import type { Fragrance } from "../types";
import { shuffle } from "../random";

export interface PairRound {
  a: Fragrance;
  b: Fragrance;
  /** id of the fragrance with the higher value */
  correctId: string;
}

/**
 * Builds rounds of two fragrances with distinct values so there is always a
 * correct answer. Reuses pool entries in fresh pairings if rounds > pool/2.
 */
export function generatePairRounds(
  pool: Fragrance[],
  rounds: number,
  value: (f: Fragrance) => number,
): PairRound[] {
  const result: PairRound[] = [];
  const seenPairs = new Set<string>();
  let candidates = shuffle(pool);
  let guard = 0;

  while (result.length < rounds && guard < rounds * 30) {
    guard++;
    if (candidates.length < 2) candidates = shuffle(pool);
    const a = candidates.pop()!;
    const bIndex = candidates.findIndex(
      (f) => f.id !== a.id && value(f) !== value(a),
    );
    if (bIndex === -1) continue;
    const b = candidates.splice(bIndex, 1)[0];
    const key = [a.id, b.id].sort().join("|");
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    const [first, second] = shuffle([a, b]);
    result.push({
      a: first,
      b: second,
      correctId: value(first) > value(second) ? first.id : second.id,
    });
  }
  return result;
}
