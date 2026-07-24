import type { Fragrance } from "@/lib/types";

export type SimilarityFragrance = Pick<
  Fragrance,
  | "id"
  | "house"
  | "year"
  | "rating"
  | "votes"
  | "topNotes"
  | "heartNotes"
  | "baseNotes"
  | "accords"
>;

const NOTE_TIER_WEIGHTS = {
  top: 3,
  heart: 2,
  base: 1.5,
} as const;

export const FRAGRANCE_SIMILARITY_WEIGHTS = {
  notes: 0.36,
  accords: 0.24,
  year: 0.14,
  house: 0.1,
  rating: 0.08,
  popularity: 0.08,
} as const;

const FEATURE_GROUPS = [
  ["citrus", "bergamot", "lemon", "orange", "grapefruit", "mandarin", "neroli"],
  ["aquatic", "marine", "ozonic", "water", "sea", "salt", "fresh"],
  ["green", "herbal", "aromatic", "grass", "mint", "galbanum", "tea"],
  ["floral", "white floral", "jasmine", "tuberose", "ylang", "gardenia", "lily"],
  ["rose", "oud", "agarwood", "saffron"],
  ["gourmand", "vanilla", "sweet", "caramel", "chocolate", "cacao", "coffee", "honey", "almond"],
  ["woody", "cedar", "sandalwood", "vetiver", "patchouli", "oakmoss", "earthy"],
  ["spicy", "warm spicy", "fresh spicy", "cinnamon", "pepper", "cardamom", "clove"],
  ["leather", "smoky", "tobacco", "incense", "birch", "petrol"],
  ["musky", "powdery", "iris", "violet", "amber", "resinous", "balsamic"],
] as const;

export interface FragranceSimilarity {
  overallScore: number;
  scentScore: number;
  noteSimilarity: number;
  accordSimilarity: number;
  sharedNotes: string[];
  sharedAccords: string[];
  yearDistance: number;
  sameHouse: boolean;
  ratingDistance: number | null;
  popularitySimilarity: number | null;
  scoreComponents: SimilarityScoreComponent[];
  noteComparison: SimilarityValueComparison;
  accordComparison: SimilarityValueComparison;
}

export interface SimilarityScoreComponent {
  key: keyof typeof FRAGRANCE_SIMILARITY_WEIGHTS;
  label: string;
  score: number | null;
  weight: number;
  contribution: number;
}

export interface SimilarityValueComparison {
  shared: string[];
  firstOnly: string[];
  secondOnly: string[];
}

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function noteWeights(fragrance: SimilarityFragrance): Map<string, number> {
  const result = new Map<string, number>();
  const add = (notes: string[], weight: number) => {
    for (const note of notes) {
      const key = normalized(note);
      result.set(key, Math.max(result.get(key) ?? 0, weight));
    }
  };
  add(fragrance.topNotes, NOTE_TIER_WEIGHTS.top);
  add(fragrance.heartNotes, NOTE_TIER_WEIGHTS.heart);
  add(fragrance.baseNotes, NOTE_TIER_WEIGHTS.base);
  return result;
}

function accordWeights(fragrance: SimilarityFragrance): Map<string, number> {
  return new Map(
    fragrance.accords.map((accord, index) => [
      normalized(accord),
      1 / Math.sqrt(index + 1),
    ]),
  );
}

function weightedJaccard(
  left: Map<string, number>,
  right: Map<string, number>,
): number {
  const keys = new Set([...left.keys(), ...right.keys()]);
  let intersection = 0;
  let union = 0;
  for (const key of keys) {
    const a = left.get(key) ?? 0;
    const b = right.get(key) ?? 0;
    intersection += Math.min(a, b);
    union += Math.max(a, b);
  }
  return union > 0 ? intersection / union : 0;
}

function proximity(distance: number, scale: number): number {
  return Math.exp(-Math.max(0, distance) / scale);
}

