import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChartBar,
  GridFour,
  Plus,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { SavedTemplateShelf } from "@/components/rankings/SavedTemplateShelf";
import { getPoolCandidates } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Fragrance rankings — Scenthub",
  description:
    "Create reusable ranking templates and arrange fragrances into ordered tiers.",
  alternates: { canonical: "/rankings" },
};

export default async function RankingsPage() {
  const fragrances = await getPoolCandidates({ requiresImage: true }, 8);

  return (
    <div className="space-y-12 pb-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-[#17181b] px-6 py-9 text-white sm:px-10 sm:py-12 lg:grid lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-center lg:gap-10">
        <div className="relative z-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f5a400]">
            Scenthub Rankings
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
            Put every scent
            <br />
            in its place.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-zinc-300 sm:text-lg">
            Build reusable image sets, make personal tier lists, and compare
            how fragrance community ranks each release.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/rankings/board"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#f5a400] px-6 font-semibold text-[#17120a] hover:-translate-y-0.5"
            >
              Start featured ranking
              <ArrowRight size={18} weight="bold" aria-hidden />
            </Link>
            <Link
              href="/rankings/create"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-zinc-600 px-6 font-semibold hover:border-[#f5a400] hover:bg-zinc-800"
            >
              <Plus size={18} weight="bold" aria-hidden />
              Create template
            </Link>
          </div>
        </div>

        <div
          className="relative mt-10 grid grid-cols-4 gap-2 lg:mt-0"
          aria-label="Featured fragrance items"
        >
          {fragrances.map((fragrance, index) => (
            <div
              key={fragrance.id}
              className={`relative flex aspect-[4/5] items-end justify-center overflow-hidden rounded-xl bg-white p-2 shadow-xl ${
                index % 2 ? "translate-y-4" : ""
              }`}
            >
              <FragranceBottleImage
                imageUrl={fragrance.imageUrl}
                alt={fragrance.name}
                eager={index === 0}
                width={150}
                height={190}
                sizes="112px"
                className="max-h-full w-auto max-w-full object-contain"
                placeholderClassName="h-16 w-auto text-zinc-300"
              />
            </div>
          ))}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#17181b]/40 to-transparent" />
        </div>
      </section>

      <SavedTemplateShelf />

      <section aria-labelledby="featured-ranking-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Popular template
            </p>
            <h2
              id="featured-ranking-heading"
              className="mt-1 font-display text-3xl font-semibold"
            >
              Modern fragrance icons
            </h2>
            <p className="mt-2 max-w-2xl leading-7 text-muted">
              Rank recognizable releases from S to D. Every item starts
              unranked and every position inside row counts.
            </p>
          </div>
          <Link
            href="/rankings/board"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-[#17120a]"
          >
            Rank this set
            <ArrowRight size={17} weight="bold" aria-hidden />
          </Link>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-[#17181b]">
          {[
            ["S", "#e76f51"],
            ["A", "#f4a261"],
            ["B", "#e9c46a"],
          ].map(([label, color], tierIndex) => (
            <div
              key={label}
              className="grid min-h-24 grid-cols-[4.5rem_minmax(0,1fr)] border-b border-zinc-700 last:border-0 sm:grid-cols-[6rem_minmax(0,1fr)]"
            >
              <div
                className="flex items-center justify-center font-display text-2xl font-semibold text-[#17120a]"
                style={{ backgroundColor: color }}
              >
                {label}
              </div>
              <div className="flex gap-2 overflow-hidden p-2">
                {fragrances
                  .slice(tierIndex * 2, tierIndex * 2 + 2)
                  .map((fragrance) => (
                    <div
                      key={fragrance.id}
                      className="flex aspect-square w-20 shrink-0 items-center justify-center rounded-lg bg-white p-1"
                    >
                      <FragranceBottleImage
                        imageUrl={fragrance.imageUrl}
                        alt=""
                        width={80}
                        height={80}
                        sizes="80px"
                        className="max-h-full w-auto max-w-full object-contain"
                        placeholderClassName="h-10 w-auto text-zinc-300"
                      />
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Feature
          icon={<GridFour size={24} aria-hidden />}
          title="Template-safe"
          copy="Source template and personal board remain separate. Saved drafts pin exact template version."
        />
        <Feature
          icon={<ChartBar size={24} aria-hidden />}
          title="Order matters"
          copy="Tier order and item order are explicit. Earlier items in same row score higher."
        />
        <Feature
          icon={<UsersThree size={24} aria-hidden />}
          title="Community-ready"
          copy="Stable tier IDs prepare compatible public rankings for distribution-aware aggregation."
        />
      </section>
    </div>
  );
}

function Feature({
  icon,
  title,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
        {icon}
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
    </article>
  );
}
