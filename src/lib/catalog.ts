import "server-only";

import rawData from "@/data/fragrances.json";
import { expandBrandSearchTerms } from "@/lib/brand-aliases";
import type { Fragrance } from "@/lib/types";
import { allNotes } from "@/lib/types";

export interface CatalogFragrance extends Fragrance {
  slug: string;
  houseSlug: string;
}

export interface CatalogSearchResult {
  id: string;
  name: string;
  house: string;
  year: number;
  slug: string;
  imageUrl?: string;
}

export interface HouseSummary {
  slug: string;
  name: string;
  fragranceCount: number;
  averageRating: number;
  firstYear: number | null;
  latestYear: number | null;
  topAccords: Array<{ name: string; count: number }>;
}

export interface HouseCatalog extends HouseSummary {
  fragrances: CatalogFragrance[];
}

const fragrances = rawData as Fragrance[];
const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const SEARCH_NON_ALPHANUMERIC = /[^a-z0-9]+/g;

export function slugify(value: string): string {
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

function chooseHouseName(entries: Fragrance[]): string {
  const counts = new Map<string, number>();
  for (const fragrance of entries) {
    counts.set(fragrance.house, (counts.get(fragrance.house) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b))[0]![0];
}

const houseGroups = new Map<string, Fragrance[]>();
for (const fragrance of fragrances) {
  const houseSlug = slugify(fragrance.house);
  const group = houseGroups.get(houseSlug);
  if (group) group.push(fragrance);
  else houseGroups.set(houseSlug, [fragrance]);
}

const houseNames = new Map<string, string>();
for (const [houseSlug, entries] of houseGroups) {
  houseNames.set(houseSlug, chooseHouseName(entries));
}

const baseSlugGroups = new Map<string, Fragrance[]>();
for (const fragrance of fragrances) {
  const baseSlug = `${slugify(fragrance.house)}-${slugify(fragrance.name)}`;
  const group = baseSlugGroups.get(baseSlug);
  if (group) group.push(fragrance);
  else baseSlugGroups.set(baseSlug, [fragrance]);
}

const catalogFragrances: CatalogFragrance[] = [];
const fragranceBySlug = new Map<string, CatalogFragrance>();
const fragranceById = new Map<string, CatalogFragrance>();
const fragrancesByHouse = new Map<string, CatalogFragrance[]>();

for (const fragrance of fragrances) {
  const houseSlug = slugify(fragrance.house);
  const baseSlug = `${houseSlug}-${slugify(fragrance.name)}`;
  const hasCollision = (baseSlugGroups.get(baseSlug)?.length ?? 0) > 1;
  const slug = hasCollision ? `${baseSlug}-${slugify(fragrance.id)}` : baseSlug;
  const catalogFragrance: CatalogFragrance = {
    ...fragrance,
    house: houseNames.get(houseSlug) ?? fragrance.house,
    slug,
    houseSlug,
  };

  catalogFragrances.push(catalogFragrance);
  fragranceBySlug.set(slug, catalogFragrance);
  fragranceById.set(fragrance.id, catalogFragrance);

  const houseCatalog = fragrancesByHouse.get(houseSlug);
  if (houseCatalog) houseCatalog.push(catalogFragrance);
  else fragrancesByHouse.set(houseSlug, [catalogFragrance]);
}

const searchRecords = catalogFragrances.map((fragrance) => ({
  fragrance,
  name: searchKey(fragrance.name),
  house: searchKey(fragrance.house),
  combined: searchKey(`${fragrance.name} ${fragrance.house}`),
}));

const accordIndex = new Map<string, CatalogFragrance[]>();
const noteIndex = new Map<string, CatalogFragrance[]>();
for (const fragrance of catalogFragrances) {
  for (const accord of new Set(fragrance.accords.map(searchKey))) {
    const entries = accordIndex.get(accord);
    if (entries) entries.push(fragrance);
    else accordIndex.set(accord, [fragrance]);
  }
  for (const note of new Set(allNotes(fragrance).map(searchKey))) {
    const entries = noteIndex.get(note);
    if (entries) entries.push(fragrance);
    else noteIndex.set(note, [fragrance]);
  }
}

function summarizeHouse(
  slug: string,
  entries: CatalogFragrance[],
): HouseSummary {
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

  return {
    slug,
    name: houseNames.get(slug) ?? entries[0]?.house ?? slug,
    fragranceCount: entries.length,
    averageRating: ratedCount > 0 ? ratingTotal / ratedCount : 0,
    firstYear: Number.isFinite(firstYear) ? firstYear : null,
    latestYear: latestYear > 0 ? latestYear : null,
    topAccords: [...accordCounts.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8),
  };
}

const houseSummaries = new Map<string, HouseSummary>();
for (const [houseSlug, entries] of fragrancesByHouse) {
  houseSummaries.set(houseSlug, summarizeHouse(houseSlug, entries));
}

export function getAllCatalogFragrances(): readonly CatalogFragrance[] {
  return catalogFragrances;
}

export function getFragranceBySlug(
  slug: string,
): CatalogFragrance | undefined {
  return fragranceBySlug.get(slug);
}

export function getFragranceById(id: string): CatalogFragrance | undefined {
  return fragranceById.get(id);
}

export function getHouseBySlug(slug: string): HouseCatalog | undefined {
  const entries = fragrancesByHouse.get(slug);
  const summary = houseSummaries.get(slug);
  if (!entries || !summary) return undefined;
  return { ...summary, fragrances: entries };
}

export function getAllHouseSummaries(): readonly HouseSummary[] {
  return [...houseSummaries.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function searchCatalog(
  query: string,
  limit = 8,
): CatalogSearchResult[] {
  const normalized = searchKey(query);
  if (normalized.length < 2) return [];
  const terms = expandBrandSearchTerms(normalized.split(" "), searchKey);
  const expandedQuery = terms.join(" ");

  return searchRecords
    .map(({ fragrance, name, house, combined }) => {
      if (!terms.every((term) => combined.includes(term))) return null;

      let score = 0;
      if (name === normalized || name === expandedQuery) score += 1_000;
      else if (name.startsWith(normalized) || name.startsWith(expandedQuery))
        score += 700;
      else if (name.includes(normalized) || name.includes(expandedQuery))
        score += 450;
      if (house === normalized || house === expandedQuery) score += 500;
      else if (house.startsWith(normalized) || house.startsWith(expandedQuery))
        score += 260;
      if (
        combined.startsWith(normalized) ||
        combined.startsWith(expandedQuery)
      ) {
        score += 180;
      }
      score += Math.min(Math.log10((fragrance.votes ?? 0) + 1) * 30, 150);
      score += fragrance.rating > 0 ? fragrance.rating * 2 : 0;

      return { fragrance, score };
    })
    .filter(
      (
        result,
      ): result is { fragrance: CatalogFragrance; score: number } =>
        result !== null,
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.fragrance.votes ?? 0) - (a.fragrance.votes ?? 0) ||
        a.fragrance.name.localeCompare(b.fragrance.name),
    )
    .slice(0, Math.max(1, Math.min(limit, 20)))
    .map(({ fragrance }) => ({
      id: fragrance.id,
      name: fragrance.name,
      house: fragrance.house,
      year: fragrance.year,
      slug: fragrance.slug,
      imageUrl: fragrance.imageUrl,
    }));
}

export function getRelatedFragrances(
  fragrance: CatalogFragrance,
  limit = 6,
): CatalogFragrance[] {
  const candidates = new Map<string, CatalogFragrance>();
  for (const entry of fragrancesByHouse.get(fragrance.houseSlug) ?? []) {
    candidates.set(entry.id, entry);
  }
  for (const accord of fragrance.accords) {
    for (const entry of accordIndex.get(searchKey(accord)) ?? []) {
      candidates.set(entry.id, entry);
    }
  }
  for (const note of allNotes(fragrance)) {
    for (const entry of noteIndex.get(searchKey(note)) ?? []) {
      candidates.set(entry.id, entry);
    }
  }
  candidates.delete(fragrance.id);

  const accordKeys = new Set(fragrance.accords.map(searchKey));
  const noteKeys = new Set(allNotes(fragrance).map(searchKey));

  return [...candidates.values()]
    .map((candidate) => {
      let score = candidate.houseSlug === fragrance.houseSlug ? 18 : 0;
      score += candidate.accords.filter((accord) =>
        accordKeys.has(searchKey(accord)),
      ).length * 7;
      score += allNotes(candidate).filter((note) =>
        noteKeys.has(searchKey(note)),
      ).length * 2;
      score += Math.min(Math.log10((candidate.votes ?? 0) + 1), 4);
      return { candidate, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.candidate.votes ?? 0) - (a.candidate.votes ?? 0) ||
        b.candidate.rating - a.candidate.rating,
    )
    .slice(0, Math.max(1, limit))
    .map(({ candidate }) => candidate);
}

export function getPopularFragranceSlugs(limit = 250): string[] {
  return [...catalogFragrances]
    .sort(
      (a, b) =>
        (b.votes ?? 0) - (a.votes ?? 0) ||
        b.rating - a.rating ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
    .map((fragrance) => fragrance.slug);
}

export function getPopularCatalogFragrances(
  limit = 9,
): CatalogSearchResult[] {
  const capped = Math.max(1, Math.min(limit, 24));
  return [...catalogFragrances]
    .sort(
      (a, b) =>
        (b.votes ?? 0) - (a.votes ?? 0) ||
        b.rating - a.rating ||
        a.name.localeCompare(b.name),
    )
    .slice(0, capped)
    .map((fragrance) => ({
      id: fragrance.id,
      name: fragrance.name,
      house: fragrance.house,
      year: fragrance.year,
      slug: fragrance.slug,
      imageUrl: fragrance.imageUrl,
    }));
}
