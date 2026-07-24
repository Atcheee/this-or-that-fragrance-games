import type { Metadata } from "next";
import Link from "next/link";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import {
  FragranceComparisonPicker,
  type ComparisonPickerFragrance,
} from "@/components/compare/FragranceComparisonPicker";
import {
  getFragranceBySlug,
  type CatalogFragrance,
} from "@/lib/catalog";
import {
  scoreFragranceSimilarity,
  type FragranceSimilarity,
  type SimilarityValueComparison,
} from "@/lib/fragrance-similarity";
import {
  deriveWearBuckets,
  type WearBucket,
} from "@/lib/visuals/wear-profile";
import { accordColor, accordSoftBackground } from "@/lib/visuals/accord-colors";

export const metadata: Metadata = {
  title: "Compare fragrances — This or That",
  description:
    "Compare any two fragrances side by side: notes, accords, ratings, popularity, wear occasions, and similarity.",
  alternates: { canonical: "/compare" },
};

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ComparePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const first = getFragrance(getParam(params, "first"));
  const second = getFragrance(getParam(params, "second"));
  const canCompare = first && second && first.id !== second.id;
  const similarity = canCompare
    ? scoreFragranceSimilarity(first, second)
    : undefined;

  return (
    <div className="flex flex-col gap-8 pb-8">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          Scent match-up
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Compare any two fragrances
        </h1>
        <p className="mt-4 leading-7 text-muted">
          See what overlaps, what stands apart, and exactly how the similarity
          score is built.
        </p>
      </header>

      <FragranceComparisonPicker
        first={toPickerFragrance(first)}
        second={toPickerFragrance(second)}
      />

      {first && second && first.id === second.id ? (
        <section className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-6 text-center">
          <h2 className="font-semibold">Choose two different fragrances</h2>
          <p className="mt-1 text-sm text-muted">
            Both search fields point to {first.name}. Replace either one to
            compare their differences.
          </p>
        </section>
      ) : similarity && first && second ? (
        <Comparison
          first={first}
          second={second}
          similarity={similarity}
        />
      ) : (
        <EmptyComparison first={first} second={second} />
      )}
    </div>
  );
}

function Comparison({
  first,
  second,
  similarity,
}: {
  first: CatalogFragrance;
  second: CatalogFragrance;
  similarity: FragranceSimilarity;
}) {
  const firstWear = deriveWearBuckets(
    first.accords,
    first.votes,
    first.wear,
  );
  const secondWear = deriveWearBuckets(
    second.accords,
    second.votes,
    second.wear,
  );
  const summary = summarizeDifferences(
    first,
    second,
    similarity,
    firstWear,
    secondWear,
  );

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px_minmax(0,1fr)] lg:items-stretch">
        <FragranceSummary fragrance={first} align="left" />
        <SimilarityDial similarity={similarity} />
        <FragranceSummary fragrance={second} align="right" />
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Bottom line
        </p>
        <h2 className="mt-2 text-2xl font-semibold">
          Most important differences
        </h2>
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {summary.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-border bg-background p-4 leading-6 text-muted"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <ScoreBreakdown similarity={similarity} />
      <ComparisonTable
        first={first}
        second={second}
        firstWear={firstWear}
        secondWear={secondWear}
      />
      <ValueComparison
        title="Note overlap"
        description="Every listed top, middle, and base note, normalized across both pyramids."
        firstName={first.name}
        secondName={second.name}
        comparison={similarity.noteComparison}
        kind="note"
      />
      <ValueComparison
        title="Accord overlap"
        description="Shared and distinctive scent families, ordered as they appear in the catalog."
        firstName={first.name}
        secondName={second.name}
        comparison={similarity.accordComparison}
        kind="accord"
      />
      <WearComparison
        first={first}
        second={second}
        firstWear={firstWear}
        secondWear={secondWear}
      />
    </>
  );
}

