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
    tagline: "King of the hill — keep the higher-rated bottle alive.",
    howTo:
      "Two fragrances face off. Pick the higher community rating — the correct one stays as champion while the other is replaced. Keep going until the rounds run out.",
  },
  {
    id: "cost-more",
    kind: "this-or-that",
    title: "Does It Cost More?",
    tagline: "King of the hill — keep the pricier bottle alive.",
    howTo:
      "Two fragrances face off. Pick the higher retail price (per ~100ml) — the correct one stays as champion while the other is replaced. Keep going until the rounds run out.",
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
  {
    id: "note-pyramid",
    kind: "note-pyramid",
    title: "Note Pyramid",
    tagline: "Identify a fragrance as its clues unfold.",
    howTo:
      "Guess the exact fragrance from progressively revealed base, heart, top, accord, year, and house clues. Earlier answers score more.",
  },
  {
    id: "fragrance-grid",
    kind: "fragrance-grid",
    title: "Fragrance Grid",
    tagline: "Find nine fragrances at the intersections.",
    howTo:
      "Fill every cell with a unique fragrance matching both its row and column criteria. Wrong answers consume an attempt.",
  },
  {
    id: "odd-one-out",
    kind: "odd-one-out",
    title: "Odd One Out",
    tagline: "Three belong. One bottle breaks the connection.",
    howTo:
      "Choose the one fragrance that does not share the objective house, note, accord, or release-era connection.",
  },
  {
    id: "build-an-accord",
    kind: "build-an-accord",
    title: "Build an Accord",
    tagline: "Compose a scent profile note by note.",
    howTo:
      "Choose a limited set of notes for each target accord, then learn which choices form its structure and character.",
  },
  {
    id: "fragrance-timeline",
    kind: "fragrance-timeline",
    title: "Fragrance Timeline",
    tagline: "Put fragrance history in the right order.",
    howTo:
      "Reorder the cards from oldest to newest. Drag them or use the accessible move buttons, then submit your timeline.",
  },
  {
    id: "bottle-silhouette",
    kind: "bottle-silhouette",
    title: "Bottle Silhouette",
    tagline: "Name the fragrance behind the shape.",
    howTo:
      "Guess the exact fragrance from an obscured bottle. Each wrong answer reveals more of the image and lowers the score.",
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
