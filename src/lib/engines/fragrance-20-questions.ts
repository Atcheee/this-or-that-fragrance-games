import type { Fragrance } from "@/lib/types";
import { allNotes } from "@/lib/types";

export type TwentyQuestionsAnswer = "yes" | "no" | "unknown";

export type TwentyQuestionsCategory =
  | "notes"
  | "accords"
  | "release"
  | "house"
  | "origin"
  | "performance"
  | "price"
  | "rating";

type QuestionRule =
  | { kind: "note"; value: string }
  | { kind: "accord"; value: string }
  | { kind: "year-after"; value: number }
  | { kind: "house"; value: string }
  | { kind: "country"; value: string }
  | { kind: "long-lasting" }
  | { kind: "strong-sillage" }
  | { kind: "price-over"; value: number }
  | { kind: "rating-at-least"; value: number };

export interface TwentyQuestionsQuestion {
  id: string;
  category: TwentyQuestionsCategory;
  label: string;
  searchText: string;
  rule: QuestionRule;
}

export interface QuestionDistribution {
  yes: number;
  no: number;
  unknown: number;
  worstCase: number;
}

export interface RankedTwentyQuestionsQuestion {
  question: TwentyQuestionsQuestion;
  distribution: QuestionDistribution;
}

export const TWENTY_QUESTIONS_LIMIT = 20;
export const QUESTION_COST = 3;
export const WRONG_GUESS_COST = 12;

export const TWENTY_QUESTIONS_CATEGORIES: ReadonlyArray<{
  id: "all" | TwentyQuestionsCategory;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "notes", label: "Notes" },
  { id: "accords", label: "Accords" },
  { id: "release", label: "Release" },
  { id: "house", label: "House" },
  { id: "origin", label: "Origin" },
  { id: "performance", label: "Performance" },
  { id: "price", label: "Price" },
  { id: "rating", label: "Rating" },
];

const HOUSE_COUNTRIES: Record<string, string> = {
  afnan: "United Arab Emirates",
  amouage: "Oman",
  "acqua di parma": "Italy",
  "al haramain perfumes": "United Arab Emirates",
  "ariana grande": "United States",
  armani: "Italy",
  armaf: "United Arab Emirates",
  atelier_cologne: "France",
  azzaro: "France",
  balenciaga: "France",
  "billie eilish": "United States",
  "bond no 9": "United States",
  "bottega veneta": "Italy",
  burberry: "United Kingdom",
  bvlgari: "Italy",
  byredo: "Sweden",
  "calvin klein": "United States",
  "carolina herrera": "United States",
  cartier: "France",
  "casamorati 1888": "Italy",
  cerruti: "Italy",
  chanel: "France",
  chloe: "France",
  chloé: "France",
  clinique: "United States",
  creed: "United Kingdom",
  davidoff: "Switzerland",
  dior: "France",
  diptyque: "France",
  "dolce & gabbana": "Italy",
  "donna karan": "United States",
  "elizabeth arden": "United States",
  "essential parfums": "France",
  "etat libre d'orange": "France",
  "frederic malle editions de parfums": "France",
  "french avenue": "United Arab Emirates",
  givenchy: "France",
  "giorgio armani": "Italy",
  gucci: "Italy",
  guerlain: "France",
  hermes: "France",
  hermès: "France",
  "hugo boss": "Germany",
  "initio parfums prives": "France",
  "jean paul gaultier": "France",
  "jo malone london": "United Kingdom",
  "juliette has a gun": "France",
  "kayali fragrances": "United Arab Emirates",
  kenzo: "France",
  kilian: "France",
  lacoste: "France",
  lalique: "France",
  lancôme: "France",
  "lattafa perfumes": "United Arab Emirates",
  "le labo": "United States",
  loewe: "Spain",
  "louis vuitton": "France",
  lush: "United Kingdom",
  mancera: "France",
  "maison alhambra": "United Arab Emirates",
  "maison francis kurkdjian": "France",
  "maison martin margiela": "France",
  "maison margiela": "France",
  "memo paris": "France",
  montale: "France",
  montblanc: "Germany",
  moschino: "Italy",
  mugler: "France",
  nasomatto: "Netherlands",
  "narciso rodriguez": "United States",
  nishane: "Turkey",
  "orto parisi": "Netherlands",
  "paco rabanne": "France",
  "parfums de marly": "France",
  prada: "Italy",
  "ralph lauren": "United States",
  rasasi: "United Arab Emirates",
  "roja parfums": "United Kingdom",
  "serge lutens": "France",
  "sol de janeiro": "United States",
  "tauer perfumes": "Switzerland",
  "tiziana terenzi": "Italy",
  "tom ford": "United States",
  trussardi: "Italy",
  valentino: "Italy",
  versace: "Italy",
  "viktor & rolf": "Netherlands",
  xerjoff: "Italy",
  "yves rocher": "France",
  "yves saint laurent": "France",
  "zadig & voltaire": "France",
  "zoologist perfumes": "Canada",
};