function FragranceSummary({
  fragrance,
  align,
}: {
  fragrance: CatalogFragrance;
  align: "left" | "right";
}) {
  return (
    <article
      className={`flex items-center gap-5 rounded-2xl border border-border bg-card p-5 ${
        align === "right" ? "lg:flex-row-reverse lg:text-right" : ""
      }`}
    >
      <div className="bottle-studio flex h-36 w-28 shrink-0 items-center justify-center rounded-xl p-3">
        <FragranceBottleImage
          imageUrl={fragrance.imageUrl}
          alt={`${fragrance.name} bottle`}
          width={180}
          height={240}
          sizes="112px"
          className="max-h-full w-auto max-w-full object-contain"
          placeholderClassName="h-20 w-auto text-stone-400 opacity-40"
        />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          {fragrance.house}
        </p>
        <h2 className="mt-1 text-xl font-semibold leading-tight">
          <Link
            href={`/fragrance/${fragrance.slug}`}
            className="hover:text-accent"
          >
            {fragrance.name}
          </Link>
        </h2>
        <p className="mt-2 text-sm text-muted">
          {fragrance.year > 0 ? fragrance.year : "Year unknown"}
          {fragrance.rating > 0
            ? ` · ${fragrance.rating.toFixed(2)} / 5`
            : ""}
        </p>
      </div>
    </article>
  );
}

function SimilarityDial({
  similarity,
}: {
  similarity: FragranceSimilarity;
}) {
  const tone =
    similarity.overallScore >= 70
      ? "#22c55e"
      : similarity.overallScore >= 45
        ? "#f5a400"
        : "#f97316";

  return (
    <section className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-5 text-center">
      <div
        className="grid h-36 w-36 place-items-center rounded-full p-2"
        style={{
          background: `conic-gradient(${tone} ${similarity.overallScore}%, color-mix(in oklab, var(--border) 75%, transparent) 0)`,
        }}
      >
        <div className="grid h-full w-full place-items-center rounded-full bg-card">
          <div>
            <span className="block font-mono text-4xl font-semibold tabular-nums">
              {similarity.overallScore}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              out of 100
            </span>
          </div>
        </div>
      </div>
      <h2 className="mt-4 font-semibold">Overall similarity</h2>
      <p className="mt-1 text-sm text-muted">
        Scent profile alone: {similarity.scentScore}%
      </p>
    </section>
  );
}

