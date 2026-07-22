"use client";

import { useAppStore } from "@/lib/store";
import type { GameModeId, GameKind } from "@/lib/types";
import { useHydrated } from "@/lib/useHydrated";

export function BestBadge({
  modeId,
  kind,
}: {
  modeId: GameModeId;
  kind: GameKind;
}) {
  const bestValue = useAppStore((state) => state.best[modeId]);
  const mounted = useHydrated();

  if (!mounted || bestValue === undefined) return null;

  return (
    <span className="mt-3 block text-xs font-semibold uppercase tracking-[0.16em] text-accent">
      Best {formatBest(kind, bestValue)}
    </span>
  );
}

function formatBest(kind: GameKind, value: number) {
  if (kind === "naming") return `${value} named`;
  if (kind === "connections") return `${Math.round(value / 25)}/4 groups`;
  if (kind === "bracket" || kind === "discovery") return "played";
  return `${value}%`;
}
