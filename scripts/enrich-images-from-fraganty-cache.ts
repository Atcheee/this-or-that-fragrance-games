/**
 * Fills missing fragrance.imageUrl by fuzzy-matching against every perfume
 * already present in scripts/api-cache/image-enrich/fraganty-search-*.json.
 * Zero network cost.
 *
 * Run: npx tsx scripts/enrich-images-from-fraganty-cache.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canonicalHouse, dedupeKey, norm } from "./dataset-utils";

const JSON_PATH = path.join(__dirname, "..", "src", "data", "fragrances.json");
const CACHE_DIR = path.join(__dirname, "api-cache", "image-enrich");

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
  nameKey: string;
  brandKey: string;
}

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
    `${house} - `,
    `${house} `,
  ];
  for (const p of prefixes) {
    if (n.toLowerCase().startsWith(p.toLowerCase())) {
      n = n.slice(p.length).trim();
    }
  }
  n = n
    .replace(/\s+for\s+(women|men|women and men|unisex)\s*$/i, "")
    .replace(/\s+unisex\s*$/i, "")
    .trim();
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
  const hb = norm(canonicalHouse(hitBrand) || hitBrand);
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

if (!existsSync(CACHE_DIR)) {
  console.error("No image-enrich cache found.");
  process.exit(1);
}

const hits: Hit[] = [];
const seen = new Set<string>();
for (const file of readdirSync(CACHE_DIR).filter((f) =>
  f.startsWith("fraganty-search-"),
)) {
  const data = JSON.parse(readFileSync(path.join(CACHE_DIR, file), "utf8")) as {
    perfumes?: Array<Record<string, unknown>>;
  };
  for (const p of data.perfumes ?? []) {
    const name = String(p.name ?? "").trim();
    const brand = String(p.brand ?? "").trim();
    const imageUrl = String(p.imageTransparent ?? p.image ?? "").trim();
    if (!name || !imageUrl) continue;
    const key = `${norm(name)}|${norm(brand)}|${imageUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      name,
      brand,
      imageUrl,
      nameKey: norm(name),
      brandKey: norm(canonicalHouse(brand) || brand),
    });
  }
}

console.log(`Indexed ${hits.length} unique Fraganty cache bottles.`);

// Exact brand+name index for fast path
const byExact = new Map<string, string>();
for (const hit of hits) {
  const key = `${hit.nameKey}|${hit.brandKey}`;
  if (!byExact.has(key)) byExact.set(key, hit.imageUrl);
}

const catalog = JSON.parse(readFileSync(JSON_PATH, "utf8")) as FragranceOut[];
let filled = 0;
let scanned = 0;

for (const f of catalog) {
  if (f.imageUrl) continue;
  scanned++;
  const cleaned = cleanName(f.name, f.house);
  const houseKey = norm(f.house);
  const nameKey = norm(cleaned);
  if (!nameKey) continue;

  const exact = byExact.get(`${nameKey}|${houseKey}`);
  if (exact) {
    f.imageUrl = exact;
    filled++;
    continue;
  }

  let best: { score: number; url: string } | null = null;
  for (const hit of hits) {
    // Cheap brand gate before full score
    if (
      hit.brandKey !== houseKey &&
      !hit.brandKey.includes(houseKey) &&
      !houseKey.includes(hit.brandKey)
    ) {
      continue;
    }
    const score = matchScore(cleaned, f.house, hit.name, hit.brand);
    if (!best || score > best.score) best = { score, url: hit.imageUrl };
  }

  if (best && best.score >= 90) {
    f.imageUrl = best.url;
    filled++;
  }
}

writeFileSync(JSON_PATH, JSON.stringify(catalog) + "\n");
const withImg = catalog.filter((f) => f.imageUrl).length;
console.log(
  `Scanned ${scanned} missing. Filled ${filled}. Catalog images: ${withImg}/${catalog.length}.`,
);
void dedupeKey;
