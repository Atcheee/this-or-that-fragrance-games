"use client";

import dynamic from "next/dynamic";
import type { GameKind, GameModeId } from "@/lib/types";

const BestBadge = dynamic(
  () => import("@/components/BestBadge").then((mod) => mod.BestBadge),
  { ssr: false },
);

export function LazyBestBadge({
  modeId,
  kind,
}: {
  modeId: GameModeId;
  kind: GameKind;
}) {
  return <BestBadge modeId={modeId} kind={kind} />;
}
