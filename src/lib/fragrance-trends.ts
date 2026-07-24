import "server-only";

import { getAllCatalogFragrances } from "@/lib/catalog";
import type { CatalogFragrance } from "@/lib/catalog";
import type {
  TrendChart,
  TrendEra,
  TrendExplorerData,
  TrendFilters,
  TrendGender,
  TrendMover,
  TrendPeriodSummary,
  TrendShare,
} from "@/lib/trend-types";
import { allNotes } from "@/lib/types";

const MINIMUM_YEAR = 1900;
const MAXIMUM_YEAR = new Date().getFullYear();
const MAX_TOP_ITEMS = 8;
const CHART_SERIES_COUNT = 5;

type TermKind = "note" | "accord";

interface PeriodTerms {
  summary: TrendPeriodSummary;
  notePercentages: Map<string, TrendShare>;
  accordPercentages: Map<string, TrendShare>;
}

export const defaultTrendFilters: TrendFilters = {
  startYear: 2000,
  endYear: MAXIMUM_YEAR,
  house: "",
  gender: "all",
  minimumRating: 0,
  minimumVotes: 0,
};

export function normalizeTrendFilters(
  filters: Partial<Omit<TrendFilters, "gender">> & { gender?: unknown },
): TrendFilters {
  const requestedStart = integerOr(
    filters.startYear,
    defaultTrendFilters.startYear,
  );
  const requestedEnd = integerOr(filters.endYear, defaultTrendFilters.endYear);
  const startYear = clamp(
    Math.min(requestedStart, requestedEnd),
    MINIMUM_YEAR,
    MAXIMUM_YEAR,
  );
  const endYear = clamp(
    Math.max(requestedStart, requestedEnd),
    startYear,
    MAXIMUM_YEAR,
  );

  return {
    startYear,
    endYear,
    house: filters.house?.trim() ?? "",
    gender: isTrendGender(filters.gender) ? filters.gender : "all",
    minimumRating: clamp(Number(filters.minimumRating) || 0, 0, 5),
    minimumVotes: Math.max(0, integerOr(filters.minimumVotes, 0)),
  };
}

export function buildTrendExplorerData(
  requestedFilters: Partial<TrendFilters> = {},
): TrendExplorerData {
  const filters = normalizeTrendFilters(requestedFilters);
  const candidates = getAllCatalogFragrances().filter((fragrance) =>
    matchesFilters(fragrance, filters),
  );
  const currentFragrances = candidates.filter(
    (fragrance) =>
      fragrance.year >= filters.startYear &&
      fragrance.year <= filters.endYear,
  );

  const periodLength = filters.endYear - filters.startYear + 1;
  const previousEnd = filters.startYear - 1;
  const previousStart = previousEnd - periodLength + 1;
  const previousFragrances = candidates.filter(
    (fragrance) =>
      fragrance.year >= previousStart && fragrance.year <= previousEnd,
  );

  const current = summarizePeriod(
    currentFragrances,
    filters.startYear,
    filters.endYear,
  );
  const previous = summarizePeriod(
    previousFragrances,
    previousStart,
    previousEnd,
  );
  const bins = createPeriodBins(filters.startYear, filters.endYear);
  const topNoteNames = current.summary.topNotes
    .slice(0, CHART_SERIES_COUNT)
    .map((item) => item.name);
  const topAccordNames = current.summary.topAccords
    .slice(0, CHART_SERIES_COUNT)
    .map((item) => item.name);

  return {
    filters,
    availableYears: {
      minimum: MINIMUM_YEAR,
      maximum: MAXIMUM_YEAR,
    },
    current: current.summary,
    previous: previous.summary,
    noteChart: buildChart(currentFragrances, bins, topNoteNames, "note"),
    accordChart: buildChart(
      currentFragrances,
      bins,
      topAccordNames,
      "accord",
    ),
    rising: buildMovers(
      current.accordPercentages,
      previous.accordPercentages,
      "rising",
    ),
    declining: buildMovers(
      current.accordPercentages,
      previous.accordPercentages,
      "declining",
    ),
    eras: buildEraOverview(candidates),
    representatives: currentFragrances
      .filter((fragrance) => fragrance.accords.length > 0)
      .sort(
        (a, b) =>
          (b.votes ?? 0) - (a.votes ?? 0) ||
          b.rating - a.rating ||
          b.year - a.year,
      )
      .slice(0, 6)
      .map((fragrance) => ({
        id: fragrance.id,
        name: fragrance.name,
        house: fragrance.house,
        year: fragrance.year,
        rating: fragrance.rating,
        slug: fragrance.slug,
        imageUrl: fragrance.imageUrl,
        sharedStyle: findRepresentativeStyle(
          fragrance,
          current.summary.topAccords,
        ),
      })),
  };
}

function matchesFilters(
  fragrance: CatalogFragrance,
  filters: TrendFilters,
): boolean {
  if (fragrance.year < MINIMUM_YEAR || fragrance.year > MAXIMUM_YEAR) {
    return false;
  }
  if (filters.house && fragrance.houseSlug !== filters.house) return false;
  if (fragrance.rating < filters.minimumRating) return false;
  if ((fragrance.votes ?? 0) < filters.minimumVotes) return false;
  if (
    filters.gender !== "all" &&
    inferGender(fragrance) !== filters.gender
  ) {
    return false;
  }
  return true;
}

function inferGender(fragrance: CatalogFragrance): Exclude<
  TrendGender,
  "all"
