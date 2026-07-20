"use client";

import type { Icon } from "@phosphor-icons/react";
import { Compass, PuzzlePiece, Trophy } from "@phosphor-icons/react";
import Link from "next/link";
import { GameIcon } from "@/components/GameIcon";
import { MODES } from "@/lib/modes";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";

const GROUPS: Array<{
  title: string;
  description: string;
  icon: Icon;
  ids: string[];
}> = [
  {
    title: "Play & Compete",
    description: "Compare, choose, and challenge yourself.",
    icon: Trophy,
    ids: [
      "higher-rating",
      "cost-more",
      "contains-note",
      "has-accord",
      "which-house",
      "guess-description",
    ],
  },
  {
    title: "Puzzles & Discovery",
    description: "Solve clues, explore patterns, and make new connections.",
    icon: PuzzlePiece,
    ids: [
      "fragrance-grid",
      "note-pyramid",
      "odd-one-out",
      "bottle-silhouette",
      "fragrance-timeline",
      "connections-curated",
    ],
  },
  {
    title: "Taste & Create",
    description: "Follow your instincts and build a scent profile of your own.",
    icon: Compass,
    ids: [
      "find-favorite",
      "perfect-match",
      "build-an-accord",
      "name-by-house",
      "name-by-note",
    ],
  },
];

export function ModeGrid() {
  const best = useAppStore((state) => state.best);
  const mounted = useHydrated();

  return (
    <div id="games" className="space-y-14 scroll-mt-24">
      {GROUPS.map((group) => {
        const CategoryIcon = group.icon;

        return (
          <section key={group.title} aria-labelledby={slugify(group.title)}>
            <div className="mb-6 flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-accent/70 text-accent">
                <CategoryIcon aria-hidden size={28} weight="light" />
              </span>
              <div>
                <h2
                  id={slugify(group.title)}
                  className="text-xl font-semibold tracking-tight sm:text-2xl"
                >
                  {group.title}
                </h2>
                <p className="mt-1 text-sm text-muted sm:text-base">
                  {group.description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.ids.map((id) => {
                const mode = MODES.find((candidate) => candidate.id === id);
                if (!mode) return null;
                const bestValue = mounted ? best[mode.id] : undefined;

                return (
                  <Link
                    key={mode.id}
                    href={`/play/${mode.id}`}
                    className="group flex min-h-32 items-center gap-5 rounded-2xl border border-border bg-card px-5 py-5 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-accent hover:bg-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                  >
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-accent/70 text-accent transition-colors group-hover:bg-accent-soft sm:size-20">
                      <GameIcon modeId={mode.id} size={36} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-lg font-semibold leading-6 tracking-tight group-hover:text-accent">
                        {mode.title}
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-muted sm:text-base">
                        {mode.tagline}
                      </span>
                      {bestValue !== undefined ? (
                        <span className="mt-3 block text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                          Best {formatBest(mode.kind, bestValue)}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function slugify(value: string) {
  return value.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and");
}

function formatBest(kind: string, value: number) {
  if (kind === "naming") return `${value} named`;
  if (kind === "connections") return `${Math.round(value / 25)}/4 groups`;
  if (kind === "bracket" || kind === "discovery") return "played";
  return `${value}%`;
}
