// src/hooks/useGame.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { Game, Player, Round, Role } from "../types";

const uid = () => Math.random().toString(36).slice(2, 9);

interface UseGameReturn {
  game: Game | null;
  role: Role;
  isJoiner: boolean;
  loading: boolean;
  error: string | null;
  localWip: Record<string, string>;
  // derived
  totalScores: Record<string, number>;
  wipTotals: Record<string, number>;
  sortedPlayers: Player[];
  hasWip: boolean;
  // actions
  createGame: (players: Player[]) => Promise<string | null>; // returns game code
  joinGame: (code: string) => Promise<boolean>;
  setWip: (playerId: string, value: string) => void;
  lockRound: () => Promise<void>;
  editRoundScore: (roundId: string, playerId: string, value: number) => Promise<void>;
  resetGame: () => void;
}

export function useGame(): UseGameReturn {
  const [game, setGame] = useState<Game | null>(null);
  const [role, setRole] = useState<Role>("viewer");
  const [isJoiner, setIsJoiner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Local WIP mirror
  const [localWip, setLocalWip] = useState<Record<string, string>>({});
  const wipDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track when a field was last edited locally to prevent DB echoes from clobbering active typing
  const lastEdited = useRef<Record<string, number>>({});

  // Derived values
  const totalScores: Record<string, number> = {};
  const wipTotals: Record<string, number> = {};

  if (game) {
    for (const p of game.players) {
      totalScores[p.id] = game.rounds.reduce(
        (s, r) => s + (r.scores[p.id] ?? 0),
        0
      );
      wipTotals[p.id] =
        totalScores[p.id] + (parseInt(localWip[p.id] ?? "") || 0);
    }
  }

  const hasWip = Object.values(localWip).some(
    (v) => v !== "" && v !== undefined
  );
  
  const sortedPlayers = game
    ? [...game.players].sort((a, b) => wipTotals[b.id] - wipTotals[a.id])
    : [];

  const gameId = game?.id;
  // Subscribe to realtime updates for current game
  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
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
          setGame(updated);
          
          // Smart merge: Update localWip from the DB, EXCEPT for fields the user is actively typing.
          // If the user typed in a field within the last 1500ms, we assume this DB update
          // is either an echo of their own typing, or a conflicting edit that we should ignore
          // for a moment so their cursor doesn't jump.
          setLocalWip((prev) => {
            const merged: Record<string, string> = { ...prev };
            const now = Date.now();
            for (const p of updated.players) {
              const isActivelyEditing = now - (lastEdited.current[p.id] || 0) < 1500;
              if (!isActivelyEditing) {
                const remoteVal = updated.wip_scores?.[p.id];
                merged[p.id] = remoteVal !== undefined && remoteVal !== null ? String(remoteVal) : "";
              }
            }
            return merged;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const createGame = useCallback(async (players: Player[]) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("games")
        .insert({ players, rounds: [], wip_scores: {}, code: "" })
        .select()
        .single();
      if (err) throw err;
      setGame(data as Game);
      setRole("keeper");
      setIsJoiner(false);
      setLocalWip({});
      lastEdited.current = {};
      return (data as Game).code;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create game");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const joinGame = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("games")
        .select()
        .eq("code", code.toUpperCase().trim())
        .single();
      if (err || !data) throw err ?? new Error("Game not found");
      const joinedGame = data as Game;
      setGame(joinedGame);
      // We allow everyone who joins to be a keeper for now
      // TODO: Viewer-only invites later on
      setRole("keeper");
      setIsJoiner(true);
      setLocalWip(
        Object.fromEntries(
          Object.entries(joinedGame.wip_scores ?? {}).map(([k, v]) => [k, String(v)])
        )
      );
      lastEdited.current = {};
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Game not found");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const pushWipToDb = useCallback(
    async (wip: Record<string, string>) => {
      if (!game) return;
      const numericWip = Object.fromEntries(
        Object.entries(wip).map(([k, v]) => [k, parseInt(v) || 0])
      );
      await supabase
        .from("games")
        .update({ wip_scores: numericWip })
        .eq("id", game.id);
    },
    [game]
  );

  const setWip = useCallback(
    (playerId: string, value: string) => {
      lastEdited.current[playerId] = Date.now();
      setLocalWip((prev) => {
        const next = { ...prev, [playerId]: value };
        // Debounce DB write by 400ms so we don't hammer on every keystroke
        if (wipDebounce.current) clearTimeout(wipDebounce.current);
        wipDebounce.current = setTimeout(() => pushWipToDb(next), 400);
        return next;
      });
    },
    [pushWipToDb]
  );

  const lockRound = useCallback(async () => {
    if (!game) return;
    const scores: Record<string, number> = {};
    for (const p of game.players) {
      scores[p.id] = parseInt(localWip[p.id] ?? "") || 0;
    }
    const newRound: Round = { id: uid(), scores };
    const updatedRounds = [...game.rounds, newRound];
    await supabase
      .from("games")
      .update({ rounds: updatedRounds, wip_scores: {} })
      .eq("id", game.id);
    setLocalWip({});
    lastEdited.current = {};
  }, [game, localWip]);

  const editRoundScore = useCallback(
    async (roundId: string, playerId: string, value: number) => {
      if (!game) return;
      const updatedRounds = game.rounds.map((r) =>
        r.id === roundId
          ? { ...r, scores: { ...r.scores, [playerId]: value } }
          : r
      );
      await supabase
        .from("games")
        .update({ rounds: updatedRounds })
        .eq("id", game.id);
    },
    [game]
  );

  const resetGame = useCallback(() => {
    setGame(null);
    setRole("viewer");
    setIsJoiner(false);
    setLocalWip({});
    lastEdited.current = {};
    setError(null);
  }, []);

  return {
    game,
    role,
    isJoiner,
    loading,
    error,
    localWip,
    totalScores,
    wipTotals,
    sortedPlayers,
    hasWip,
    createGame,
    joinGame,
    setWip,
    lockRound,
    editRoundScore,
    resetGame,
  };
}