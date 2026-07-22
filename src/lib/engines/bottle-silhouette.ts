import {
  brandAliasTokensForHouse,
  expandBrandSearchTerms,
} from "../brand-aliases";
import { hashSeed, seededRandom, utcDateKey } from "../daily";
import type { Fragrance } from "../types";

export type BottleSilhouetteVariant = "daily" | "practice";

export type BottleRevealStageId =
  | "silhouette"
  | "cap"
  | "blur"
  | "color"
  | "clearer"
  | "brand"
  | "full";

export interface BottleRevealStage {
  id: BottleRevealStageId;
  label: string;
  description: string;
  points: number;
}

export interface BottleSilhouetteChallenge {
  id: string;
  variant: BottleSilhouetteVariant;
  dateKey?: string;
  fragrance: Fragrance;
  stages: readonly BottleRevealStage[];
}

export interface CreateBottleSilhouetteOptions {
  variant?: BottleSilhouetteVariant;
  /** YYYY-MM-DD in UTC. */
  dateKey?: string;
  /** Stable practice seed. Ignored by daily challenges. */
  seed?: string;
  random?: () => number;
}

export const BOTTLE_REVEAL_STAGES: readonly BottleRevealStage[] = [
  {
    id: "silhouette",
    label: "Silhouette",
    description: "Only the bottle outline is visible.",
    points: 100,
  },
  {
    id: "cap",
    label: "Cap reveal",
    description: "The cap shape is partially visible.",
    points: 80,
  },
  {
    id: "blur",
    label: "Heavy blur",
    description: "The whole bottle is visible through a heavy blur.",
    points: 60,
  },
  {
    id: "color",
    label: "Color reveal",
    description: "Bottle colors are visible through the blur.",
    points: 40,
  },
  {
    id: "clearer",
    label: "Clearer bottle",
    description: "The shape and materials are clearer; the label stays hidden.",
    points: 20,
  },
  {
    id: "brand",
    label: "Brand clue",
    description: "The bottle is nearly clear and its house is revealed.",
    points: 20,
  },
  {
    id: "full",
    label: "Full reveal",
    description: "The original bottle and answer are revealed.",
    points: 0,
  },
] as const;

