export const SCENTLE_MAX_GUESSES = 8;

export interface ScentleFragranceSummary {
  id: string;
  name: string;
  house: string;
  year: number;
  imageUrl?: string;
}

export interface ScentleGuessFeedback {
  guess: ScentleFragranceSummary;
  overallScore: number;
  noteSimilarity: number;
  sharedNotes: string[];
  accordSimilarity: number;
  sharedAccords: string[];
  yearDistance: number;
  yearDirection: "older" | "newer" | "exact" | "unknown";
  sameHouse: boolean;
  ratingDistance: number | null;
  popularitySimilarity: number | null;
  isCorrect: boolean;
}

export interface ScentleProgress {
  dateKey: string;
  guesses: ScentleGuessFeedback[];
  outcome: "won" | "lost" | null;
  answer?: ScentleFragranceSummary;
}

export interface ScentleGuessResponse {
  dateKey: string;
  maxGuesses: number;
  feedback?: ScentleGuessFeedback;
  outcome: "won" | "lost" | null;
  answer?: ScentleFragranceSummary;
}
