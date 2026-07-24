"use client";

import {
  ChartBar,
  Check,
  Flask,
  Heart,
  MagnifyingGlass,
  Plus,
  Sparkle,
  Trash,
  Warning,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { FragranceSearchResultVisual } from "@/components/FragranceSearchResultVisual";
import {
  clearCollection,
  COLLECTION_STATUSES,
  getCollection,
  removeFromCollection,
  setCollectionStatus,
  type CollectionAnalysis,
  type CollectionEntry,
  type CollectionFragrance,
  type CollectionRecommendation,
  type CollectionStat,
  type CollectionStatus,
  type SimilarityBreakdown,
} from "@/lib/fragrance-collection";
import { useHydrated } from "@/lib/useHydrated";

const STATUS_META: Record<
  CollectionStatus,
  { label: string; shortLabel: string; className: string }
> = {
  owned: {
    label: "Owned",
    shortLabel: "Owned",
    className: "bg-success-soft text-success",
  },
  sampled: {
    label: "Sampled",
    shortLabel: "Sampled",
    className: "bg-connection-blue/25 text-foreground",
  },
  wanted: {
    label: "Wanted",
    shortLabel: "Wanted",
    className: "bg-accent-soft text-accent",
  },
  disliked: {
    label: "Disliked",
    shortLabel: "Disliked",
    className: "bg-danger-soft text-danger",
  },
};

type StatusFilter = "all" | CollectionStatus;

type SearchResult = CollectionFragrance;

export function CollectionWorkbench() {
  const hydrated = useHydrated();
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [analysis, setAnalysis] = useState<CollectionAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!hydrated) return;
    const frame = window.requestAnimationFrame(() => {
      setEntries(getCollection());
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hydrated]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/catalog/search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const analysisKey = entries
    .map((entry) => `${entry.id}:${entry.status}`)
    .sort()
    .join("|");

  useEffect(() => {
    if (!hydrated || entries.every((entry) => entry.status !== "owned")) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAnalysisLoading(true);
      setAnalysisError(false);
      try {
        const response = await fetch("/api/collection/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entries: entries.map(({ id, status }) => ({ id, status })),
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Analysis failed");
        setAnalysis((await response.json()) as CollectionAnalysis);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAnalysisError(true);
        }
      } finally {
        if (!controller.signal.aborted) setAnalysisLoading(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // analysisKey is a stable primitive snapshot of collection classification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, analysisKey]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        COLLECTION_STATUSES.map((status) => [
          status,
          entries.filter((entry) => entry.status === status).length,
        ]),
      ) as Record<CollectionStatus, number>,
    [entries],
  );
  const visibleEntries =
    filter === "all"
      ? entries
      : entries.filter((entry) => entry.status === filter);

  function classify(
    fragrance: CollectionFragrance,
    status: CollectionStatus,
  ) {
    setEntries(setCollectionStatus(fragrance, status));
    setNotice(`${fragrance.name} marked ${STATUS_META[status].label.toLowerCase()}.`);
    window.setTimeout(() => setNotice(""), 2200);
  }

  if (!hydrated) {
    return (
      <div className="flex animate-pulse flex-col gap-6">
        <div className="h-32 rounded-3xl bg-card" />
        <div className="h-48 rounded-3xl bg-card" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            <ChartBar aria-hidden size={14} weight="bold" />
            Your scent wardrobe
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Collection Analyzer
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Save what you own, sampled, want, or dislike. Owned bottles power
            coverage, gap, and redundancy analysis on this device.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COLLECTION_STATUSES.map((status) => (
            <Metric
              key={status}
              label={STATUS_META[status].label}
              value={counts[status]}
            />
          ))}
        </div>
      </header>

      <section className="rounded-3xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-xl bg-accent-soft p-2 text-accent">
            <Plus aria-hidden size={18} weight="bold" />
          </span>
          <div>
            <h2 className="font-semibold">Add a fragrance</h2>
            <p className="mt-1 text-sm text-muted">
              Search 74,000+ catalog entries, then choose its place.
            </p>
          </div>
        </div>

        <div className="relative mt-5">
          <MagnifyingGlass
            aria-hidden
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setResults([]);
              setSearching(false);
            }}
            placeholder="Search fragrance or house…"
            aria-label="Search fragrance catalog"
            className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-11 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          {searching && query.trim().length >= 2 ? (
            <span
              aria-hidden
              className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-border border-t-accent"
            />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setSearching(false);
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:text-foreground"
            >
              <X aria-hidden size={16} weight="bold" />
            </button>
          ) : null}
        </div>

        {query.trim().length >= 2 ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-background">
            {results.length > 0 ? (
              <ul className="divide-y divide-border">
                {results.map((result) => {
                  const current = entries.find((entry) => entry.id === result.id);
                  return (
                    <li
                      key={result.id}
                      className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
                    >
                      <FragranceSearchResultVisual fragrance={result} />
                      <label className="shrink-0">
                        <span className="sr-only">
                          Classify {result.name}
                        </span>
                        <select
                          value={current?.status ?? ""}
                          onChange={(event) =>
                            classify(
                              result,
                              event.target.value as CollectionStatus,
                            )
                          }
                          className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-accent sm:w-36"
                        >
                          <option value="" disabled>
                            Add as…
                          </option>
                          {COLLECTION_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_META[status].label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="p-6 text-center text-sm text-muted">
                {searching ? "Searching…" : "No fragrances found."}
              </p>
            )}
          </div>
        ) : null}
      </section>

      {notice ? (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold shadow-xl"
        >
          <Check aria-hidden size={16} weight="bold" className="text-success" />
          {notice}
        </div>
      ) : null}

      {entries.length > 0 ? (
        <CollectionInventory
          entries={visibleEntries}
          allEntries={entries}
          filter={filter}
          counts={counts}
          onFilter={setFilter}
          onClassify={classify}
          onRemove={(id) => setEntries(removeFromCollection(id))}
          onClear={() => {
            if (!confirm("Clear your entire fragrance collection?")) return;
            clearCollection();
            setEntries([]);
          }}
        />
      ) : (
        <EmptyCollection />
      )}

      {counts.owned > 0 ? (
        <AnalysisDashboard
          analysis={analysis}
          loading={analysisLoading}
          error={analysisError}
        />
      ) : entries.length > 0 ? (
        <section className="rounded-3xl border border-dashed border-border px-6 py-12 text-center">
          <Flask
            aria-hidden
            size={30}
            className="mx-auto text-muted"
          />
          <h2 className="mt-3 text-lg font-semibold">
            Mark one fragrance as owned
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Analysis uses owned bottles. Sampled, wanted, and disliked entries
            shape which recommendations get excluded.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function EmptyCollection() {
  return (
    <section className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <Heart
        aria-hidden
        size={34}
        className="mx-auto text-muted"
      />
      <h2 className="mt-3 text-xl font-semibold">Your shelf is empty</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Search above for a bottle you own. Three owned fragrances are enough
        for useful patterns; five or more improves redundancy detection.
      </p>
    </section>
  );
}

function CollectionInventory({
  entries,
  allEntries,
  filter,
  counts,
  onFilter,
  onClassify,
  onRemove,
  onClear,
}: {
  entries: CollectionEntry[];
  allEntries: CollectionEntry[];
  filter: StatusFilter;
  counts: Record<CollectionStatus, number>;
  onFilter: (filter: StatusFilter) => void;
  onClassify: (
    fragrance: CollectionFragrance,
    status: CollectionStatus,
  ) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Saved on this device
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Your collection</h2>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-muted hover:bg-danger-soft hover:text-danger"
        >
          <Trash aria-hidden size={15} />
          Clear all
        </button>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {(["all", ...COLLECTION_STATUSES] as const).map((status) => {
          const active = filter === status;
          const count = status === "all" ? allEntries.length : counts[status];
          return (
            <button
              key={status}
              type="button"
              onClick={() => onFilter(status)}
              aria-pressed={active}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                active
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-card text-muted hover:text-foreground"
              }`}
            >
              {status === "all" ? "All" : STATUS_META[status].label} · {count}
            </button>
          );
        })}
      </div>

      {entries.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <Link
                href={`/fragrance/${entry.slug}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <span className="flex h-16 w-14 shrink-0 items-center justify-center rounded-xl bg-white p-1">
                  <FragranceBottleImage
                    imageUrl={entry.imageUrl}
                    alt=""
                    stage={false}
                    className="max-h-full w-auto max-w-full object-contain"
                    placeholderClassName="h-10 w-auto text-stone-400 opacity-40"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {entry.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {entry.house}
                    {entry.year > 0 ? ` · ${entry.year}` : ""}
                  </span>
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                <label>
                  <span className="sr-only">Change status for {entry.name}</span>
                  <select
                    value={entry.status}
                    onChange={(event) =>
                      onClassify(
                        entry,
                        event.target.value as CollectionStatus,
                      )
                    }
                    className={`h-9 max-w-28 rounded-lg border-0 px-2 text-xs font-semibold outline-none ${STATUS_META[entry.status].className}`}
                  >
                    {COLLECTION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_META[status].shortLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => onRemove(entry.id)}
                  aria-label={`Remove ${entry.name}`}
                  className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <X aria-hidden size={15} weight="bold" />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          No fragrances in this group.
        </p>
      )}
    </section>
  );
}

function AnalysisDashboard({
  analysis,
  loading,
  error,
}: {
  analysis: CollectionAnalysis | null;
  loading: boolean;
  error: boolean;
}) {
  if (loading && !analysis) {
    return (
      <section className="grid animate-pulse gap-4 md:grid-cols-2">
        <div className="h-64 rounded-3xl bg-card" />
        <div className="h-64 rounded-3xl bg-card" />
      </section>
    );
  }
  if (error && !analysis) {
    return (
      <section className="rounded-3xl border border-danger bg-danger-soft p-6">
        <h2 className="font-semibold text-danger">Analysis unavailable</h2>
        <p className="mt-1 text-sm text-muted">
          Collection remains saved. Change one status to retry analysis.
        </p>
      </section>
    );
  }
  if (!analysis) return null;

  const missing = analysis.categories.filter((category) => category.count === 0);

  return (
    <section className="flex flex-col gap-6" aria-busy={loading}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Live analysis
          </p>
          <h2 className="mt-1 text-2xl font-semibold">
            What your shelf says
          </h2>
        </div>
        <p className="text-xs text-muted">
          {analysis.ownedCount} owned · rule-based
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Dominant accords" subtitle="Share of owned bottles">
          <StatBars stats={analysis.dominantAccords} />
        </Panel>
        <Panel title="Dominant notes" subtitle="Repeated anywhere in note pyramids">
          <StatBars stats={analysis.dominantNotes} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Wear coverage" subtitle="Relative share of your collection profile">
          <CoverageBars items={analysis.seasons} />
          <div className="mt-6 border-t border-border pt-5">
            <CoverageBars items={analysis.dayNight} />
          </div>
        </Panel>
        <Panel
          title="Missing categories"
          subtitle={
            missing.length > 0
              ? `${missing.length} scent families have no coverage`
              : "Every core scent family has coverage"
          }
        >
          <div className="grid gap-2">
            {analysis.categories.map((category) => (
              <div
                key={category.name}
                className={`rounded-xl border p-3 ${
                  category.count === 0
                    ? "border-accent/50 bg-accent-soft/60"
                    : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{category.name}</p>
                  <span className="text-xs tabular-nums text-muted">
                    {category.count} owned
                  </span>
                </div>
                {category.count === 0 ? (
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {category.explanation}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="House distribution" subtitle="Where your bottles come from">
          <StatBars stats={analysis.houses} />
        </Panel>
        <Panel title="Release decades" subtitle="Age profile of your wardrobe">
          <StatBars stats={analysis.decades} />
        </Panel>
      </div>

      <Panel
        title="Redundancy watch"
        subtitle="Shared notes, accords, and house lineage — not identical smell"
      >
        {analysis.redundantPairs.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {analysis.redundantPairs.map((pair) => (
              <RedundancyCard
                key={`${pair.first.id}:${pair.second.id}`}
                pair={pair}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
            No strong overlap yet. More owned bottles create more pair checks.
          </p>
        )}
      </Panel>

      <Panel
        title="Recommendations"
        subtitle="Transparent rules now; no collaborative filtering"
        icon={<Sparkle aria-hidden size={17} weight="fill" />}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <RecommendationCard
            recommendation={analysis.recommendations.bestNextAddition}
          />
          <RecommendationCard
            recommendation={analysis.recommendations.unusualUsefulAddition}
          />
          <RecommendationCard
            recommendation={analysis.recommendations.probablyDoNotNeed}
            warning
          />
          <RecommendationCard
            recommendation={analysis.recommendations.weakestSeasonalCoverage}
            warning
          />
        </div>
      </Panel>
    </section>
  );
}

function Panel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        {icon ? <span className="text-accent">{icon}</span> : null}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatBars({ stats }: { stats: CollectionStat[] }) {
  const max = Math.max(1, ...stats.map((stat) => stat.count));
  return (
    <div className="space-y-3">
      {stats.map((stat) => (
        <div key={stat.name}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-semibold capitalize">
              {stat.name}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {stat.count} · {stat.share}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-card-hover">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(4, (stat.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CoverageBars({
  items,
}: {
  items: CollectionAnalysis["seasons"];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.name} className="rounded-2xl bg-background p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold">{item.name}</p>
            <p className="text-sm font-semibold tabular-nums">{item.score}%</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card-hover">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${item.score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RedundancyCard({ pair }: { pair: SimilarityBreakdown }) {
  const reasons = [
    ...pair.sharedAccords.slice(0, 3),
    ...pair.sharedNotes.slice(0, 2),
  ];
  return (
    <article className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
          <Warning aria-hidden size={13} weight="fill" />
          {pair.score}% similar
        </span>
        {pair.sameHouse ? (
          <span className="text-xs text-muted">Same house</span>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-semibold">
        <Link
          href={`/fragrance/${pair.first.slug}`}
          className="min-w-0 truncate hover:text-accent"
        >
          {pair.first.name}
        </Link>
        <span aria-hidden className="text-muted">
          /
        </span>
        <Link
          href={`/fragrance/${pair.second.slug}`}
          className="min-w-0 truncate text-right hover:text-accent"
        >
          {pair.second.name}
        </Link>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        {reasons.length > 0
          ? `Shared: ${reasons.join(", ")}.`
          : "Similarity comes mainly from house lineage."}
      </p>
    </article>
  );
}

function RecommendationCard({
  recommendation,
  warning = false,
}: {
  recommendation?: CollectionRecommendation;
  warning?: boolean;
}) {
  if (!recommendation) return null;
  const fragrance = recommendation.fragrance;
  return (
    <article className="flex min-h-36 gap-4 rounded-2xl border border-border bg-background p-4">
      {fragrance ? (
        <Link
          href={`/fragrance/${fragrance.slug}`}
          className="flex h-24 w-20 shrink-0 items-center justify-center rounded-xl bg-white p-2"
        >
          <FragranceBottleImage
            imageUrl={fragrance.imageUrl}
            alt=""
            stage={false}
            className="max-h-full w-auto max-w-full object-contain"
            placeholderClassName="h-14 w-auto text-stone-400 opacity-40"
          />
        </Link>
      ) : (
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            warning ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent"
          }`}
        >
          <Warning aria-hidden size={19} weight="fill" />
        </span>
      )}
      <div className="min-w-0">
        <p
          className={`text-xs font-semibold uppercase tracking-[0.12em] ${
            warning ? "text-danger" : "text-accent"
          }`}
        >
          {recommendation.title}
        </p>
        {fragrance ? (
          <Link
            href={`/fragrance/${fragrance.slug}`}
            className="mt-1 block truncate font-semibold hover:text-accent"
          >
            {fragrance.name}
          </Link>
        ) : null}
        {fragrance ? (
          <p className="text-xs text-muted">{fragrance.house}</p>
        ) : null}
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {recommendation.explanation}
        </p>
      </div>
    </article>
  );
}
