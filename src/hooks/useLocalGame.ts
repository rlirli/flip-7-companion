// src/hooks/useLocalGame.ts
// Pure-local scorekeeper state — zero network calls.
// This is the single-player default; useGame wraps it and optionally adds
// Supabase sync for shared/multiplayer sessions.

import { useState, useEffect, useCallback, useRef } from "react";
import type { Game, Player, Round } from "../types";

const uid = () => Math.random().toString(36).slice(2, 9);

export interface UseLocalGameReturn {
  // State
  game: Game | null;
  localWip: Record<string, string>;

  // Refs (for the sync layer to read latest values synchronously)
  gameRef: React.RefObject<Game | null>;
  localWipRef: React.RefObject<Record<string, string>>;

  // Derived
  totalScores: Record<string, number>;
  wipTotals: Record<string, number>;
  sortedPlayers: Player[];
  hasWip: boolean;

  // Actions
  createGame: (players: Player[]) => Game;
  setWip: (playerId: string, value: string) => void;
  lockRound: () => { rounds: Round[]; wip_scores: Record<string, number> } | null;
  editRoundScore: (roundId: string, playerId: string, value: number) => void;
  resetGame: () => void;
  leaveGame: () => void;

  // Escape hatches for the shared-game sync layer
  replaceGame: (game: Game) => void;
  replaceLocalWip: (wip: Record<string, string>) => void;
}

export function useLocalGame(): UseLocalGameReturn {
  const [game, setGame] = useState<Game | null>(null);
  const [localWip, setLocalWip] = useState<Record<string, string>>({});

  // Keep refs in sync for synchronous reads by the sync layer
  const gameRef = useRef<Game | null>(game);
  useEffect(() => { gameRef.current = game; }, [game]);

  const localWipRef = useRef<Record<string, string>>(localWip);
  useEffect(() => { localWipRef.current = localWip; }, [localWip]);

  // ── Derived values ──────────────────────────────────────────────

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

  // ── Actions ─────────────────────────────────────────────────────

  const createGame = useCallback((players: Player[]): Game => {
    const newGame: Game = {
      id: uid(),
      players,
      rounds: [],
      wip_scores: {},
    };
    setGame(newGame);
    gameRef.current = newGame;
    setLocalWip({});
    localWipRef.current = {};
    return newGame;
  }, []);

  const setWip = useCallback((playerId: string, value: string) => {
    setLocalWip((prev) => {
      const next = { ...prev, [playerId]: value };
      localWipRef.current = next;
      return next;
    });
  }, []);

  const lockRound = useCallback((): { rounds: Round[]; wip_scores: Record<string, number> } | null => {
    const g = gameRef.current;
    const wip = localWipRef.current;
    if (!g) return null;

    const scores: Record<string, number> = {};
    for (const p of g.players) {
      scores[p.id] = parseInt(wip[p.id] ?? "") || 0;
    }
    const newRound: Round = { id: uid(), scores };
    const updatedRounds = [...g.rounds, newRound];

    const updatedGame = { ...g, rounds: updatedRounds, wip_scores: {} };
    setGame(updatedGame);
    gameRef.current = updatedGame;
    setLocalWip({});
    localWipRef.current = {};

    return { rounds: updatedRounds, wip_scores: {} };
  }, []);

  const editRoundScore = useCallback(
    (roundId: string, playerId: string, value: number) => {
      setGame((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          rounds: prev.rounds.map((r) =>
            r.id === roundId
              ? { ...r, scores: { ...r.scores, [playerId]: value } }
              : r
          ),
        };
        gameRef.current = updated;
        return updated;
      });
    },
    []
  );

  const resetGame = useCallback(() => {
    setGame((prev) => {
      if (!prev) return null;
      const updated = { ...prev, rounds: [], wip_scores: {} };
      gameRef.current = updated;
      return updated;
    });
    setLocalWip({});
    localWipRef.current = {};
  }, []);

  const leaveGame = useCallback(() => {
    setGame(null);
    gameRef.current = null;
    setLocalWip({});
    localWipRef.current = {};
  }, []);

  // ── Sync escape hatches ─────────────────────────────────────────

  const replaceGame = useCallback((g: Game) => {
    setGame(g);
    gameRef.current = g;
  }, []);

  const replaceLocalWip = useCallback((wip: Record<string, string>) => {
    setLocalWip(wip);
    localWipRef.current = wip;
  }, []);

  return {
    game,
    localWip,
    gameRef,
    localWipRef,
    totalScores,
    wipTotals,
    sortedPlayers,
    hasWip,
    createGame,
    setWip,
    lockRound,
    editRoundScore,
    resetGame,
    leaveGame,
    replaceGame,
    replaceLocalWip,
  };
}
