import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  TreeStructure,
} from "@phosphor-icons/react/dist/ssr";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { getAllFragranceFamilies } from "@/lib/fragrance-families";

export const metadata: Metadata = {
  title: "Fragrance family trees — This or That",
  description:
    "Explore curated fragrance lines chronologically and compare how notes and accords changed across flankers and concentrations.",
  alternates: { canonical: "/families" },
};

export default function FragranceFamiliesPage() {
  const families = getAllFragranceFamilies();

  return (
    <div className="flex flex-col gap-8 pb-8">
      <section className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.42fr)] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              Curated lineages
            </p>
            <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
              Fragrance family trees
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-muted">
              Follow original releases through new concentrations, flankers,
              and later reinterpretations. See what changed at every branch.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start gap-3">
              <CheckCircle
                aria-hidden
                size={22}
                weight="fill"
                className="mt-0.5 shrink-0 text-success"
              />
              <div>
                <p className="text-sm font-semibold">
                  Relationships are manually curated
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Similar names never create a family automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="family-directory-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="family-directory-heading"
              className="text-2xl font-semibold tracking-tight"
            >
              Verified families
            </h2>
            <p className="mt-1 text-sm text-muted">
              {families.length} major lines available in this first release
            </p>
          </div>
          <Link
            href="/fragrances"
            className="text-sm font-semibold text-accent hover:underline"
          >
            Browse all fragrances
          </Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {families.map((family) => {
            const original = family.members[0]!.fragrance;
            const latest = family.members.at(-1)!.fragrance;

            return (
              <article
                key={family.slug}
                className="group overflow-hidden rounded-2xl border border-border bg-card transition-[border-color,box-shadow] hover:border-accent hover:shadow-lg"
              >
                <div className="grid grid-cols-[112px_minmax(0,1fr)]">
                  <div className="bottle-studio flex min-h-44 items-center justify-center p-4">
                    <FragranceBottleImage
                      imageUrl={original.imageUrl}
                      alt={`${original.name} by ${original.house} bottle`}
                      width={220}
                      height={300}
                      sizes="112px"
                      className="max-h-36 w-auto max-w-full object-contain"
                      placeholderClassName="h-24 w-auto text-stone-400 opacity-40"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                      {family.house}
                    </p>
                    <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight">
                      {family.name}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {family.summary}
                    </p>
                  </div>
                </div>

                <div className="border-t border-border p-5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <TreeStructure aria-hidden size={16} />
                      {family.members.length} releases
                    </span>
                    <span className="tabular-nums">
                      {original.year}–{latest.year}
                    </span>
                  </div>
                  <Link
                    href={`/family/${family.slug}`}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-[#17120a] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Open family tree
                    <ArrowRight aria-hidden size={16} weight="bold" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
