import type { Metadata } from "next";
import { RankingBoard } from "@/components/rankings/RankingBoard";
import { getPoolCandidates } from "@/lib/catalog";
import {
  DEFAULT_TIERS,
  type RankingTemplateVersion,
} from "@/lib/rankings";

export const metadata: Metadata = {
  title: "Rank fragrances — Scenthub",
  description:
    "Drag fragrances into ordered tiers, customize the board, and export your ranking.",
  alternates: { canonical: "/rankings/board" },
  robots: { index: false, follow: true },
};

export default async function RankingBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template } = await searchParams;
  const fragrances = await getPoolCandidates({ requiresImage: true }, 16);
  const defaultTemplate: RankingTemplateVersion = {
    id: "scenthub-signatures:v1",
    templateId: "scenthub-signatures",
    version: 1,
    title: "Modern fragrance icons",
    description:
      "Rank recognizable releases by how much you would want to wear them. Earlier placement inside each row ranks higher.",
    category: "Fragrance",
    visibility: "public",
    displayMode: "contain",
    items: fragrances.map((fragrance) => ({
      id: fragrance.id,
      name: fragrance.name,
      imageUrl: fragrance.imageUrl,
      alt: `${fragrance.name} by ${fragrance.house}`,
      attribution: fragrance.house,
    })),
    tiers: DEFAULT_TIERS,
    createdAt: "2026-07-30T00:00:00.000Z",
  };

  return (
    <RankingBoard
      defaultTemplate={defaultTemplate}
      requestedTemplateId={template}
    />
  );
}
