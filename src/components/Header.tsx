
import type { ViewMode } from "../types";

interface HeaderProps {
  phase: "setup" | "game";
  view: ViewMode;
  roundNumber: number;
  onViewChange: (v: ViewMode) => void;
}

export function Header({ phase, view, roundNumber, onViewChange }: HeaderProps) {
  return (
    <header className="header">
      <div className="logo">
        <span className="logo-text">Flip 7</span>
        <span className="logo-badge">Score</span>
      </div>
      <div className="header-right">
        {phase === "game" && (
          <>
            <span className="round-indicator">Rnd {roundNumber}</span>
            <div className="view-toggle">
              <button
                className={`toggle-btn ${view === "score" ? "active" : ""}`}
                onClick={() => onViewChange("score")}
              >
                Standings
              </button>
              <button
                className={`toggle-btn ${view === "entry" ? "active" : ""}`}
                onClick={() => onViewChange("entry")}
              >
                Entry
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}