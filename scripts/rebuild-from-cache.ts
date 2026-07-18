/**
 * Replays Fragella responses from scripts/api-cache/ into the catalog.
 * Zero API cost. Drops any existing fragella-* rows first, then remaps.
 *
 * Run: npx tsx scripts/rebuild-from-cache.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canonicalHouse, dedupeKey, norm, titleCase } from "./dataset-utils";

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

const catalog = (
  JSON.parse(readFileSync(JSON_PATH, "utf8")) as FragranceOut[]
).filter((f) => !f.id.startsWith("fragella-"));

const byKey = new Map(catalog.map((f) => [dedupeKey(f.name, f.house), f]));
let added = 0;
let enriched = 0;
let skipped = 0;

if (!existsSync(CACHE_DIR)) {
  console.error("No scripts/api-cache/ directory found.");
  process.exit(1);
}

for (const file of readdirSync(CACHE_DIR).filter((f) =>
  f.startsWith("fragella-"),
)) {
  const data = JSON.parse(readFileSync(path.join(CACHE_DIR, file), "utf8"));
  const items = Array.isArray(data) ? data : [];
  for (const item of items) {
    const mapped = mapFragellaItem(item);
    if (!mapped) {
      skipped++;
      continue;
    }
    const key = dedupeKey(mapped.name, mapped.house);
    const existing = byKey.get(key);
    if (!existing) {
      catalog.push(mapped);
      byKey.set(key, mapped);
      added++;
      continue;
    }
    let changed = false;
    if (existing.price === 0 && mapped.price > 0) {
      existing.price = mapped.price;
      changed = true;
    }
    if (!existing.description && mapped.description) {
      existing.description = mapped.description;
      changed = true;
    }
    if (existing.rating === 0 && mapped.rating > 0) {
      existing.rating = mapped.rating;
      changed = true;
    }
    if (existing.year === 0 && mapped.year > 0) {
      existing.year = mapped.year;
      changed = true;
    }
    if (
      existing.topNotes.length +
        existing.heartNotes.length +
        existing.baseNotes.length ===
      0
    ) {
      existing.topNotes = mapped.topNotes;
      existing.heartNotes = mapped.heartNotes;
      existing.baseNotes = mapped.baseNotes;
      changed = true;
    }
    if (existing.accords.length === 0 && mapped.accords.length > 0) {
      existing.accords = mapped.accords;
      changed = true;
    }
    if (!existing.imageUrl && mapped.imageUrl) {
      existing.imageUrl = mapped.imageUrl;
      changed = true;
    }
    if (changed) enriched++;
  }
}

writeFileSync(JSON_PATH, JSON.stringify(catalog) + "\n");
console.log(
  `Rebuilt from cache: ${added} added, ${enriched} enriched, ${skipped} skipped. Total ${catalog.length}.`,
);

function mapFragellaItem(item: unknown): FragranceOut | null {
  const p = item as Record<string, unknown>;
  const house = canonicalHouse(str(p["Brand"]) || str(p["brand"]));
  let name = str(p["Name"]) || str(p["name"]);
  if (!name || !house) return null;
  if (name.toLowerCase().startsWith(house.toLowerCase() + " ")) {
    name = name.slice(house.length).trim();
  }
  // Also strip "Emporio Armani" / "Armani Privé" style leftovers when house is Giorgio Armani
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
  const general = noteNames(p["General Notes"]);
  const rating = clampRating(num(p["rating"]) ?? num(p["Rating"]) ?? 0);
  if (rating <= 0) return null;
  if (top.length + heart.length + base.length + general.length === 0) return null;
  if (!Array.isArray(p["Main Accords"]) || (p["Main Accords"] as unknown[]).length === 0) {
    return null;
  }

  const imageUrl =
    str(p["Image URL Transparent"]) || str(p["Image URL"]);

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
    accords: (p["Main Accords"] as string[]).map((a) => String(a).toLowerCase()),
    description: str(p["Description"]) || str(p["description"]),
    ...(imageUrl ? { imageUrl } : {}),
  };
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
  const scaled = r > 5 ? r / 2 : r;
  return Math.round(Math.min(Math.max(scaled, 0), 5) * 10) / 10;
}
