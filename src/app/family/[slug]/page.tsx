import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowsLeftRight,
  CheckCircle,
  GitBranch,
} from "@phosphor-icons/react/dist/ssr";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import {
  getFragranceFamilyBySlug,
  getFragranceFamilySlugs,
  type FragranceFamily,
  type FragranceFamilyMember,
} from "@/lib/fragrance-families";
import { allNotes } from "@/lib/types";

type FamilyPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getFragranceFamilySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: FamilyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const family = getFragranceFamilyBySlug(slug);
  if (!family) return { title: "Fragrance family not found" };

  return {
    title: `${family.name} family tree — ${family.house}`,
    description: `Follow the ${family.house} ${family.name} fragrance family chronologically and compare note and accord changes.`,
    alternates: { canonical: `/family/${family.slug}` },
  };
}

export default async function FragranceFamilyPage({
  params,
  searchParams,
}: FamilyPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const family = getFragranceFamilyBySlug(slug);
  if (!family) notFound();

  const original = family.members[0]!;
  const latest = family.members.at(-1)!;
  const left =
    findMember(family, getParam(query, "left")) ?? original;
  const right =
    findMember(family, getParam(query, "right")) ??
    (latest.fragranceId === left.fragranceId
      ? family.members[1] ?? original
      : latest);

  return (
    <article className="flex flex-col gap-8 pb-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link
              href="/families"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <ArrowLeft aria-hidden size={14} />
              Family trees
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground" aria-current="page">
            {family.house} {family.name}
          </li>
        </ol>
      </nav>

      <header className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              {family.house} · Fragrance family
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
              {family.name}
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-muted">
              {family.summary}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <Fact label="Releases" value={String(family.members.length)} />
            <Fact
              label="Years"
              value={`${original.fragrance.year}–${latest.fragrance.year}`}
            />
          </dl>
        </div>
        <div className="flex items-start gap-3 border-t border-border bg-background/60 px-6 py-4 sm:px-8">
          <CheckCircle
            aria-hidden
            size={19}
            weight="fill"
            className="mt-0.5 shrink-0 text-success"
          />
          <p className="text-sm leading-6 text-muted">
            Membership and parent relationships were manually reviewed on{" "}
            <time dateTime={family.reviewedAt}>{family.reviewedAt}</time>.
            Release years, notes, and accords come from the local catalog.
          </p>
        </div>
      </header>

      <Comparison family={family} left={left} right={right} />

      <section aria-labelledby="timeline-heading">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Oldest to newest
          </p>
          <h2
            id="timeline-heading"
            className="mt-1 text-3xl font-semibold tracking-tight"
          >
            Evolution timeline
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Each release is compared with its curated parent. Added and removed
            labels reflect catalog note pyramids, not ingredient formulas.
          </p>
        </div>

        <ol className="relative mt-7 space-y-5 before:absolute before:bottom-6 before:left-[1.125rem] before:top-6 before:w-px before:bg-border sm:before:left-[1.375rem]">
          {family.members.map((member, index) => {
            const parent = member.parentId
              ? findMember(family, member.parentId)
              : undefined;
            const noteDelta = parent
              ? labelDelta(
                  allNotes(parent.fragrance),
                  allNotes(member.fragrance),
                )
              : undefined;
            const accordDelta = parent
              ? labelDelta(
                  parent.fragrance.accords,
                  member.fragrance.accords,
                )
              : undefined;

            return (
              <li
                key={member.fragranceId}
                className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:gap-4"
              >
                <div className="relative z-10 mt-7 flex size-9 items-center justify-center rounded-full border-4 border-background bg-accent text-xs font-bold text-[#17120a] sm:size-11">
                  {index + 1}
                </div>
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="grid md:grid-cols-[148px_minmax(0,1fr)]">
                    <div className="bottle-studio flex min-h-44 items-center justify-center p-4">
                      <FragranceBottleImage
                        imageUrl={member.fragrance.imageUrl}
                        alt={`${member.fragrance.name} by ${member.fragrance.house} bottle`}
                        width={260}
                        height={340}
                        sizes="148px"
                        className="max-h-40 w-auto max-w-full object-contain"
                        placeholderClassName="h-28 w-auto text-stone-400 opacity-40"
                      />
                    </div>
                    <div className="min-w-0 p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                              {member.relationship}
                            </span>
                            <time className="font-mono text-sm tabular-nums text-muted">
                              {member.fragrance.year}
                            </time>
                          </div>
                          <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                            <Link
                              href={`/fragrance/${member.fragrance.slug}`}
                              className="hover:text-accent hover:underline"
                            >
                              {member.fragrance.name}
                            </Link>
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-muted">
                            {member.lineageNote}
                          </p>
                          {parent ? (
                            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
                              <GitBranch aria-hidden size={15} />
                              Branches from {parent.fragrance.name}
                            </p>
                          ) : null}
                        </div>
                        <Link
                          href={comparisonHref(
                            family,
                            original.fragranceId,
                            member.fragranceId,
                          )}
                          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold transition-colors hover:border-accent hover:bg-card-hover"
                        >
                          Compare
                          <ArrowsLeftRight aria-hidden size={14} />
                        </Link>
                      </div>

                      {noteDelta && accordDelta ? (
                        <div className="mt-5 grid gap-4 border-t border-border pt-5 xl:grid-cols-2">
                          <DeltaBlock
                            label="Notes"
                            added={noteDelta.added}
                            removed={noteDelta.removed}
                          />
                          <DeltaBlock
                            label="Accords"
                            added={accordDelta.added}
                            removed={accordDelta.removed}
                          />
                        </div>
                      ) : (
                        <div className="mt-5 border-t border-border pt-5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                            Foundation notes
                          </p>
                          <LabelList
                            labels={uniqueLabels(allNotes(member.fragrance))}
                            tone="neutral"
                          />
                        </div>
                      )}

                      <Link
                        href={`/fragrance/${member.fragrance.slug}`}
                        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                      >
                        Open fragrance page
                        <ArrowRight aria-hidden size={14} weight="bold" />
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Verification sources</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Official brand pages support family membership. Note pyramids and
          release years shown above remain catalog data and may describe a
          specific formulation or market.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {family.sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm font-semibold transition-colors hover:border-accent hover:bg-card-hover"
              >
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function Comparison({
  family,
  left,
  right,
}: {
  family: FragranceFamily;
  left: FragranceFamilyMember;
  right: FragranceFamilyMember;
}) {
  const noteComparison = compareLabels(
    allNotes(left.fragrance),
    allNotes(right.fragrance),
  );
  const accordComparison = compareLabels(
    left.fragrance.accords,
    right.fragrance.accords,
  );

  return (
    <section
      aria-labelledby="comparison-heading"
      className="rounded-3xl border border-border bg-card p-6 sm:p-8"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <ArrowsLeftRight aria-hidden size={20} weight="bold" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Side by side
          </p>
          <h2
            id="comparison-heading"
            className="mt-1 text-2xl font-semibold tracking-tight"
          >
            Compare any two releases
          </h2>
        </div>
      </div>

      <form
        action={`/family/${family.slug}`}
        className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <MemberSelect
          name="left"
          label="First fragrance"
          members={family.members}
          selectedId={left.fragranceId}
        />
        <MemberSelect
          name="right"
          label="Second fragrance"
          members={family.members}
          selectedId={right.fragranceId}
        />
        <button
          type="submit"
          className="mt-auto h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-[#17120a] transition-transform hover:-translate-y-0.5"
        >
          Compare
        </button>
      </form>

      <div className="mt-7 grid gap-5 border-t border-border pt-7">
        <ComparisonHeading left={left} right={right} />
        <ComparisonBlock
          label="Notes"
          leftName={left.fragrance.name}
          rightName={right.fragrance.name}
          comparison={noteComparison}
        />
        <ComparisonBlock
          label="Main accords"
          leftName={left.fragrance.name}
          rightName={right.fragrance.name}
          comparison={accordComparison}
        />
      </div>
    </section>
  );
}

function ComparisonHeading({
  left,
  right,
}: {
  left: FragranceFamilyMember;
  right: FragranceFamilyMember;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
      <ComparisonFragrance member={left} align="left" />
      <span className="hidden text-xs font-semibold uppercase tracking-widest text-muted sm:block">
        versus
      </span>
      <ComparisonFragrance member={right} align="right" />
    </div>
  );
}

function ComparisonFragrance({
  member,
  align,
}: {
  member: FragranceFamilyMember;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "sm:text-right" : undefined}>
      <p className="font-mono text-xs tabular-nums text-muted">
        {member.fragrance.year} · {member.relationship}
      </p>
      <Link
        href={`/fragrance/${member.fragrance.slug}`}
        className="mt-1 inline-block text-lg font-semibold hover:text-accent hover:underline"
      >
        {member.fragrance.name}
      </Link>
    </div>
  );
}

function ComparisonBlock({
  label,
  leftName,
  rightName,
  comparison,
}: {
  label: string;
  leftName: string;
  rightName: string;
  comparison: LabelComparison;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {label}
      </h3>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <ComparisonColumn
          label={`Only in ${leftName}`}
          labels={comparison.leftOnly}
          tone="removed"
        />
        <ComparisonColumn
          label="Shared"
          labels={comparison.shared}
          tone="neutral"
        />
        <ComparisonColumn
          label={`Only in ${rightName}`}
          labels={comparison.rightOnly}
          tone="added"
        />
      </div>
    </div>
  );
}

function ComparisonColumn({
  label,
  labels,
  tone,
}: {
  label: string;
  labels: string[];
  tone: LabelTone;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-xs font-semibold leading-5 text-muted">{label}</p>
      <LabelList labels={labels} tone={tone} />
    </div>
  );
}

function MemberSelect({
  name,
  label,
  members,
  selectedId,
}: {
  name: string;
  label: string;
  members: FragranceFamilyMember[];
  selectedId: string;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <select
        name={name}
        defaultValue={selectedId}
        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      >
        {members.map((member) => (
          <option key={member.fragranceId} value={member.fragranceId}>
            {member.fragrance.year} — {member.fragrance.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function DeltaBlock({
  label,
  added,
  removed,
}: {
  label: string;
  added: string[];
  removed: string[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label} changed
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs font-semibold text-success">Added</p>
          <LabelList labels={added} tone="added" />
        </div>
        <div>
          <p className="text-xs font-semibold text-danger">Removed</p>
          <LabelList labels={removed} tone="removed" />
        </div>
      </div>
    </div>
  );
}

type LabelTone = "added" | "removed" | "neutral";

function LabelList({
  labels,
  tone,
}: {
  labels: string[];
  tone: LabelTone;
}) {
  if (labels.length === 0) {
    return <p className="mt-2 text-xs text-muted">None listed</p>;
  }

  const toneClass =
    tone === "added"
      ? "bg-success-soft text-success"
      : tone === "removed"
        ? "bg-danger-soft text-danger"
        : "bg-card-hover text-foreground";

  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <li
          key={label}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 rounded-xl border border-border bg-background p-3">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function findMember(
  family: FragranceFamily,
  fragranceId: string,
): FragranceFamilyMember | undefined {
  return family.members.find((member) => member.fragranceId === fragranceId);
}

function comparisonHref(
  family: FragranceFamily,
  leftId: string,
  rightId: string,
): string {
  const query = new URLSearchParams({ left: leftId, right: rightId });
  return `/family/${family.slug}?${query.toString()}#comparison-heading`;
}

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizedLabel(value: string): string {
  return value.trim().toLocaleLowerCase("en");
}

function uniqueLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const label of labels) {
    const key = normalizedLabel(label);
    if (!key || key === "n/a" || seen.has(key)) continue;
    seen.add(key);
    unique.push(label.trim());
  }

  return unique;
}

function labelDelta(
  fromLabels: string[],
  toLabels: string[],
): { added: string[]; removed: string[] } {
  const from = uniqueLabels(fromLabels);
  const to = uniqueLabels(toLabels);
  const fromKeys = new Set(from.map(normalizedLabel));
  const toKeys = new Set(to.map(normalizedLabel));

  return {
    added: to.filter((label) => !fromKeys.has(normalizedLabel(label))),
    removed: from.filter((label) => !toKeys.has(normalizedLabel(label))),
  };
}

interface LabelComparison {
  leftOnly: string[];
  shared: string[];
  rightOnly: string[];
}

function compareLabels(
  leftLabels: string[],
  rightLabels: string[],
): LabelComparison {
  const left = uniqueLabels(leftLabels);
  const right = uniqueLabels(rightLabels);
  const leftKeys = new Set(left.map(normalizedLabel));
  const rightKeys = new Set(right.map(normalizedLabel));

  return {
    leftOnly: left.filter((label) => !rightKeys.has(normalizedLabel(label))),
    shared: left.filter((label) => rightKeys.has(normalizedLabel(label))),
    rightOnly: right.filter((label) => !leftKeys.has(normalizedLabel(label))),
  };
}
