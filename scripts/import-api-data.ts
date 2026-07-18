/**
 * Enriches and expands src/data/fragrances.json using two commercial APIs:
 *
 *  1. Fragella (https://api.fragella.com) — rich per-fragrance data
 *     including real prices. Key: FRAGELLA_API_KEY.
 *  2. FragranceFinder on RapidAPI
 *     (https://rapidapi.com/remote-skills-remote-skills-default/api/fragrancefinder-api)
 *     — search endpoint with descriptions and notes. Key: RAPIDAPI_KEY.
 *
 * Put keys in .env.local (FRAGELLA_API_KEY=…, RAPIDAPI_KEY=…) or the
 * environment. Free tiers allow only ~20 requests/month per API, so the
 * script:
 *   - caches every raw response in scripts/api-cache/ (re-runs are free),
 *   - respects per-source request budgets (see BUDGETS, override with
 *     FRAGELLA_BUDGET / RAPIDAPI_BUDGET),
 *   - queries by house, highest-value first, and stops when the budget runs out.
 *
 * Merge policy: existing entries win; API data only fills gaps (price,
 * description, rating, notes, accords, year) and new fragrances are appended.
 *
 * Run: npx tsx scripts/import-api-data.ts [--houses "Dior,Chanel,..."]
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { canonicalHouse, dedupeKey, norm, titleCase } from "./dataset-utils";

const JSON_PATH = path.join(__dirname, "..", "src", "data", "fragrances.json");
const CACHE_DIR = path.join(__dirname, "api-cache");
const ENV_PATH = path.join(__dirname, "..", ".env.local");

const BUDGETS = {
  fragella: Number(process.env.FRAGELLA_BUDGET ?? 15),
  rapidapi: Number(process.env.RAPIDAPI_BUDGET ?? 15),
};

interface FragranceOut {
  id: string;
  name: string;
  house: string;
  year: number;
  rating: number;
  price: number;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  accords: string[];
  description: string;
  votes?: number;
}

interface SourceStats {
  requests: number;
  cacheHits: number;
  added: number;
  enriched: number;
  errors: string[];
  /** Set on auth/quota failures: stop spending budget on this source. */
  stopped: boolean;
}

async function main() {
  loadDotEnv();
  const fragellaKey = process.env.FRAGELLA_API_KEY ?? "";
  const rapidKey = process.env.RAPIDAPI_KEY ?? "";

  if (!fragellaKey && !rapidKey) {
    console.error(
      [
        "No API keys found. Add one or both to .env.local:",
        "  FRAGELLA_API_KEY=…   (from https://api.fragella.com)",
        "  RAPIDAPI_KEY=…       (from https://rapidapi.com — subscribe to FragranceFinder API)",
        "Nothing was changed.",
      ].join("\n"),
    );
    process.exit(1);
  }

  const catalog = JSON.parse(readFileSync(JSON_PATH, "utf8")) as FragranceOut[];
  const byKey = new Map<string, FragranceOut>();
  for (const f of catalog) byKey.set(dedupeKey(f.name, f.house), f);

  const houses = parseHousesArg() ?? defaultHouses(catalog);
  console.log(`Querying up to ${houses.length} houses: ${houses.slice(0, 8).join(", ")}…\n`);

  mkdirSync(CACHE_DIR, { recursive: true });

  if (fragellaKey) {
    const stats = await importFragella(fragellaKey, houses, catalog, byKey);
    report("Fragella", stats);
  } else {
    console.log("Fragella: skipped (no FRAGELLA_API_KEY)");
  }

  if (rapidKey) {
    const stats = await importFragranceFinder(rapidKey, houses, catalog, byKey);
    report("FragranceFinder", stats);
  } else {
    console.log("FragranceFinder: skipped (no RAPIDAPI_KEY)");
  }

  writeFileSync(JSON_PATH, JSON.stringify(catalog) + "\n");
  console.log(`\nCatalog now has ${catalog.length} fragrances.`);
}

