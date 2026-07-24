import "server-only";

import {
  getAllCatalogFragrances,
  getFragranceById,
} from "@/lib/catalog";
import { hashSeed, utcDateKey } from "@/lib/daily";
import {
  SCENTLE_MAX_GUESSES,
  type ScentleFragranceSummary,
  type ScentleGuessFeedback,
} from "@/lib/scentle-types";
import { scoreFragranceSimilarity } from "@/lib/fragrance-similarity";
import type { Fragrance } from "@/lib/types";
import { allNotes } from "@/lib/types";

const DAILY_POOL = getAllCatalogFragrances()
  .filter(
    (fragrance) =>
      fragrance.year > 0 &&
      fragrance.rating > 0 &&
      (fragrance.votes ?? 0) >= 250 &&
      allNotes(fragrance).length >= 3 &&
      fragrance.accords.length >= 2,
  )
  .sort(
    (a, b) =>
      (b.votes ?? 0) - (a.votes ?? 0) ||
      b.rating - a.rating ||
      a.id.localeCompare(b.id),
  )
  .slice(0, 1_200);

function summary(fragrance: Fragrance): ScentleFragranceSummary {
  return {
    id: fragrance.id,
    name: fragrance.name,
    house: fragrance.house,
    year: fragrance.year,
    ...(fragrance.imageUrl ? { imageUrl: fragrance.imageUrl } : {}),
  };
}

export function getDailyScentleAnswer(date = new Date()): Fragrance {
  if (DAILY_POOL.length === 0) {
    throw new Error("No fragrances are eligible for Scentle.");
  }
  const seed = hashSeed(`scentle:${utcDateKey(date)}`);
  return DAILY_POOL[seed % DAILY_POOL.length]!;
}

export function getScentleAnswerSummary(
  date = new Date(),
): ScentleFragranceSummary {
  return summary(getDailyScentleAnswer(date));
}

export function scoreScentleGuess(
  guessId: string,
  date = new Date(),
): ScentleGuessFeedback | null {
  const guess = getFragranceById(guessId);
  if (!guess) return null;

  const answer = getDailyScentleAnswer(date);
  const isCorrect = guess.id === answer.id;
  const similarity = scoreFragranceSimilarity(answer, guess);

  return {
    guess: summary(guess),
    overallScore: similarity.overallScore,
    noteSimilarity: similarity.noteSimilarity,
    sharedNotes: similarity.sharedNotes,
    accordSimilarity: similarity.accordSimilarity,
    sharedAccords: similarity.sharedAccords,
    yearDistance: similarity.yearDistance,
    yearDirection:
      guess.year <= 0 || answer.year <= 0
        ? "unknown"
        : guess.year === answer.year
          ? "exact"
          : guess.year < answer.year
            ? "newer"
            : "older",
    sameHouse: similarity.sameHouse,
    ratingDistance: similarity.ratingDistance,
    popularitySimilarity: similarity.popularitySimilarity,
    isCorrect,
  };
}

export { SCENTLE_MAX_GUESSES };
