
import type { Player } from "../types";

interface StandingsViewProps {
  sortedPlayers: Player[];
  totalScores: Record<string, number>;
  wipTotals: Record<string, number>;
  localWip: Record<string, string>;
  hasWip: boolean;
}

export function StandingsView({
  sortedPlayers,
  totalScores,
  wipTotals,
  localWip,
  hasWip,
}: StandingsViewProps) {
  return (
    <div className="leaderboard-full">
      {sortedPlayers.map((p, i) => {
        const locked = totalScores[p.id] ?? 0;
        const wip = parseInt(localWip[p.id] ?? "") || 0;
        const projected = wipTotals[p.id] ?? locked;
        return (
          <div key={p.id} className={`lb-row${i === 0 ? " lb-top" : ""}`}>
            <div className={`lb-rank-num${i === 0 ? " gold" : ""}`}>
              {i === 0 ? "♛" : `#${i + 1}`}
            </div>
            <div className="lb-player-name">{p.name}</div>
            <div className="lb-scores">
              <div className="lb-locked-score">{locked}</div>
              {hasWip && (
                <div className="lb-wip-line">
                  {wip !== 0 ? (
                    <>
                      <span className="wip-delta">+{wip}</span>
                      <span className="wip-arrow">→</span>
                      <span className="wip-total">{projected}</span>
                    </>
                  ) : (
                    <span style={{ opacity: 0.3 }}>—</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}