import "server-only";

import { all } from "@/lib/catalog-db";

// Keep search-engine discovery focused on useful, established profiles. The
// complete catalog remains available through search and direct navigation,
// but advertising every long-tail URL causes crawlers to generate thousands
// of on-demand pages in a few hours.
export const FRAGRANCE_SITEMAP_LIMIT = 5_000;
export const FRAGRANCE_SITEMAP_SIZE = 5_000;

export async function getFragranceSlugPage(
  page: number,
): Promise<string[]> {
  const safePage = Math.max(0, Math.floor(page));
  const offset = safePage * FRAGRANCE_SITEMAP_SIZE;
  const remaining = FRAGRANCE_SITEMAP_LIMIT - offset;
  if (remaining <= 0) return [];

  return (
    await all<{ slug: string }>(
      `SELECT slug FROM fragrance
       ORDER BY votes DESC, rating DESC, name
       LIMIT ? OFFSET ?`,
      Math.min(FRAGRANCE_SITEMAP_SIZE, remaining),
      offset,
    )
  ).map((row) => row.slug);
}

export async function getAllHouseSlugs(): Promise<string[]> {
  return (
    await all<{ slug: string }>(
      "SELECT slug FROM house ORDER BY fragrance_count DESC, name",
    )
  ).map((row) => row.slug);
}
