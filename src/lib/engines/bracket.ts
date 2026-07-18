import type { Fragrance } from "../types";
import { sample } from "../random";

export const BRACKET_SIZES = [8, 16, 32] as const;
export type BracketSize = (typeof BRACKET_SIZES)[number];

export function createBracket(pool: Fragrance[], size: BracketSize): Fragrance[] {
  return sample(pool, Math.min(size, pool.length - (pool.length % 2)));
}

export function roundName(competitors: number): string {
  switch (competitors) {
    case 2:
      return "Final";
    case 4:
      return "Semifinals";
    case 8:
      return "Quarterfinals";
    default:
      return `Round of ${competitors}`;
  }
}
