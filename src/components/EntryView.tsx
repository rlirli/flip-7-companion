// src/components/EntryView.tsx
import { useState } from "react";
import type { Player, Round } from "../types";
import { WINNING_SCORE } from "../constants";

interface EntryViewProps {
  players: Player[];
  rounds: Round[];
  roundNumber: number;
  totalScores: Record<string, number>;
  wipTotals: Record<string, number>;
  localWip: Record<string, string>;
  hasWip: boolean;
  sortedPlayers: Player[];
  role: "keeper" | "viewer";
  onSetWip: (pid: string, val: string) => void;
  onLockRound: () => void;
  onEditRoundScore: (roundId: string, pid: string, val: number) => void;
  onNewGame: () => void;
}

function DebouncedScoreInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  const [localVal, setLocalVal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    setLocalVal(value);
  }

  return (
    <input
      type="number"
      className="editable-score"
      value={localVal}
      onChange={(e) => {
        const val = parseInt(e.target.value) || 0;
        setLocalVal(val);
        onChange(val);
      }}
      inputMode="numeric"
    />
  );
}

export function EntryView({
  players,
  rounds,
  roundNumber,
  totalScores,
  wipTotals,
  localWip,
  hasWip,
  sortedPlayers,
  role,
  onSetWip,
  onLockRound,
  onEditRoundScore,
  onNewGame,
}: EntryViewProps) {
  const isKeeper = role === "keeper";

  return (
    <div className="game-screen">
      {/* Mini leaderboard strip */}
      <div className="leaderboard-strip">
        {sortedPlayers.map((p, i) => {
          const locked = totalScores[p.id] ?? 0;
          const wip = parseInt(localWip[p.id] ?? "") || 0;
          const projected = wipTotals[p.id] ?? locked;
          return (
            <div key={p.id} className={`leader-card rank-${i + 1}${projected >= WINNING_SCORE ? ' near-win' : ''}`}>
              <div className="leader-rank">#{i + 1}</div>
              <div className="leader-name">{p.name}</div>
              <div className="leader-score">{locked}</div>
              {hasWip && wip !== 0 && (
                <div className="leader-score-wip">→ {projected}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Round entry */}
      <div className="round-section">
        <div className="round-header">
          <span className="round-label">Round {roundNumber}</span>
          {isKeeper && (
            <button className="btn-end-round" onClick={onLockRound}>
              Lock Round ✓
            </button>
          )}
        </div>
        <div className="entry-list">
          {players.map((p) => {
            const locked = totalScores[p.id] ?? 0;
            const wip = parseInt(localWip[p.id] ?? "") || 0;
            const projected = wipTotals[p.id] ?? locked;
            const hasThisWip =
              localWip[p.id] !== "" && localWip[p.id] !== undefined;
            return (
              <div key={p.id} className={`entry-row${projected >= WINNING_SCORE ? ' near-win' : ''}`}>
                <div className="entry-left">
                  <div className="entry-player-name">{p.name}</div>
                  <div className="entry-sub">
                    {hasThisWip && wip !== 0 ? (
                      <span>
                        {locked}{" "}
                        <span className="wip-highlight">
                          +{wip} = {projected}
                        </span>
                      </span>
                    ) : (
                      <span>{locked}</span>
                    )}
                  </div>
                </div>
                {isKeeper ? (
                  <input
                    type="number"
                    className="entry-input"
                    value={localWip[p.id] ?? ""}
                    onChange={(e) => onSetWip(p.id, e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                  />
                ) : (
                  <div className="entry-input-readonly">
                    {localWip[p.id] || "—"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* History */}
      {rounds.length > 0 && (
        <>
          <div className="history-title">Score History</div>
          <div className="history-table">
            <div
              className="history-row header-row"
              style={{
                gridTemplateColumns: `48px repeat(${players.length}, 1fr)`,
              }}
            >
              <div className="history-cell round-col header">Rnd</div>
              {players.map((p) => (
                <div
                  key={p.id}
                  className="history-cell header"
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 10,
                  }}
                >
                  {p.name}
                </div>
              ))}
            </div>
            {rounds.map((round, ri) => (
              <div
                key={round.id}
                className="history-row"
                style={{
                  gridTemplateColumns: `48px repeat(${players.length}, 1fr)`,
                }}
              >
                <div className="history-cell round-col">{ri + 1}</div>
                {players.map((p) => (
                  <div key={p.id} className="history-cell">
                    {isKeeper ? (
                      <DebouncedScoreInput
                        value={round.scores[p.id] ?? 0}
                        onChange={(val) => onEditRoundScore(round.id, p.id, val)}
                      />
                    ) : (
                      <span>{round.scores[p.id] ?? 0}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
            <div
              className="history-row total-highlight"
              style={{
                gridTemplateColumns: `48px repeat(${players.length}, 1fr)`,
              }}
            >
              <div
                className="history-cell round-col"
                style={{ color: "var(--gold-dim)", fontSize: 10 }}
              >
                Σ
              </div>
              {players.map((p) => (
                <div key={p.id} className="history-cell total-row">
                  {totalScores[p.id] ?? 0}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {rounds.length === 0 && (
        <div className="empty-history">
          Enter scores above — history will appear here
        </div>
      )}

      {isKeeper && (
        <div className="action-bar">
          <button className="btn-secondary btn-danger" onClick={onNewGame}>
            New Game
          </button>
        </div>
      )}
    </div>
  );
}