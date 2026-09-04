import type { MetadataRoute } from "next";
import { getCatalogSize } from "@/lib/catalog";
import {
  FRAGRANCE_SITEMAP_LIMIT,
  FRAGRANCE_SITEMAP_SIZE,
  getFragranceSlugPage,
} from "@/lib/catalog-sitemap";
import { absoluteUrl } from "@/lib/site";

export async function generateSitemaps() {
  const count = await getCatalogSize();
  const sitemapCount = Math.max(
    1,
    Math.ceil(Math.min(count, FRAGRANCE_SITEMAP_LIMIT) / FRAGRANCE_SITEMAP_SIZE),
  );

  return Array.from({ length: sitemapCount }, (_, id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const parsedId = Number.parseInt(await id, 10);
  const page = Number.isFinite(parsedId) && parsedId >= 0 ? parsedId : 0;
  const slugs = await getFragranceSlugPage(page);

  return slugs.map((slug) => ({
    url: absoluteUrl(`/fragrance/${slug}`),
    changeFrequency: "monthly",
    priority: 0.6,
  }));
}
