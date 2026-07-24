import type { Metadata } from "next";
import topHouses from "@/data/generated/top-houses.json";
import { FragranceTrendExplorer } from "@/components/FragranceTrendExplorer";
import {
  buildTrendExplorerData,
  defaultTrendFilters,
} from "@/lib/fragrance-trends";

export const metadata: Metadata = {
  title: "Fragrance Trend Explorer — This or That",
  description:
    "Compare how fragrance notes, accords, houses, and styles changed across decades.",
  alternates: { canonical: "/trends" },
};

export default function TrendsPage() {
  const initialData = buildTrendExplorerData(defaultTrendFilters);

  return (
    <FragranceTrendExplorer
      initialData={initialData}
      houses={topHouses.slice(0, 100)}
    />
  );
}