const MIN_POPULARITY_VOTES = 1_000;
const MAX_CHALLENGE_POOL = 80;
const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeBottleGuess(value: string): string {
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

export function bottleGuessLabel(fragrance: Fragrance): string {
  return `${fragrance.name} — ${fragrance.house}`;
}

export function hasUsableBottleImage(fragrance: Fragrance): boolean {
  const value = fragrance.imageUrl?.trim();
  if (!value) return false;

  // Early silhouette stages require alpha transparency. Opaque catalog JPEGs
  // turn into solid rectangles under brightness filters and reveal no shape.
  return /^https:\/\/img\.fraganty\.ai\/perfume-nobg\/\d+\.webp(?:\?.*)?$/i.test(
    value,
  );
}

export function isBottleSilhouetteEligible(fragrance: Fragrance): boolean {
  return (
    Boolean(fragrance.id.trim() && fragrance.name.trim() && fragrance.house.trim()) &&
    hasUsableBottleImage(fragrance) &&
    (fragrance.votes ?? 0) >= MIN_POPULARITY_VOTES
  );
}

export function eligibleBottleSilhouetteFragrances(
  fragrances: readonly Fragrance[],
): Fragrance[] {
  const byIdentity = new Map<string, Fragrance>();
  const ranked = fragrances
    .filter(isBottleSilhouetteEligible)
    .sort(
      (a, b) =>
        (b.votes ?? 0) - (a.votes ?? 0) ||
        b.rating - a.rating ||
        a.id.localeCompare(b.id),
    );

  for (const fragrance of ranked) {
    const identity = normalizeBottleGuess(bottleGuessLabel(fragrance));
    if (!byIdentity.has(identity)) byIdentity.set(identity, fragrance);
  }

  return [...byIdentity.values()].slice(0, MAX_CHALLENGE_POOL);
}

export function createBottleSilhouettePracticeSeed(): string {
  return `bottle-silhouette:practice:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function createBottleSilhouetteChallenge(
  fragrances: readonly Fragrance[],
  options: CreateBottleSilhouetteOptions = {},
): BottleSilhouetteChallenge {
  const variant = options.variant ?? "practice";
  const eligible = eligibleBottleSilhouetteFragrances(fragrances);
  if (eligible.length === 0) {
    throw new Error(
      "Bottle Silhouette needs a popular fragrance with a usable bottle image.",
    );
  }

  const resolvedDateKey = resolveDateKey(options.dateKey);
  const practiceSeed = options.seed ?? createBottleSilhouettePracticeSeed();
  const random =
    variant === "daily"
      ? seededRandom(hashSeed(`bottle-silhouette:${resolvedDateKey}`))
      : options.seed
        ? seededRandom(hashSeed(practiceSeed))
        : (options.random ?? Math.random);
  const fragrance = eligible[Math.floor(random() * eligible.length)]!;
  const challengeKey =
    variant === "daily"
      ? resolvedDateKey
      : hashSeed(`${practiceSeed}:${fragrance.id}`).toString(36);

  return {
    id: `bottle-silhouette-${challengeKey}`,
    variant,
    dateKey: variant === "daily" ? resolvedDateKey : undefined,
    fragrance,
    stages: BOTTLE_REVEAL_STAGES,
  };
}

function bottleGuessKeys(fragrance: Fragrance): string[] {
  const keys = new Set<string>();
  keys.add(normalizeBottleGuess(bottleGuessLabel(fragrance)));
  keys.add(normalizeBottleGuess(`${fragrance.name} ${fragrance.house}`));
  for (const alias of brandAliasTokensForHouse(fragrance.house)) {
    keys.add(normalizeBottleGuess(`${fragrance.name} — ${alias}`));
    keys.add(normalizeBottleGuess(`${fragrance.name} ${alias}`));
    keys.add(normalizeBottleGuess(`${alias} ${fragrance.name}`));
  }
  return [...keys];
}

export function resolveExactBottleGuess(
  input: string,
  fragrances: readonly Fragrance[],
): Fragrance | null {
  const guess = normalizeBottleGuess(input);
  if (!guess) return null;
  const expandedGuess = expandBrandSearchTerms(
    guess.split(" ").filter(Boolean),
    normalizeBottleGuess,
  ).join(" ");

  const labelMatch = fragrances.find((fragrance) => {
    const keys = bottleGuessKeys(fragrance);
    return keys.includes(guess) || keys.includes(expandedGuess);
  });
  if (labelMatch) return labelMatch;

  const nameMatches = fragrances.filter(
    (fragrance) => normalizeBottleGuess(fragrance.name) === guess,
  );
  return nameMatches.length === 1 ? nameMatches[0]! : null;
}

export function searchBottleSilhouetteFragrances(
  input: string,
  fragrances: readonly Fragrance[],
  limit = 8,
): Fragrance[] {
  const query = normalizeBottleGuess(input);
  const terms = expandBrandSearchTerms(
    query.split(" ").filter(Boolean),
    normalizeBottleGuess,
  );
  const expandedQuery = terms.join(" ");

  return fragrances
    .filter((fragrance) => {
      const haystack = normalizeBottleGuess(bottleGuessLabel(fragrance));
      return terms.every((term) => haystack.includes(term));
    })
    .map((fragrance) => {
      const name = normalizeBottleGuess(fragrance.name);
      const label = normalizeBottleGuess(bottleGuessLabel(fragrance));
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
    .slice(0, Math.max(1, Math.min(20, Math.floor(limit))))
    .map(({ fragrance }) => fragrance);
}

export function scoreBottleSilhouette(stageIndex: number): number {
  const index = Math.max(
    0,
    Math.min(Math.floor(stageIndex), BOTTLE_REVEAL_STAGES.length - 1),
  );
  return BOTTLE_REVEAL_STAGES[index]!.points;
}

export function createBottleSilhouetteShareText({
  challenge,
  won,
  stageIndex,
  attempts,
  score,
}: {
  challenge: BottleSilhouetteChallenge;
  won: boolean;
  stageIndex: number;
  attempts: number;
  score: number;
}): string {
  const heading = challenge.dateKey
    ? `Bottle Silhouette ${challenge.dateKey}`
    : "Bottle Silhouette Practice";
  const safeStage = Math.max(
    0,
    Math.min(Math.floor(stageIndex), challenge.stages.length - 1),
  );
  const progress = challenge.stages
    .map((_, index) => {
      if (won && index === safeStage) return "🟩";
      if (index <= safeStage) return "⬛";
      return "⬜";
    })
    .join("");
  const result = won ? `${safeStage + 1}/${challenge.stages.length}` : "X";

  return `${heading} ${result}\n${progress}\n${attempts} attempt${attempts === 1 ? "" : "s"} · ${score} points`;
}

function resolveDateKey(value?: string): string {
  const candidate = value?.slice(0, 10);
  return candidate && DATE_KEY.test(candidate) ? candidate : utcDateKey();
}
