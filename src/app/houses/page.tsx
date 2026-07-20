import type { Metadata } from "next";
import Link from "next/link";
import { Buildings, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { getAllCatalogFragrances, getAllHouseSummaries } from "@/lib/catalog";
import { houseInitials } from "@/lib/visuals/house-logos";

export const metadata: Metadata = {
  title: "Designer houses — This or That",
  description:
    "Explore fragrance designer houses and browse their collections, signature accords, ratings, and release years.",
  alternates: { canonical: "/houses" },
};

const PAGE_SIZE = 48;
const COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HousesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = getParam(params, "q").trim();
  const sort = getParam(params, "sort") || "collection";
  const page = positiveInteger(getParam(params, "page"));
  const normalizedQuery = query.toLocaleLowerCase();
  const houses = getAllHouseSummaries();
  const fragranceCount = getAllCatalogFragrances().length;

  const filtered = houses
    .filter((house) => {
      if (!normalizedQuery) return true;
      return (
        house.name.toLocaleLowerCase().includes(normalizedQuery) ||
        house.topAccords.some((accord) =>
          accord.name.toLocaleLowerCase().includes(normalizedQuery),
        )
      );
    })
    .sort((a, b) => {
      if (sort === "name") return COLLATOR.compare(a.name, b.name);
      if (sort === "rating") {
        return b.averageRating - a.averageRating || b.fragranceCount - a.fragranceCount;
      }
      if (sort === "newest") {
        return (b.latestYear ?? 0) - (a.latestYear ?? 0) || COLLATOR.compare(a.name, b.name);
      }
      return b.fragranceCount - a.fragranceCount || COLLATOR.compare(a.name, b.name);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-8 pb-8">
      <section className="grid gap-6 rounded-3xl border border-border bg-card p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            House directory
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
            Designer houses
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-muted">
            Explore {formatNumber(houses.length)} houses behind{" "}
            {formatNumber(fragranceCount)} fragrances. Compare collections,
            signature accords, ratings, and eras.
          </p>
        </div>
        <Link
          href="/fragrances"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold transition-colors hover:border-accent hover:bg-card-hover"
        >
          Browse all fragrances
        </Link>
      </section>

      <form action="/houses" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(240px,1fr)_minmax(180px,0.35fr)_auto]">
          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Search houses
            </span>
            <span className="relative block">
              <MagnifyingGlass
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                size={17}
              />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="House name or signature accord"
                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </span>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Sort by
            </span>
            <select
              name="sort"
              defaultValue={sort}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            >
              <option value="collection">Largest collection</option>
              <option value="name">Name A–Z</option>
              <option value="rating">Highest rated</option>
              <option value="newest">Latest release</option>
            </select>
          </label>
          <button
            type="submit"
            className="mt-auto h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-[#17120a] transition-transform hover:-translate-y-0.5"
          >
            Explore
          </button>
        </div>
      </form>

      <section aria-labelledby="houses-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="houses-heading" className="text-2xl font-semibold tracking-tight">
              {query ? `Results for “${query}”` : "All houses"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {formatNumber(filtered.length)} {filtered.length === 1 ? "house" : "houses"}
            </p>
          </div>
          {query || sort !== "collection" ? (
            <Link href="/houses" className="text-sm font-semibold text-accent hover:underline">
              Clear filters
            </Link>
          ) : null}
        </div>

        {visible.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((house) => (
              <Link
                key={house.slug}
                href={`/house/${house.slug}`}
                className="group flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 transition-[border-color,background-color,box-shadow] hover:border-accent hover:bg-card-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xs font-bold tracking-wide text-accent ring-1 ring-accent/15"
                  >
                    {houseInitials(house.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-semibold tracking-tight group-hover:text-accent">
                      {house.name}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {formatNumber(house.fragranceCount)} fragrances
                    </span>
                  </span>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-2 border-y border-border py-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Years</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">{yearRange(house.firstYear, house.latestYear)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Avg. rating</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {house.averageRating > 0 ? `${house.averageRating.toFixed(2)} / 5` : "Not rated"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex min-h-7 flex-wrap gap-1.5">
                  {house.topAccords.slice(0, 3).map((accord) => (
                    <span key={accord.name} className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                      {accord.name}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <Buildings aria-hidden className="mx-auto text-muted" size={42} weight="light" />
            <h3 className="mt-4 font-semibold">No houses found</h3>
            <p className="mt-1 text-sm text-muted">Try a broader name or accord.</p>
            <Link href="/houses" className="mt-5 inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-[#17120a]">
              View all houses
            </Link>
          </div>
        )}

        {filtered.length > PAGE_SIZE ? (
          <nav aria-label="House directory pages" className="mt-8 flex items-center justify-center gap-4">
            {currentPage > 1 ? (
              <Link href={pageHref(query, sort, currentPage - 1)} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent hover:bg-card">
                Previous
              </Link>
            ) : (
              <span className="rounded-full border border-border px-4 py-2 text-sm text-muted opacity-50">Previous</span>
            )}
            <span className="text-sm tabular-nums text-muted">
              Page <strong className="text-foreground">{currentPage}</strong> of {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Link href={pageHref(query, sort, currentPage + 1)} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent hover:bg-card">
                Next
              </Link>
            ) : (
              <span className="rounded-full border border-border px-4 py-2 text-sm text-muted opacity-50">Next</span>
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}

function yearRange(first: number | null, latest: number | null): string {
  if (!first || !latest) return "Not listed";
  return first === latest ? String(first) : `${first}–${latest}`;
}

function pageHref(queryValue: string, sort: string, page: number): string {
  const query = new URLSearchParams();
  if (queryValue) query.set("q", queryValue);
  if (sort !== "collection") query.set("sort", sort);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `/houses?${suffix}` : "/houses";
}

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function positiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}
