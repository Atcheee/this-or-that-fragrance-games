import {
  brandAliasTokensForHouse,
  expandBrandSearchTerms,
} from "../brand-aliases";
import type { Fragrance } from "../types";
import { dailySeed, seededRandom, utcDateKey } from "../daily";

export { utcDateKey } from "../daily";

export type NotePyramidVariant = "daily" | "practice";

export type NotePyramidClueKind =
  | "base-note"
  | "base-notes"
  | "heart-notes"
  | "top-notes"
  | "accords"
  | "year"
  | "house";

export interface NotePyramidClue {
  kind: NotePyramidClueKind;
  label: string;
  values: string[];
}

export interface NotePyramidChallenge {
  id: string;
  variant: NotePyramidVariant;
  dateKey?: string;
  fragrance: Fragrance;
  clues: NotePyramidClue[];
  maxGuesses: number;
}

export interface CreateNotePyramidOptions {
  variant?: NotePyramidVariant;
  date?: Date;
  maxGuesses?: number;
  random?: () => number;
}

export const NOTE_PYRAMID_SCORE_STEPS = [100, 80, 60, 40, 20] as const;

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

export function normalizeFragranceGuess(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[°º]/g, "o")
    .replace(/&/g, "and")
    .replace(NON_ALPHANUMERIC, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function fragranceGuessLabel(fragrance: Fragrance): string {
  return `${fragrance.name} — ${fragrance.house}`;
}

export function isNotePyramidEligible(fragrance: Fragrance): boolean {
  return (
    fragrance.baseNotes.length > 0 &&
    fragrance.heartNotes.length > 0 &&
    fragrance.topNotes.length > 0 &&
    fragrance.accords.length > 0 &&
    fragrance.year > 0 &&
    fragrance.house.trim().length > 0
  );
}

export function buildNotePyramidClues(
  fragrance: Fragrance,
  random: () => number = Math.random,
): NotePyramidClue[] {
  const baseNotes = [...fragrance.baseNotes];
  const firstBaseIndex = Math.min(
    baseNotes.length - 1,
    Math.floor(random() * baseNotes.length),
  );
  const [firstBaseNote] = baseNotes.splice(firstBaseIndex, 1);
  const clues: NotePyramidClue[] = [
    {
      kind: "base-note",
      label: "One base note",
      values: [firstBaseNote],
    },
  ];

  if (baseNotes.length > 0) {
    clues.push({
      kind: "base-notes",
      label: "Remaining base notes",
      values: baseNotes,
    });
  }

  clues.push(
    {
      kind: "heart-notes",
      label: "Heart notes",
      values: [...fragrance.heartNotes],
    },
    {
      kind: "top-notes",
      label: "Top notes",
      values: [...fragrance.topNotes],
    },
    {
      kind: "accords",
      label: "Main accords",
      values: fragrance.accords.slice(0, 5),
    },
    {
      kind: "year",
      label: "Release year",
      values: [String(fragrance.year)],
    },
    { kind: "house", label: "House", values: [fragrance.house] },
  );

  return clues;
}

export function createNotePyramidChallenge(
  fragrances: readonly Fragrance[],
  options: CreateNotePyramidOptions = {},
): NotePyramidChallenge {
  const variant = options.variant ?? "practice";
  const eligible = fragrances
    .filter(isNotePyramidEligible)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (eligible.length === 0) {
    throw new Error("Note Pyramid needs at least one fragrance with a complete note pyramid.");
  }

  const dailyDate = options.date ?? new Date();
  const dateKey = variant === "daily" ? utcDateKey(dailyDate) : undefined;
  const random =
    variant === "daily"
      ? seededRandom(dailySeed("note-pyramid", dailyDate))
      : (options.random ?? Math.random);
  const fragrance = eligible[Math.floor(random() * eligible.length)]!;
  const clues = buildNotePyramidClues(fragrance, random);
  const requestedGuesses = options.maxGuesses ?? clues.length;
  const maxGuesses = Math.max(1, Math.min(requestedGuesses, clues.length));

  return {
    id: variant === "daily" ? `note-pyramid-${dateKey}` : `note-pyramid-${fragrance.id}`,
    variant,
    dateKey,
    fragrance,
    clues,
    maxGuesses,
  };
}

export function scoreNotePyramid(cluesUsed: number): number {
  const index = Math.max(0, Math.min(cluesUsed - 1, NOTE_PYRAMID_SCORE_STEPS.length - 1));
  return NOTE_PYRAMID_SCORE_STEPS[index];
}

function fragranceGuessKeys(fragrance: Fragrance): string[] {
  const keys = new Set<string>();
  keys.add(normalizeFragranceGuess(fragranceGuessLabel(fragrance)));
  keys.add(normalizeFragranceGuess(`${fragrance.name} ${fragrance.house}`));
  for (const alias of brandAliasTokensForHouse(fragrance.house)) {
    keys.add(normalizeFragranceGuess(`${fragrance.name} — ${alias}`));
    keys.add(normalizeFragranceGuess(`${fragrance.name} ${alias}`));
    keys.add(normalizeFragranceGuess(`${alias} ${fragrance.name}`));
  }
  return [...keys];
}

export function resolveExactFragranceGuess(
  input: string,
  fragrances: readonly Fragrance[],
): Fragrance | null {
  const guess = normalizeFragranceGuess(input);
  if (!guess) return null;
  const expandedGuess = expandBrandSearchTerms(
    guess.split(" ").filter(Boolean),
    normalizeFragranceGuess,
  ).join(" ");

  const exactLabel = fragrances.find((fragrance) => {
    const keys = fragranceGuessKeys(fragrance);
    return keys.includes(guess) || keys.includes(expandedGuess);
  });
  if (exactLabel) return exactLabel;

  const nameMatches = fragrances.filter(
    (fragrance) => normalizeFragranceGuess(fragrance.name) === guess,
  );
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

export function searchNotePyramidFragrances(
  input: string,
  fragrances: readonly Fragrance[],
  limit = 8,
): Fragrance[] {
  const query = normalizeFragranceGuess(input);
  const terms = expandBrandSearchTerms(
    query.split(" ").filter(Boolean),
    normalizeFragranceGuess,
  );
  const expandedQuery = terms.join(" ");

  return fragrances
    .filter((fragrance) => {
      if (terms.length === 0) return true;
      const haystack = normalizeFragranceGuess(fragranceGuessLabel(fragrance));
      return terms.every((term) => haystack.includes(term));
    })
    .map((fragrance) => {
      const name = normalizeFragranceGuess(fragrance.name);
      const label = normalizeFragranceGuess(fragranceGuessLabel(fragrance));
      let rank = Math.log10((fragrance.votes ?? 0) + 1) * 10;
      if (query && (name === query || name === expandedQuery)) rank += 1_000;
      else if (query && (label === query || label === expandedQuery))
        rank += 900;
      else if (
        query &&
        (name.startsWith(query) || name.startsWith(expandedQuery))
      )
        rank += 600;
      else if (
        query &&
        (label.startsWith(query) || label.startsWith(expandedQuery))
      )
        rank += 400;
      return { fragrance, rank };
    })
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        (b.fragrance.votes ?? 0) - (a.fragrance.votes ?? 0) ||
        a.fragrance.name.localeCompare(b.fragrance.name),
    )
    .slice(0, Math.max(1, Math.min(limit, 20)))
    .map(({ fragrance }) => fragrance);
}

export function createNotePyramidShareText({
  challenge,
  won,
  cluesUsed,
  guesses,
  score,
}: {
  challenge: NotePyramidChallenge;
  won: boolean;
  cluesUsed: number;
  guesses: number;
  score: number;
}): string {
  const heading = challenge.dateKey
    ? `Note Pyramid ${challenge.dateKey}`
    : "Note Pyramid Practice";
  const progress = challenge.clues
    .map((_, index) => {
      if (index >= cluesUsed) return "⬜";
      if (won && index === cluesUsed - 1) return "🟩";
      return "⬛";
    })
    .join("");
  const result = won ? `${cluesUsed}/${challenge.clues.length}` : "X";

  return `${heading} ${result}\n${progress}\n${guesses} guess${guesses === 1 ? "" : "es"} · ${score} points`;
}
