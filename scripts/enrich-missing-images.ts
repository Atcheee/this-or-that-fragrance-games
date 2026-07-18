/**
 * Fills / repairs fragrance.imageUrl values via Fraganty public search.
 *
 * Many Fragella CDN URLs (cdn.fragella.com) return 403 when hotlinked — those
 * are treated as broken and replaced. FragranceFinder (`--ff`) is optional.
 *
 * Run:
 *   npx tsx scripts/enrich-missing-images.ts --all --concurrency 10
 *   npx tsx scripts/enrich-missing-images.ts --fix-broken --limit 900
 *   npx tsx scripts/enrich-missing-images.ts --limit 500 --min-votes 50
 *   npx tsx scripts/enrich-missing-images.ts --all --ff
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { canonicalHouse, norm } from "./dataset-utils";

const JSON_PATH = path.join(__dirname, "..", "src", "data", "fragrances.json");
const CACHE_DIR = path.join(__dirname, "api-cache", "image-enrich");
const ENV_PATH = path.join(__dirname, "..", ".env.local");

const FRAGANTY_SEARCH = "https://fraganty.ai/api/search";
const FF_SEARCH =
  "https://fragrancefinder-api.p.rapidapi.com/perfumes/search";
const FIMGS = (id: string) =>
  `https://fimgs.net/mdimg/perfume/375x500.${id}.jpg`;

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
  imageUrl?: string;
}

interface Hit {
  name: string;
  brand: string;
  imageUrl: string;
  score: number;
  source: string;
}

function loadDotEnv() {
  if (!existsSync(ENV_PATH)) return;
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (match && process.env[match[1]!] === undefined) {
      process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
    }
  }
}

function argNum(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) ? n : fallback;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function isBrokenHost(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes("cdn.fragella.com");
}

/** Strip line prefixes that confuse search + matching. */
function cleanName(name: string, house: string): string {
  let n = name.trim().replace(/\s*[|/].*$/, "").trim();

  const prefixes = [
    "Emporio Armani - ",
    "Emporio Armani ",
    "Armani Privé - ",
    "Armani Privé ",
    "Armani Prive - ",
    "Armani Prive ",
    "Armani Code ",
    "Armani ",
    "Replica - ",
    "Replica ",
    "Casamorati - ",
    "Casamorati ",
    "Les Royales Exclusives - ",
    "Le Vestiaire - ",
    "Shooting Stars - ",
    `${house} - `,
    `${house} `,
  ];
  for (const p of prefixes) {
    if (n.toLowerCase().startsWith(p.toLowerCase())) {
      n = n.slice(p.length).trim();
    }
  }

  if (n.includes(" - ")) {
    const after = n.split(" - ").slice(1).join(" - ").trim();
    if (after.length >= 3) n = after;
  }

  return n.replace(/\s+/g, " ").trim();
}

function matchScore(
  targetName: string,
  targetHouse: string,
  hitName: string,
  hitBrand: string,
): number {
  const tn = norm(targetName);
  const th = norm(targetHouse);
  const hn = norm(hitName);
  const hb = norm(canonicalHouse(hitBrand));
  if (!tn || !hn) return -Infinity;

  let score = 0;
  if (hn === tn) score += 100;
  else if (hn.startsWith(tn) || tn.startsWith(hn)) score += 70;
  else if (hn.includes(tn) || tn.includes(hn)) score += 45;
  else {
    const ta = new Set(tn.match(/[a-z0-9]+/g) ?? []);
    const ha = new Set(hn.match(/[a-z0-9]+/g) ?? []);
    let overlap = 0;
    for (const t of ta) if (ha.has(t)) overlap++;
    if (overlap === 0) return -Infinity;
    score += (overlap / Math.max(ta.size, ha.size)) * 40;
  }

  if (hb === th) score += 40;
  else if (hb.includes(th) || th.includes(hb)) score += 22;
  else score -= 15;

  score -= Math.min(30, Math.abs(hn.length - tn.length));
  return score;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function cachePath(source: string, key: string): string {
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return path.join(CACHE_DIR, `${source}-${hash}.json`);
}

async function cachedJson<T>(
  source: string,
  key: string,
  fetcher: () => Promise<T | null>,
): Promise<T | null> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = cachePath(source, key);
  if (existsSync(file)) {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  }
  try {
    const data = await fetcher();
    if (data !== null) writeFileSync(file, JSON.stringify(data));
    return data;
  } catch {
    return null;
  }
}

function pickImage(p: Record<string, unknown>): string {
  // Prefer transparent cutout; card UI falls back to JPEG if nobg 404s.
  return (
    String(p.imageTransparent ?? "") ||
    String(p.image ?? "") ||
    String(p.imageUrl ?? "")
  );
}

async function searchFraganty(
  name: string,
  house: string,
): Promise<Hit | null> {
  const cleaned = cleanName(name, house);
  if (!cleaned) return null;

  const queries = [`${cleaned} ${house}`, cleaned];
  let best: Hit | null = null;

  for (const q of queries) {
    const data = await cachedJson<{
      perfumes?: Array<Record<string, unknown>>;
    }>("fraganty-search", q, async () => {
      const res = await fetch(
        `${FRAGANTY_SEARCH}?q=${encodeURIComponent(q)}&limit=12`,
        { signal: AbortSignal.timeout(6_000) },
      );
      if (!res.ok) return null;
      return (await res.json()) as { perfumes?: Array<Record<string, unknown>> };
    });
    await sleep(20);

    for (const p of data?.perfumes ?? []) {
      const hitName = String(p.name ?? "");
      const brand = String(p.brand ?? "");
      const imageUrl = pickImage(p);
      if (!hitName || !imageUrl) continue;
      const score = matchScore(cleaned, house, hitName, brand);
      if (!best || score > best.score) {
        best = { name: hitName, brand, imageUrl, score, source: "fraganty" };
      }
    }
    if (best && best.score >= 100) break;
  }

  return best && best.score >= 55 ? best : null;
}

