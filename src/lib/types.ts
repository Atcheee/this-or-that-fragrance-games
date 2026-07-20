export type WearOccasion =
  | "winter"
  | "spring"
  | "summer"
  | "fall"
  | "day"
  | "night";

export interface Fragrance {
  id: string;
  name: string;
  house: string;
  year: number;
  /** Community rating, 0–5 */
  rating: number;
  /** Approximate retail price in USD for ~100ml */
  price: number;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  accords: string[];
  description: string;
  /** Community vote count (popularity signal), when known */
  votes?: number;
  /** Bottle image URL when known (Fragella / Fraganty CDN) */
  imageUrl?: string;
  /** Longevity label when known (e.g. Long Lasting) */
  longevity?: string;
  /** Sillage / projection label when known */
  sillage?: string;
  /**
   * Normalized when-to-wear shares (0–1). Prefer API rankings when present;
   * otherwise derived from accords at catalog build time.
   */
  wear?: Partial<Record<WearOccasion, number>>;
}

export type GameModeId =
  | "higher-rating"
  | "cost-more"
  | "contains-note"
  | "has-accord"
  | "which-house"
  | "guess-description"
  | "find-favorite"
  | "perfect-match"
  | "name-by-house"
  | "name-by-note"
  | "connections-curated"
  | "connections-generated"
  | "connections-daily";

export type GameKind =
  | "this-or-that"
  | "yes-no"
  | "multiple-choice"
  | "bracket"
  | "discovery"
  | "naming"
  | "connections";

export interface GameModeMeta {
  id: GameModeId;
  kind: GameKind;
  title: string;
  tagline: string;
  /** Instructions shown on the setup screen */
  howTo: string;
}

export interface GameRecord {
  mode: GameModeId;
  /** Correct answers (or names found / bracket winner rounds) */
  score: number;
  /** Total rounds (for naming modes: number of possible answers) */
  total: number;
  /** ISO date string */
  playedAt: string;
  /** Extra label, e.g. bracket winner name or naming subject */
  label?: string;
}

export type ConnectionDifficulty = "yellow" | "green" | "blue" | "purple";

export type ConnectionMatch =
  | { kind: "house"; value: string }
  | { kind: "note"; value: string }
  | { kind: "accord"; value: string; maxIndex?: number }
  | { kind: "year-range"; min: number; max: number }
  | { kind: "longevity"; value: string }
  | { kind: "sillage"; value: string }
  | { kind: "curated" };

export interface ConnectionGroup {
  id: string;
  label: string;
  difficulty: ConnectionDifficulty;
  fragranceIds: [string, string, string, string];
  match: ConnectionMatch;
}

export interface ConnectionPuzzle {
  id: string;
  groups: [ConnectionGroup, ConnectionGroup, ConnectionGroup, ConnectionGroup];
}

export function allNotes(f: Fragrance): string[] {
  return [...f.topNotes, ...f.heartNotes, ...f.baseNotes];
}
