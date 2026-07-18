"use client";

import Link from "next/link";
import { MODES } from "@/lib/modes";
import type { GameKind } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";

const KIND_LABELS: Record<GameKind, string> = {
  "this-or-that": "This or That",
  "yes-no": "Yes / No",
  "multiple-choice": "Multiple Choice",
  bracket: "Bracket",
  naming: "Timed",
};

export function ModeGrid() {
  const best = useAppStore((s) => s.best);
  const mounted = useHydrated();

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {MODES.map((mode) => {
        const bestValue = mounted ? best[mode.id] : undefined;
        return (
          <Link
            key={mode.id}
            href={`/play/${mode.id}`}
            className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                {KIND_LABELS[mode.kind]}
              </span>
              {bestValue !== undefined && (
                <span className="text-xs font-medium text-muted">
                  Best:{" "}
                  {mode.kind === "naming"
                    ? `${bestValue} named`
                    : mode.kind === "bracket"
                      ? "played"
                      : `${bestValue}%`}
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold tracking-tight group-hover:text-accent">
              {mode.title}
            </h2>
            <p className="text-sm text-muted">{mode.tagline}</p>
          </Link>
        );
      })}
    </section>
  );
}