/* ---------------------------------- Fragella --------------------------------- */

async function importFragella(
  apiKey: string,
  houses: string[],
  catalog: FragranceOut[],
  byKey: Map<string, FragranceOut>,
): Promise<SourceStats> {
  const stats = newStats();
  for (const house of houses) {
    const url = `https://api.fragella.com/api/v1/brands/${encodeURIComponent(house)}?limit=100`;
    const data = await cachedFetch("fragella", url, { "x-api-key": apiKey }, BUDGETS.fragella, stats);
    if (data === null) continue;
    for (const item of extractArray(data)) {
      mergeItem(mapFragellaItem(item), catalog, byKey, stats);
    }
  }
  return stats;
}

function mapFragellaItem(item: unknown): FragranceOut | null {
  const p = item as Record<string, unknown>;
  const house = canonicalHouse(str(p["Brand"]) || str(p["brand"]));
  let name = str(p["Name"]) || str(p["name"]);
  if (!name || !house) return null;
  // Fragella often prefixes the brand onto the name ("Tom Ford Lost Cherry").
  if (name.toLowerCase().startsWith(house.toLowerCase() + " ")) {
    name = name.slice(house.length).trim();
  }
  for (const prefix of ["Emporio Armani ", "Armani Prive ", "Armani Privé ", "Armani "]) {
    if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
      name = name.slice(prefix.length).trim();
    }
  }
  if (!name) return null;

  const notes = (p["Notes"] ?? {}) as Record<string, unknown>;
  const top = noteNames(notes["Top"]);
  const heart = noteNames(notes["Middle"]);
  const base = noteNames(notes["Base"]);
  // Fall back to the flat general-notes list when the pyramid is missing.
  const general = noteNames(p["General Notes"]);
  const rating = clampRating(num(p["rating"]) ?? num(p["Rating"]) ?? 0);
  if (rating <= 0) return null;
  if (top.length + heart.length + base.length + general.length === 0) return null;
  const accords = strArray(p["Main Accords"]).map((a) => a.toLowerCase());
  if (accords.length === 0) return null;

  return {
    id: `fragella-${norm(house)}-${norm(name)}`,
    name,
    house,
    year: int(p["Year"]),
    rating,
    price: Math.round((num(p["Price"]) ?? 0) * 100) / 100,
    topNotes: top.length > 0 ? top : general.slice(0, Math.ceil(general.length / 3)),
    heartNotes:
      heart.length > 0
        ? heart
        : general.slice(
            Math.ceil(general.length / 3),
            Math.ceil((2 * general.length) / 3),
          ),
    baseNotes:
      base.length > 0 ? base : general.slice(Math.ceil((2 * general.length) / 3)),
    accords,
    description: str(p["Description"]) || str(p["description"]),
  };
}

/* ------------------------------ FragranceFinder ------------------------------ */

async function importFragranceFinder(
  apiKey: string,
  houses: string[],
  catalog: FragranceOut[],
  byKey: Map<string, FragranceOut>,
): Promise<SourceStats> {
  const stats = newStats();
  for (const house of houses) {
    // Real path (RapidAPI docs incorrectly list /search?keyword=).
    const url = `https://fragrancefinder-api.p.rapidapi.com/perfumes/search?q=${encodeURIComponent(house)}`;
    const data = await cachedFetch(
      "fragrancefinder",
      url,
      {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": "fragrancefinder-api.p.rapidapi.com",
        "Content-Type": "application/json",
      },
      BUDGETS.rapidapi,
      stats,
    );
    if (data === null) continue;
    for (const item of extractArray(data)) {
      mergeItem(mapFragranceFinderItem(item), catalog, byKey, stats);
    }
  }
  return stats;
}

/**
 * FragranceFinder (RapidAPI) returns Fragrantica-derived rows shaped like:
 * { perfume, brand: "dior perfumes and colognes", notes: string[], accords,
 *   description, rating, url, id }
 */
