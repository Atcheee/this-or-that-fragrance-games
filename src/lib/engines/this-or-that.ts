import type { Fragrance } from "../types";
import { shuffle } from "../random";

export interface PairRound {
  a: Fragrance;
  b: Fragrance;
  /** id of the fragrance with the higher value */
  correctId: string;
}

/**
 * King-of-the-hill pair rounds: the objectively correct fragrance stays as
 * champion, and the other side is replaced with a fresh challenger each round.
 * The champion keeps its side so the board feels continuous.
 */
export function generatePairRounds(
  pool: Fragrance[],
  rounds: number,
  value: (f: Fragrance) => number,
): PairRound[] {
  if (rounds < 1 || pool.length < 2) return [];

  const result: PairRound[] = [];
  const usedIds = new Set<string>();
  let deck = shuffle(pool);
  let guard = 0;

  function draw(
    exclude: Set<string>,
    differentFrom?: Fragrance,
  ): Fragrance | null {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (deck.length === 0) deck = shuffle(pool);
      const index = deck.findIndex((f) => {
        if (exclude.has(f.id)) return false;
        if (differentFrom && value(f) === value(differentFrom)) return false;
        return true;
      });
      if (index !== -1) {
        const [picked] = deck.splice(index, 1);
        return picked;
      }
      deck = shuffle(pool);
    }
    return null;
  }

  // Opening matchup — two fragrances with distinct values, order randomized.
  let openingGuard = 0;
  let first: Fragrance | null = null;
  let second: Fragrance | null = null;
  while (openingGuard++ < 40) {
    usedIds.clear();
    first = draw(usedIds);
    if (!first) return [];
    usedIds.add(first.id);
    second = draw(usedIds, first);
    if (!second) {
      usedIds.delete(first.id);
      continue;
    }
    usedIds.add(second.id);
    break;
  }
  if (!first || !second) return [];

  const [left, right] = shuffle([first, second]);
  result.push({
    a: left,
    b: right,
    correctId: value(left) > value(right) ? left.id : right.id,
  });

  while (result.length < rounds && guard++ < rounds * 30) {
    const previous = result[result.length - 1]!;
    const champion =
      previous.correctId === previous.a.id ? previous.a : previous.b;
    const championOnLeft = previous.correctId === previous.a.id;

    const challenger = draw(usedIds, champion);
    if (!challenger) break;
    usedIds.add(challenger.id);

    const a = championOnLeft ? champion : challenger;
    const b = championOnLeft ? challenger : champion;
    result.push({
      a,
      b,
      correctId: value(a) > value(b) ? a.id : b.id,
    });
  }

  return result;
}
