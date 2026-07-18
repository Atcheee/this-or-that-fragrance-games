/**
 * Fills fragrance.imageUrl from FragranceFinder cache entries that already
 * carry Fragrantica perfume ids → fimgs.net bottle JPEGs.
 *
 * Run: npx tsx scripts/enrich-images-from-ff-cache.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canonicalHouse, dedupeKey } from "./dataset-utils";

const JSON_PATH = path.join(__dirname, "..", "src", "data", "fragrances.json");
const CACHE_DIR = path.join(__dirname, "api-cache");

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

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function mapItem(item: Record<string, unknown>): {
  key: string;
  imageUrl: string;
} | null {
  const rawBrand = str(item.brand)
    .replace(/\s+perfumes and colognes$/i, "")
    .replace(/\s+perfume$/i, "")
    .trim();
  const house = canonicalHouse(
    rawBrand || str(item.designer) || str(item.house),
  );
  let name = str(item.perfume) || str(item.name) || str(item.title);
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

  const id =
    str(item.id) ||
    (str(item.url).match(/-(\d+)\.html?$/i)?.[1] ?? "");
  if (!id) return null;

  return {
    key: dedupeKey(name, house),
    imageUrl: `https://fimgs.net/mdimg/perfume/375x500.${id}.jpg`,
  };
}

if (!existsSync(CACHE_DIR)) {
  console.error("No scripts/api-cache/ directory found.");
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(JSON_PATH, "utf8")) as FragranceOut[];
const byKey = new Map(catalog.map((f) => [dedupeKey(f.name, f.house), f]));

const images = new Map<string, string>();
for (const file of readdirSync(CACHE_DIR).filter((f) =>
  f.startsWith("fragrancefinder-"),
)) {
  const data = JSON.parse(readFileSync(path.join(CACHE_DIR, file), "utf8"));
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.results)
        ? data.results
        : [];
  for (const item of items) {
    const mapped = mapItem(item as Record<string, unknown>);
    if (!mapped || images.has(mapped.key)) continue;
    images.set(mapped.key, mapped.imageUrl);
  }
}

let filled = 0;
for (const [key, imageUrl] of images) {
  const f = byKey.get(key);
  if (!f || f.imageUrl) continue;
  f.imageUrl = imageUrl;
  filled++;
}

writeFileSync(JSON_PATH, JSON.stringify(catalog) + "\n");
console.log(
  `FF image map: ${images.size} unique. Filled ${filled}. Catalog images: ${catalog.filter((f) => f.imageUrl).length}/${catalog.length}.`,
);
