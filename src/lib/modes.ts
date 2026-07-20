import type { GameModeId, GameModeMeta } from "./types";

const CONNECTIONS_MODE: GameModeMeta = {
  id: "connections-curated",
  kind: "connections",
  title: "Fragrance Connections",
  tagline: "Choose a hand-crafted or freshly generated puzzle.",
  howTo:
    "Choose a puzzle mode, then sort 16 fragrances into four connected groups. Select four at a time and submit the strongest connection.",
};

export const MODES: GameModeMeta[] = [
  {
    id: "higher-rating",
    kind: "this-or-that",
    title: "Higher Rating",
    tagline: "Which fragrance does the community rate higher?",
    howTo: "Two fragrances are shown. Pick the one with the higher community rating.",
  },
  {
    id: "cost-more",
    kind: "this-or-that",
    title: "Does It Cost More?",
    tagline: "Pick the pricier bottle.",
    howTo: "Two fragrances are shown. Pick the one with the higher retail price (per ~100ml).",
  },
  {
    id: "contains-note",
    kind: "yes-no",
    title: "Contains This Note?",
    tagline: "Yes or no: is the note in the pyramid?",
    howTo: "A fragrance and a note are shown. Answer whether the note appears anywhere in its pyramid.",
  },
  {
    id: "has-accord",
    kind: "yes-no",
    title: "Has This Main Accord?",
    tagline: "Yes or no: is it a main accord?",
    howTo: "A fragrance and an accord are shown. Answer whether it is one of the fragrance's main accords.",
  },
  {
    id: "which-house",
    kind: "multiple-choice",
    title: "Which House?",
    tagline: "Match the fragrance to its house.",
    howTo: "A fragrance is shown. Pick the house it belongs to from four options.",
  },
  {
    id: "guess-description",
    kind: "multiple-choice",
    title: "Guess From Description",
    tagline: "Name and house redacted — can you tell?",
    howTo: "Read a description with the fragrance name and house blacked out, then pick the right fragrance from four options.",
  },
  {
    id: "find-favorite",
    kind: "bracket",
    title: "Find Your Favorite",
    tagline: "A knockout bracket. Your taste decides.",
    howTo: "Fragrances face off two at a time. Pick your preference each round until one favorite remains. No wrong answers here.",
  },
  {
    id: "perfect-match",
    kind: "discovery",
    title: "Find Your Perfect Fragrance",
    tagline: "Answer a few questions — we'll narrow the catalog to your taste.",
    howTo:
      "Choose what you want back (one favorite, a top 10, or your preferred notes & accords), set any limits, then answer short preference questions. No wrong answers.",
  },
  {
    id: "name-by-house",
    kind: "naming",
    title: "Name That House's Fragrances",
    tagline: "Type as many as you can before time runs out.",
    howTo: "You get a fragrance house and a timer. Type as many of its fragrances as you can remember.",
  },
  {
    id: "name-by-note",
    kind: "naming",
    title: "Name Fragrances With a Note",
    tagline: "How many can you list with this note?",
    howTo: "You get a note and a timer. Type as many fragrances containing that note as you can.",
  },
  CONNECTIONS_MODE,
  {
    id: "connections-daily",
    kind: "connections",
    title: "Daily Connections",
    tagline: "One shared fragrance puzzle every UTC day.",
    howTo:
      "Solve today's shared puzzle in one resumable attempt. Your progress is saved, and a new puzzle arrives at midnight UTC.",
  },
];

export function getMode(id: string): GameModeMeta | undefined {
  if (id === "connections-generated") {
    return { ...CONNECTIONS_MODE, id };
  }
  return MODES.find((m) => m.id === id);
}

export function isGameModeId(id: string): id is GameModeId {
  return getMode(id) !== undefined;
}
