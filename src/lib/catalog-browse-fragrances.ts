import "server-only";

import { unstable_cache } from "next/cache";
import { expandBrandSearchTerms } from "@/lib/brand-aliases";
import popularCards from "@/data/generated/popular-cards.json";
import accords from "@/data/generated/accords.json";
import topHouses from "@/data/generated/top-houses.json";
import browseMeta from "@/data/generated/browse-meta.json";

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
  accords?: string[];
}

export interface FragranceBrowseResult {
  total: number;
  fragrances: BrowseFragranceCard[];
  totalPages: number;
  page: number;
}

const COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const popular = popularCards as BrowseFragranceCard[];
const allAccords = accords as string[];
const featuredHouses = topHouses as Array<{ slug: string; name: string }>;
const meta = browseMeta as {
  fragranceCount: number;
  houseCount: number;
  generatedAt: string;
};

let allCardsPromise: Promise<BrowseFragranceCard[]> | null = null;

function loadAllCards(): Promise<BrowseFragranceCard[]> {
  if (!allCardsPromise) {
    allCardsPromise = import("@/data/generated/fragrance-cards.json").then(
      (module) => module.default as BrowseFragranceCard[],
    );
  }
  return allCardsPromise;
}

function normalizeBrowseQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cardSearchBlob(fragrance: BrowseFragranceCard): string {
  return normalizeBrowseQuery(
    [fragrance.name, fragrance.house, ...(fragrance.accords ?? [])].join(" "),
  );
}

export function getBrowseFragranceMeta() {
  return meta;
}

export function getBrowseAccords(): readonly string[] {
  return allAccords;
}

export function getFeaturedBrowseHouses(): ReadonlyArray<{
  slug: string;
  name: string;
}> {
  return featuredHouses;
}

async function browseFragrancesUncached(
  query: string,
  house: string,
  accord: string,
  sort: string,
  page: number,
  pageSize: number,
): Promise<FragranceBrowseResult> {
  const queryTerms = expandBrandSearchTerms(
    normalizeBrowseQuery(query).split(" ").filter(Boolean),
    normalizeBrowseQuery,
  );
  const isDefaultPopular =
    queryTerms.length === 0 &&
    !house &&
    !accord &&
    (sort === "popular" || !sort);

  // Default listing stays on the tiny popular subset whenever possible.
  if (isDefaultPopular) {
    const total = meta.fragranceCount;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;

    if (end <= popular.length) {
      return {
        total,
        fragrances: popular.slice(start, end),
        totalPages,
        page: currentPage,
      };
    }

    const cards = await loadAllCards();
    return {
      total,
      fragrances: cards.slice(start, end),
      totalPages,
      page: currentPage,
    };
  }

  const cards = await loadAllCards();
  const filtered = cards.filter((fragrance) => {
    if (house && fragrance.houseSlug !== house) return false;
    if (accord && !(fragrance.accords ?? []).includes(accord)) return false;
    if (queryTerms.length === 0) return true;
    const searchable = cardSearchBlob(fragrance);
    return queryTerms.every((term) => searchable.includes(term));
  });

  const sorted =
    sort === "popular"
      ? filtered
      : [...filtered].sort((a, b) => {
          if (sort === "rating") {
            return b.rating - a.rating || b.votes - a.votes;
          }
          if (sort === "newest") {
            return b.year - a.year || COLLATOR.compare(a.name, b.name);
          }
          if (sort === "name") return COLLATOR.compare(a.name, b.name);
          return (
            b.votes - a.votes ||
            b.rating - a.rating ||
            COLLATOR.compare(a.name, b.name)
          );
        });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const fragrances = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return {
    total: sorted.length,
    fragrances,
    totalPages,
    page: currentPage,
  };
}

export const browseFragrances = unstable_cache(
  async (
    query: string,
    house: string,
    accord: string,
    sort: string,
    page: number,
    pageSize: number,
  ) => browseFragrancesUncached(query, house, accord, sort, page, pageSize),
  // Include generatedAt so a new catalog index deploy cannot keep serving
  // stale totals (hero reads browse-meta live; this cache used to lag behind).
  ["browse-fragrances-v3", meta.generatedAt],
  { revalidate: 3600 },
);
