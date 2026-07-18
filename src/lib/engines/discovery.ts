import type { Fragrance } from "../types";
import { allNotes } from "../types";

/** What the quiz should produce at the end. */
export type DiscoveryGoal = "favorite" | "top10" | "notes";

export type RatingFloor = 0 | 3.5 | 4 | 4.5;
export type EraFilter = "any" | "classic" | "modern";
export type PopularityFilter = "any" | "known" | "cult";

export interface DiscoveryLimits {
  ratingFloor: RatingFloor;
  era: EraFilter;
  popularity: PopularityFilter;
  /** Accords the fragrance must include at least one of (empty = no must). */
  mustAccords: string[];
  /** Accords that disqualify a fragrance. */
  excludeAccords: string[];
}

export interface DiscoveryAnswers {
  /** Liked main accords (vibe). */
  likedAccords: string[];
  /** Liked notes. */
  likedNotes: string[];
  /** Notes / accords to avoid. */
  avoid: string[];
  /** soft | balanced | bold — biases toward lighter or denser pyramids. */
  intensity: "soft" | "balanced" | "bold";
  /** Prefer fresh-leaning vs warm-leaning profiles. */
  climate: "fresh" | "either" | "warm";
  sweetness: "love" | "neutral" | "avoid";
}

export interface ScoredFragrance {
  fragrance: Fragrance;
  score: number;
}

export interface PreferenceProfile {
  accords: { name: string; weight: number }[];
  notes: { name: string; weight: number }[];
}

export const DISCOVERY_GOALS: {
  id: DiscoveryGoal;
  title: string;
  description: string;
}[] = [
  {
    id: "favorite",
    title: "One perfect match",
    description: "Your single best fragrance from the catalog.",
  },
  {
    id: "top10",
    title: "Top 10 list",
    description: "A ranked shortlist tailored to your answers.",
  },
  {
    id: "notes",
    title: "Preferred notes & accords",
    description: "Your taste profile, plus bottles that fit it.",
  },
];

/** Curated vibe options drawn from the densest catalog accords. */
export const VIBE_ACCORDS = [
  "fresh",
  "citrus",
  "aquatic",
  "green",
  "floral",
  "fruity",
  "sweet",
  "gourmand",
  "spicy",
  "woody",
  "oriental",
  "powdery",
  "smoky",
  "leathery",
  "creamy",
  "resinous",
] as const;

export const NOTE_PICKS = [
  "Bergamot",
  "Lemon",
  "Rose",
  "Jasmine",
  "Iris",
  "Lavender",
  "Vanilla",
  "Sandalwood",
  "Cedarwood",
  "Vetiver",
  "Patchouli",
  "Musk",
  "Amber",
  "Oud",
  "Leather",
  "Pink Pepper",
  "Cardamom",
  "Tonka Bean",
  "Orange Blossom",
  "Frankincense",
] as const;

export const AVOID_PICKS = [
  ...VIBE_ACCORDS.slice(0, 10),
  "Oud",
  "Leather",
  "Vanilla",
  "Patchouli",
  "Musk",
  "Rose",
] as const;

export const DEFAULT_LIMITS: DiscoveryLimits = {
  ratingFloor: 0,
  era: "any",
  popularity: "known",
  mustAccords: [],
  excludeAccords: [],
};

export const DEFAULT_ANSWERS: DiscoveryAnswers = {
  likedAccords: [],
  likedNotes: [],
  avoid: [],
  intensity: "balanced",
  climate: "either",
  sweetness: "neutral",
};

const FRESH_ACCORDS = new Set([
  "fresh",
  "citrus",
  "aquatic",
  "green",
  "aromatic",
  "herbal",
]);
const WARM_ACCORDS = new Set([
  "oriental",
  "woody",
  "spicy",
  "sweet",
  "gourmand",
  "smoky",
  "amber",
  "resinous",
  "leathery",
  "creamy",
]);

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function hasAccord(f: Fragrance, name: string): boolean {
  const n = norm(name);
  return f.accords.some((a) => norm(a) === n);
}

function hasNote(f: Fragrance, name: string): boolean {
  const n = norm(name);
  return allNotes(f).some((x) => norm(x) === n);
}

function matchesAvoid(f: Fragrance, term: string): boolean {
  return hasAccord(f, term) || hasNote(f, term);
}

export function applyLimits(
  pool: Fragrance[],
  limits: DiscoveryLimits,
): Fragrance[] {
  return pool.filter((f) => {
    if (limits.ratingFloor > 0 && f.rating < limits.ratingFloor) return false;

    if (limits.era === "classic" && !(f.year > 0 && f.year < 2000)) return false;
    if (limits.era === "modern" && !(f.year >= 2000)) return false;

    const votes = f.votes ?? 0;
    if (limits.popularity === "known" && votes < 50 && f.price <= 0) return false;
    if (limits.popularity === "cult" && votes < 200) return false;

    if (limits.mustAccords.length > 0) {
      const ok = limits.mustAccords.some((a) => hasAccord(f, a));
      if (!ok) return false;
    }

    if (limits.excludeAccords.some((a) => hasAccord(f, a))) return false;

    // Need enough scent data to score meaningfully
    if (f.accords.length < 2 && allNotes(f).length < 3) return false;

    return true;
  });
}

