"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CatalogFragranceCard,
  type CatalogCardFragrance,
} from "@/components/CatalogFragranceCard";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";

export interface HouseCollectionItem extends CatalogCardFragrance {
  accords: string[];
  notes: string[];
}

type SortOption = "name" | "rating" | "year" | "popular";
type CollectionTab = "all" | "top-rated" | "newest" | "popular";
type ViewMode = "grid" | "list";

const PAGE_SIZE = 24;

const COLLATOR = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

const TABS: Array<{
  id: CollectionTab;
  label: string;
  sort: SortOption;
}> = [
  { id: "all", label: "All fragrances", sort: "name" },
  { id: "top-rated", label: "Top rated", sort: "rating" },
  { id: "newest", label: "Newest", sort: "year" },
  { id: "popular", label: "Popular", sort: "popular" },
];

export function FragranceCollectionBrowser({
  houseName,
  items,
}: {
  houseName: string;
  items: HouseCollectionItem[];
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [note, setNote] = useState("");
  const [accord, setAccord] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [sort, setSort] = useState<SortOption>("name");
  const [tab, setTab] = useState<CollectionTab>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);

  const options = useMemo(() => {
    const notes = new Set<string>();
    const accords = new Set<string>();
    for (const item of items) {
      item.notes.forEach((entry) => notes.add(entry));
      item.accords.forEach((entry) => accords.add(entry));
    }
    return {
      notes: [...notes].sort(COLLATOR.compare),
      accords: [...accords].sort(COLLATOR.compare),
    };
  }, [items]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
    const from = Number(yearFrom) || 0;
    const to = Number(yearTo) || Number.POSITIVE_INFINITY;

    return items
      .filter((item) => {
        const matchesQuery =
          !normalizedQuery ||
          item.name.toLocaleLowerCase().includes(normalizedQuery) ||
          item.accords.some((entry) =>
            entry.toLocaleLowerCase().includes(normalizedQuery),
          ) ||
          item.notes.some((entry) =>
            entry.toLocaleLowerCase().includes(normalizedQuery),
          );
        return (
          matchesQuery &&
          (!note || item.notes.includes(note)) &&
          (!accord || item.accords.includes(accord)) &&
          ((!yearFrom && !yearTo) ||
            (item.year > 0 && item.year >= from && item.year <= to))
        );
      })
      .sort((a, b) => {
        if (sort === "rating") {
          return (
            b.rating - a.rating ||
            (b.votes ?? 0) - (a.votes ?? 0) ||
            COLLATOR.compare(a.name, b.name)
          );
        }
        if (sort === "year") {
          return b.year - a.year || COLLATOR.compare(a.name, b.name);
        }
        if (sort === "popular") {
          return (
            (b.votes ?? 0) - (a.votes ?? 0) ||
            b.rating - a.rating ||
            COLLATOR.compare(a.name, b.name)
          );
        }
        return COLLATOR.compare(a.name, b.name);
      });
  }, [accord, deferredQuery, items, note, sort, yearFrom, yearTo]);

  useEffect(() => {
    setPage(1);
  }, [accord, deferredQuery, note, sort, yearFrom, yearTo, tab]);

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = visibleItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const hasFilters = Boolean(query || note || accord || yearFrom || yearTo);

  function clearFilters() {
    setQuery("");
    setNote("");
    setAccord("");
    setYearFrom("");
    setYearTo("");
  }

  function goToPage(nextPage: number) {
    setPage(nextPage);
    document
      .getElementById("collection-results")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section aria-labelledby="collection-heading">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 sm:px-5">
          <div className="flex gap-1 overflow-x-auto py-2" role="tablist" aria-label="Collection order">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => {
                  setTab(item.id);
                  setSort(item.sort);
                }}
                className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  tab === item.id
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-card-hover hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Search this collection
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${houseName} by name, note, or accord…`}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </label>

          <FilterSelect
            label="Note"
            allLabel="All notes"
            value={note}
            onChange={setNote}
            options={options.notes}
          />
          <FilterSelect
            label="Accord"
            allLabel="All accords"
            value={accord}
            onChange={setAccord}
            options={options.accords}
          />

          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              From year
            </span>
            <input
              type="number"
              inputMode="numeric"
              min="1700"
              max="2100"
              value={yearFrom}
              onChange={(event) => setYearFrom(event.target.value)}
              placeholder="Any"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              To year
            </span>
            <input
              type="number"
              inputMode="numeric"
              min="1700"
              max="2100"
              value={yearTo}
              onChange={(event) => setYearTo(event.target.value)}
              placeholder="Any"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Sort by
            </span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as SortOption);
                setTab("all");
              }}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            >
              <option value="name">Name A–Z</option>
              <option value="rating">Highest rating</option>
              <option value="year">Newest first</option>
              <option value="popular">Most votes</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="h-10 w-full rounded-xl border border-border px-3 text-sm font-medium transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      <div
        id="collection-results"
        className="mt-6 scroll-mt-24 flex items-center justify-between gap-4"
      >
        <p id="collection-heading" className="text-sm text-muted" aria-live="polite">
          <span className="font-semibold text-foreground">
            {visibleItems.length}
          </span>{" "}
          {visibleItems.length === 1 ? "fragrance" : "fragrances"}
        </p>
        <div className="flex rounded-lg border border-border p-1" aria-label="Collection view">
          <ViewButton
            active={view === "grid"}
            label="Grid view"
            onClick={() => setView("grid")}
          >
            <GridIcon />
          </ViewButton>
          <ViewButton
            active={view === "list"}
            label="List view"
            onClick={() => setView("list")}
          >
            <ListIcon />
          </ViewButton>
        </div>
      </div>

      {visibleItems.length > 0 ? (
        <>
          {view === "grid" ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {pagedItems.map((item) => (
                <CatalogFragranceCard
                  key={item.id}
                  fragrance={item}
                  showHouse={false}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {pagedItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/fragrance/${item.slug}`}
                  className="catalog-card flex items-center gap-4 p-4 transition-colors hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                >
                  <div className="bottle-studio flex h-16 w-14 shrink-0 items-center justify-center rounded-lg px-1 py-1">
                    <FragranceBottleImage
                      key={`${item.id}:${item.imageUrl ?? ""}`}
                      imageUrl={item.imageUrl}
                      alt={`${item.name} bottle`}
                      className="max-h-[90%] max-w-[90%] object-contain"
                      placeholderClassName="h-12 w-auto text-stone-400 opacity-40"
                      stage={false}
                    />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {item.name}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {item.year > 0 ? item.year : "Year unknown"}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted">
                    {item.rating > 0 ? `${item.rating.toFixed(1)} / 5` : "Unrated"}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {visibleItems.length > PAGE_SIZE ? (
            <nav
              aria-label="Collection pages"
              className="mt-8 flex items-center justify-center gap-4"
            >
              {currentPage > 1 ? (
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent hover:bg-card"
                >
                  Previous
                </button>
              ) : (
                <span
                  aria-disabled="true"
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted"
                >
                  Previous
                </span>
              )}
              <span className="text-sm tabular-nums text-muted">
                Page{" "}
                <strong className="text-foreground">{currentPage}</strong> of{" "}
                {totalPages}
              </span>
              {currentPage < totalPages ? (
                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent hover:bg-card"
                >
                  Next
                </button>
              ) : (
                <span
                  aria-disabled="true"
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted"
                >
                  Next
                </span>
              )}
            </nav>
          ) : null}
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <h3 className="font-semibold">No fragrances match</h3>
          <p className="mt-1 text-sm text-muted">
            Try removing a filter or using a broader search.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white dark:text-black"
          >
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  allLabel,
  value,
  onChange,
  options,
}: {
  label: string;
  allLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-md p-1.5 transition-colors ${
        active ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  );
}
