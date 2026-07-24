import type { Metadata } from "next";
import { CollectionWorkbench } from "@/components/collection/CollectionWorkbench";

export const metadata: Metadata = {
  title: "Collection Analyzer — This or That",
  description:
    "Save your fragrance wardrobe, find coverage gaps, spot redundant bottles, and get transparent recommendations.",
  alternates: { canonical: "/collection" },
};

export default function CollectionPage() {
  return <CollectionWorkbench />;
}