function intensityScore(f: Fragrance, preference: DiscoveryAnswers["intensity"]): number {
  const noteCount = allNotes(f).length;
  const baseHeavy = f.baseNotes.length;
  // Dense pyramids + heavier bases ≈ bolder
  const boldness = noteCount * 0.4 + baseHeavy * 1.2 + (hasAccord(f, "oriental") ? 2 : 0);
  if (preference === "soft") return boldness <= 8 ? 4 : boldness <= 12 ? 1 : -3;
  if (preference === "bold") return boldness >= 12 ? 4 : boldness >= 8 ? 1 : -2;
  return boldness >= 6 && boldness <= 14 ? 2 : 0;
}

function climateScore(f: Fragrance, climate: DiscoveryAnswers["climate"]): number {
  if (climate === "either") return 0;
  let fresh = 0;
  let warm = 0;
  for (const a of f.accords) {
    const n = norm(a);
    if (FRESH_ACCORDS.has(n)) fresh += 1;
    if (WARM_ACCORDS.has(n)) warm += 1;
  }
  if (climate === "fresh") return fresh * 2.5 - warm;
  return warm * 2.5 - fresh;
}

function sweetnessScore(
  f: Fragrance,
  sweetness: DiscoveryAnswers["sweetness"],
): number {
  const sweet =
    hasAccord(f, "sweet") ||
    hasAccord(f, "gourmand") ||
    hasNote(f, "Vanilla") ||
    hasNote(f, "Tonka Bean");
  if (sweetness === "love") return sweet ? 5 : -1;
  if (sweetness === "avoid") return sweet ? -6 : 2;
  return 0;
}

/** Score one fragrance against the taste answers (limits already applied). */
export function scoreFragrance(
  f: Fragrance,
  answers: DiscoveryAnswers,
): number {
  let score = 0;

  for (const a of answers.likedAccords) {
    if (hasAccord(f, a)) score += 8;
  }
  for (const n of answers.likedNotes) {
    if (hasNote(f, n)) score += 5;
  }
  for (const term of answers.avoid) {
    if (matchesAvoid(f, term)) score -= 10;
  }

  score += intensityScore(f, answers.intensity);
  score += climateScore(f, answers.climate);
  score += sweetnessScore(f, answers.sweetness);

  // Soft quality signals
  if (f.rating >= 4.2) score += 2;
  else if (f.rating >= 3.8) score += 1;
  if ((f.votes ?? 0) >= 200) score += 1;

  return score;
}

export function rankMatches(
  pool: Fragrance[],
  limits: DiscoveryLimits,
  answers: DiscoveryAnswers,
  limit = 10,
): ScoredFragrance[] {
  const filtered = applyLimits(pool, limits);
  return filtered
    .map((fragrance) => ({
      fragrance,
      score: scoreFragrance(fragrance, answers),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.fragrance.votes ?? 0) - (a.fragrance.votes ?? 0);
    })
    .slice(0, limit);
}

/**
 * Aggregate which accords/notes appear most among the top-ranked matches,
 * boosted by explicit likes from the quiz.
 */
export function buildPreferenceProfile(
  ranked: ScoredFragrance[],
  answers: DiscoveryAnswers,
  topN = 8,
): PreferenceProfile {
  const accordWeights = new Map<string, number>();
  const noteWeights = new Map<string, number>();

  for (const a of answers.likedAccords) {
    accordWeights.set(a, (accordWeights.get(a) ?? 0) + 20);
  }
  for (const n of answers.likedNotes) {
    noteWeights.set(n, (noteWeights.get(n) ?? 0) + 20);
  }

  const avoid = new Set(answers.avoid.map(norm));

  ranked.slice(0, 15).forEach(({ fragrance, score }, i) => {
    const w = Math.max(1, 12 - i) + Math.max(0, score) * 0.15;
    for (const a of fragrance.accords) {
      if (avoid.has(norm(a))) continue;
      accordWeights.set(a, (accordWeights.get(a) ?? 0) + w);
    }
    for (const n of allNotes(fragrance)) {
      if (avoid.has(norm(n))) continue;
      noteWeights.set(n, (noteWeights.get(n) ?? 0) + w * 0.6);
    }
  });

  const accords = [...accordWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name, weight]) => ({ name, weight: Math.round(weight) }));

  const notes = [...noteWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name, weight]) => ({ name, weight: Math.round(weight) }));

  return { accords, notes };
}

export function filteredCount(
  pool: Fragrance[],
  limits: DiscoveryLimits,
): number {
  return applyLimits(pool, limits).length;
}
