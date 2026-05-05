
import type { ViewMode } from "../types";

interface HeaderProps {
  phase: "setup" | "game";
  view: ViewMode;
  roundNumber: number;
  onViewChange: (v: ViewMode) => void;
  onHomeClick?: () => void;
}

export function Header({ phase, view, roundNumber, onViewChange, onHomeClick }: HeaderProps) {
  return (
    <header className="header">
      <div 
        className="logo" 
        onClick={onHomeClick}
        style={onHomeClick ? { cursor: 'pointer' } : undefined}
      >
        <span className="logo-text">Flip 7</span>
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