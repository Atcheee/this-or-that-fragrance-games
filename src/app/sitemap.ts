import type { MetadataRoute } from "next";
import {
  getAllCatalogFragrances,
  getAllHouseSummaries,
} from "@/lib/catalog";
import { MODES } from "@/lib/modes";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://this-or-that-fragrance-games.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/settings`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/fragrances`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/houses`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/compare`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  const fragranceRoutes: MetadataRoute.Sitemap = getAllCatalogFragrances().map(
    (fragrance) => ({
      url: `${siteUrl}/fragrance/${fragrance.slug}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    }),
  );

  const gameRoutes: MetadataRoute.Sitemap = MODES.map((mode) => ({
    url: `${siteUrl}/play/${mode.id}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const houseRoutes: MetadataRoute.Sitemap = getAllHouseSummaries().map(
    (house) => ({
      url: `${siteUrl}/house/${house.slug}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    }),
  );

  return [...staticRoutes, ...gameRoutes, ...houseRoutes, ...fragranceRoutes];
}
