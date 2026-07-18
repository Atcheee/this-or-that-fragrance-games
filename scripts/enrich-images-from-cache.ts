/**
 * Fills fragrance.imageUrl from Fragella responses already in scripts/api-cache/.
 * Zero API cost. Prefer transparent WebP when available.
 *
 * Run: npx tsx scripts/enrich-images-from-cache.ts
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

function mapKeyAndImage(item: Record<string, unknown>): {
  key: string;
  imageUrl: string;
} | null {
  const house = canonicalHouse(str(item["Brand"]) || str(item["brand"]));
  let name = str(item["Name"]) || str(item["name"]);
  if (!name || !house) return null;
  if (name.toLowerCase().startsWith(house.toLowerCase() + " ")) {
    name = name.slice(house.length).trim();
  }
  for (const prefix of [
    "Emporio Armani ",
    "Armani Prive ",
    "Armani Privé ",
    "Armani ",
  ]) {
    if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
      name = name.slice(prefix.length).trim();
    }
  }
  if (!name) return null;

  const imageUrl =
    str(item["Image URL Transparent"]) || str(item["Image URL"]);
  if (!imageUrl) return null;
  return { key: dedupeKey(name, house), imageUrl };
}

if (!existsSync(CACHE_DIR)) {
  console.error("No scripts/api-cache/ directory found.");
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(JSON_PATH, "utf8")) as FragranceOut[];
const byKey = new Map(catalog.map((f) => [dedupeKey(f.name, f.house), f]));

const images = new Map<string, string>();
for (const file of readdirSync(CACHE_DIR).filter((f) =>
  f.startsWith("fragella-"),
)) {
  const data = JSON.parse(readFileSync(path.join(CACHE_DIR, file), "utf8"));
  const items = Array.isArray(data) ? data : [];
  for (const item of items) {
    const mapped = mapKeyAndImage(item as Record<string, unknown>);
    if (!mapped) continue;
    // Prefer first (or keep existing transparent) — don't overwrite with weaker
    if (!images.has(mapped.key)) {
      images.set(mapped.key, mapped.imageUrl);
    }
  }
}

let filled = 0;
let already = 0;
for (const [key, imageUrl] of images) {
  const f = byKey.get(key);
  if (!f) continue;
  if (f.imageUrl) {
    already++;
    continue;
  }
  f.imageUrl = imageUrl;
  filled++;
}

writeFileSync(JSON_PATH, JSON.stringify(catalog) + "\n");
console.log(
  `Image map: ${images.size} unique. Filled ${filled}, already had ${already}. Catalog ${catalog.length}.`,
);
