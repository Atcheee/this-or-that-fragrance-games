import type { Fragrance } from "../types";
import { pick, shuffle } from "../random";

export interface YesNoRound {
  fragrance: Fragrance;
  /** The note or accord being asked about */
  subject: string;
  answer: boolean;
}

/**
 * Roughly half the rounds use a real note/accord from the fragrance, the
 * other half a decoy drawn from the global vocabulary.
 */
export function generateYesNoRounds(
  pool: Fragrance[],
  rounds: number,
  extract: (f: Fragrance) => string[],
  vocabulary: string[],
): YesNoRound[] {
  const result: YesNoRound[] = [];
  let candidates = shuffle(pool);

  for (let i = 0; i < rounds; i++) {
    if (candidates.length === 0) candidates = shuffle(pool);
    const fragrance = candidates.pop()!;
    const own = extract(fragrance);
    const decoys = vocabulary.filter((v) => !own.includes(v));
    const wantYes = own.length > 0 && (decoys.length === 0 || Math.random() < 0.5);
    result.push({
      fragrance,
      subject: wantYes ? pick(own) : pick(decoys),
      answer: wantYes,
    });
  }
  return result;
}
