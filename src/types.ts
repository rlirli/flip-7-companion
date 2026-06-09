
export interface Player {
  id: string;
  name: string;
}

export interface Round {
  id: string;
  scores: Record<string, number>; // playerId -> points
}

export interface Game {
  id: string;
  code?: string;                              // only set once shared via Supabase
  players: Player[];
  rounds: Round[];
  wip_scores: Record<string, number>;         // playerId -> points (live, unlocked)
  created_at?: string;                        // DB-only
  updated_at?: string;                        // DB-only
}

export type ViewMode = "score" | "entry";
export type Role = "keeper" | "viewer"; // keeper = creator, viewer = joined via code