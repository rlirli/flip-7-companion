// src/hooks/useGame.ts
// Orchestrator hook: wraps useLocalGame with optional Supabase sync.
// All scorekeeping works offline by default.  Supabase is only touched when
// the user explicitly shares or joins a multiplayer game.

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocalGame } from "./useLocalGame";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import type { Game, Player, Role } from "../types";

export interface UseGameReturn {
  game: Game | null;
  role: Role;
  isJoiner: boolean;
  isShared: boolean;
  supabaseAvailable: boolean;
  loading: boolean;
  error: string | null;
  localWip: Record<string, string>;
  // derived
  totalScores: Record<string, number>;
  wipTotals: Record<string, number>;
  sortedPlayers: Player[];
  hasWip: boolean;
  // actions
  createGame: (players: Player[]) => void;
  joinGame: (code: string) => Promise<boolean>;
  shareGame: () => Promise<string | null>;
  setWip: (playerId: string, value: string) => void;
  lockRound: () => void;
  editRoundScore: (roundId: string, playerId: string, value: number) => void;
  leaveGame: () => void;
  resetGame: () => void;
}

export function useGame(): UseGameReturn {
  const local = useLocalGame();

  const [role, setRole] = useState<Role>("viewer");
  const [isJoiner, setIsJoiner] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      const code = new URLSearchParams(window.location.search).get("code");
      return !!code;
    }
    return false;
  });
  const [error, setError] = useState<string | null>(null);

  // Refs for values used inside callbacks / timers
  const isSharedRef = useRef(false);
  useEffect(() => { isSharedRef.current = isShared; }, [isShared]);

  // Track when a wip field was last edited locally (prevents realtime echoes
  // from clobbering active typing)
  const lastEdited = useRef<Record<string, number>>({});
  const wipDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundsSyncDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabaseAvailable = isSupabaseConfigured();

  // ── URL helpers ─────────────────────────────────────────────────

  const updateUrlCode = useCallback((code: string | null) => {
    const url = new URL(window.location.href);
    if (code) {
      url.searchParams.set("code", code);
    } else {
      url.searchParams.delete("code");
    }
    window.history.replaceState({}, "", url.toString());
  }, []);

  // ── Realtime subscription (only when shared) ───────────────────

  const gameId = local.game?.id;

  useEffect(() => {
    if (!isShared || !gameId) return;

    let sb;
    try {
      sb = getSupabase();
    } catch {
      return;
    }

    const channel = sb
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updated = payload.new as Game;
          local.replaceGame(updated);

          // Smart merge: don't overwrite fields the user is actively typing
          const now = Date.now();
          const prev = local.localWipRef.current;
          const merged: Record<string, string> = { ...prev };
          for (const p of updated.players) {
            const isActivelyEditing =
              now - (lastEdited.current[p.id] || 0) < 1500;
            if (!isActivelyEditing) {
              const remoteVal = updated.wip_scores?.[p.id];
              merged[p.id] =
                remoteVal !== undefined && remoteVal !== null
                  ? String(remoteVal)
                  : "";
            }
          }
          local.replaceLocalWip(merged);
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [isShared, gameId, local]);

  // ── DB sync helpers ─────────────────────────────────────────────

  const pushWipToDb = useCallback(() => {
    const g = local.gameRef.current;
    if (!isSharedRef.current || !g) return;
    try {
      const sb = getSupabase();
      const numericWip = Object.fromEntries(
        Object.entries(local.localWipRef.current).map(([k, v]) => [
          k,
          parseInt(v) || 0,
        ])
      );
      sb.from("games")
        .update({ wip_scores: numericWip })
        .eq("id", g.id)
        .then();
    } catch {
      /* offline / snoozed — silently ignore */
    }
  }, [local]);

  const pushRoundsToDb = useCallback(() => {
    const g = local.gameRef.current;
    if (!isSharedRef.current || !g) return;
    try {
      const sb = getSupabase();
      sb.from("games")
        .update({ rounds: g.rounds })
        .eq("id", g.id)
        .then();
    } catch {
      /* offline / snoozed */
    }
  }, [local]);

  // ── Public actions ──────────────────────────────────────────────

  const createGame = useCallback(
    (players: Player[]) => {
      setError(null);
      local.createGame(players);
      setRole("keeper");
      setIsJoiner(false);
      setIsShared(false);
      lastEdited.current = {};
      updateUrlCode(null);
    },
    [local, updateUrlCode]
  );

  const shareGame = useCallback(async (): Promise<string | null> => {
    const g = local.gameRef.current;
    if (!g) return null;
    setLoading(true);
    setError(null);
    try {
      const sb = getSupabase();
      const { data, error: err } = await sb
        .from("games")
        .insert({
          players: g.players,
          rounds: g.rounds,
          wip_scores: g.wip_scores,
          code: "",
        })
        .select()
        .single();
      if (err) throw err;

      const shared = data as Game;
      local.replaceGame(shared);
      setIsShared(true);
      updateUrlCode(shared.code!);
      return shared.code!;
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to share game"
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [local, updateUrlCode]);

  const joinGame = useCallback(
    async (code: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const sb = getSupabase();
        const { data, error: err } = await sb
          .from("games")
          .select()
          .eq("code", code.toUpperCase().trim())
          .single();
        if (err || !data) throw err ?? new Error("Game not found");

        const joinedGame = data as Game;
        local.replaceGame(joinedGame);
        local.replaceLocalWip(
          Object.fromEntries(
            Object.entries(joinedGame.wip_scores ?? {}).map(([k, v]) => [
              k,
              String(v),
            ])
          )
        );
        setRole("keeper");
        setIsJoiner(true);
        setIsShared(true);
        lastEdited.current = {};
        updateUrlCode(joinedGame.code!);
        return true;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Game not found");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [local, updateUrlCode]
  );

  // Auto-join if URL has ?code=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    let ignore = false;
    const autoJoin = async () => {
      if (!isSupabaseConfigured()) {
        if (!ignore) {
          setError("Shared games are unavailable — the server may be paused.");
          setLoading(false);
          updateUrlCode(null);
        }
        return;
      }

      try {
        const sb = getSupabase();
        const { data, error: err } = await sb
          .from("games")
          .select()
          .eq("code", code.toUpperCase().trim())
          .single();
        if (err || !data) throw err ?? new Error("Game not found");
        if (!ignore) {
          const joinedGame = data as Game;
          local.replaceGame(joinedGame);
          local.replaceLocalWip(
            Object.fromEntries(
              Object.entries(joinedGame.wip_scores ?? {}).map(([k, v]) => [
                k,
                String(v),
              ])
            )
          );
          setRole("keeper");
          setIsJoiner(true);
          setIsShared(true);
          lastEdited.current = {};
          updateUrlCode(joinedGame.code!);
        }
      } catch (e: unknown) {
        if (!ignore) {
          setError(e instanceof Error ? e.message : "Game not found");
          updateUrlCode(null);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    autoJoin();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Wrapped mutations (add DB sync when shared) ─────────────────

  const setWip = useCallback(
    (playerId: string, value: string) => {
      lastEdited.current[playerId] = Date.now();
      local.setWip(playerId, value);

      if (isSharedRef.current) {
        if (wipDebounce.current) clearTimeout(wipDebounce.current);
        wipDebounce.current = setTimeout(pushWipToDb, 400);
      }
    },
    [local, pushWipToDb]
  );

  const lockRound = useCallback(() => {
    const patch = local.lockRound();
    lastEdited.current = {};

    if (patch && isSharedRef.current) {
      const g = local.gameRef.current;
      if (g) {
        try {
          const sb = getSupabase();
          sb.from("games")
            .update({ rounds: patch.rounds, wip_scores: patch.wip_scores })
            .eq("id", g.id)
            .then();
        } catch {
          /* offline */
        }
      }
    }
  }, [local]);

  const editRoundScore = useCallback(
    (roundId: string, playerId: string, value: number) => {
      local.editRoundScore(roundId, playerId, value);

      if (isSharedRef.current) {
        if (roundsSyncDebounce.current)
          clearTimeout(roundsSyncDebounce.current);
        roundsSyncDebounce.current = setTimeout(pushRoundsToDb, 400);
      }
    },
    [local, pushRoundsToDb]
  );

  const resetGame = useCallback(() => {
    const gameIdNow = local.gameRef.current?.id;
    local.resetGame();
    lastEdited.current = {};

    if (isSharedRef.current && gameIdNow) {
      try {
        const sb = getSupabase();
        sb.from("games")
          .update({ rounds: [], wip_scores: {} })
          .eq("id", gameIdNow)
          .then();
      } catch {
        /* offline */
      }
    }
  }, [local]);

  const leaveGame = useCallback(() => {
    local.leaveGame();
    setRole("viewer");
    setIsJoiner(false);
    setIsShared(false);
    lastEdited.current = {};
    setError(null);
    updateUrlCode(null);
  }, [local, updateUrlCode]);

  return {
    game: local.game,
    role,
    isJoiner,
    isShared,
    supabaseAvailable,
    loading,
    error,
    localWip: local.localWip,
    totalScores: local.totalScores,
    wipTotals: local.wipTotals,
    sortedPlayers: local.sortedPlayers,
    hasWip: local.hasWip,
    createGame,
    joinGame,
    shareGame,
    setWip,
    lockRound,
    editRoundScore,
    leaveGame,
    resetGame,
  };
}