function mapFragranceFinderItem(item: unknown): FragranceOut | null {
  const p = item as Record<string, unknown>;
  const rawBrand = str(p["brand"])
    .replace(/\s+perfumes and colognes$/i, "")
    .replace(/\s+perfume$/i, "")
    .trim();
  const house = canonicalHouse(rawBrand || str(p["designer"]) || str(p["house"]));
  let name = str(p["perfume"]) || str(p["name"]) || str(p["title"]);
  if (!name || !house) return null;

  name = name
    .replace(/\s+for\s+(women|men|women and men|unisex)\s*$/i, "")
    .trim();
  if (name.toLowerCase().endsWith(house.toLowerCase())) {
    name = name.slice(0, name.length - house.length).trim();
  }
  if (name.toLowerCase().startsWith(house.toLowerCase() + " ")) {
    name = name.slice(house.length).trim();
  }
  if (!name) return null;

  const description = str(p["description"]);
  const pyramid = parsePyramidFromDescription(description);
  const flat = Array.isArray(p["notes"]) ? noteNames(p["notes"]) : [];
  const top = pyramid.top.length > 0 ? pyramid.top : [];
  const heart =
    pyramid.heart.length > 0
      ? pyramid.heart
      : flat.length > 0
        ? flat
        : [];
  const base = pyramid.base.length > 0 ? pyramid.base : [];
  if (top.length + heart.length + base.length === 0) return null;

  const accords = strArray(p["accords"]).map((a) => a.toLowerCase());
  const year =
    int(p["year"] ?? p["release_year"]) ||
    (description.match(/launched in (\d{4})/i)
      ? Number(description.match(/launched in (\d{4})/i)![1])
      : 0);
  const rating = clampRating(num(p["rating"]) ?? num(p["rating_value"]) ?? 0);

  return {
    id: `ff-${norm(house)}-${norm(name)}`,
    name,
    house,
    year,
    rating,
    price: 0,
    topNotes: top,
    heartNotes: heart,
    baseNotes: base,
    accords,
    description,
  };
}

/** Pull top/heart/base lists out of Fragrantica-style description sentences. */
function parsePyramidFromDescription(description: string): {
  top: string[];
  heart: string[];
  base: string[];
} {
  const empty = { top: [] as string[], heart: [] as string[], base: [] as string[] };
  if (!description) return empty;

  const grab = (label: RegExp): string[] => {
    const m = description.match(label);
    if (!m?.[1]) return [];
    return m[1]
      .split(/,| and /i)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && !/^the nose/i.test(s))
      .map(titleCase);
  };

  return {
    top: grab(/Top notes? (?:is|are) ([^.;]+)/i),
    heart: grab(/middle notes? (?:is|are) ([^.;]+)/i),
    base: grab(/base notes? (?:is|are) ([^.;]+)/i),
  };
}

/* ---------------------------------- merging ---------------------------------- */

function mergeItem(
  incoming: FragranceOut | null,
  catalog: FragranceOut[],
  byKey: Map<string, FragranceOut>,
  stats: SourceStats,
) {
  if (!incoming) return;
  if (incoming.topNotes.length + incoming.heartNotes.length + incoming.baseNotes.length === 0) {
    return; // useless for the games
  }

  const key = dedupeKey(incoming.name, incoming.house);
  const existing = byKey.get(key);
  if (!existing) {
    // FragranceFinder often returns null ratings — only add new entries that
    // have a usable rating so quiz modes stay fair.
    if (incoming.rating <= 0) return;
    catalog.push(incoming);
    byKey.set(key, incoming);
    stats.added++;
    return;
  }

  // Fill gaps only; hand-curated and higher-quality data stays.
  let enriched = false;
  if (existing.price === 0 && incoming.price > 0) {
    existing.price = incoming.price;
    enriched = true;
  }
  if (!existing.description && incoming.description) {
    existing.description = incoming.description;
    enriched = true;
  }
  if (existing.rating === 0 && incoming.rating > 0) {
    existing.rating = incoming.rating;
    enriched = true;
  }
  if (existing.year === 0 && incoming.year > 0) {
    existing.year = incoming.year;
    enriched = true;
  }
  if (
    existing.topNotes.length + existing.heartNotes.length + existing.baseNotes.length === 0
  ) {
    existing.topNotes = incoming.topNotes;
    existing.heartNotes = incoming.heartNotes;
    existing.baseNotes = incoming.baseNotes;
    enriched = true;
  }
  if (existing.accords.length === 0 && incoming.accords.length > 0) {
    existing.accords = incoming.accords;
    enriched = true;
  }
  if (enriched) stats.enriched++;
}

