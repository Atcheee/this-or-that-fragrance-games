/**
 * Fills catalog gaps using licensed/cached sources (not Fragrantica HTML):
 *   - Fragella cache → price, longevity, sillage, season/occasion wear, images
 *   - FragranceFinder cache → editorial descriptions + fimgs bottle URLs
 *   - Note/accord synthesis → descriptions when no editorial text exists
 *   - Accord-derived wear → when Fragella rankings are absent
 *
 * Run: npx tsx scripts/fill-catalog-gaps.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canonicalHouse, dedupeKey, norm, titleCase } from "./dataset-utils";

const JSON_PATH = path.join(__dirname, "..", "src", "data", "fragrances.json");
const CACHE_DIR = path.join(__dirname, "api-cache");

type WearKey = "winter" | "spring" | "summer" | "fall" | "day" | "night";

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
  longevity?: string;
  sillage?: string;
  wear?: Partial<Record<WearKey, number>>;
}

interface RankScore {
  name: string;
  score: number;
}

const WEAR_META: Array<{ id: WearKey; accords: string[] }> = [
  {
    id: "winter",
    accords: [
      "woody",
      "sweet",
      "vanilla",
      "amber",
      "ambery",
      "spicy",
      "warm spicy",
      "gourmand",
      "leather",
      "oud",
      "tobacco",
      "balsamic",
      "oriental",
      "smoky",
      "resinous",
    ],
  },
  {
    id: "spring",
    accords: [
      "floral",
      "white floral",
      "yellow floral",
      "fresh",
      "green",
      "fruity",
      "powdery",
      "rose",
      "iris",
      "lavender",
    ],
  },
  {
    id: "summer",
    accords: [
      "citrus",
      "aquatic",
      "marine",
      "fresh",
      "ozonic",
      "tropical",
      "aromatic",
      "herbal",
      "green",
    ],
  },
  {
    id: "fall",
    accords: [
      "woody",
      "spicy",
      "warm spicy",
      "earthy",
      "amber",
      "tobacco",
      "patchouli",
      "leather",
      "aromatic",
      "sweet",
    ],
  },
  {
    id: "day",
    accords: [
      "fresh",
      "citrus",
      "green",
      "floral",
      "aquatic",
      "aromatic",
      "fruity",
      "clean",
      "soapy",
    ],
  },
  {
    id: "night",
    accords: [
      "woody",
      "sweet",
      "oriental",
      "leather",
      "oud",
      "musky",
      "amber",
      "vanilla",
      "spicy",
      "animalic",
      "smoky",
    ],
  },
];

const stats = {
  prices: 0,
  descriptionsFromFf: 0,
  descriptionsSynthesized: 0,
  imagesFromFf: 0,
  imagesFromFragella: 0,
  longevity: 0,
  sillage: 0,
  wearFromFragella: 0,
  wearDerived: 0,
};

function main() {
  if (!existsSync(CACHE_DIR)) {
    console.error("No scripts/api-cache/ directory found.");
    process.exit(1);
  }

  const catalog = JSON.parse(readFileSync(JSON_PATH, "utf8")) as FragranceOut[];
  const byKey = new Map(catalog.map((f) => [dedupeKey(f.name, f.house), f]));

  applyFragellaCache(byKey);
  applyFragranceFinderCache(byKey);

  // Include any newly added Fragella-only rows.
  for (const f of byKey.values()) {
    if (!catalog.includes(f)) catalog.push(f);
  }

  for (const f of catalog) {
    if (!f.description.trim()) {
      const synthesized = synthesizeDescription(f);
      if (synthesized) {
        f.description = synthesized;
        stats.descriptionsSynthesized++;
      }
    }
    if (!f.wear || Object.keys(f.wear).length === 0) {
      f.wear = deriveWearShares(f.accords);
      stats.wearDerived++;
    }
  }

  writeFileSync(JSON_PATH, JSON.stringify(catalog) + "\n");

  const withDesc = catalog.filter((f) => f.description.trim()).length;
  const withImg = catalog.filter((f) => f.imageUrl).length;
  const withPrice = catalog.filter((f) => f.price > 0).length;
  const withWear = catalog.filter(
    (f) => f.wear && Object.keys(f.wear).length > 0,
  ).length;

  console.log("Filled catalog gaps:");
  console.log(stats);
  console.log(
    `Coverage: desc ${withDesc}/${catalog.length}, images ${withImg}/${catalog.length}, price ${withPrice}/${catalog.length}, wear ${withWear}/${catalog.length}`,
  );
}

function applyFragellaCache(byKey: Map<string, FragranceOut>) {
  const housePrices = new Map<string, number[]>();

  for (const file of readdirSync(CACHE_DIR).filter((f) =>
    f.startsWith("fragella-"),
  )) {
    const data = JSON.parse(readFileSync(path.join(CACHE_DIR, file), "utf8"));
    const items = Array.isArray(data) ? data : [];
    for (const item of items) {
      const mapped = mapFragellaEnrichment(item as Record<string, unknown>);
      if (!mapped) continue;

      if (mapped.price > 0) {
        const hk = norm(mapped.house);
        const list = housePrices.get(hk) ?? [];
        list.push(mapped.price);
        housePrices.set(hk, list);
      }

      let existing = byKey.get(mapped.key);
      if (!existing) {
        // Try alternate stripped keys for Armani-style prefixes.
        for (const alt of mapped.altKeys) {
          existing = byKey.get(alt);
          if (existing) break;
        }
      }

      if (!existing) {
        if (mapped.asFragrance) {
          byKey.set(mapped.key, mapped.asFragrance);
          stats.prices += mapped.asFragrance.price > 0 ? 1 : 0;
        }
        continue;
      }

      if (existing.price === 0 && mapped.price > 0) {
        existing.price = mapped.price;
        stats.prices++;
      }
      if (!existing.longevity && mapped.longevity) {
        existing.longevity = mapped.longevity;
        stats.longevity++;
      }
      if (!existing.sillage && mapped.sillage) {
        existing.sillage = mapped.sillage;
        stats.sillage++;
      }
      if (
        (!existing.wear || Object.keys(existing.wear).length === 0) &&
        mapped.wear
      ) {
        existing.wear = mapped.wear;
        stats.wearFromFragella++;
      }
      if (
        !existing.imageUrl &&
        mapped.imageUrl &&
        !mapped.imageUrl.includes("cdn.fragella.com")
      ) {
        existing.imageUrl = mapped.imageUrl;
        stats.imagesFromFragella++;
      }
    }
  }

  // Approximate remaining zero prices from house medians (Fragella-backed houses only).
  for (const f of byKey.values()) {
    if (f.price > 0) continue;
    const prices = housePrices.get(norm(f.house));
    if (!prices || prices.length < 3) continue;
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!;
    f.price = Math.round(median * 100) / 100;
    stats.prices++;
  }
}

function applyFragranceFinderCache(byKey: Map<string, FragranceOut>) {
  for (const file of readdirSync(CACHE_DIR).filter((f) =>
    f.startsWith("fragrancefinder-"),
  )) {
    const data = JSON.parse(readFileSync(path.join(CACHE_DIR, file), "utf8"));
    const items = Array.isArray(data) ? data : extractArray(data);
    for (const item of items) {
      const mapped = mapFfEnrichment(item as Record<string, unknown>);
      if (!mapped) continue;
      const existing = byKey.get(mapped.key);
      if (!existing) continue;

      if (mapped.description) {
        const synthesized = synthesizeDescription(existing);
        const empty = !existing.description.trim();
        const isSynthetic =
          synthesized && existing.description.trim() === synthesized;
        if (empty || isSynthetic) {
          existing.description = mapped.description;
          stats.descriptionsFromFf++;
        }
      }
      if (!existing.imageUrl && mapped.imageUrl) {
        existing.imageUrl = mapped.imageUrl;
        stats.imagesFromFf++;
      }
    }
  }
}

function mapFragellaEnrichment(item: Record<string, unknown>): {
  key: string;
  altKeys: string[];
  house: string;
  price: number;
  longevity: string;
  sillage: string;
  wear?: Partial<Record<WearKey, number>>;
  imageUrl: string;
  asFragrance?: FragranceOut;
} | null {
  const house = canonicalHouse(str(item.Brand) || str(item.brand));
  let name = str(item.Name) || str(item.name);
  if (!name || !house) return null;
  if (name.toLowerCase().startsWith(house.toLowerCase() + " ")) {
    name = name.slice(house.length).trim();
  }
  for (const prefix of [
    "Emporio Armani ",
    "Armani Prive ",
    "Armani Privé ",
    "Armani Code ",
    "Armani ",
  ]) {
    if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
      name = name.slice(prefix.length).trim();
    }
  }
  if (!name) return null;

  const season = asRankScores(item["Season Ranking"]);
  const occasion = asRankScores(item["Occasion Ranking"]);
  const wear = ranksToWear(season, occasion);

  const imageUrl =
    str(item["Image URL Transparent"]) || str(item["Image URL"]);
  const price = Math.round((num(item.Price) ?? 0) * 100) / 100;
  const longevity = str(item.Longevity);
  const sillage = str(item.Sillage);
  const key = dedupeKey(name, house);

  // Alternate keys so "Armani Code" catalog rows match "Code" Fragella names.
  const altKeys = [
    dedupeKey(`Armani ${name}`, house),
    dedupeKey(`Emporio Armani ${name}`, house),
    dedupeKey(`Armani Code ${name}`, house),
  ];

  const notes = (item.Notes ?? {}) as Record<string, unknown>;
  const top = noteNames(notes.Top);
  const heart = noteNames(notes.Middle);
  const base = noteNames(notes.Base);
  const general = noteNames(item["General Notes"]);
  const accords = Array.isArray(item["Main Accords"])
    ? (item["Main Accords"] as unknown[]).map((a) => String(a).toLowerCase())
    : [];
  const rating = clampRating(num(item.rating) ?? num(item.Rating) ?? 0);

  let asFragrance: FragranceOut | undefined;
  if (
    rating > 0 &&
    accords.length > 0 &&
    top.length + heart.length + base.length + general.length > 0
  ) {
    asFragrance = {
      id: `fragella-${norm(house)}-${norm(name)}`,
      name,
      house,
      year: int(item.Year),
      rating,
      price,
      topNotes:
        top.length > 0 ? top : general.slice(0, Math.ceil(general.length / 3)),
      heartNotes:
        heart.length > 0
          ? heart
          : general.slice(
              Math.ceil(general.length / 3),
              Math.ceil((2 * general.length) / 3),
            ),
      baseNotes:
        base.length > 0
          ? base
          : general.slice(Math.ceil((2 * general.length) / 3)),
      accords,
      description: "",
      ...(longevity ? { longevity } : {}),
      ...(sillage ? { sillage } : {}),
      ...(wear ? { wear } : {}),
      ...(imageUrl && !imageUrl.includes("cdn.fragella.com")
        ? { imageUrl }
        : {}),
    };
  }

  return {
    key,
    altKeys,
    house,
    price,
    longevity,
    sillage,
    ...(wear ? { wear } : {}),
    imageUrl,
    ...(asFragrance ? { asFragrance } : {}),
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

function int(v: unknown): number {
  const n = num(v);
  return n === null ? 0 : Math.round(n);
}

function clampRating(r: number): number {
  const scaled = r > 5 ? r / 2 : r;
  return Math.round(Math.min(Math.max(scaled, 0), 5) * 10) / 10;
}

function mapFfEnrichment(item: Record<string, unknown>): {
  key: string;
  description: string;
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
    .replace(/\s+unisex\s*$/i, "")
    .trim();
  // FragranceFinder often appends the brand: "Twilly d'Hermès Hermès"
  for (let i = 0; i < 2; i++) {
    if (name.toLowerCase().endsWith(house.toLowerCase())) {
      name = name.slice(0, name.length - house.length).trim();
    }
    if (name.toLowerCase().startsWith(house.toLowerCase() + " ")) {
      name = name.slice(house.length).trim();
    }
  }
  if (!name) return null;

  const id =
    str(item.id) || (str(item.url).match(/-(\d+)\.html?$/i)?.[1] ?? "");
  const imageUrl = id
    ? `https://fimgs.net/mdimg/perfume/375x500.${id}.jpg`
    : "";

  return {
    key: dedupeKey(name, house),
    description: str(item.description),
    imageUrl,
  };
}

function asRankScores(v: unknown): RankScore[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const name = str(row.name).toLowerCase();
      const score = num(row.score) ?? 0;
      if (!name || score <= 0) return null;
      return { name, score };
    })
    .filter((x): x is RankScore => x !== null);
}

function ranksToWear(
  seasons: RankScore[],
  occasions: RankScore[],
): Partial<Record<WearKey, number>> | undefined {
  const wear: Partial<Record<WearKey, number>> = {};

  const seasonMap: Record<string, WearKey> = {
    winter: "winter",
    spring: "spring",
    summer: "summer",
    fall: "fall",
    autumn: "fall",
  };
  const seasonScores: Partial<Record<WearKey, number>> = {};
  for (const row of seasons) {
    const key = seasonMap[row.name];
    if (!key) continue;
    seasonScores[key] = (seasonScores[key] ?? 0) + row.score;
  }
  Object.assign(wear, normalizeShares(seasonScores));

  let day = 0;
  let night = 0;
  for (const row of occasions) {
    if (row.name.includes("night")) night += row.score;
    else day += row.score;
  }
  if (day + night > 0) {
    const total = day + night;
    wear.day = roundShare(day / total);
    wear.night = roundShare(night / total);
  }

  return Object.keys(wear).length > 0 ? wear : undefined;
}

function normalizeShares(
  scores: Partial<Record<WearKey, number>>,
): Partial<Record<WearKey, number>> {
  const entries = Object.entries(scores).filter(
    ([, v]) => typeof v === "number" && v > 0,
  ) as Array<[WearKey, number]>;
  const sum = entries.reduce((a, [, v]) => a + v, 0);
  if (sum <= 0) return {};
  const out: Partial<Record<WearKey, number>> = {};
  for (const [k, v] of entries) out[k] = roundShare(v / sum);
  return out;
}

function deriveWearShares(accords: string[]): Partial<Record<WearKey, number>> {
  const keys = accords.map((a) =>
    a
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim(),
  );
  const scores: Partial<Record<WearKey, number>> = {};
  for (const meta of WEAR_META) {
    let score = 0.35;
    for (const accord of keys) {
      if (meta.accords.includes(accord)) score += 1.4;
      else if (
        meta.accords.some((a) => accord.includes(a) || a.includes(accord))
      ) {
        score += 0.7;
      }
    }
    scores[meta.id] = score;
  }
  return normalizeShares(scores);
}

function synthesizeDescription(f: FragranceOut): string {
  const accords = f.accords.slice(0, 3).map((a) => a.toLowerCase());
  const accordPhrase =
    accords.length === 0
      ? "fragrance"
      : accords.length === 1
        ? `${accords[0]} fragrance`
        : accords.length === 2
          ? `${accords[0]} and ${accords[1]} fragrance`
          : `${accords[0]}, ${accords[1]}, and ${accords[2]} fragrance`;

  const parts: string[] = [];
  parts.push(`${f.name} by ${f.house} is a ${accordPhrase}.`);

  if (f.year > 0) {
    parts.push(`${f.name} was launched in ${f.year}.`);
  }

  const top = f.topNotes.slice(0, 6);
  const heart = f.heartNotes.slice(0, 6);
  const base = f.baseNotes.slice(0, 6);
  if (top.length) parts.push(`Top notes are ${joinNotes(top)}.`);
  if (heart.length) parts.push(`Middle notes are ${joinNotes(heart)}.`);
  if (base.length) parts.push(`Base notes are ${joinNotes(base)}.`);

  if (parts.length < 2) return "";
  return parts.join(" ");
}

function joinNotes(notes: string[]): string {
  if (notes.length === 1) return notes[0]!;
  if (notes.length === 2) return `${notes[0]} and ${notes[1]}`;
  return `${notes.slice(0, -1).join(", ")}, and ${notes[notes.length - 1]}`;
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

function roundShare(n: number): number {
  return Math.round(n * 1000) / 1000;
}

void titleCase;
void norm;

main();