function ScoreBreakdown({
  similarity,
}: {
  similarity: FragranceSimilarity;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-2xl font-semibold">Why this score?</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
        Notes and accords drive 60% of the result. Year, house, rating, and
        popularity explain the remaining 40%.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {similarity.scoreComponents.map((component) => (
          <div
            key={component.key}
            className="rounded-xl border border-border bg-background p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{component.label}</h3>
                <p className="mt-0.5 text-xs text-muted">
                  {component.weight}% of total
                </p>
              </div>
              <span className="font-mono text-sm font-semibold tabular-nums text-accent">
                {component.score === null ? "N/A" : `${component.score}%`}
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-border/70">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${component.score ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {component.score === null
                ? "Not enough catalog data"
                : `${formatDecimal(component.contribution)} of ${component.weight} possible points`}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ComparisonTable({
  first,
  second,
  firstWear,
  secondWear,
}: {
  first: CatalogFragrance;
  second: CatalogFragrance;
  firstWear: WearBucket[];
  secondWear: WearBucket[];
}) {
  const rows: Array<{
    label: string;
    first: React.ReactNode;
    second: React.ReactNode;
  }> = [
    { label: "House", first: first.house, second: second.house },
    {
      label: "Released",
      first: first.year > 0 ? first.year : "Unknown",
      second: second.year > 0 ? second.year : "Unknown",
    },
    {
      label: "Rating",
      first: first.rating > 0 ? `${first.rating.toFixed(2)} / 5` : "Unrated",
      second:
        second.rating > 0 ? `${second.rating.toFixed(2)} / 5` : "Unrated",
    },
    {
      label: "Popularity",
      first: formatVotes(first.votes),
      second: formatVotes(second.votes),
    },
    {
      label: "Main accords",
      first: <InlineAccords accords={first.accords.slice(0, 5)} />,
      second: <InlineAccords accords={second.accords.slice(0, 5)} />,
    },
    {
      label: "Best season",
      first: dominantWear(firstWear, ["winter", "spring", "summer", "fall"]),
      second: dominantWear(secondWear, [
        "winter",
        "spring",
        "summer",
        "fall",
      ]),
    },
    {
      label: "Day or night",
      first: dominantWear(firstWear, ["day", "night"]),
      second: dominantWear(secondWear, ["day", "night"]),
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="p-6 pb-4 sm:px-8">
        <h2 className="text-2xl font-semibold">Side-by-side</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-y border-border bg-background/60">
              <th className="w-40 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted sm:px-8">
                Metric
              </th>
              <th className="px-6 py-3 font-semibold">{first.name}</th>
              <th className="px-6 py-3 font-semibold">{second.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-0">
                <th className="px-6 py-4 text-sm font-semibold text-muted sm:px-8">
                  {row.label}
                </th>
                <td className="px-6 py-4 align-top text-sm">{row.first}</td>
                <td className="px-6 py-4 align-top text-sm">{row.second}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ValueComparison({
  title,
  description,
  firstName,
  secondName,
  comparison,
  kind,
}: {
  title: string;
  description: string;
  firstName: string;
  secondName: string;
  comparison: SimilarityValueComparison;
  kind: "note" | "accord";
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.1fr_1fr]">
        <ValueColumn
          title={`Only ${firstName}`}
          values={comparison.firstOnly}
          kind={kind}
          tone="neutral"
        />
        <ValueColumn
          title={`Shared ${kind}s`}
          values={comparison.shared}
          kind={kind}
          tone="shared"
        />
        <ValueColumn
          title={`Only ${secondName}`}
          values={comparison.secondOnly}
          kind={kind}
          tone="neutral"
        />
      </div>
    </section>
  );
}

function ValueColumn({
  title,
  values,
  kind,
  tone,
}: {
  title: string;
  values: string[];
  kind: "note" | "accord";
  tone: "shared" | "neutral";
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === "shared"
          ? "border-accent bg-accent-soft/55"
          : "border-border bg-background"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="font-mono text-xs text-muted">{values.length}</span>
      </div>
      {values.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {values.map((value) => {
            const color = kind === "accord" ? accordColor(value) : undefined;
            return (
              <li
                key={value}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold capitalize"
                style={
                  color
                    ? {
                        borderColor: color,
                        backgroundColor: accordSoftBackground(color),
                      }
                    : undefined
                }
              >
                {value}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">
          No {tone === "shared" ? "shared" : "unique"} {kind}s.
        </p>
      )}
    </div>
  );
}

function WearComparison({
  first,
  second,
  firstWear,
  secondWear,
}: {
  first: CatalogFragrance;
  second: CatalogFragrance;
  firstWear: WearBucket[];
  secondWear: WearBucket[];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-2xl font-semibold">Season and day/night use</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Relative catalog suitability. Longer bars mean a stronger fit for that
        occasion.
      </p>
      <div className="mt-6 space-y-4">
        {firstWear.map((bucket, index) => {
          const other = secondWear[index]!;
          return (
            <div
              key={bucket.id}
              className="grid items-center gap-2 sm:grid-cols-[1fr_88px_1fr]"
            >
              <WearBar
                label={first.name}
                share={bucket.share}
                color={bucket.color}
                reverse
              />
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted">
                {bucket.label}
              </p>
              <WearBar
                label={second.name}
                share={other.share}
                color={other.color}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WearBar({
  label,
  share,
  color,
  reverse = false,
}: {
  label: string;
  share: number;
  color: string;
  reverse?: boolean;
}) {
  const width = Math.max(3, Math.min(100, share * 100));
  return (
    <div
      aria-label={`${label}: ${Math.round(share * 100)}%`}
      className={`flex items-center gap-2 ${reverse ? "flex-row-reverse" : ""}`}
    >
      <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted">
        {Math.round(share * 100)}%
      </span>
      <span
        className={`flex h-3 flex-1 overflow-hidden rounded-full bg-border/65 ${
          reverse ? "justify-end" : ""
        }`}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </span>
    </div>
  );
}

function EmptyComparison({
  first,
  second,
}: {
  first?: CatalogFragrance;
  second?: CatalogFragrance;
}) {
  const selected = Number(Boolean(first)) + Number(Boolean(second));
  return (
    <section className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <p className="font-mono text-4xl text-accent">{selected}/2</p>
      <h2 className="mt-3 text-xl font-semibold">
        {selected === 0 ? "Start with two searches" : "One more fragrance"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
        {selected === 0
          ? "Search by fragrance or house in both fields above."
          : "Use the empty search field above to complete the comparison."}
      </p>
    </section>
  );
}

function InlineAccords({ accords }: { accords: string[] }) {
  if (accords.length === 0) return "Not listed";
  return (
    <span className="flex flex-wrap gap-1.5">
      {accords.map((accord) => {
        const color = accordColor(accord);
        return (
          <span
            key={accord}
            className="rounded-full border px-2.5 py-1 text-xs font-semibold capitalize"
            style={{
              borderColor: color,
              backgroundColor: accordSoftBackground(color),
            }}
          >
            {accord}
          </span>
        );
      })}
    </span>
  );
}

function summarizeDifferences(
  first: CatalogFragrance,
  second: CatalogFragrance,
  similarity: FragranceSimilarity,
  firstWear: WearBucket[],
  secondWear: WearBucket[],
): string[] {
  const items: string[] = [];
  const scentLabel =
    similarity.scentScore >= 70
      ? "strongly related"
      : similarity.scentScore >= 45
        ? "moderately related"
        : "quite different";
  items.push(
    `Their scent profiles are ${scentLabel}: ${similarity.noteComparison.shared.length} shared ${pluralize("note", similarity.noteComparison.shared.length)} and ${similarity.accordComparison.shared.length} shared ${pluralize("accord", similarity.accordComparison.shared.length)} produce a ${similarity.scentScore}% scent score.`,
  );

  if (similarity.noteComparison.shared.length > 0) {
    items.push(
      `Common ground comes from ${joinNatural(similarity.noteComparison.shared.slice(0, 4))}.`,
    );
  } else {
    items.push(
      `${first.name} and ${second.name} share no exact catalog notes; their resemblance comes from broader accords and non-scent factors.`,
    );
  }

  if (first.rating > 0 && second.rating > 0) {
    const higher = first.rating >= second.rating ? first : second;
    const lower = higher.id === first.id ? second : first;
    const difference = Math.abs(first.rating - second.rating);
    items.push(
      difference < 0.1
        ? `Community ratings are nearly tied at ${first.rating.toFixed(2)} and ${second.rating.toFixed(2)}.`
        : `${higher.name} rates ${difference.toFixed(2)} points higher than ${lower.name}.`,
    );
  }

  const firstSeason = dominantWear(firstWear, [
    "winter",
    "spring",
    "summer",
    "fall",
  ]);
  const secondSeason = dominantWear(secondWear, [
    "winter",
    "spring",
    "summer",
    "fall",
  ]);
  const firstTime = dominantWear(firstWear, ["day", "night"]);
  const secondTime = dominantWear(secondWear, ["day", "night"]);
  items.push(
    firstSeason === secondSeason && firstTime === secondTime
      ? `Both lean ${firstSeason.toLowerCase()} and ${firstTime.toLowerCase()} in the wear profile.`
      : `${first.name} leans ${firstSeason.toLowerCase()} / ${firstTime.toLowerCase()}; ${second.name} leans ${secondSeason.toLowerCase()} / ${secondTime.toLowerCase()}.`,
  );

  return items.slice(0, 4);
}

function dominantWear(
  buckets: WearBucket[],
  ids: WearBucket["id"][],
): string {
  const winner = buckets
    .filter((bucket) => ids.includes(bucket.id))
    .sort((a, b) => b.share - a.share)[0];
  return winner
    ? `${winner.label[0]!.toUpperCase()}${winner.label.slice(1)}`
    : "Unknown";
}

function joinNatural(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "no exact notes";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function formatVotes(votes?: number): string {
  return votes && votes > 0
    ? `${new Intl.NumberFormat("en").format(votes)} votes`
    : "Not listed";
}

function formatDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function pluralize(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
}

function getFragrance(slug: string): CatalogFragrance | undefined {
  return slug ? getFragranceBySlug(slug) : undefined;
}

function toPickerFragrance(
  fragrance?: CatalogFragrance,
): ComparisonPickerFragrance | undefined {
  if (!fragrance) return undefined;
  return {
    id: fragrance.id,
    name: fragrance.name,
    house: fragrance.house,
    year: fragrance.year,
    slug: fragrance.slug,
    imageUrl: fragrance.imageUrl,
  };
}

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
