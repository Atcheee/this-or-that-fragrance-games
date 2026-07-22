import type { Metadata } from "next";
import Link from "next/link";
import { MagnifyingGlass, SprayBottle } from "@phosphor-icons/react/dist/ssr";
import { CatalogFragranceCard } from "@/components/CatalogFragranceCard";
import { expandBrandSearchTerms } from "@/lib/brand-aliases";
import {
  getAllCatalogFragrances,
  getAllHouseSummaries,
} from "@/lib/catalog";
import { allNotes } from "@/lib/types";

export const metadata: Metadata = {
  title: "Browse fragrances — This or That",
  description:
    "Browse thousands of fragrances by house, accord, release year, rating, and popularity.",
  alternates: { canonical: "/fragrances" },
};

const PAGE_SIZE = 24;
const COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function normalizeBrowseQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

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
  const queryTerms = expandBrandSearchTerms(
    normalizeBrowseQuery(query).split(" ").filter(Boolean),
    normalizeBrowseQuery,
  );

  const fragrances = getAllCatalogFragrances();
  const houses = getAllHouseSummaries();
  const accords = [
    ...new Set(
      fragrances
        .flatMap((fragrance) => fragrance.accords)
        .filter((item) => item.trim().length > 0),
    ),
  ].sort(COLLATOR.compare);

  const filtered = fragrances
    .filter((fragrance) => {
      if (house && fragrance.houseSlug !== house) return false;
      if (accord && !fragrance.accords.includes(accord)) return false;
      if (queryTerms.length === 0) return true;

      const searchable = normalizeBrowseQuery(
        [
          fragrance.name,
          fragrance.house,
          ...fragrance.accords,
          ...allNotes(fragrance),
        ].join(" "),
      );
      return queryTerms.every((term) => searchable.includes(term));
    })
    .sort((a, b) => {
      if (sort === "rating") {
        return b.rating - a.rating || (b.votes ?? 0) - (a.votes ?? 0);
      }
      if (sort === "newest") {
        return b.year - a.year || COLLATOR.compare(a.name, b.name);
      }
      if (sort === "name") return COLLATOR.compare(a.name, b.name);
      return (
        (b.votes ?? 0) - (a.votes ?? 0) ||
        b.rating - a.rating ||
        COLLATOR.compare(a.name, b.name)
      );
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const activeHouse = houses.find((item) => item.slug === house);

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
            Explore {formatNumber(fragrances.length)} scents across{" "}
            {formatNumber(houses.length)} designer houses. Filter by house,
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
                placeholder="Name, house, note, or accord"
                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </span>
          </label>
          <FilterSelect name="house" label="House" defaultValue={house}>
            <option value="">All houses</option>
            {houses.map((item) => (
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
      </form>

      <section aria-labelledby="results-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="results-heading" className="text-2xl font-semibold tracking-tight">
              {activeHouse ? activeHouse.name : accord || query || "All fragrances"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {formatNumber(filtered.length)}{" "}
              {filtered.length === 1 ? "fragrance" : "fragrances"}
            </p>
          </div>
          {query || house || accord || sort !== "popular" ? (
            <Link href="/fragrances" className="text-sm font-semibold text-accent hover:underline">
              Clear filters
            </Link>
          ) : null}
        </div>

        {visible.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {visible.map((fragrance) => (
              <CatalogFragranceCard key={fragrance.id} fragrance={fragrance} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <SprayBottle aria-hidden className="mx-auto text-muted" size={42} weight="light" />
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

        {filtered.length > PAGE_SIZE ? (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
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