function uniqueValues(source: string[]): string[] {
  const seen = new Set<string>();
  return source.filter((value) => {
    const key = normalized(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareValues(
  first: string[],
  second: string[],
): SimilarityValueComparison {
  const uniqueFirst = uniqueValues(first);
  const uniqueSecond = uniqueValues(second);
  const firstKeys = new Set(uniqueFirst.map(normalized));
  const secondKeys = new Set(uniqueSecond.map(normalized));
  return {
    shared: uniqueFirst.filter((value) => secondKeys.has(normalized(value))),
    firstOnly: uniqueFirst.filter(
      (value) => !secondKeys.has(normalized(value)),
    ),
    secondOnly: uniqueSecond.filter(
      (value) => !firstKeys.has(normalized(value)),
    ),
  };
}

function scoreComponent(
  key: SimilarityScoreComponent["key"],
  label: string,
  score: number | null,
): SimilarityScoreComponent {
  const weight = FRAGRANCE_SIMILARITY_WEIGHTS[key];
  return {
    key,
    label,
    score: score === null ? null : Math.round(score * 100),
    weight: Math.round(weight * 100),
    contribution:
      score === null ? 0 : Math.round(score * weight * 1_000) / 10,
  };
}

export function scoreFragranceSimilarity(
  first: SimilarityFragrance,
  second: SimilarityFragrance,
): FragranceSimilarity {
  const noteSimilarity = weightedJaccard(
    noteWeights(first),
    noteWeights(second),
  );
  const accordSimilarity = weightedJaccard(
    accordWeights(first),
    accordWeights(second),
  );
  const yearDistance =
    first.year > 0 && second.year > 0
      ? Math.abs(first.year - second.year)
      : 0;
  const yearScore =
    first.year > 0 && second.year > 0 ? proximity(yearDistance, 18) : 0;
  const sameHouse = normalized(first.house) === normalized(second.house);
  const ratingDistance =
    first.rating > 0 && second.rating > 0
      ? Math.abs(first.rating - second.rating)
      : null;
  const ratingScore =
    ratingDistance === null ? 0 : proximity(ratingDistance, 0.75);
  const firstVotes = first.votes ?? 0;
  const secondVotes = second.votes ?? 0;
  const popularitySimilarity =
    firstVotes > 0 && secondVotes > 0
      ? proximity(
          Math.abs(Math.log10(firstVotes + 1) - Math.log10(secondVotes + 1)),
          0.9,
        )
      : null;
  const noteComparison = compareValues(
    first.topNotes.concat(first.heartNotes, first.baseNotes),
    second.topNotes.concat(second.heartNotes, second.baseNotes),
  );
  const accordComparison = compareValues(first.accords, second.accords);
  const rawScore =
    noteSimilarity * FRAGRANCE_SIMILARITY_WEIGHTS.notes +
    accordSimilarity * FRAGRANCE_SIMILARITY_WEIGHTS.accords +
    yearScore * FRAGRANCE_SIMILARITY_WEIGHTS.year +
    (sameHouse ? 1 : 0) * FRAGRANCE_SIMILARITY_WEIGHTS.house +
    ratingScore * FRAGRANCE_SIMILARITY_WEIGHTS.rating +
    (popularitySimilarity ?? 0) *
      FRAGRANCE_SIMILARITY_WEIGHTS.popularity;
  const isSame = first.id === second.id;

  return {
    overallScore: isSame ? 100 : Math.min(99, Math.round(rawScore * 100)),
    scentScore: Math.round(
      ((noteSimilarity * FRAGRANCE_SIMILARITY_WEIGHTS.notes +
        accordSimilarity * FRAGRANCE_SIMILARITY_WEIGHTS.accords) /
        (FRAGRANCE_SIMILARITY_WEIGHTS.notes +
          FRAGRANCE_SIMILARITY_WEIGHTS.accords)) *
        100,
    ),
    noteSimilarity: Math.round(noteSimilarity * 100),
    accordSimilarity: Math.round(accordSimilarity * 100),
    sharedNotes: noteComparison.shared.slice(0, 8),
    sharedAccords: accordComparison.shared.slice(0, 6),
    yearDistance,
    sameHouse,
    ratingDistance:
      ratingDistance === null ? null : Math.round(ratingDistance * 10) / 10,
    popularitySimilarity:
      popularitySimilarity === null
        ? null
        : Math.round(popularitySimilarity * 100),
    scoreComponents: [
      scoreComponent("notes", "Notes", noteSimilarity),
      scoreComponent("accords", "Accords", accordSimilarity),
      scoreComponent(
        "year",
        "Release year",
        first.year > 0 && second.year > 0 ? yearScore : null,
      ),
      scoreComponent("house", "House", sameHouse ? 1 : 0),
      scoreComponent(
        "rating",
        "Rating",
        ratingDistance === null ? null : ratingScore,
      ),
      scoreComponent("popularity", "Popularity", popularitySimilarity),
    ],
    noteComparison,
    accordComparison,
  };
}

function matchesFeature(value: string, terms: readonly string[]): boolean {
  const valueKey = normalized(value);
  return terms.some((term) => valueKey.includes(term));
}

/**
 * Stable, compact vector used by Fragrance Atlas. It shares normalization,
 * note tiers, and accord emphasis with the pairwise Scentle scorer.
 */
export function fragranceSimilarityVector(
  fragrance: SimilarityFragrance,
): number[] {
  const features = FEATURE_GROUPS.map((terms) => {
    let score = 0;
    for (const accord of fragrance.accords) {
      if (matchesFeature(accord, terms)) score += 2.4;
    }
    for (const note of fragrance.topNotes) {
      if (matchesFeature(note, terms)) score += 1.25;
    }
    for (const note of fragrance.heartNotes) {
      if (matchesFeature(note, terms)) score += 1;
    }
    for (const note of fragrance.baseNotes) {
      if (matchesFeature(note, terms)) score += 0.85;
    }
    return Math.log1p(score);
  });
  features.push(Math.max(-1, Math.min(1, (fragrance.year - 1990) / 55)));
  features.push(fragrance.rating > 0 ? (fragrance.rating - 3.7) / 1.2 : 0);
  return features;
}
