import type { Fragrance } from "../types";
import { sample, shuffle } from "../random";

export interface MultipleChoiceRound {
  fragrance: Fragrance;
  /** For guess-description: the redacted description text */
  promptText?: string;
  options: string[];
  answerIndex: number;
}

export function generateWhichHouseRounds(
  pool: Fragrance[],
  rounds: number,
  houses: string[],
): MultipleChoiceRound[] {
  return sampleRounds(pool, rounds).map((fragrance) => {
    const decoys = sample(houses.filter((h) => h !== fragrance.house), 3);
    const options = shuffle([fragrance.house, ...decoys]);
    return {
      fragrance,
      options,
      answerIndex: options.indexOf(fragrance.house),
    };
  });
}

export function generateDescriptionRounds(
  pool: Fragrance[],
  rounds: number,
): MultipleChoiceRound[] {
  const withDescriptions = pool.filter((f) => f.description.length > 0);
  return sampleRounds(withDescriptions, rounds).map((fragrance) => {
    const decoys = sample(
      withDescriptions.filter((f) => f.id !== fragrance.id),
      3,
    );
    const options = shuffle([fragrance, ...decoys]).map(
      (f) => `${f.name} — ${f.house}`,
    );
    return {
      fragrance,
      promptText: redact(fragrance.description, [fragrance.name, fragrance.house]),
      options,
      answerIndex: options.indexOf(`${fragrance.name} — ${fragrance.house}`),
    };
  });
}

const REDACTION = "▮▮▮▮▮";

/** Replaces the fragrance name and house (and possessive forms) in the text. */
export function redact(text: string, terms: string[]): string {
  let out = text;
  for (const term of terms.filter(Boolean)) {
    const pattern = new RegExp(`${escapeRegExp(term)}(?:'s)?`, "gi");
    out = out.replace(pattern, REDACTION);
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sampleRounds(pool: Fragrance[], rounds: number): Fragrance[] {
  const shuffled = shuffle(pool);
  const result: Fragrance[] = [];
  for (let i = 0; i < rounds && shuffled.length > 0; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
}
