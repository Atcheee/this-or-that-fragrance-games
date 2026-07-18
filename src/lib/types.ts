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
}

export type GameModeId =
  | "higher-rating"
  | "cost-more"
  | "contains-note"
  | "has-accord"
  | "which-house"
  | "guess-description"
  | "find-favorite"
  | "name-by-house"
  | "name-by-note";

export type GameKind =
  | "this-or-that"
  | "yes-no"
  | "multiple-choice"
  | "bracket"
  | "naming";

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

export function allNotes(f: Fragrance): string[] {
  return [...f.topNotes, ...f.heartNotes, ...f.baseNotes];
}
