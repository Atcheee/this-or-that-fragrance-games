/**
 * Builds lightweight browse indexes from fragrances.json so /fragrances and
 * /houses do not parse the full ~37MB catalog on every cold start.
 *
 * Run: npx tsx scripts/generate-catalog-indexes.ts
 * Also runs automatically via `prebuild`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface Fragrance {
  id: string;
  name: string;
  house: string;
  year: number;
  rating: number;
  votes?: number;
  accords: string[];
  imageUrl?: string;
  topNotes?: string[];
  heartNotes?: string[];
  baseNotes?: string[];
}

export interface BrowseFragranceCard {
  id: string;
  name: string;
  house: string;
  year: number;
  rating: number;
  votes: number;
  imageUrl?: string;
  slug: string;
  houseSlug: string;
  accords: string[];
}

export interface BrowseHouseSummary {
  slug: string;
  name: string;
  fragranceCount: number;
  averageRating: number;
  firstYear: number | null;
  latestYear: number | null;
  topAccords: Array<{ name: string; count: number }>;
}

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const SEARCH_NON_ALPHANUMERIC = /[^a-z0-9]+/g;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, "-")
    .replace(/^-+|-+$/g, "");
}

function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(SEARCH_NON_ALPHANUMERIC, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function main() {
  const root = path.resolve(import.meta.dirname, "..");
  const sourcePath = path.join(root, "src/data/fragrances.json");
  const outDir = path.join(root, "src/data/generated");
  await mkdir(outDir, { recursive: true });

  const fragrances = JSON.parse(
    await readFile(sourcePath, "utf8"),
  ) as Fragrance[];

  const houseGroups = new Map<string, Fragrance[]>();
  for (const fragrance of fragrances) {
    const houseSlug = slugify(fragrance.house);
    const group = houseGroups.get(houseSlug);
    if (group) group.push(fragrance);
    else houseGroups.set(houseSlug, [fragrance]);
  }

  const houseNames = new Map<string, string>();
  for (const [houseSlug, entries] of houseGroups) {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      counts.set(entry.house, (counts.get(entry.house) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]![0];
    houseNames.set(houseSlug, best);
  }

  const baseSlugGroups = new Map<string, Fragrance[]>();
  for (const fragrance of fragrances) {
    const baseSlug = `${slugify(fragrance.house)}-${slugify(fragrance.name)}`;
    const group = baseSlugGroups.get(baseSlug);
    if (group) group.push(fragrance);
    else baseSlugGroups.set(baseSlug, [fragrance]);
  }

  const cards: BrowseFragranceCard[] = fragrances.map((fragrance) => {
    const houseSlug = slugify(fragrance.house);
    const baseSlug = `${houseSlug}-${slugify(fragrance.name)}`;
    const hasCollision = (baseSlugGroups.get(baseSlug)?.length ?? 0) > 1;
    const slug = hasCollision
      ? `${baseSlug}-${slugify(fragrance.id)}`
      : baseSlug;
    const house = houseNames.get(houseSlug) ?? fragrance.house;
    return {
      id: fragrance.id,
      name: fragrance.name,
      house,
      year: fragrance.year,
      rating: fragrance.rating,
      votes: fragrance.votes ?? 0,
      ...(fragrance.imageUrl ? { imageUrl: fragrance.imageUrl } : {}),
      slug,
      houseSlug,
      accords: fragrance.accords,
    };
  });

  // Default browse order: popular first.
  cards.sort(
    (a, b) =>
      b.votes - a.votes ||
      b.rating - a.rating ||
      a.name.localeCompare(b.name),
  );

  const houses: BrowseHouseSummary[] = [];
  for (const [slug, entries] of houseGroups) {
    let ratingTotal = 0;
    let ratedCount = 0;
    let firstYear = Number.POSITIVE_INFINITY;
    let latestYear = 0;
    const accordCounts = new Map<string, { name: string; count: number }>();

    for (const fragrance of entries) {
      if (fragrance.rating > 0) {
        ratingTotal += fragrance.rating;
        ratedCount += 1;
      }
      if (fragrance.year > 0) {
        firstYear = Math.min(firstYear, fragrance.year);
        latestYear = Math.max(latestYear, fragrance.year);
      }
      for (const accord of new Set(fragrance.accords)) {
        const key = searchKey(accord);
        const current = accordCounts.get(key);
        accordCounts.set(key, {
          name: current?.name ?? accord,
          count: (current?.count ?? 0) + 1,
        });
      }
    }

    houses.push({
      slug,
      name: houseNames.get(slug) ?? entries[0]!.house,
      fragranceCount: entries.length,
      averageRating:
        ratedCount > 0
          ? Math.round((ratingTotal / ratedCount) * 100) / 100
          : 0,
      firstYear: Number.isFinite(firstYear) ? firstYear : null,
      latestYear: latestYear > 0 ? latestYear : null,
      topAccords: [...accordCounts.values()]
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 8),
    });
  }

  houses.sort((a, b) => a.name.localeCompare(b.name));

  const accords = [
    ...new Set(
      fragrances.flatMap((f) => f.accords).filter((a) => a.trim().length > 0),
    ),
  ].sort((a, b) => a.localeCompare(b));

  // Top houses by collection size for compact filter dropdowns.
  const topHouses = [...houses]
    .sort(
      (a, b) =>
        b.fragranceCount - a.fragranceCount || a.name.localeCompare(b.name),
    )
    .slice(0, 80)
    .map((house) => ({ slug: house.slug, name: house.name }));

  const meta = {
    fragranceCount: cards.length,
    houseCount: houses.length,
    generatedAt: new Date().toISOString(),
  };

  await writeFile(
    path.join(outDir, "fragrance-cards.json"),
    JSON.stringify(cards),
  );
  // Default /fragrances path only needs the first pages of the popular list.
  const popularCards = cards.slice(0, 480).map(
    ({ accords: _accords, ...card }) => card,
  );
  await writeFile(
    path.join(outDir, "popular-cards.json"),
    JSON.stringify(popularCards),
  );
  await writeFile(path.join(outDir, "house-summaries.json"), JSON.stringify(houses));
  await writeFile(path.join(outDir, "accords.json"), JSON.stringify(accords));
  await writeFile(path.join(outDir, "top-houses.json"), JSON.stringify(topHouses));
  await writeFile(path.join(outDir, "browse-meta.json"), JSON.stringify(meta));

  const cardBytes = Buffer.byteLength(JSON.stringify(cards));
  const popularBytes = Buffer.byteLength(JSON.stringify(popularCards));
  const houseBytes = Buffer.byteLength(JSON.stringify(houses));
  console.log(
    `Generated browse indexes: ${cards.length} cards (${(cardBytes / 1e6).toFixed(1)}MB), popular ${popularCards.length} (${(popularBytes / 1e6).toFixed(2)}MB), ${houses.length} houses (${(houseBytes / 1e6).toFixed(2)}MB), ${accords.length} accords`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
