import type { Metadata } from "next";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { FragranceBottleIcon } from "@/components/FragranceBottleIcon";
import { CatalogFragranceCard } from "@/components/CatalogFragranceCard";
import {
  browseFragrances,
  getBrowseAccords,
  getBrowseFragranceMeta,
  getFeaturedBrowseHouses,
} from "@/lib/catalog-browse-fragrances";

export const metadata: Metadata = {
  title: "Browse fragrances — This or That",
  description:
    "Browse thousands of fragrances by house, accord, release year, rating, and popularity.",
  alternates: { canonical: "/fragrances" },
};

/** CDN/ISR cache — browse indexes are generated at build time. */
export const revalidate = 3600;

const PAGE_SIZE = 24;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FragrancesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = getParam(params, "q").trim();
  const house = getParam(params, "house");
  const accord = getParam(params, "accord");
  const sort = getParam(params, "sort") || "popular";
  const page = positiveInteger(getParam(params, "page"));

  const meta = getBrowseFragranceMeta();
  const featuredHouses = getFeaturedBrowseHouses();
  const accords = getBrowseAccords();
  const result = await browseFragrances(
    query,
    house,
    accord,
    sort,
    page,
    PAGE_SIZE,
  );

  let activeHouseName: string | undefined;
  if (house) {
    activeHouseName = featuredHouses.find((item) => item.slug === house)?.name;
    if (!activeHouseName) {
      const { getBrowseHouseSummaries } = await import(
        "@/lib/catalog-browse-houses"
      );
      activeHouseName = getBrowseHouseSummaries().find(
        (item) => item.slug === house,
      )?.name;
    }
  }

  const houseOptions = [...featuredHouses];
  if (
    house &&
    activeHouseName &&
    !houseOptions.some((item) => item.slug === house)
  ) {
    houseOptions.unshift({ slug: house, name: activeHouseName });
  }

  return (
    <div className="flex flex-col gap-8 pb-8">
      <section className="grid gap-6 rounded-3xl border border-border bg-card p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Scent library
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
            Browse fragrances
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-muted">
            Explore {formatNumber(meta.fragranceCount)} scents across{" "}
            {formatNumber(meta.houseCount)} designer houses. Filter by house,
            accord, or search every name and note.
          </p>
        </div>
        <Link
          href="/houses"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold transition-colors hover:border-accent hover:bg-card-hover"
        >
          View designer houses
        </Link>
      </section>

      <form
        action="/fragrances"
        className="rounded-2xl border border-border bg-card p-4 sm:p-5"
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(260px,1.5fr)_1fr_1fr_1fr_auto]">
          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Search
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
                placeholder="Name, house, or accord"
                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </span>
          </label>
          <FilterSelect name="house" label="House" defaultValue={house}>
            <option value="">All houses</option>
            {houseOptions.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect name="accord" label="Accord" defaultValue={accord}>
            <option value="">All accords</option>
            {accords.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect name="sort" label="Sort by" defaultValue={sort}>
            <option value="popular">Most popular</option>
            <option value="rating">Highest rated</option>
            <option value="newest">Newest first</option>
            <option value="name">Name A–Z</option>
          </FilterSelect>
          <button
            type="submit"
            className="mt-auto h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-[#17120a] transition-transform hover:-translate-y-0.5"
          >
            Browse
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          House list shows the largest collections.{" "}
          <Link href="/houses" className="font-semibold text-accent hover:underline">
            Browse all houses
          </Link>{" "}
          for the full directory.
        </p>
      </form>

      <section aria-labelledby="results-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="results-heading" className="text-2xl font-semibold tracking-tight">
              {activeHouseName || accord || query || "All fragrances"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {formatNumber(result.total)}{" "}
              {result.total === 1 ? "fragrance" : "fragrances"}
            </p>
          </div>
          {query || house || accord || sort !== "popular" ? (
            <Link href="/fragrances" className="text-sm font-semibold text-accent hover:underline">
              Clear filters
            </Link>
          ) : null}
        </div>

        {result.fragrances.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {result.fragrances.map((fragrance, index) => (
              <CatalogFragranceCard
                key={fragrance.id}
                fragrance={fragrance}
                priority={index < 6}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <FragranceBottleIcon
              aria-hidden
              className="mx-auto text-muted"
              size={42}
              weight="light"
            />
            <h3 className="mt-4 font-semibold">No fragrances found</h3>
            <p className="mt-1 text-sm text-muted">Try a broader search or remove a filter.</p>
            <Link
              href="/fragrances"
              className="mt-5 inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-[#17120a]"
            >
              Browse all fragrances
            </Link>
          </div>
        )}

        {result.total > PAGE_SIZE ? (
          <Pagination
            currentPage={result.page}
            totalPages={result.totalPages}
            params={{ q: query, house, accord, sort }}
          />
        ) : null}
      </section>
    </div>
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      >
        {children}
      </select>
    </label>
  );
}

function Pagination({
  currentPage,
  totalPages,
  params,
}: {
  currentPage: number;
  totalPages: number;
  params: Record<string, string>;
}) {
  const previous = pageHref(params, currentPage - 1);
  const next = pageHref(params, currentPage + 1);

  return (
    <nav aria-label="Fragrance results pages" className="mt-8 flex items-center justify-center gap-4">
      {currentPage > 1 ? (
        <Link href={previous} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent hover:bg-card">
          Previous
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted"
        >
          Previous
        </span>
      )}
      <span className="text-sm tabular-nums text-muted">
        Page <strong className="text-foreground">{currentPage}</strong> of {totalPages}
      </span>
      {currentPage < totalPages ? (
        <Link href={next} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent hover:bg-card">
          Next
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted"
        >
          Next
        </span>
      )}
    </nav>
  );
}

function pageHref(params: Record<string, string>, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && !(key === "sort" && value === "popular")) query.set(key, value);
  }
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `/fragrances?${suffix}` : "/fragrances";
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
