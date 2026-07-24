"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  MagnifyingGlass,
  ShareNetwork,
  X,
} from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { FragranceSearchResultVisual } from "@/components/FragranceSearchResultVisual";
import { dailyStreak, utcDateKey } from "@/lib/daily";
import {
  SCENTLE_MAX_GUESSES,
  type ScentleFragranceSummary,
  type ScentleGuessFeedback,
  type ScentleGuessResponse,
  type ScentleProgress,
} from "@/lib/scentle-types";
import { useAppStore } from "@/lib/store";
import type { GameModeMeta } from "@/lib/types";
import { useHydrated } from "@/lib/useHydrated";
import { useSaveRecord } from "./useSaveRecord";

interface SearchResult extends ScentleFragranceSummary {
  slug: string;
}

const EMPTY_PROGRESS = (dateKey: string): ScentleProgress => ({
  dateKey,
  guesses: [],
  outcome: null,
});

export function ScentleGame({ meta }: { meta: GameModeMeta }) {
  const hydrated = useHydrated();
  const dateKey = utcDateKey();
  const listboxId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const progress = useAppStore((state) => state.scentleProgress);
  const setProgress = useAppStore((state) => state.setScentleProgress);
  const history = useAppStore((state) => state.history);
  const saveRecord = useSaveRecord();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState("");
  const [shareLabel, setShareLabel] = useState("Share result");

  const current =
    progress?.dateKey === dateKey ? progress : EMPTY_PROGRESS(dateKey);
  const guessedIds = useMemo(
    () => new Set(current.guesses.map((feedback) => feedback.guess.id)),
    [current.guesses],
  );
  const visibleResults = results.filter((result) => !guessedIds.has(result.id));
  const finished = current.outcome !== null;
  const scentleHistory = history.filter((record) => record.mode === "scentle");
  const wins = scentleHistory.filter((record) => record.score > 0).length;
  const winRate =
    scentleHistory.length > 0
      ? Math.round((wins / scentleHistory.length) * 100)
      : 0;
  const streak = dailyStreak(history, "scentle");

  useEffect(() => {
    if (!hydrated) return;
    if (!progress || progress.dateKey !== dateKey) {
      setProgress(EMPTY_PROGRESS(dateKey));
    }
  }, [dateKey, hydrated, progress, setProgress]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2 || finished) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/catalog/search?q=${encodeURIComponent(normalizedQuery)}&limit=10`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
        setActiveIndex(data.results?.length ? 0 : -1);
      } catch (searchError) {
        if (
          !(searchError instanceof DOMException && searchError.name === "AbortError")
        ) {
          setResults([]);
          setError("Search unavailable. Try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [finished, query]);

  async function submitGuess(result: SearchResult) {
    if (submitting || finished || guessedIds.has(result.id)) return;
    setSubmitting(true);
    setError("");
    setQuery("");
    setResults([]);
    setActiveIndex(-1);

    try {
      const guessNumber = current.guesses.length + 1;
      const response = await fetch("/api/scentle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "guess",
          guessId: result.id,
          guessNumber,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || "Guess failed");
      }

      const data = (await response.json()) as ScentleGuessResponse;
      if (!data.feedback) throw new Error("Guess feedback missing");
      const nextProgress: ScentleProgress = {
        dateKey: data.dateKey,
        guesses: [...current.guesses, data.feedback],
        outcome: data.outcome,
        ...(data.answer ? { answer: data.answer } : {}),
      };
      setProgress(nextProgress);
      if (data.outcome) {
        saveOutcome(data.outcome, guessNumber, data.dateKey);
      } else {
        window.requestAnimationFrame(() => searchRef.current?.focus());
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Guess failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function giveUp() {
    if (submitting || finished) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/scentle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "give-up" }),
      });
      if (!response.ok) throw new Error("Could not reveal today’s fragrance");
      const data = (await response.json()) as ScentleGuessResponse;
      setProgress({
        ...current,
        dateKey: data.dateKey,
        outcome: "lost",
        answer: data.answer,
      });
      saveOutcome("lost", current.guesses.length, data.dateKey);
    } catch (giveUpError) {
      setError(
        giveUpError instanceof Error ? giveUpError.message : "Give up failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function saveOutcome(
    outcome: "won" | "lost",
    guessesUsed: number,
    playedDateKey: string,
  ) {
    saveRecord({
      mode: "scentle",
      score:
        outcome === "won"
          ? SCENTLE_MAX_GUESSES - Math.max(1, guessesUsed) + 1
          : 0,
      total: SCENTLE_MAX_GUESSES,
      label: `daily:${playedDateKey}`,
    });
  }

  async function shareResult() {
    const text = buildShareText(current);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Scentle", text });
        setShareLabel("Shared");
      } else {
        await navigator.clipboard.writeText(text);
        setShareLabel("Copied");
      }
      window.setTimeout(() => setShareLabel("Share result"), 1800);
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        return;
      }
      setShareLabel("Couldn’t share");
      window.setTimeout(() => setShareLabel("Share result"), 1800);
    }
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) =>
        visibleResults.length ? (index + 1) % visibleResults.length : -1,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        visibleResults.length
          ? (index - 1 + visibleResults.length) % visibleResults.length
          : -1,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = visibleResults[activeIndex] ?? visibleResults[0];
      if (result) void submitGuess(result);
    } else if (event.key === "Escape") {
      setResults([]);
      setActiveIndex(-1);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted">
        Loading today’s Scentle…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-10">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Daily fragrance · {dateKey} UTC
        </p>
        <h1 className="mt-2 text-5xl font-semibold tracking-tight sm:text-6xl">
          {meta.title}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted sm:text-base">
          {meta.howTo}
        </p>
      </header>

      {finished && current.answer ? (
        <ResultPanel
          progress={current}
          wins={wins}
          played={scentleHistory.length}
          winRate={winRate}
          streak={streak}
          shareLabel={shareLabel}
          onShare={shareResult}
        />
      ) : (
        <section className="mx-auto w-full max-w-2xl">
          <div className="mb-4 flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold">
              Guess {Math.min(current.guesses.length + 1, SCENTLE_MAX_GUESSES)}{" "}
              of {SCENTLE_MAX_GUESSES}
            </span>
            <GuessDots count={current.guesses.length} />
          </div>

          <div className="relative">
            <MagnifyingGlass
              aria-hidden
              size={20}
              className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted"
            />
            <input
              ref={searchRef}
              type="search"
              role="combobox"
              value={query}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setQuery(nextQuery);
                if (nextQuery.trim().length < 2) {
                  setResults([]);
                  setActiveIndex(-1);
                }
                setError("");
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search a fragrance or house…"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={visibleResults.length > 0}
              aria-controls={listboxId}
              aria-activedescendant={
                activeIndex >= 0
                  ? `${listboxId}-option-${activeIndex}`
                  : undefined
              }
              disabled={submitting}
              className="h-14 w-full rounded-2xl border-2 border-border bg-card pl-12 pr-12 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent-soft disabled:opacity-60"
            />
            {loading || submitting ? (
              <span
                aria-label={submitting ? "Submitting guess" : "Searching"}
                className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin rounded-full border-2 border-border border-t-accent"
              />
            ) : query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  searchRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-card-hover hover:text-foreground"
              >
                <X aria-hidden size={17} weight="bold" />
              </button>
            ) : null}

            {query.trim().length >= 2 && (
              <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                {visibleResults.length > 0 ? (
                  <ul
                    id={listboxId}
                    role="listbox"
                    className="max-h-80 overflow-y-auto p-2"
                  >
                    {visibleResults.map((result, index) => (
                      <li key={result.id}>
                        <button
                          id={`${listboxId}-option-${index}`}
                          type="button"
                          role="option"
                          aria-selected={index === activeIndex}
                          onMouseEnter={() => setActiveIndex(index)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => void submitGuess(result)}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                            index === activeIndex
                              ? "bg-accent-soft"
                              : "hover:bg-card-hover"
                          }`}
                        >
                          <FragranceSearchResultVisual fragrance={result} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-muted">
                    {loading ? "Searching…" : "No unguessed fragrances found."}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="min-h-5 text-sm text-danger" role="alert">
              {error}
            </p>
            <button
              type="button"
              onClick={() => void giveUp()}
              disabled={submitting}
              className="shrink-0 text-sm font-semibold text-muted underline-offset-4 hover:text-danger hover:underline disabled:opacity-50"
            >
              Give up
            </button>
          </div>
        </section>
      )}

      {current.guesses.length > 0 && (
        <section aria-labelledby="scentle-guesses" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Similarity trail
              </p>
              <h2 id="scentle-guesses" className="mt-1 text-2xl font-semibold">
                Today’s guesses
              </h2>
            </div>
            <p className="text-sm tabular-nums text-muted">
              {current.guesses.length}/{SCENTLE_MAX_GUESSES}
            </p>
          </div>
          <div className="space-y-3">
            {[...current.guesses].reverse().map((feedback, reverseIndex) => (
              <GuessCard
                key={feedback.guess.id}
                feedback={feedback}
                guessNumber={current.guesses.length - reverseIndex}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GuessDots({ count }: { count: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`${count} guesses used`}>
      {Array.from({ length: SCENTLE_MAX_GUESSES }, (_, index) => (
        <span
          key={index}
          aria-hidden
          className={`size-2.5 rounded-full ${
            index < count ? "bg-accent" : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}

function GuessCard({
  feedback,
  guessNumber,
}: {
  feedback: ScentleGuessFeedback;
  guessNumber: number;
}) {
  const yearText =
    feedback.yearDirection === "unknown"
      ? "Unknown"
      : feedback.yearDirection === "exact"
        ? "Exact year"
        : `${feedback.yearDistance}y · answer ${feedback.yearDirection}`;

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-card ${
        feedback.isCorrect ? "border-success" : "border-border"
      }`}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white p-1 ring-1 ring-border">
            <FragranceBottleImage
              imageUrl={feedback.guess.imageUrl}
              alt=""
              well={false}
              stage={false}
              className="max-h-full w-auto max-w-full object-contain"
              placeholderClassName="h-10 w-auto text-stone-400 opacity-40"
            />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              Guess {guessNumber} · {feedback.guess.house}
            </p>
            <h3 className="truncate text-lg font-semibold">
              {feedback.guess.name}
            </h3>
            <p className="text-sm tabular-nums text-muted">
              {feedback.guess.year > 0 ? feedback.guess.year : "Year unknown"}
            </p>
          </div>
        </div>
        <div
          className={`flex size-20 shrink-0 flex-col items-center justify-center self-center rounded-full border-4 ${scoreClasses(feedback.overallScore)}`}
          aria-label={`${feedback.overallScore}% overall similarity`}
        >
          <span className="text-2xl font-bold tabular-nums">
            {feedback.overallScore}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide">
            match
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-border sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Notes" value={`${feedback.noteSimilarity}%`}>
          {feedback.sharedNotes.length
            ? `${feedback.sharedNotes.length} shared`
            : "None shared"}
        </Metric>
        <Metric label="Accords" value={`${feedback.accordSimilarity}%`}>
          {feedback.sharedAccords.length
            ? feedback.sharedAccords.slice(0, 2).join(", ")
            : "None shared"}
        </Metric>
        <Metric
          label="Release"
          value={yearText}
          icon={
            feedback.yearDirection === "newer" ? (
              <ArrowUp aria-hidden size={14} />
            ) : feedback.yearDirection === "older" ? (
              <ArrowDown aria-hidden size={14} />
            ) : feedback.yearDirection === "exact" ? (
              <Check aria-hidden size={14} />
            ) : null
          }
        />
        <Metric
          label="House"
          value={feedback.sameHouse ? "Same house" : "Different"}
          good={feedback.sameHouse}
        />
        <Metric
          label="Rating"
          value={
            feedback.ratingDistance === null
              ? "Unknown"
              : `±${feedback.ratingDistance.toFixed(1)}`
          }
        />
        <Metric
          label="Popularity"
          value={
            feedback.popularitySimilarity === null
              ? "Unknown"
              : `${feedback.popularitySimilarity}% close`
          }
        />
      </div>

      {(feedback.sharedNotes.length > 0 ||
        feedback.sharedAccords.length > 0) && (
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3 sm:px-5">
          {feedback.sharedNotes.map((note) => (
            <span
              key={`note-${note}`}
              className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent"
            >
              {note}
            </span>
          ))}
          {feedback.sharedAccords.map((accord) => (
            <span
              key={`accord-${accord}`}
              className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted"
            >
              {accord} accord
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function Metric({
  label,
  value,
  icon,
  good = false,
  children,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  good?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 border-b border-r border-border p-3 last:border-r-0 sm:min-h-24 lg:border-b-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <p
        className={`mt-1 flex items-center gap-1 text-sm font-bold leading-tight ${
          good ? "text-success" : "text-foreground"
        }`}
      >
        {icon}
        {value}
      </p>
      {children && (
        <p className="mt-1 truncate text-xs text-muted" title={String(children)}>
          {children}
        </p>
      )}
    </div>
  );
}

function ResultPanel({
  progress,
  played,
  wins,
  winRate,
  streak,
  shareLabel,
  onShare,
}: {
  progress: ScentleProgress;
  played: number;
  wins: number;
  winRate: number;
  streak: number;
  shareLabel: string;
  onShare: () => void;
}) {
  const answer = progress.answer!;
  const won = progress.outcome === "won";
  const ShareIcon = shareLabel === "Copied" ? Copy : ShareNetwork;

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="flex flex-col items-center gap-5 p-6 text-center sm:p-8">
          <p
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${
              won
                ? "bg-success-soft text-success"
                : "bg-danger-soft text-danger"
            }`}
          >
            {won
              ? `Solved in ${progress.guesses.length}`
              : "Today’s fragrance"}
          </p>
          <div className="flex h-44 w-full items-end justify-center">
            <FragranceBottleImage
              imageUrl={answer.imageUrl}
              alt={`${answer.name} by ${answer.house}`}
              well={false}
              className="max-h-full w-auto max-w-[55%] object-contain drop-shadow-xl"
              placeholderClassName="h-32 w-auto text-muted opacity-30"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              {answer.house}
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">
              {answer.name}
            </h2>
            {answer.year > 0 && (
              <p className="mt-1 text-sm tabular-nums text-muted">
                Released {answer.year}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-7 py-3 font-semibold text-[#17120a] transition-transform hover:-translate-y-0.5"
          >
            <ShareIcon aria-hidden size={18} weight="bold" />
            {shareLabel}
          </button>
        </div>

        <div className="border-t border-border bg-background/55 p-6 lg:border-l lg:border-t-0 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Your stats
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat value={played} label="Played" />
            <Stat value={wins} label="Won" />
            <Stat value={`${winRate}%`} label="Win rate" />
            <Stat value={streak} label="Day streak" />
          </div>
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-sm font-semibold">Share grid</p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-sans text-xl leading-8">
              {buildShareGrid(progress)}
            </pre>
            <p className="mt-3 text-xs text-muted">
              New shared fragrance at midnight UTC.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
    </div>
  );
}

function scoreClasses(score: number): string {
  if (score >= 85) return "border-success bg-success-soft text-success";
  if (score >= 60) return "border-accent bg-accent-soft text-accent";
  if (score >= 35) return "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300";
  return "border-danger bg-danger-soft text-danger";
}

function square(score: number): string {
  if (score >= 85) return "🟩";
  if (score >= 60) return "🟨";
  if (score >= 35) return "🟧";
  if (score > 0) return "🟥";
  return "⬛";
}

function buildShareGrid(progress: ScentleProgress): string {
  if (progress.guesses.length === 0) return "⬛⬛⬛⬛⬛⬛";
  return progress.guesses
    .map((feedback) => {
      const yearScore =
        feedback.yearDirection === "unknown"
          ? 0
          : Math.round(Math.exp(-feedback.yearDistance / 18) * 100);
      const ratingScore =
        feedback.ratingDistance === null
          ? 0
          : Math.round(Math.exp(-feedback.ratingDistance / 0.75) * 100);
      return [
        feedback.isCorrect ? "🟩" : square(feedback.overallScore),
        square(feedback.noteSimilarity),
        square(feedback.accordSimilarity),
        square(yearScore),
        feedback.sameHouse ? "🟩" : "⬛",
        square(
          Math.round(
            (ratingScore + (feedback.popularitySimilarity ?? 0)) / 2,
          ),
        ),
      ].join("");
    })
    .join("\n");
}

function buildShareText(progress: ScentleProgress): string {
  const result =
    progress.outcome === "won"
      ? `${progress.guesses.length}/${SCENTLE_MAX_GUESSES}`
      : `X/${SCENTLE_MAX_GUESSES}`;
  return `Scentle ${progress.dateKey} ${result}\n\n${buildShareGrid(progress)}\n\nCan you find today’s fragrance?`;
}
