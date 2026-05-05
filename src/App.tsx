
import { useState } from "react";
import { useGame } from "./hooks/useGame";
import { Header } from "./components/Header";
import { Setup } from "./components/Setup";
import { StandingsView } from "./components/StandingsView";
import { EntryView } from "./components/EntryView";
import { Modal } from "./components/Modal";
import type { ViewMode } from "./types";

export default function App() {
  const {
    game, role, isJoiner, loading, error, localWip,
    totalScores, wipTotals, sortedPlayers, hasWip,
    createGame, joinGame, setWip, lockRound, editRoundScore, resetGame,
  } = useGame();

  const [view, setView] = useState<ViewMode | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Default view: Joiners see standings first, Creators see entry first. 
  // Future viewers are locked to standings unless they change it (if permitted).
  let effectiveView: ViewMode = view ?? (isJoiner ? "score" : "entry");
  if (role === "viewer" && effectiveView === "entry") {
    effectiveView = "score";
  }

  const phase = game ? "game" : "setup";

  // Use the fast local mirror for immediate keystroke feedback
  const displayWip = localWip;

  return (
    <>
      <Header
        phase={phase}
        view={effectiveView}
        roundNumber={(game?.rounds.length ?? 0) + 1}
        onViewChange={setView}
      />

      {phase === "setup" && (
        <Setup
          loading={loading}
          error={error}
          onCreateGame={createGame}
          onJoinGame={joinGame}
        />
      )}

      {phase === "game" && game && (
        <>
          {/* Share code banner */}
          {role === "keeper" && (
            <div className="share-banner">
              <span className="share-label">Share code</span>
              <span className="share-code">{game.code}</span>
              <button
                className="share-copy"
                onClick={() => navigator.clipboard.writeText(game.code)}
              >
                Copy
              </button>
            </div>
          )}

          {effectiveView === "score" && (
            <StandingsView
              sortedPlayers={sortedPlayers}
              totalScores={totalScores}
              wipTotals={wipTotals}
              localWip={displayWip}
              hasWip={hasWip}
            />
          )}

          {effectiveView === "entry" && (
            <EntryView
              players={game.players}
              rounds={game.rounds}
              roundNumber={game.rounds.length + 1}
              totalScores={totalScores}
              wipTotals={wipTotals}
              localWip={displayWip}
              hasWip={hasWip}
              sortedPlayers={sortedPlayers}
              role={role}
              onSetWip={setWip}
              onLockRound={lockRound}
              onEditRoundScore={editRoundScore}
              onNewGame={() => setConfirmReset(true)}
            />
          )}
        </>
      )}

      {confirmReset && (
        <Modal
          title="Start Over?"
          subtitle="This will end the current game for everyone."
          onClose={() => setConfirmReset(false)}
        >
          <div className="modal-actions">
            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setConfirmReset(false)}
            >
              Cancel
            </button>
            <button
              className="btn-secondary btn-danger"
              style={{ flex: 1 }}
              onClick={() => { resetGame(); setConfirmReset(false); }}
            >
              Yes, Reset
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}