import {
  Compass,
  PuzzlePiece,
  Trophy,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { LazyBestBadge } from "@/components/LazyBestBadge";
import { GameIcon } from "@/components/GameIcon";
import { MODES } from "@/lib/modes";

const GROUPS = [
  {
    title: "Play & Compete",
    description: "Compare, choose, and challenge yourself.",
    Icon: Trophy,
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
    Icon: PuzzlePiece,
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
    Icon: Compass,
    ids: [
      "find-favorite",
      "perfect-match",
      "build-an-accord",
      "name-by-house",
      "name-by-note",
    ],
  },
] as const;

export function ModeGrid() {
  return (
    <div id="games" className="space-y-14 scroll-mt-24">
      {GROUPS.map((group) => {
        const CategoryIcon = group.Icon;

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

                return (
                  <Link
                    key={mode.id}
                    href={`/play/${mode.id}`}
                    className="group flex min-h-32 items-center gap-5 rounded-2xl border border-border bg-card px-5 py-5 transition-transform hover:-translate-y-0.5 hover:border-accent hover:bg-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                  >
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-accent/70 text-accent group-hover:bg-accent-soft sm:size-20">
                      <GameIcon modeId={mode.id} size={36} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-lg font-semibold leading-6 tracking-tight group-hover:text-accent">
                        {mode.title}
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-muted sm:text-base">
                        {mode.tagline}
                      </span>
                      <LazyBestBadge modeId={mode.id} kind={mode.kind} />
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
