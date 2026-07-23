import "server-only";

import { unstable_cache } from "next/cache";
import { expandBrandSearchTerms } from "@/lib/brand-aliases";
import houseSummaries from "@/data/generated/house-summaries.json";
import browseMeta from "@/data/generated/browse-meta.json";

export interface BrowseHouseSummary {
  slug: string;
  name: string;
  fragranceCount: number;
  averageRating: number;
  firstYear: number | null;
  latestYear: number | null;
  topAccords: Array<{ name: string; count: number }>;
}

export interface HouseBrowseResult {
  total: number;
  houses: BrowseHouseSummary[];
  totalPages: number;
  page: number;
}

const COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const houses = houseSummaries as BrowseHouseSummary[];
const meta = browseMeta as {
  fragranceCount: number;
  houseCount: number;
  generatedAt: string;
};

function normalizeBrowseQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function getBrowseMeta() {
  return meta;
}

export function getBrowseHouseSummaries(): readonly BrowseHouseSummary[] {
  return houses;
}

function browseHousesUncached(
  query: string,
  sort: string,
  page: number,
  pageSize: number,
): HouseBrowseResult {
  const queryTerms = expandBrandSearchTerms(
    normalizeBrowseQuery(query).split(" ").filter(Boolean),
    normalizeBrowseQuery,
  );

  const filtered = houses.filter((house) => {
    if (queryTerms.length === 0) return true;
    const haystack = normalizeBrowseQuery(
      `${house.name} ${house.topAccords.map((accord) => accord.name).join(" ")}`,
    );
    return queryTerms.every((term) => haystack.includes(term));
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name") return COLLATOR.compare(a.name, b.name);
    if (sort === "rating") {
      return (
        b.averageRating - a.averageRating ||
        b.fragranceCount - a.fragranceCount
      );
    }
    if (sort === "newest") {
      return (
        (b.latestYear ?? 0) - (a.latestYear ?? 0) ||
        COLLATOR.compare(a.name, b.name)
      );
    }
    return (
      b.fragranceCount - a.fragranceCount || COLLATOR.compare(a.name, b.name)
    );
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pageHouses = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return {
    total: sorted.length,
    houses: pageHouses,
    totalPages,
    page: currentPage,
  };
}

export const browseHouses = unstable_cache(
  async (query: string, sort: string, page: number, pageSize: number) =>
    browseHousesUncached(query, sort, page, pageSize),
  ["browse-houses-v1"],
  { revalidate: 3600 },
);
