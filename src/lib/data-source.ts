import rawData from "@/data/fragrances.json";
import type { Fragrance, GameModeId } from "./types";
import { allNotes } from "./types";
import { sample } from "./random";

export const seedFragrances: Fragrance[] = rawData as Fragrance[];

/**
 * Well-known subset used where obscure entries would hurt gameplay
 * (naming challenges, house decoys). Curated entries (the ones with prices)
 * are always included.
 */
export const popularFragrances: Fragrance[] = seedFragrances.filter(
  (f) => (f.votes ?? 0) >= 100 || f.price > 0,
);

/**
 * Modes that can run on a Fraganty-fetched pool. The rest need data the API
 * doesn't expose (prices, descriptions) or the full local catalog (naming,
 * house decoys), so they always use the seed dataset.
 */
const FRAGANTY_CAPABLE: GameModeId[] = [
  "higher-rating",
  "contains-note",
  "has-accord",
  "find-favorite",
];

/** Per-mode data requirements for seed-pool eligibility. */
const ELIGIBILITY: Partial<Record<GameModeId, (f: Fragrance) => boolean>> = {
  "cost-more": (f) => f.price > 0,
  "guess-description": (f) => f.description.length > 0,
  "higher-rating": (f) => f.rating > 0,
};

export interface PoolResult {
  pool: Fragrance[];
  source: "seed" | "fraganty";
}

export async function getPoolForMode(
  mode: GameModeId,
  count: number,
  apiKey: string,
): Promise<PoolResult> {
  if (apiKey && FRAGANTY_CAPABLE.includes(mode)) {
    try {
      const res = await fetch(`/api/fraganty/pool?count=${count}`, {
        headers: { "x-api-key": apiKey },
      });
      if (res.ok) {
        const data = (await res.json()) as { fragrances: Fragrance[] };
        if (Array.isArray(data.fragrances) && data.fragrances.length >= count) {
          return { pool: data.fragrances.slice(0, count), source: "fraganty" };
        }
      }
    } catch {
      // fall through to seed data
    }
  }

  const eligible = seedFragrances.filter(ELIGIBILITY[mode] ?? (() => true));
  // Bias pools toward well-known fragrances: draw from the most-voted window
  // rather than the whole catalog, keeping games recognizable.
  const window = [...eligible]
    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
    .slice(0, Math.max(count * 8, 400));
  return { pool: sample(window, Math.min(count, window.length)), source: "seed" };
}

export function allHouses(data: Fragrance[] = popularFragrances): string[] {
  return [...new Set(data.map((f) => f.house))];
}

export function noteVocabulary(data: Fragrance[] = seedFragrances): string[] {
  return [...new Set(data.flatMap(allNotes))];
}

export function accordVocabulary(data: Fragrance[] = seedFragrances): string[] {
  return [...new Set(data.flatMap((f) => f.accords))];
}
