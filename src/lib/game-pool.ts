import "server-only";

import { CONNECTION_PUZZLES } from "@/data/connections-puzzles";
import { getAllCatalogFragrances } from "@/lib/catalog";
import {
  dailyConnectionPuzzle,
  generateConnectionPuzzle,
  randomConnectionPuzzle,
} from "@/lib/engines/connections";
import { generateFragranceGrid } from "@/lib/engines/fragrance-grid";
import {
  createOddOneOutPracticeSeed,
  dailyOddOneOutSeed,
  generateOddOneOutRounds,
} from "@/lib/engines/odd-one-out";
import {
  createHouseChallenge,
  createNoteChallenge,
} from "@/lib/engines/naming";
import { sample } from "@/lib/random";
import type { GameStartResponse } from "@/lib/data-source";
import type { Fragrance, GameKind, GameModeId } from "@/lib/types";
import { allNotes } from "@/lib/types";

/** Cap for client-side search catalogs (grid / pyramid / bottle / timeline). */
export const PLAY_CATALOG_LIMIT = 3_000;

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

function asFragrance(f: Fragrance): Fragrance {
  // Drop catalog-only extras and keep payloads lean for the client.
  const {
    id,
    name,
    house,
    year,
    rating,
    price,
    topNotes,
    heartNotes,
    baseNotes,
    accords,
    description,
    votes,
    imageUrl,
    longevity,
    sillage,
    wear,
  } = f;
  return {
    id,
    name,
    house,
    year,
    rating,
    price,
    topNotes,
    heartNotes,
    baseNotes,
    accords,
    description,
    ...(votes !== undefined ? { votes } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(longevity ? { longevity } : {}),
    ...(sillage ? { sillage } : {}),
    ...(wear ? { wear } : {}),
  };
}

function slimForClient(f: Fragrance): Fragrance {
  const next = asFragrance(f);
  // Descriptions are large and unused by search/puzzle UIs.
  return { ...next, description: "" };
}

function allSeedFragrances(): readonly Fragrance[] {
  return getAllCatalogFragrances();
}

export function getPopularFragrances(): Fragrance[] {
  return allSeedFragrances().filter(
    (f) => (f.votes ?? 0) >= 100 || f.price > 0,
  );
}

/** Recognizable subset used for client search + local challenge generation. */
export function getPlayCatalog(limit = PLAY_CATALOG_LIMIT): Fragrance[] {
  return [...allSeedFragrances()]
    .sort(
      (a, b) =>
        (b.votes ?? 0) - (a.votes ?? 0) ||
        b.rating - a.rating ||
        a.name.localeCompare(b.name),
    )
    .slice(0, Math.max(1, Math.min(limit, 8_000)))
    .map(slimForClient);
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
    const leadingEau = (s: string) => /^\s*eau\b/i.test(s);
    const targetHasEau = leadingEau(cleaned);
    let best: { score: number; url: string } | null = null;
    for (const p of data.perfumes ?? []) {
      const url = p.imageTransparent || p.image;
      if (!p.name || !url) continue;
      // "Eau Sauvage" must not satisfy a bare "Sauvage" lookup.
      if (leadingEau(p.name) !== targetHasEau) continue;
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
      if (hasUsableImage(f)) return asFragrance(f);
      const imageUrl = await resolveImageUrl(f.name, f.house);
      return asFragrance(imageUrl ? { ...f, imageUrl } : f);
    }),
  );
}

export async function getPoolForMode(
  mode: GameModeId,
  count: number,
  _apiKey = "",
): Promise<PoolResult> {
  // Fraganty pools are fetched client-side (user API key + relative URL).
  void _apiKey;

  const seedFragrances = allSeedFragrances();
  const eligible = seedFragrances.filter(ELIGIBILITY[mode] ?? (() => true));
  const withImages = eligible.filter(hasUsableImage);
  const preferred =
    withImages.length >= Math.max(count * 2, 40) ? withImages : eligible;

  if (mode === "perfect-match") {
    const pool = [...preferred]
      .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
      .slice(0, Math.min(count, preferred.length))
      .map(asFragrance);
    return { pool, source: "seed" };
  }

  const window = [...preferred]
    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
    .slice(0, Math.max(count * 8, 400));
  const sampled = sample(window, Math.min(count, window.length));
  const pool = await ensurePoolImages(sampled);
  return { pool, source: "seed" };
}

export type GameStartRequest = {
  modeId: GameModeId;
  kind: GameKind;
  rounds?: number;
  bracketSize?: number;
  challengeVariant?: "daily" | "practice";
  connectionsVariant?: "daily" | "curated" | "generated";
  dateKey?: string;
  poolCount?: number;
};

export async function prepareGameStart(
  request: GameStartRequest,
): Promise<GameStartResponse> {
  const {
    modeId,
    kind,
    rounds = 10,
    challengeVariant = "practice",
    connectionsVariant = "curated",
    dateKey,
    poolCount,
  } = request;

  const catalog = allSeedFragrances();
  const playCatalog = getPlayCatalog();

  if (kind === "connections") {
    const fallback = CONNECTION_PUZZLES[0];
    if (!fallback) throw new Error("No Connections puzzles are configured.");
    const puzzle =
      connectionsVariant === "daily"
        ? dailyConnectionPuzzle(CONNECTION_PUZZLES, catalog)
        : connectionsVariant === "generated"
          ? generateConnectionPuzzle(catalog, fallback)
          : randomConnectionPuzzle(CONNECTION_PUZZLES, catalog);
    return { source: "seed", pool: [], connectionsPuzzle: puzzle };
  }

  if (kind === "fragrance-grid") {
    const seed =
      challengeVariant === "daily"
        ? `fragrance-grid:${dateKey ?? new Date().toISOString().slice(0, 10)}`
        : `fragrance-grid:practice:${Date.now()}:${Math.random()}`;
    // Generate against the same recognizable set the client will search.
    const puzzle = generateFragranceGrid(playCatalog, { seed });
    return {
      source: "seed",
      pool: playCatalog,
      fragranceGridPuzzle: puzzle,
    };
  }

  if (kind === "odd-one-out") {
    const seed =
      challengeVariant === "daily"
        ? dailyOddOneOutSeed(dateKey ?? new Date())
        : createOddOneOutPracticeSeed();
    const oddOneOutRounds = generateOddOneOutRounds(catalog, rounds, { seed });
    return {
      source: "seed",
      pool: [],
      oddOneOutRounds,
      oddOneOutSeed: seed,
    };
  }

  if (kind === "naming") {
    const popular = getPopularFragrances();
    const namingChallenge =
      modeId === "name-by-house"
        ? createHouseChallenge(popular)
        : createNoteChallenge(popular);
    return { source: "seed", pool: [], namingChallenge };
  }

  if (
    kind === "note-pyramid" ||
    kind === "bottle-silhouette" ||
    kind === "fragrance-timeline"
  ) {
    return { source: "seed", pool: playCatalog };
  }

  if (kind === "build-an-accord") {
    return { source: "seed", pool: [] };
  }

  const count =
    poolCount ??
    (kind === "discovery"
      ? 800
      : kind === "bracket"
        ? (request.bracketSize ?? 16)
        : kind === "this-or-that"
          ? rounds + 16
          : Math.max(rounds, 16));

  const result = await getPoolForMode(modeId, count);
  return { source: result.source, pool: result.pool };
}
