"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartLineUp,
  FunnelSimple,
  SpinnerGap,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import type {
  TrendChart,
  TrendExplorerData,
  TrendFilters,
  TrendMover,
  TrendShare,
} from "@/lib/trend-types";

const SERIES_COLORS = [
  "var(--accent)",
  "var(--success)",
  "#7c6ee6",
  "#d95d83",
  "#3d9db8",
];

interface HouseOption {
  slug: string;
  name: string;
}

export function FragranceTrendExplorer({
  initialData,
  houses,
}: {
  initialData: TrendExplorerData;
  houses: HouseOption[];
}) {
  const [filters, setFilters] = useState<TrendFilters>(initialData.filters);
  const [data, setData] = useState(initialData);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const query = useMemo(() => trendQuery(filters), [filters]);

  useEffect(() => {
    if (query === trendQuery(initialData.filters)) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPending(true);
      setError("");
      try {
        const response = await fetch(`/api/trends?${query}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Trend request failed");
        setData((await response.json()) as TrendExplorerData);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        setError("Could not refresh trends. Try another filter.");
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [initialData, query]);

  function updateFilter<K extends keyof TrendFilters>(
    key: K,
    value: TrendFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function selectEra(startYear: number, endYear: number) {
    setFilters((current) => ({
      ...current,
      startYear,
      endYear,
    }));
  }

  function resetExplorer() {
    setFilters(initialData.filters);
    setData(initialData);
    setPending(false);
    setError("");
  }

  const selectedRange = `${filters.startYear}–${filters.endYear}`;
  const previousRange = `${data.previous.startYear}–${data.previous.endYear}`;

  return (
    <div className="flex flex-col gap-6 pb-10 sm:gap-8">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute -right-24 -top-28 size-72 rounded-full bg-accent-soft opacity-60 blur-3xl"
        />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              <ChartLineUp size={18} weight="bold" aria-hidden />
              Fragrance Trend Explorer
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl">
              Watch taste change over time.
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-muted">
              Compare note and accord prevalence across years. Every value is
              the percentage of fragrances in its period, so larger catalogs
              never win by volume alone.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-[360px]">
            <Stat label="Selected period" value={selectedRange} />
            <Stat
              label="Matching scents"
              value={formatNumber(data.current.count)}
            />
            <Stat
              label="Compared with"
              value={previousRange}
              className="col-span-2 sm:col-span-1"
            />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="trend-filters-heading"
        className="rounded-2xl border border-border bg-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="trend-filters-heading"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <FunnelSimple size={19} aria-hidden />
            Refine the timeline
          </h2>
          <button
            type="button"
            onClick={resetExplorer}
            className="text-sm font-semibold text-accent hover:underline"
          >
            Reset filters
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            label="House"
            value={filters.house}
            onChange={(value) => updateFilter("house", value)}
          >
            <option value="">All houses</option>
            {houses.map((house) => (
              <option key={house.slug} value={house.slug}>
                {house.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Gender category"
            value={filters.gender}
            onChange={(value) =>
              updateFilter("gender", value as TrendFilters["gender"])
            }
          >
            <option value="all">All categories</option>
            <option value="men">Men cues</option>
            <option value="women">Women cues</option>
            <option value="unisex">Unisex / uncategorized</option>
          </FilterSelect>
          <FilterSelect
            label="Minimum rating"
            value={String(filters.minimumRating)}
            onChange={(value) =>
              updateFilter("minimumRating", Number(value))
            }
          >
            <option value="0">Any rating</option>
            <option value="3.5">3.5+</option>
            <option value="4">4.0+</option>
            <option value="4.25">4.25+</option>
          </FilterSelect>
          <FilterSelect
            label="Popularity"
            value={String(filters.minimumVotes)}
            onChange={(value) => updateFilter("minimumVotes", Number(value))}
          >
            <option value="0">Any popularity</option>
            <option value="100">100+ votes</option>
            <option value="1000">1,000+ votes</option>
            <option value="5000">5,000+ votes</option>
          </FilterSelect>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted">
          Gender is inferred from explicit naming and description cues because
          source records do not include a category field.
        </p>
      </section>

      <section
        aria-labelledby="timeline-heading"
        className="rounded-2xl border border-border bg-card p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Interactive timeline
            </p>
            <h2 id="timeline-heading" className="mt-1 text-2xl font-semibold">
              Pick a period
            </h2>
          </div>
          <div
            className={`inline-flex min-h-8 items-center gap-2 text-sm text-muted transition-opacity ${
              pending ? "opacity-100" : "opacity-0"
            }`}
            aria-live="polite"
          >
            <SpinnerGap className="animate-spin" size={17} aria-hidden />
            Recalculating percentages
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-[repeat(13,minmax(0,1fr))]">
          {data.eras.map((era) => {
            const active =
              filters.startYear === era.startYear &&
              filters.endYear === era.endYear;
            return (
              <button
                key={era.startYear}
                type="button"
                onClick={() => selectEra(era.startYear, era.endYear)}
                aria-pressed={active}
                title={
                  era.dominantAccord
                    ? `${era.dominantAccord}: ${formatPercentage(
                        era.dominantPercentage,
                      )} of scents`
                    : "No matching releases"
                }
                className={`group flex min-h-24 flex-col justify-end overflow-hidden rounded-xl border px-2 py-2 text-left transition-colors ${
                  active
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-background hover:border-accent"
                }`}
              >
                <span
                  aria-hidden
                  className="mb-2 block w-full rounded-sm bg-accent opacity-70 transition-[height]"
                  style={{
                    height: `${Math.max(
                      3,
                      Math.min(42, era.dominantPercentage),
                    )}px`,
                  }}
                />
                <span className="text-xs font-semibold tabular-nums">
                  {era.label}
                </span>
                <span className="mt-0.5 truncate text-[0.65rem] text-muted">
                  {era.dominantAccord ?? "No data"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">
          Bar height shows dominant accord prevalence within each decade.
        </p>

        <div className="mt-6 grid gap-4 border-t border-border pt-5 md:grid-cols-2">
          <YearSlider
            label="Start year"
            value={filters.startYear}
            minimum={data.availableYears.minimum}
            maximum={filters.endYear}
            onChange={(value) => updateFilter("startYear", value)}
          />
          <YearSlider
            label="End year"
            value={filters.endYear}
            minimum={filters.startYear}
            maximum={data.availableYears.maximum}
            onChange={(value) => updateFilter("endYear", value)}
          />
        </div>
        {error ? (
          <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </section>

      {data.current.count > 0 ? (
        <>
          <section className="grid gap-4 xl:grid-cols-2">
            <TrendChartCard
              eyebrow="Note trends"
              title="Most common notes"
              chart={data.noteChart}
            />
            <TrendChartCard
              eyebrow="Accord trends"
              title="Leading scent profiles"
              chart={data.accordChart}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <SharePanel
              title="Top notes"
              description={`Share of ${selectedRange} fragrances containing each note.`}
              items={data.current.topNotes}
            />
            <SharePanel
              title="Top accords"
              description={`Share of ${selectedRange} fragrances containing each accord.`}
              items={data.current.topAccords}
            />
          </section>

          <section
            aria-labelledby="comparison-heading"
            className="rounded-2xl border border-border bg-card p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                  Decade comparison
                </p>
                <h2
                  id="comparison-heading"
                  className="mt-1 text-2xl font-semibold"
                >
                  {selectedRange} vs. {previousRange}
                </h2>
              </div>
              <p className="text-sm text-muted">
                Change shown in percentage points
              </p>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <MoverPanel
                title="Styles on the rise"
                items={data.rising}
                direction="rising"
              />
              <MoverPanel
                title="Styles in decline"
                items={data.declining}
                direction="declining"
              />
            </div>
          </section>

          <RepresentativeFragrances
            items={data.representatives}
            period={selectedRange}
          />
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold">No matching releases</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            Widen the year range or loosen house, rating, and popularity
            filters.
          </p>
          <button
            type="button"
            onClick={resetExplorer}
            className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-[#17120a]"
          >
            Reset explorer
          </button>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-background/80 px-4 py-3 ${className}`}
    >
      <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      >
        {children}
      </select>
    </label>
  );
}

function YearSlider({
  label,
  value,
  minimum,
  maximum,
  onChange,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="flex items-center justify-between gap-3 text-sm font-semibold">
        {label}
        <output className="font-mono text-accent">{value}</output>
      </span>
      <input
        type="range"
        min={minimum}
        max={maximum}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-2 w-full accent-[var(--accent)]"
      />
    </label>
  );
}

function TrendChartCard({
  eyebrow,
  title,
  chart,
}: {
  eyebrow: string;
  title: string;
  chart: TrendChart;
}) {
  const maximum = Math.max(
    5,
    ...chart.series.flatMap((series) => series.values),
  );
  const roundedMaximum = Math.ceil(maximum / 5) * 5;
  const left = 44;
  const right = 18;
  const top = 16;
  const bottom = 42;
  const width = 720;
  const height = 260;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="p-5 pb-2 sm:p-6 sm:pb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted">% of fragrances in each slice</p>
      </div>

      <div className="overflow-x-auto px-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title} over ${chart.labels.join(", ")}`}
          className="h-auto min-w-[580px] w-full"
        >
          {[0, 0.5, 1].map((fraction) => {
            const y = top + chartHeight * fraction;
            const value = roundedMaximum * (1 - fraction);
            return (
              <g key={fraction}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="4 6"
                />
                <text
                  x={left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--muted)"
                  fontSize="11"
                >
                  {value.toFixed(0)}%
                </text>
              </g>
            );
          })}

          {chart.series.map((series, seriesIndex) => {
            const points = series.values.map((value, index) => {
              const x =
                chart.labels.length === 1
                  ? left + chartWidth / 2
                  : left + (index / (chart.labels.length - 1)) * chartWidth;
              const y =
                top + chartHeight - (value / roundedMaximum) * chartHeight;
              return { x, y, value };
            });
            const path = points
              .map(
                (point, index) =>
                  `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
              )
              .join(" ");

            return (
              <g key={series.name}>
                <path
                  d={path}
                  fill="none"
                  stroke={SERIES_COLORS[seriesIndex]}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {points.map((point, index) => (
                  <circle
                    key={`${series.name}-${chart.labels[index]}`}
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill="var(--card)"
                    stroke={SERIES_COLORS[seriesIndex]}
                    strokeWidth="2.5"
                  >
                    <title>{`${series.name}, ${chart.labels[index]}: ${formatPercentage(
                      point.value,
                    )}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}

          {chart.labels.map((label, index) => {
            if (
              chart.labels.length > 5 &&
              index !== 0 &&
              index !== chart.labels.length - 1 &&
              index !== Math.floor(chart.labels.length / 2)
            ) {
              return null;
            }
            const x =
              chart.labels.length === 1
                ? left + chartWidth / 2
                : left + (index / (chart.labels.length - 1)) * chartWidth;
            return (
              <text
                key={label}
                x={x}
                y={height - 14}
                textAnchor="middle"
                fill="var(--muted)"
                fontSize="11"
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border px-5 py-4 sm:px-6">
        {chart.series.map((series, index) => (
          <span
            key={series.name}
            className="inline-flex items-center gap-2 text-xs font-semibold"
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: SERIES_COLORS[index] }}
              aria-hidden
            />
            {series.name}
          </span>
        ))}
      </div>
    </article>
  );
}

function SharePanel({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: TrendShare[];
}) {
  const maximum = Math.max(...items.map((item) => item.percentage), 1);

  return (
    <article className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <ol className="mt-5 space-y-3">
        {items.map((item, index) => (
          <li key={item.name}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold">
                <span className="mr-2 font-mono text-xs text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item.name}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted">
                {formatPercentage(item.percentage)}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(item.percentage / maximum) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}

function MoverPanel({
  title,
  items,
  direction,
}: {
  title: string;
  items: TrendMover[];
  direction: "rising" | "declining";
}) {
  const rising = direction === "rising";

  return (
    <article
      className={`rounded-2xl border p-4 sm:p-5 ${
        rising
          ? "border-success/35 bg-success-soft"
          : "border-danger/35 bg-danger-soft"
      }`}
    >
      <h3 className="flex items-center gap-2 font-semibold">
        {rising ? (
          <ArrowUpRight size={19} className="text-success" aria-hidden />
        ) : (
          <ArrowDownRight size={19} className="text-danger" aria-hidden />
        )}
        {title}
      </h3>
      {items.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.name}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-card/65 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="mt-0.5 text-[0.68rem] text-muted">
                  {formatPercentage(item.previousPercentage)} to{" "}
                  {formatPercentage(item.currentPercentage)}
                </p>
              </div>
              <span
                className={`font-mono text-sm font-semibold ${
                  rising ? "text-success" : "text-danger"
                }`}
              >
                {item.change > 0 ? "+" : ""}
                {item.change.toFixed(1)} pp
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Not enough previous-period data for a reliable comparison.
        </p>
      )}
    </article>
  );
}

function RepresentativeFragrances({
  items,
  period,
}: {
  items: TrendExplorerData["representatives"];
  period: string;
}) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="representative-heading">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Representative fragrances
        </p>
        <h2 id="representative-heading" className="mt-1 text-2xl font-semibold">
          Smell the {period} period
        </h2>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {items.map((fragrance) => (
          <Link
            key={fragrance.id}
            href={`/fragrance/${fragrance.slug}`}
            className="group overflow-hidden rounded-2xl border border-border bg-card transition-[border-color,transform] hover:-translate-y-1 hover:border-accent"
          >
            <div className="bottle-studio flex aspect-square items-center justify-center p-4">
              <FragranceBottleImage
                imageUrl={fragrance.imageUrl}
                alt={`${fragrance.name} by ${fragrance.house} bottle`}
                width={220}
                height={260}
                sizes="(max-width: 768px) 50vw, 16vw"
                className="max-h-full w-auto max-w-full object-contain"
                placeholderClassName="h-24 w-auto text-stone-400 opacity-40"
              />
            </div>
            <div className="p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-accent">
                {fragrance.sharedStyle}
              </p>
              <h3 className="mt-1 line-clamp-2 font-semibold leading-snug">
                {fragrance.name}
              </h3>
              <p className="mt-1 truncate text-xs text-muted">
                {fragrance.house} · {fragrance.year}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function trendQuery(filters: TrendFilters): string {
  const params = new URLSearchParams({
    start: String(filters.startYear),
    end: String(filters.endYear),
    gender: filters.gender,
    rating: String(filters.minimumRating),
    votes: String(filters.minimumVotes),
  });
  if (filters.house) params.set("house", filters.house);
  return params.toString();
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}
