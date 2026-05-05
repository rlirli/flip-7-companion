
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
    createGame, joinGame, setWip, lockRound, editRoundScore, leaveGame, resetGame,
  } = useGame();

  type ModalType = "leave" | "reset" | null;
  const [view, setView] = useState<ViewMode | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Default view: Joiners see standings first, Creators see entry first. 
  // Future viewers are locked to standings unless they change it (if permitted).
  let effectiveView: ViewMode = view ?? (isJoiner ? "score" : "entry");
  if (role === "viewer" && effectiveView === "entry") {
    effectiveView = "score";
  }

  const phase = game ? "game" : "setup";

  // Use the fast local mirror for immediate keystroke feedback
  const displayWip = localWip;

  const handleShare = async () => {
    if (!game) return;
    const url = window.location.href; // will include ?code=XYZ
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Flip 7 Companion",
          text: `Join my Flip 7 game!`,
          url: url,
        });
        return;
      } catch (err) {
        // If user aborts, do nothing. If it fails, fallback to clipboard.
        if ((err as Error).name === "AbortError") return;
      }
    }
    
    // Fallback
    navigator.clipboard.writeText(url);
    alert("Link copied to clipboard!");
  };

  return (
    <>
      <Header
        phase={phase}
        view={effectiveView}
        roundNumber={(game?.rounds.length ?? 0) + 1}
        onViewChange={setView}
        onHomeClick={() => {
          if (game) setActiveModal("leave");
        }}
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="share-copy"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert("Link copied to clipboard!");
                  }}
                >
                  Copy
                </button>
                <button
                  className="share-copy"
                  onClick={handleShare}
                >
                  Share
                </button>
              </div>
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
              onNewGame={() => setActiveModal("reset")}
            />
          )}
        </>
      )}

      {activeModal === "leave" && (
        <Modal
          title="Leave Game?"
          subtitle="Are you sure you want to exit the current game lobby?"
          onClose={() => setActiveModal(null)}
        >
          <div className="modal-actions">
            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setActiveModal(null)}
            >
              Cancel
            </button>
            <button
              className="btn-secondary btn-danger"
              style={{ flex: 1 }}
              onClick={() => { leaveGame(); setActiveModal(null); }}
            >
              Yes, Leave
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "reset" && (
        <Modal
          title="Start Over?"
          subtitle="This will erase all rounds and reset the score to 0 for everyone in the lobby."
          onClose={() => setActiveModal(null)}
        >
          <div className="modal-actions">
            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setActiveModal(null)}
            >
              Cancel
            </button>
            <button
              className="btn-secondary btn-danger"
              style={{ flex: 1 }}
              onClick={() => { resetGame(); setActiveModal(null); }}
            >
              Yes, Reset
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}