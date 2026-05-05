
import { useState } from "react";
import type { Player } from "../types";

const uid = () => Math.random().toString(36).slice(2, 9);

interface SetupProps {
  loading: boolean;
  error: string | null;
  onCreateGame: (players: Player[]) => void;
  onJoinGame: (code: string) => void;
}

export function Setup({ loading, error, onCreateGame, onJoinGame }: SetupProps) {
  const [tab, setTab] = useState<"create" | "join">(() => 
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("code") ? "join" : "create"
  );
  const [players, setPlayers] = useState<Player[]>([
    { id: uid(), name: "Player 1" },
    { id: uid(), name: "Player 2" },
    { id: uid(), name: "Player 3" },
  ]);
  const [joinCode, setJoinCode] = useState(() => {
    if (typeof window !== "undefined") {
      const c = new URLSearchParams(window.location.search).get("code");
      return c ? c.toUpperCase() : "";
    }
    return "";
  });

  const addPlayer = () =>
    setPlayers((p) => [...p, { id: uid(), name: `Player ${p.length + 1}` }]);
  const removePlayer = (id: string) =>
    setPlayers((p) => p.filter((x) => x.id !== id));
  const updateName = (id: string, name: string) =>
    setPlayers((p) => p.map((x) => (x.id === id ? { ...x, name } : x)));

  const handleCreate = () => {
    const clean = players.filter((p) => p.name.trim());
    if (clean.length >= 2) onCreateGame(clean);
  };

  const handleJoin = () => {
    if (joinCode.trim().length >= 4) onJoinGame(joinCode.trim());
  };

  return (
    <div className="setup-screen">
      <h1 className="setup-title">Flip 7</h1>
      <p className="setup-sub">Press your luck. Track your score.</p>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>{tab === "join" ? "Joining game..." : "Creating game..."}</p>
        </div>
      ) : (
        <>
          <div className="setup-tabs">
            <button
              className={`setup-tab ${tab === "create" ? "active" : ""}`}
              onClick={() => setTab("create")}
            >
              New Game
            </button>
            <button
              className={`setup-tab ${tab === "join" ? "active" : ""}`}
              onClick={() => setTab("join")}
            >
              Join Game
            </button>
          </div>

          {tab === "create" && (
            <>
              <div className="player-list">
                {players.map((p, i) => (
                  <div key={p.id} className="player-input-row">
                    <span className="player-num">{i + 1}</span>
                    <input
                      className="player-input"
                      value={p.name}
                      onChange={(e) => updateName(p.id, e.target.value)}
                      placeholder={`Player ${i + 1}`}
                      maxLength={20}
                    />
                    {players.length > 2 && (
                      <button
                        className="btn-icon"
                        onClick={() => removePlayer(p.id)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button className="btn-add" onClick={addPlayer}>
                + Add player
              </button>
              <button
                className="btn-primary"
                onClick={handleCreate}
                disabled={players.filter((p) => p.name.trim()).length < 2}
              >
                Start Game
              </button>
            </>
          )}

          {tab === "join" && (
            <>
              <div className="join-input-wrap">
                <input
                  className="join-input"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="FLIP-XXXXXX"
                  maxLength={11}
                  autoCapitalize="characters"
                />
              </div>
              <button
                className="btn-primary"
                onClick={handleJoin}
                disabled={joinCode.trim().length < 4}
              >
                Join Game
              </button>
            </>
          )}
        </>
      )}

      {error && <div className="error-msg">{error}</div>}
    </div>
  );
}