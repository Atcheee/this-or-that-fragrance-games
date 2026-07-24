"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowSquareOut,
  Fingerprint,
  Heart,
  ShareNetwork,
  Sparkle,
  ThumbsDown,
  Trash,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { CatalogFragranceCard } from "@/components/CatalogFragranceCard";
import {
  parseSharedTasteProfile,
  rankTasteRecommendations,
  serializeSharedTasteProfile,
  type PreferenceScore,
  type TasteFragrance,
} from "@/lib/taste-passport";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";

export function TastePassportDashboard({
  candidates,
  sharedValue,
}: {
  candidates: TasteFragrance[];
  sharedValue?: string;
}) {
  const hydrated = useHydrated();
  const localProfile = useAppStore((state) => state.tasteProfile);
  const events = useAppStore((state) => state.tasteEvents);
  const anonymousId = useAppStore((state) => state.tasteAnonymousId);
  const clearTastePassport = useAppStore((state) => state.clearTastePassport);
  const rebuildTasteProfile = useAppStore(
    (state) => state.rebuildTasteProfile,
  );
  const [shareStatus, setShareStatus] = useState("");
  const sharedProfile = useMemo(
    () => (sharedValue ? parseSharedTasteProfile(sharedValue) : null),
    [sharedValue],
  );

  useEffect(() => {
    if (hydrated && events.length && localProfile.algorithmVersion !== 1) {
      rebuildTasteProfile();
    }
  }, [
    events.length,
    hydrated,
    localProfile.algorithmVersion,
    rebuildTasteProfile,
  ]);

  const profile = sharedProfile ?? localProfile;
  const isShared = sharedProfile !== null;
  const recommendations = useMemo(
    () =>
      isShared
        ? []
        : rankTasteRecommendations(profile, candidates, events, 6),
    [candidates, events, isShared, profile],
  );

  if (!hydrated) {
    return <PassportSkeleton />;
  }

  if (!isShared && profile.interactionCount === 0) {
    return <EmptyPassport />;
  }

  async function shareProfile() {
    const share = serializeSharedTasteProfile(profile);
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("share", share);
    const shareData = {
      title: "My fragrance Taste Passport",
      text: profile.summary,
      url: url.toString(),
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus("Shared");
      } else {
        await navigator.clipboard.writeText(url.toString());
        setShareStatus("Link copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("Could not share");
    }
    window.setTimeout(() => setShareStatus(""), 2_000);
  }

  const favoriteNotes = positive(profile.notes, 6);
  const favoriteAccords = positive(profile.accords, 6);
  const avoidedNotes = negative(profile.notes, 5);
  const avoidedAccords = negative(profile.accords, 5);

  return (
    <div className="flex flex-col gap-8 pb-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <Sparkle aria-hidden size={15} weight="fill" />
            {isShared ? "Shared fragrance profile" : "Your living fragrance profile"}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Taste Passport
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            {isShared
              ? "A snapshot of fragrance preferences shaped through play."
              : "Every choice sharpens this profile. Raw game events stay on this device; scores can be rebuilt whenever the model improves."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={shareProfile}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-[#17120a] transition-transform hover:-translate-y-0.5"
          >
            <ShareNetwork aria-hidden size={18} weight="bold" />
            {shareStatus || "Share passport"}
          </button>
          {!isShared ? (
            <button
              type="button"
              onClick={() => {
                if (
                  !confirm(
                    "Clear all Taste Passport events and calculated preferences from this device?",
                  )
                ) {
                  return;
                }
                clearTastePassport();
              }}
              aria-label="Clear Taste Passport"
              className="inline-flex size-11 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-danger hover:text-danger"
            >
              <Trash aria-hidden size={18} />
            </button>
          ) : null}
        </div>
      </header>

      <section
        id="taste-profile-card"
        className="relative overflow-hidden rounded-[2rem] border border-accent/30 bg-card p-6 shadow-lg sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-accent/10 blur-3xl"
        />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)] lg:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
              Olfactory identity
            </p>
            <p className="mt-4 max-w-3xl font-display text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
              “{profile.summary}”
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[...favoriteAccords.slice(0, 3), ...favoriteNotes.slice(0, 2)].map(
                (item) => (
                  <span
                    key={item.name}
                    className="rounded-full border border-accent/25 bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent"
                  >
                    {item.name}
                  </span>
                ),
              )}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <Metric
              label="Signals"
              value={profile.interactionCount.toLocaleString()}
            />
            <Metric label="Confidence" value={`${profile.confidence}%`} />
            <Metric
              label="Top season"
              value={positive(profile.seasons, 1)[0]?.name ?? "Learning"}
            />
            <Metric
              label="Style"
              value={positive(profile.markets, 1)[0]?.name ?? "Balanced"}
            />
          </dl>
        </div>
      </section>

      {!isShared && anonymousId ? (
        <p className="-mt-4 flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-wider text-muted">
          <Fingerprint aria-hidden size={15} />
          Anonymous profile · {anonymousId.slice(-12)}
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PreferencePanel
          title="Favourite notes"
          subtitle="Ingredients you repeatedly choose"
          items={favoriteNotes}
          empty="More choices needed"
        />
        <PreferencePanel
          title="Favourite accords"
          subtitle="Overall scent directions"
          items={favoriteAccords}
          empty="More choices needed"
        />
        <PreferencePanel
          title="Avoided notes"
          subtitle="Signals that pull matches down"
          items={avoidedNotes}
          tone="negative"
          empty="No clear avoids yet"
        />
        <PreferencePanel
          title="Avoided accords"
          subtitle="Profiles less likely to fit"
          items={avoidedAccords}
          tone="negative"
          empty="No clear avoids yet"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <PreferencePanel
          title="Preferred houses"
          subtitle="Brands winning your attention"
          items={positive(profile.houses, 6)}
          empty="No house pattern yet"
        />
        <PreferencePanel
          title="Release decades"
          subtitle="Eras represented in your choices"
          items={positive(profile.decades, 6)}
          empty="No decade pattern yet"
        />
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-xl font-semibold">Wear profile</h2>
          <p className="mt-1 text-sm text-muted">
            Season, time, and market tendency
          </p>
          <div className="mt-5 space-y-5">
            <ScoreStrip label="Season" items={profile.seasons} />
            <ScoreStrip label="Time" items={profile.times} />
            <ScoreStrip label="Market" items={profile.markets} />
          </div>
        </div>
      </section>

      {!isShared ? (
        <section className="mt-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Based on your passport
              </p>
              <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">
                Fragrances to try next
              </h2>
            </div>
            <Link
              href="/fragrances"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              Browse whole catalog
              <ArrowSquareOut aria-hidden size={16} />
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {recommendations.map(({ fragrance, reasons }, index) => (
              <div key={fragrance.id} className="min-w-0">
                <CatalogFragranceCard
                  fragrance={{
                    ...fragrance,
                    slug: fragrance.slug ?? fragrance.id,
                  }}
                  priority={index < 2}
                />
                <p className="mt-2 line-clamp-1 px-1 text-[0.68rem] text-muted">
                  {reasons.length
                    ? `Matches ${reasons.join(", ")}`
                    : "Strong catalog match"}
                </p>
                <RecommendationFeedback fragrance={fragrance} />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <Link
          href="/passport"
          className="mx-auto inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 font-semibold text-[#17120a]"
        >
          Build your own Taste Passport
        </Link>
      )}
    </div>
  );
}

function EmptyPassport() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-8">
      <section className="overflow-hidden rounded-[2rem] border border-border bg-card p-7 text-center sm:p-12">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Sparkle aria-hidden size={38} weight="duotone" />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Blank passport
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
          Your taste starts with one choice.
        </h1>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-muted">
          Pick favourites in a bracket or take the discovery quiz. Your profile
          saves automatically on this device.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/play/perfect-match"
            className="inline-flex min-h-12 items-center rounded-full bg-accent px-6 font-semibold text-[#17120a]"
          >
            Start a bracket
          </Link>
          <Link
            href="/play/find-favorite"
            className="inline-flex min-h-12 items-center rounded-full border border-border px-6 font-semibold hover:border-accent"
          >
            Take discovery quiz
          </Link>
        </div>
      </section>
    </div>
  );
}

function PreferencePanel({
  title,
  subtitle,
  items,
  empty,
  tone = "positive",
}: {
  title: string;
  subtitle: string;
  items: PreferenceScore[];
  empty: string;
  tone?: "positive" | "negative";
}) {
  const max = Math.max(...items.map((item) => Math.abs(item.score)), 1);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      {items.length ? (
        <ol className="mt-5 space-y-3">
          {items.map((item) => (
            <li key={item.name}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-semibold">{item.name}</span>
                <span className="font-mono text-[0.68rem] text-muted">
                  {item.evidence}×
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full rounded-full ${
                    tone === "negative" ? "bg-danger" : "bg-accent"
                  }`}
                  style={{ width: `${(Math.abs(item.score) / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-8 text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}

function ScoreStrip({
  label,
  items,
}: {
  label: string;
  items: PreferenceScore[];
}) {
  const visible = positive(items, 2);
  const total = visible.reduce((sum, item) => sum + item.score, 0) || 1;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <div className="mt-2 flex h-8 overflow-hidden rounded-lg border border-border">
        {visible.length ? (
          visible.map((item, index) => (
            <span
              key={item.name}
              style={{ width: `${Math.max(24, (item.score / total) * 100)}%` }}
              className={`flex items-center justify-center truncate px-2 text-[0.68rem] font-semibold ${
                index === 0
                  ? "bg-accent-soft text-accent"
                  : "bg-background text-muted"
              }`}
            >
              {item.name}
            </span>
          ))
        ) : (
          <span className="flex flex-1 items-center justify-center text-xs text-muted">
            Learning
          </span>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-1 truncate font-display text-xl font-semibold">{value}</dd>
    </div>
  );
}

function RecommendationFeedback({
  fragrance,
}: {
  fragrance: TasteFragrance;
}) {
  const recordTasteEvent = useAppStore((state) => state.recordTasteEvent);
  return (
    <div className="mt-2 flex items-center gap-1 px-1">
      <FeedbackButton
        label="Like"
        onClick={() =>
          recordTasteEvent({ type: "fragrance_liked", primary: fragrance })
        }
      >
        <Heart aria-hidden size={14} />
      </FeedbackButton>
      <FeedbackButton
        label="Not for me"
        onClick={() =>
          recordTasteEvent({ type: "fragrance_disliked", primary: fragrance })
        }
      >
        <ThumbsDown aria-hidden size={14} />
      </FeedbackButton>
      <FeedbackButton
        label="Skip"
        onClick={() =>
          recordTasteEvent({ type: "fragrance_skipped", primary: fragrance })
        }
      >
        <ArrowRight aria-hidden size={14} />
      </FeedbackButton>
    </div>
  );
}

function FeedbackButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-7 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  );
}

function PassportSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-10 w-64 rounded-lg bg-card" />
      <div className="h-72 rounded-[2rem] bg-card" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-64 rounded-2xl bg-card" />
        ))}
      </div>
    </div>
  );
}

function positive(items: PreferenceScore[], limit: number) {
  return items.filter((item) => item.score > 0).slice(0, limit);
}

function negative(items: PreferenceScore[], limit: number) {
  return items
    .filter((item) => item.score < 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}
