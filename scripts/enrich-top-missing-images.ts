/**
 * Live Fraganty search for the highest-vote catalog rows still missing images.
 * Tries several query variants; caches every response under image-enrich/.
 *
 * Run: npx tsx scripts/enrich-top-missing-images.ts [--limit 400] [--concurrency 8]
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
const FRAGANTY_SEARCH = "https://fraganty.ai/api/search";

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

function argNum(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) ? n : fallback;
}

function cleanName(name: string, house: string): string {
  let n = name.trim().replace(/\s*[|/].*$/, "").trim();
  n = n
    .replace(/\s+for\s+(women|men|women and men|unisex)\s*$/i, "")
    .replace(/\s+unisex\s*$/i, "")
    .replace(/\s+\d{4}\s*$/i, "")
    .trim();
  if (n.toLowerCase().startsWith(house.toLowerCase() + " ")) {
    n = n.slice(house.length).trim();
  }
  // Drop duplicated fragments: "M7 M7 Oud Absolu" → "M7 Oud Absolu"
  const parts = n.split(/\s+/);
  const deduped: string[] = [];
  for (const part of parts) {
    if (
      deduped.length &&
      deduped[deduped.length - 1]!.toLowerCase() === part.toLowerCase()
    ) {
      continue;
    }
    deduped.push(part);
  }
  return deduped.join(" ").replace(/\s+/g, " ").trim();
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
  const hb = norm(canonicalHouse(hitBrand) || hitBrand);
  if (!tn || !hn) return -Infinity;

  let score = 0;
  if (hn === tn) score += 100;
  else if (hn.startsWith(tn) || tn.startsWith(hn)) score += 75;
  else if (hn.includes(tn) || tn.includes(hn)) score += 50;
  else {
    const ta = new Set(tn.match(/[a-z0-9]+/g) ?? []);
    const ha = new Set(hn.match(/[a-z0-9]+/g) ?? []);
    let overlap = 0;
    for (const t of ta) if (ha.has(t)) overlap++;
    if (overlap === 0) return -Infinity;
    score += (overlap / Math.max(ta.size, ha.size)) * 45;
  }

  if (hb === th) score += 40;
  else if (hb.includes(th) || th.includes(hb)) score += 25;
  else score -= 10;

  score -= Math.min(25, Math.abs(hn.length - tn.length));
  return score;
}

function cachePath(key: string): string {
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return path.join(CACHE_DIR, `fraganty-search-${hash}.json`);
}

async function search(q: string): Promise<Array<Record<string, unknown>>> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = cachePath(q);
  if (existsSync(file)) {
    const data = JSON.parse(readFileSync(file, "utf8")) as {
      perfumes?: Array<Record<string, unknown>>;
    };
    return data.perfumes ?? [];
  }
  try {
    const res = await fetch(
      `${FRAGANTY_SEARCH}?q=${encodeURIComponent(q)}&limit=16`,
      { signal: AbortSignal.timeout(6_000) },
    );
    if (!res.ok) {
      writeFileSync(file, JSON.stringify({ perfumes: [] }));
      return [];
    }
    const data = (await res.json()) as {
      perfumes?: Array<Record<string, unknown>>;
    };
    writeFileSync(file, JSON.stringify(data));
    return data.perfumes ?? [];
  } catch {
    return [];
  }
}

async function resolveImage(
  name: string,
  house: string,
): Promise<{ url: string; score: number } | null> {
  const cleaned = cleanName(name, house);
  if (!cleaned) return null;

  const queries = [
    `${cleaned} ${house}`,
    cleaned,
    cleaned.split(/\s+/).slice(0, 3).join(" "),
    cleaned.split(/\s+/)[0]!,
  ].filter((q, i, arr) => q.length >= 3 && arr.indexOf(q) === i);

  let best: { url: string; score: number } | null = null;
  for (const q of queries) {
    const perfumes = await search(q);
    await new Promise((r) => setTimeout(r, 25));
    for (const p of perfumes) {
      const hitName = String(p.name ?? "");
      const brand = String(p.brand ?? "");
      const url = String(p.imageTransparent ?? p.image ?? "");
      if (!hitName || !url) continue;
      const score = matchScore(cleaned, house, hitName, brand);
      if (!best || score > best.score) best = { url, score };
    }
    if (best && best.score >= 120) break;
  }
  return best && best.score >= 70 ? best : null;
}

async function main() {
  const limit = argNum("--limit", 500);
  const concurrency = Math.max(1, argNum("--concurrency", 8));
  const catalog = JSON.parse(readFileSync(JSON_PATH, "utf8")) as FragranceOut[];
  const queue = catalog
    .filter((f) => !f.imageUrl)
    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
    .slice(0, limit);

  console.log(`Resolving images for top ${queue.length} missing by votes…`);
  let filled = 0;
  let missed = 0;
  let processed = 0;

  async function one(f: FragranceOut) {
    const hit = await resolveImage(f.name, f.house);
    processed++;
    if (hit) {
      f.imageUrl = hit.url;
      filled++;
      console.log(
        `[${processed}/${queue.length}] ✓ ${f.house} — ${f.name} (${hit.score.toFixed(0)})`,
      );
    } else {
      missed++;
      console.log(`[${processed}/${queue.length}] ✗ ${f.house} — ${f.name}`);
    }
  }

  for (let i = 0; i < queue.length; i += concurrency) {
    await Promise.all(queue.slice(i, i + concurrency).map((f) => one(f)));
    if (i % (concurrency * 10) === 0) {
      writeFileSync(JSON_PATH, JSON.stringify(catalog) + "\n");
    }
  }

  writeFileSync(JSON_PATH, JSON.stringify(catalog) + "\n");
  const withImg = catalog.filter((f) => f.imageUrl).length;
  console.log(`\nFilled ${filled}, missed ${missed}. Images: ${withImg}/${catalog.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