async function searchFragranceFinder(
  apiKey: string,
  name: string,
  house: string,
): Promise<Hit | null> {
  const cleaned = cleanName(name, house);
  const q = `${cleaned} ${house}`;
  const data = await cachedJson<unknown>("ff-search", q, async () => {
    const res = await fetch(`${FF_SEARCH}?q=${encodeURIComponent(q)}`, {
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": "fragrancefinder-api.p.rapidapi.com",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return null;
    }
    if (!res.ok) return null;
    return await res.json();
  });
  await sleep(40);

  const list = extractArray(data);
  let best: Hit | null = null;
  for (const item of list) {
    const p = item as Record<string, unknown>;
    const hitName = String(p.perfume ?? p.name ?? "");
    const brand = String(p.brand ?? "")
      .replace(/\s+perfumes and colognes$/i, "")
      .trim();
    const id =
      String(p.id ?? "") ||
      (String(p.url ?? "").match(/-(\d+)\.html?$/i)?.[1] ?? "");
    if (!hitName || !id) continue;
    const score = matchScore(cleaned, house, hitName, brand);
    if (!best || score > best.score) {
      best = {
        name: hitName,
        brand,
        imageUrl: FIMGS(id),
        score,
        source: "fragrancefinder",
      };
    }
  }
  return best && best.score >= 55 ? best : null;
}

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  for (const key of ["data", "results", "perfumes", "items"]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

function needsImage(
  f: FragranceOut,
  opts: { all: boolean; fixBroken: boolean; minVotes: number },
): boolean {
  if (isBrokenHost(f.imageUrl)) return opts.fixBroken || opts.all;
  if (f.imageUrl) return false;
  if (opts.all) return true;
  return f.price > 0 || (f.votes ?? 0) >= opts.minVotes;
}

async function main() {
  loadDotEnv();
  const all = hasFlag("--all");
  const fixBroken = hasFlag("--fix-broken") || all;
  const limit = argNum("--limit", all ? 50_000 : 800);
  const minVotes = argNum("--min-votes", all ? 0 : 80);
  const concurrency = Math.max(1, argNum("--concurrency", 10));
  const allowFf = hasFlag("--ff");
  const rapidKey = allowFf ? (process.env.RAPIDAPI_KEY ?? "") : "";

  const catalog = JSON.parse(readFileSync(JSON_PATH, "utf8")) as FragranceOut[];
  const queue = catalog
    .filter((f) => needsImage(f, { all, fixBroken, minVotes }))
    .sort(
      (a, b) =>
        (b.votes ?? 0) +
        (b.price > 0 ? 500 : 0) +
        (isBrokenHost(b.imageUrl) ? 200 : 0) -
        ((a.votes ?? 0) +
          (a.price > 0 ? 500 : 0) +
          (isBrokenHost(a.imageUrl) ? 200 : 0)),
    )
    .slice(0, limit);

  console.log(
    `Enriching ${queue.length} fragrances (all=${all}, fixBroken=${fixBroken}, concurrency=${concurrency}).`,
  );
  console.log(
    `Sources: Fraganty` +
      (rapidKey ? " + FragranceFinder" : "") +
      "\n",
  );

  const stats = {
    fraganty: 0,
    fragrancefinder: 0,
    clearedBroken: 0,
    missed: 0,
  };

  let processed = 0;

  async function enrichOne(f: FragranceOut) {
    const hit =
      (await searchFraganty(f.name, f.house)) ??
      (rapidKey
        ? await searchFragranceFinder(rapidKey, f.name, f.house)
        : null);

    processed++;
    if (hit) {
      f.imageUrl = hit.imageUrl;
      if (hit.source === "fraganty") stats.fraganty++;
      else stats.fragrancefinder++;
      console.log(
        `[${processed}/${queue.length}] ✓ ${f.house} — ${f.name}  (${hit.source}, ${hit.score.toFixed(0)})`,
      );
      return;
    }

    if (isBrokenHost(f.imageUrl)) {
      delete f.imageUrl;
      stats.clearedBroken++;
      console.log(
        `[${processed}/${queue.length}] cleared broken ${f.house} — ${f.name}`,
      );
      return;
    }

    stats.missed++;
    console.log(`[${processed}/${queue.length}] ✗ ${f.house} — ${f.name}`);
  }

  for (let i = 0; i < queue.length; i += concurrency) {
    const batch = queue.slice(i, i + concurrency);
    await Promise.all(batch.map((f) => enrichOne(f)));
    if ((i / concurrency) % 5 === 0) {
      writeFileSync(JSON_PATH, JSON.stringify(catalog) + "\n");
    }
  }

  writeFileSync(JSON_PATH, JSON.stringify(catalog) + "\n");
  const withImg = catalog.filter(
    (f) => f.imageUrl && !isBrokenHost(f.imageUrl),
  ).length;
  console.log("\nDone.");
  console.log(stats);
  console.log(`Usable catalog images: ${withImg}/${catalog.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
