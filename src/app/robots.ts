import type { MetadataRoute } from "next";
import { getCatalogSize } from "@/lib/catalog";
import {
  FRAGRANCE_SITEMAP_LIMIT,
  FRAGRANCE_SITEMAP_SIZE,
} from "@/lib/catalog-sitemap";
import { SITE_URL, absoluteUrl } from "@/lib/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const catalogSize = await getCatalogSize();
  const fragranceSitemapCount = Math.max(
    1,
    Math.ceil(
      Math.min(catalogSize, FRAGRANCE_SITEMAP_LIMIT) / FRAGRANCE_SITEMAP_SIZE,
    ),
  );
  const fragranceSitemaps = Array.from(
    { length: fragranceSitemapCount },
    (_, id) => absoluteUrl(`/fragrance/sitemap/${id}.xml`),
  );

  return {
    rules: [
      {
        userAgent: [
          "ClaudeBot",
          "Claude-SearchBot",
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "Baiduspider",
          "Bytespider",
          "Meta-ExternalAgent",
          "AhrefsBot",
          "SemrushBot",
          "MJ12bot",
          "DotBot",
          "PetalBot",
          "YandexBot",
        ],
        disallow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: [absoluteUrl("/sitemap.xml"), ...fragranceSitemaps],
    host: SITE_URL,
  };
}