const COUNTRY_ADJECTIVES: Record<string, string> = {
  Canada: "Canadian",
  France: "French",
  Germany: "German",
  Italy: "Italian",
  Netherlands: "Dutch",
  Oman: "Omani",
  Spain: "Spanish",
  Sweden: "Swedish",
  Switzerland: "Swiss",
  Turkey: "Turkish",
  "United Arab Emirates": "Emirati",
  "United Kingdom": "British",
  "United States": "American",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function idPart(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function vocabulary(
  fragrances: readonly Fragrance[],
  select: (fragrance: Fragrance) => readonly string[],
): string[] {
  const labels = new Map<string, string>();
  for (const fragrance of fragrances) {
    for (const value of select(fragrance)) {
      const key = normalize(value);
      if (key && !labels.has(key)) labels.set(key, value.trim());
    }
  }
  return [...labels.values()].sort((a, b) => a.localeCompare(b));
}

function question(
  category: TwentyQuestionsCategory,
  id: string,
  label: string,
  rule: QuestionRule,
): TwentyQuestionsQuestion {
  return {
    id,
    category,
    label,
    searchText: normalize(`${category} ${label}`),
    rule,
  };
}

export function createTwentyQuestionsQuestionBank(
  fragrances: readonly Fragrance[],
): TwentyQuestionsQuestion[] {
  const questions: TwentyQuestionsQuestion[] = [];

  for (const note of vocabulary(fragrances, allNotes)) {
    questions.push(
      question(
        "notes",
        `note:${idPart(note)}`,
        `Does it contain ${note}?`,
        { kind: "note", value: note },
      ),
    );
  }

  for (const accord of vocabulary(fragrances, (fragrance) => fragrance.accords)) {
    questions.push(
      question(
        "accords",
        `accord:${idPart(accord)}`,
        `Is ${accord} one of its main accords?`,
        { kind: "accord", value: accord },
      ),
    );
  }

  for (const year of [1980, 1990, 2000, 2010, 2020]) {
    questions.push(
      question(
        "release",
        `year-after:${year}`,
        `Was it released after ${year}?`,
        { kind: "year-after", value: year },
      ),
    );
  }

  for (const house of vocabulary(fragrances, (fragrance) => [fragrance.house])) {
    questions.push(
      question(
        "house",
        `house:${idPart(house)}`,
        `Is it from ${house}?`,
        { kind: "house", value: house },
      ),
    );
  }

  const countries = new Set<string>();
  for (const fragrance of fragrances) {
    const country = HOUSE_COUNTRIES[normalize(fragrance.house)];
    if (country) countries.add(country);
  }
  for (const country of [...countries].sort()) {
    const adjective = COUNTRY_ADJECTIVES[country] ?? country;
    const article = /^[aeiou]/i.test(adjective) ? "an" : "a";
    questions.push(
      question(
        "origin",
        `country:${idPart(country)}`,
        `Is it from ${article} ${adjective} house?`,
        { kind: "country", value: country },
      ),
    );
  }

  questions.push(
    question(
      "performance",
      "performance:long-lasting",
      "Is it described as long-lasting?",
      { kind: "long-lasting" },
    ),
    question(
      "performance",
      "performance:strong-sillage",
      "Does it have strong projection?",
      { kind: "strong-sillage" },
    ),
  );

  for (const price of [100, 150, 200, 300]) {
    questions.push(
      question(
        "price",
        `price-over:${price}`,
        `Does it cost over $${price}?`,
        { kind: "price-over", value: price },
      ),
    );
  }

  for (const rating of [3.8, 4, 4.2]) {
    questions.push(
      question(
        "rating",
        `rating-at-least:${rating}`,
        `Is its community rating at least ${rating.toFixed(1)}?`,
        { kind: "rating-at-least", value: rating },
      ),
    );
  }

  return questions;
}

function knownListAnswer(
  values: readonly string[],
  expected: string,
): TwentyQuestionsAnswer {
  if (values.length === 0) return "unknown";
  const target = normalize(expected);
  return values.some((value) => normalize(value) === target) ? "yes" : "no";
}

export function answerTwentyQuestionsQuestion(
  questionToAnswer: TwentyQuestionsQuestion,
  fragrance: Fragrance,
): TwentyQuestionsAnswer {
  const { rule } = questionToAnswer;

  switch (rule.kind) {
    case "note":
      return knownListAnswer(allNotes(fragrance), rule.value);
    case "accord":
      return knownListAnswer(fragrance.accords, rule.value);
    case "year-after":
      return fragrance.year > 0
        ? fragrance.year > rule.value
          ? "yes"
          : "no"
        : "unknown";
    case "house":
      return fragrance.house.trim()
        ? normalize(fragrance.house) === normalize(rule.value)
          ? "yes"
          : "no"
        : "unknown";
    case "country": {
      const country = HOUSE_COUNTRIES[normalize(fragrance.house)];
      if (!country) return "unknown";
      return country === rule.value ? "yes" : "no";
    }
    case "long-lasting": {
      if (!fragrance.longevity?.trim()) return "unknown";
      const value = normalize(fragrance.longevity);
      return value.includes("long") ||
        value.includes("above average") ||
        value.includes("eternal")
        ? "yes"
        : "no";
    }
    case "strong-sillage": {
      if (!fragrance.sillage?.trim()) return "unknown";
      const value = normalize(fragrance.sillage);
      return value.includes("strong") ||
        value.includes("enormous") ||
        value.includes("good projection") ||
        value.includes("heavy")
        ? "yes"
        : "no";
    }
    case "price-over":
      return fragrance.price > 0
        ? fragrance.price > rule.value
          ? "yes"
          : "no"
        : "unknown";
    case "rating-at-least":
      return fragrance.rating > 0
        ? fragrance.rating >= rule.value
          ? "yes"
          : "no"
        : "unknown";
  }
}

export function filterCandidatesByAnswer(
  candidates: readonly Fragrance[],
  answeredQuestion: TwentyQuestionsQuestion,
  answer: TwentyQuestionsAnswer,
): Fragrance[] {
  return candidates.filter(
    (candidate) =>
      answerTwentyQuestionsQuestion(answeredQuestion, candidate) === answer,
  );
}

export function questionDistribution(
  questionToScore: TwentyQuestionsQuestion,
  candidates: readonly Fragrance[],
): QuestionDistribution {
  const distribution = { yes: 0, no: 0, unknown: 0 };
  for (const candidate of candidates) {
    distribution[answerTwentyQuestionsQuestion(questionToScore, candidate)] += 1;
  }
  return {
    ...distribution,
    worstCase: Math.max(
      distribution.yes,
      distribution.no,
      distribution.unknown,
    ),
  };
}

export function rankMeaningfulQuestions(
  bank: readonly TwentyQuestionsQuestion[],
  candidates: readonly Fragrance[],
  askedIds: ReadonlySet<string>,
): RankedTwentyQuestionsQuestion[] {
  if (candidates.length <= 1) return [];
  const minimumReduction = candidates.length > 30 ? 3 : 1;

  return bank
    .filter((candidate) => !askedIds.has(candidate.id))
    .map((candidate) => ({
      question: candidate,
      distribution: questionDistribution(candidate, candidates),
    }))
    .filter(({ distribution }) => {
      const outcomes = [
        distribution.yes,
        distribution.no,
        distribution.unknown,
      ].filter((count) => count > 0);
      return (
        outcomes.length >= 2 &&
        distribution.worstCase <= candidates.length - minimumReduction
      );
    })
    .sort(
      (a, b) =>
        a.distribution.worstCase - b.distribution.worstCase ||
        a.distribution.unknown - b.distribution.unknown ||
        Math.abs(a.distribution.yes - a.distribution.no) -
          Math.abs(b.distribution.yes - b.distribution.no) ||
        a.question.label.localeCompare(b.question.label),
    );
}

export function scoreTwentyQuestions(
  questionsUsed: number,
  incorrectGuesses: number,
): number {
  return Math.max(
    0,
    100 -
      questionsUsed * QUESTION_COST -
      incorrectGuesses * WRONG_GUESS_COST,
  );
}

export function questionImpactLabel(
  distribution: QuestionDistribution,
  candidateCount: number,
): string {
  if (candidateCount <= 1) return "Solved";
  const worstShare = distribution.worstCase / candidateCount;
  if (worstShare <= 0.58) return "High impact";
  if (worstShare <= 0.75) return "Good split";
  return "Focused";
}