> {
  const text = `${fragrance.name} ${fragrance.description}`.toLowerCase();
  const womenPattern =
    /\b(for women|pour femme|parfum femme|eau de femme|donna|woman|women|feminine|for her)\b/;
  const menPattern =
    /\b(for men|pour homme|parfum homme|eau d'homme|uomo|homme|man|men|masculine|for him)\b/;
  const women = womenPattern.test(text);
  const men = menPattern.test(text);

  if (women && !men) return "women";
  if (men && !women) return "men";
  return "unisex";
}

function summarizePeriod(
  fragrances: readonly CatalogFragrance[],
  startYear: number,
  endYear: number,
): PeriodTerms {
  const notePercentages = termPercentages(fragrances, "note");
  const accordPercentages = termPercentages(fragrances, "accord");

  return {
    summary: {
      startYear,
      endYear,
      count: fragrances.length,
      topNotes: [...notePercentages.values()].slice(0, MAX_TOP_ITEMS),
      topAccords: [...accordPercentages.values()].slice(0, MAX_TOP_ITEMS),
    },
    notePercentages,
    accordPercentages,
  };
}

function termPercentages(
  fragrances: readonly CatalogFragrance[],
  kind: TermKind,
): Map<string, TrendShare> {
  const terms = new Map<string, { name: string; count: number }>();

  for (const fragrance of fragrances) {
    const values = kind === "note" ? allNotes(fragrance) : fragrance.accords;
    const uniqueValues = new Map(
      values
        .filter(Boolean)
        .map((name) => [normalizeTerm(name), name.trim()] as const),
    );
    for (const [key, name] of uniqueValues) {
      const current = terms.get(key);
      terms.set(key, {
        name: current?.name ?? name,
        count: (current?.count ?? 0) + 1,
      });
    }
  }

  const denominator = Math.max(fragrances.length, 1);
  const sorted = [...terms.entries()]
    .map(
      ([key, item]) =>
        [
          key,
          {
            name: item.name,
            percentage: roundPercentage((item.count / denominator) * 100),
          },
        ] as const,
    )
    .sort(
      ([, a], [, b]) =>
        b.percentage - a.percentage || a.name.localeCompare(b.name),
    );

  return new Map(sorted);
}

function createPeriodBins(
  startYear: number,
  endYear: number,
): Array<{ startYear: number; endYear: number; label: string }> {
  const range = endYear - startYear + 1;
  const binSize = range <= 12 ? 2 : range <= 35 ? 5 : range <= 80 ? 10 : 20;
  const bins = [];

  for (let start = startYear; start <= endYear; start += binSize) {
    const end = Math.min(endYear, start + binSize - 1);
    bins.push({
      startYear: start,
      endYear: end,
      label: start === end ? String(start) : `${start}–${end}`,
    });
  }
  return bins;
}

function buildChart(
  fragrances: readonly CatalogFragrance[],
  bins: Array<{ startYear: number; endYear: number; label: string }>,
  names: string[],
  kind: TermKind,
): TrendChart {
  const binPercentages = bins.map((bin) =>
    termPercentages(
      fragrances.filter(
        (fragrance) =>
          fragrance.year >= bin.startYear && fragrance.year <= bin.endYear,
      ),
      kind,
    ),
  );

  return {
    labels: bins.map((bin) => bin.label),
    series: names.map((name) => {
      const key = normalizeTerm(name);
      return {
        name,
        values: binPercentages.map(
          (percentages) => percentages.get(key)?.percentage ?? 0,
        ),
      };
    }),
  };
}

function buildMovers(
  current: Map<string, TrendShare>,
  previous: Map<string, TrendShare>,
  direction: "rising" | "declining",
): TrendMover[] {
  const keys = new Set([...current.keys(), ...previous.keys()]);
  const movers = [...keys].map((key) => {
    const currentItem = current.get(key);
    const previousItem = previous.get(key);
    const currentPercentage = currentItem?.percentage ?? 0;
    const previousPercentage = previousItem?.percentage ?? 0;

    return {
      name: currentItem?.name ?? previousItem?.name ?? key,
      currentPercentage,
      previousPercentage,
      change: roundPercentage(currentPercentage - previousPercentage),
    };
  });

  return movers
    .filter((item) =>
      direction === "rising" ? item.change > 0.25 : item.change < -0.25,
    )
    .sort((a, b) =>
      direction === "rising"
        ? b.change - a.change
        : a.change - b.change,
    )
    .slice(0, 4);
}

function buildEraOverview(
  fragrances: readonly CatalogFragrance[],
): TrendEra[] {
  const eras: TrendEra[] = [];

  for (let startYear = MINIMUM_YEAR; startYear <= MAXIMUM_YEAR; startYear += 10) {
    const endYear = Math.min(startYear + 9, MAXIMUM_YEAR);
    const eraFragrances = fragrances.filter(
      (fragrance) =>
        fragrance.year >= startYear && fragrance.year <= endYear,
    );
    const dominant = termPercentages(eraFragrances, "accord")
      .values()
      .next().value as TrendShare | undefined;

    eras.push({
      startYear,
      endYear,
      label: `${startYear}s`,
      dominantAccord: dominant?.name ?? null,
      dominantPercentage: dominant?.percentage ?? 0,
    });
  }
  return eras;
}

function findRepresentativeStyle(
  fragrance: CatalogFragrance,
  topAccords: TrendShare[],
): string {
  const fragranceAccords = new Set(fragrance.accords.map(normalizeTerm));
  return (
    topAccords.find((accord) =>
      fragranceAccords.has(normalizeTerm(accord.name)),
    )?.name ??
    fragrance.accords[0] ??
    "period pick"
  );
}

function normalizeTerm(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function isTrendGender(value: unknown): value is TrendGender {
  return (
    value === "all" ||
    value === "men" ||
    value === "women" ||
    value === "unisex"
  );
}

function integerOr(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundPercentage(value: number): number {
  return Math.round(value * 10) / 10;
}
