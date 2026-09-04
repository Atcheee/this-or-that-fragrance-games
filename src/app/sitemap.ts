import type { MetadataRoute } from "next";
import { getSitemapHouseSlugs } from "@/lib/catalog-sitemap";
import { getCloneSlugs } from "@/lib/clone-data";
import { getFragranceFamilySlugs } from "@/lib/fragrance-families";
import { MODES } from "@/lib/modes";
import { SITE_URL, absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
    },
    {
      url: absoluteUrl("/fragrances"),
    },
    {
      url: absoluteUrl("/houses"),
    },
    {
      url: absoluteUrl("/clones"),
    },
    {
      url: absoluteUrl("/compare"),
    },
    {
      url: absoluteUrl("/families"),
    },
    {
      url: absoluteUrl("/atlas"),
    },
    {
      url: absoluteUrl("/trends"),
    },
    {
      url: absoluteUrl("/swap-a-note"),
    },
    {
      url: absoluteUrl("/rankings"),
    },
    {
      url: absoluteUrl("/collection"),
    },
    {
      url: absoluteUrl("/about"),
    },
  ];

  const houseSlugs = await getSitemapHouseSlugs();

  const gameRoutes: MetadataRoute.Sitemap = MODES.map((mode) => ({
    url: absoluteUrl(`/play/${mode.id}`),
  }));

  const cloneRoutes: MetadataRoute.Sitemap = getCloneSlugs().map((slug) => ({
    url: absoluteUrl(`/clone/${slug}`),
  }));

  const houseRoutes: MetadataRoute.Sitemap = houseSlugs.map((slug) => ({
    url: absoluteUrl(`/house/${slug}`),
  }));

  const familyRoutes: MetadataRoute.Sitemap = getFragranceFamilySlugs().map(
    (slug) => ({
      url: absoluteUrl(`/family/${slug}`),
    }),
  );

  return [
    ...staticRoutes,
    ...gameRoutes,
    ...houseRoutes,
    ...cloneRoutes,
    ...familyRoutes,
  ];
}
