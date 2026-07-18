/**
 * Expands src/data/fragrances.json with real data from the TidyTuesday
 * Parfumo dataset (scraped from parfumo.com, CC0-style shared for the
 * 2024-12-10 TidyTuesday event).
 *
 * Run: npx tsx scripts/build-dataset.ts
 *
 * - Downloads the CSV on first run (kept out of git).
 * - Keeps every hand-curated entry (they carry prices + descriptions the
 *   CSV lacks) and enriches them with Parfumo vote counts when matched.
 * - Adds every Parfumo fragrance that passes the quality bar below.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dedupeKey, norm, titleCase } from "./dataset-utils";

const CSV_URL =
  "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2024/2024-12-10/parfumo_data_clean.csv";
const CSV_PATH = path.join(__dirname, "parfumo_data_clean.csv");
const JSON_PATH = path.join(__dirname, "..", "src", "data", "fragrances.json");

/** Minimum community votes for an entry to make the cut */
const MIN_VOTES = 30;
/** Minimum total notes across the pyramid */
const MIN_NOTES = 3;
/** Minimum main accords */
const MIN_ACCORDS = 2;

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

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.log("Downloading Parfumo dataset…");
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    writeFileSync(CSV_PATH, Buffer.from(await res.arrayBuffer()));
  }

  const rows = parseCsv(readFileSync(CSV_PATH, "utf8"));
  const header = rows[0];
  const col = (name: string) => header.indexOf(name);
  const idx = {
    number: col("Number"),
    name: col("Name"),
    brand: col("Brand"),
    year: col("Release_Year"),
    concentration: col("Concentration"),
    rating: col("Rating_Value"),
    votes: col("Rating_Count"),
    accords: col("Main_Accords"),
    top: col("Top_Notes"),
    middle: col("Middle_Notes"),
    base: col("Base_Notes"),
  };

  const existing = JSON.parse(readFileSync(JSON_PATH, "utf8")) as FragranceOut[];
  const curated = existing.filter((f) => !f.id.startsWith("parfumo-"));
  const curatedKeys = new Map(curated.map((f) => [dedupeKey(f.name, f.house), f]));

  // Canonical casing per house so "XerJoff" and "Xerjoff" don't split into
  // two houses. Curated spellings win; otherwise first spelling seen.
  const houseCanon = new Map<string, string>();
  for (const f of curated) houseCanon.set(norm(f.house), f.house);

  const candidates = new Map<string, FragranceOut>();
  let parsed = 0;
  let dropped = 0;

  for (const row of rows.slice(1)) {
    parsed++;
    const rawHouse = clean(row[idx.brand]);
    const house = houseCanon.get(norm(rawHouse)) ?? rawHouse;
    if (rawHouse && !houseCanon.has(norm(rawHouse))) {
      houseCanon.set(norm(rawHouse), rawHouse);
    }
    const year = num(row[idx.year]);
    const name = cleanName(
      clean(row[idx.name]),
      house,
      year,
      clean(row[idx.concentration]),
    );
    const rating10 = num(row[idx.rating]);
    const votes = num(row[idx.votes]);
    const top = splitList(row[idx.top]).map(titleCase);
    const heart = splitList(row[idx.middle]).map(titleCase);
    const base = splitList(row[idx.base]).map(titleCase);
    const accords = splitList(row[idx.accords]).map((a) => a.toLowerCase());

    if (
      !name ||
      !house ||
      hasMojibake(name) ||
      hasMojibake(house) ||
      rating10 === null ||
      votes === null ||
      votes < MIN_VOTES ||
      top.length + heart.length + base.length < MIN_NOTES ||
      accords.length < MIN_ACCORDS ||
      [...top, ...heart, ...base, ...accords].some(hasMojibake)
    ) {
      dropped++;
      continue;
    }

    const key = dedupeKey(name, house);
    const entry: FragranceOut = {
      id: `parfumo-${norm(house)}-${norm(name)}`,
      name,
      house,
      year: year ?? 0,
      // Parfumo rates 0–10; the app uses 0–5
      rating: Math.round((rating10 / 2) * 10) / 10,
      price: 0,
      topNotes: top,
      heartNotes: heart,
      baseNotes: base,
      accords,
      description: "",
      votes,
    };

    // Curated entries win; just borrow their vote count for popularity ranking.
    const curatedMatch = curatedKeys.get(key);
    if (curatedMatch) {
      if ((curatedMatch.votes ?? 0) < votes) curatedMatch.votes = votes;
      continue;
    }

    // Duplicate names (concentrations/reissues): keep the most-voted one.
    const dupe = candidates.get(key);
    if (!dupe || (dupe.votes ?? 0) < votes) candidates.set(key, entry);
  }

  const added = [...candidates.values()].sort(
    (a, b) => (b.votes ?? 0) - (a.votes ?? 0),
  );
  const combined = [...curated, ...added];
  // Compact output: the file ships in the client bundle.
  writeFileSync(JSON_PATH, JSON.stringify(combined) + "\n");

  const houses = new Set(combined.map((f) => f.house));
  const bytes = statSizeMb();
  console.log(`CSV rows parsed:       ${parsed}`);
  console.log(`Rows dropped (quality): ${dropped}`);
  console.log(`Curated kept:          ${curated.length}`);
  console.log(`Parfumo added:         ${added.length}`);
  console.log(`Total fragrances:      ${combined.length}`);
  console.log(`Distinct houses:       ${houses.size}`);
  console.log(`JSON size:             ${bytes} MB`);
}

function statSizeMb(): string {
  return (statSync(JSON_PATH).size / 1024 / 1024).toFixed(2);
}

/**
 * Parfumo page titles leak into names as "<Name> <Brand> <Year> <Concentration>"
 * (e.g. "Joop! Homme Joop! 1989 Eau de Toilette"). Strip those suffixes.
 */
function cleanName(
  rawName: string,
  brand: string,
  year: number | null,
  concentration: string,
): string {
  let name = rawName.trim();
  const stripSuffix = (suffix: string): boolean => {
    if (
      suffix &&
      name.length > suffix.length &&
      name.toLowerCase().endsWith(suffix.toLowerCase())
    ) {
      name = name.slice(0, name.length - suffix.length).trim();
      return true;
    }
    return false;
  };
  let changed = true;
  while (changed) {
    changed = false;
    if (concentration) changed = stripSuffix(concentration) || changed;
    if (year) changed = stripSuffix(String(year)) || changed;
    if (brand) changed = stripSuffix(brand) || changed;
  }
  // Leftovers like "La Vie est Belle L'" after stripping "Eau de Parfum"
  name = name.replace(/(?:\s+(?:l'|d'|-|–|\/))+$/i, "").trim();
  return name || rawName.trim();
}

function clean(v: string | undefined): string {
  const s = (v ?? "").trim();
  return s === "NA" ? "" : s;
}

function num(v: string | undefined): number | null {
  const s = clean(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitList(v: string | undefined): string[] {
  const s = clean(v);
  if (!s) return [];
  return [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))];
}

function hasMojibake(s: string): boolean {
  // The source CSV has some corrupted encodings; skip affected rows.
  return /[\uFFFD\u0080-\u009F]|Ǹ|ǹ/.test(s);
}

/** Minimal RFC-4180 CSV parser (quoted fields, embedded commas/newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
