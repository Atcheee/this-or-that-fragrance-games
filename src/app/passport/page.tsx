import type { Metadata } from "next";
import { TastePassportDashboard } from "@/components/TastePassportDashboard";
import { getAllCatalogFragrances } from "@/lib/catalog";
import { fragranceToTasteFragrance } from "@/lib/taste-passport";

export const metadata: Metadata = {
  title: "Taste Passport — This or That",
  description:
    "Your living fragrance taste profile, shaped by every game and choice.",
  alternates: { canonical: "/passport" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TastePassportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const sharedValue =
    typeof params.share === "string" ? params.share : params.share?.[0];
  const candidates = [...getAllCatalogFragrances()]
    .filter((fragrance) => fragrance.rating > 0 && fragrance.year > 0)
    .sort(
      (a, b) =>
        (b.votes ?? 0) - (a.votes ?? 0) ||
        b.rating - a.rating,
    )
    .slice(0, 180)
    .map(fragranceToTasteFragrance);

  return (
    <TastePassportDashboard
      candidates={candidates}
      sharedValue={sharedValue}
    />
  );
}