/* ------------------------------ fetch + caching ------------------------------ */

async function cachedFetch(
  source: string,
  url: string,
  headers: Record<string, string>,
  budget: number,
  stats: SourceStats,
): Promise<unknown | null> {
  const cacheFile = path.join(
    CACHE_DIR,
    `${source}-${createHash("sha1").update(url).digest("hex").slice(0, 16)}.json`,
  );
  if (existsSync(cacheFile)) {
    stats.cacheHits++;
    return JSON.parse(readFileSync(cacheFile, "utf8"));
  }
  if (stats.stopped || stats.requests >= budget) return null;

  stats.requests++;
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401 || res.status === 403) {
      stats.errors.push(`${res.status} auth error — check your API key (${url})`);
      stats.stopped = true;
      return null;
    }
    if (res.status === 429) {
      stats.errors.push("429 rate/quota limit reached — stopping this source");
      stats.stopped = true;
      return null;
    }
    if (!res.ok) {
      stats.errors.push(`${res.status} for ${url}`);
      return null;
    }
    const data = await res.json();
    writeFileSync(cacheFile, JSON.stringify(data));
    return data;
  } catch (err) {
    stats.errors.push(`fetch failed for ${url}: ${(err as Error).message}`);
    return null;
  }
}

/* ---------------------------------- helpers ---------------------------------- */

function loadDotEnv() {
  if (!existsSync(ENV_PATH)) return;
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function parseHousesArg(): string[] | null {
  const i = process.argv.indexOf("--houses");
  if (i === -1 || !process.argv[i + 1]) return null;
  return process.argv[i + 1].split(",").map((s) => s.trim()).filter(Boolean);
}

/** Curated houses first (most entries first), since those anchor the games. */
function defaultHouses(catalog: FragranceOut[]): string[] {
  const counts = new Map<string, number>();
  for (const f of catalog) {
    if (f.price > 0) counts.set(f.house, (counts.get(f.house) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
}

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const obj = data as Record<string, unknown>;
  for (const field of ["results", "fragrances", "perfumes", "data", "items", "hits"]) {
    if (Array.isArray(obj?.[field])) return obj[field] as unknown[];
  }
  return [];
}

function noteNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [
    ...new Set(
      v
        .map((item) =>
          typeof item === "string"
            ? item
            : str((item as Record<string, unknown>)?.name),
        )
        .filter(Boolean)
        .map(titleCase),
    ),
  ];
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && v.trim() !== "" ? n : null;
  }
  return null;
}

function int(v: unknown): number {
  const n = num(v);
  return n === null ? 0 : Math.round(n);
}

function clampRating(r: number): number {
  // Sources use 0–5 or 0–10 scales; normalize to 0–5.
  const scaled = r > 5 ? r / 2 : r;
  return Math.round(Math.min(Math.max(scaled, 0), 5) * 10) / 10;
}

function newStats(): SourceStats {
  return {
    requests: 0,
    cacheHits: 0,
    added: 0,
    enriched: 0,
    errors: [],
    stopped: false,
  };
}

function report(label: string, stats: SourceStats) {
  console.log(
    `${label}: ${stats.requests} requests (${stats.cacheHits} cache hits), ` +
      `${stats.added} added, ${stats.enriched} enriched`,
  );
  for (const err of stats.errors) console.log(`  ! ${err}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
