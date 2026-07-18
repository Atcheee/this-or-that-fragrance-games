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
  "perfect-match": (f) =>
    f.rating > 0 && (f.accords.length >= 2 || allNotes(f).length >= 3),
};

export interface PoolResult {
  pool: Fragrance[];
  source: "seed" | "fraganty";
}

/** Fragella CDN hotlinks 403 in the browser — treat as missing. */
export function hasUsableImage(f: Fragrance): boolean {
  const url = f.imageUrl;
  if (!url) return false;
  return !url.includes("cdn.fragella.com");
}

function cleanSearchName(name: string, house: string): string {
  let n = name.trim();
  for (const prefix of [
    "Emporio Armani - ",
    "Emporio Armani ",
    "Armani Privé - ",
    "Armani Privé ",
    "Armani Prive - ",
    "Armani Prive ",
    "Replica - ",
    "Casamorati - ",
    `${house} - `,
    `${house} `,
  ]) {
    if (n.toLowerCase().startsWith(prefix.toLowerCase())) {
      n = n.slice(prefix.length).trim();
    }
  }
  if (n.includes(" - ")) {
    const after = n.split(" - ").slice(1).join(" - ").trim();
    if (after.length >= 3) n = after;
  }
  return n.replace(/\s+/g, " ").trim();
}

function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Live Fraganty lookup so in-game cards aren't stuck on stale/missing catalog images. */
async function resolveImageUrl(
  name: string,
  house: string,
): Promise<string | undefined> {
  const cleaned = cleanSearchName(name, house);
  if (!cleaned) return undefined;
  try {
    const q = encodeURIComponent(`${cleaned} ${house}`);
    const res = await fetch(
      `https://fraganty.ai/api/search?q=${q}&limit=8`,
      { signal: AbortSignal.timeout(6_000) },
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      perfumes?: Array<{
        name?: string;
        brand?: string;
        image?: string;
        imageTransparent?: string;
      }>;
    };
      const tn = normKey(cleaned);
    const th = normKey(house);
    let best: { score: number; url: string } | null = null;
    for (const p of data.perfumes ?? []) {
      // Prefer transparent cutout; fall back to opaque JPEG in the card UI.
      const url = p.imageTransparent || p.image;
      if (!p.name || !url) continue;
      const hn = normKey(p.name);
      const hb = normKey(p.brand ?? "");
      let score = 0;
      if (hn === tn) score += 100;
      else if (hn.includes(tn) || tn.includes(hn)) score += 50;
      else continue;
      if (hb === th || hb.includes(th) || th.includes(hb)) score += 40;
      if (!best || score > best.score) best = { score, url };
    }
    return best && best.score >= 90 ? best.url : undefined;
  } catch {
    return undefined;
  }
}

async function ensurePoolImages(pool: Fragrance[]): Promise<Fragrance[]> {
  return Promise.all(
    pool.map(async (f) => {
      if (hasUsableImage(f)) return f;
      const imageUrl = await resolveImageUrl(f.name, f.house);
      return imageUrl ? { ...f, imageUrl } : f;
    }),
  );
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
          const pool = await ensurePoolImages(
            data.fragrances.slice(0, count),
          );
          return { pool, source: "fraganty" };
        }
      }
    } catch {
      // fall through to seed data
    }
  }

  const eligible = seedFragrances.filter(ELIGIBILITY[mode] ?? (() => true));
  const withImages = eligible.filter(hasUsableImage);
  // Prefer bottles that already have working images so cards aren't empty.
  const preferred =
    withImages.length >= Math.max(count * 2, 40) ? withImages : eligible;

  // Discovery needs a stable, broad catalog — take top by popularity, no random sample,
  // and skip live image fetches (would stall on hundreds of bottles).
  if (mode === "perfect-match") {
    const pool = [...preferred]
      .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
      .slice(0, Math.min(count, preferred.length));
    return { pool, source: "seed" };
  }

  const window = [...preferred]
    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
    .slice(0, Math.max(count * 8, 400));
  const sampled = sample(window, Math.min(count, window.length));
  const pool = await ensurePoolImages(sampled);
  return { pool, source: "seed" };
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
