"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FragranceSearchResultVisual } from "@/components/FragranceSearchResultVisual";
import { dailyStreak } from "@/lib/daily";
import {
  BINGO_SQUARES,
  completedBingoLines,
  formatBingoTime,
  generateFragranceBingoCard,
  matchingBingoSquareIndexes,
} from "@/lib/engines/fragrance-bingo";
import { useAppStore } from "@/lib/store";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import { useSaveRecord } from "./useSaveRecord";

type BingoVariant = "daily" | "practice";

interface BingoMark {
  source: "automatic" | "manual";
  fragranceId?: string;
  fragranceName?: string;
}

interface StoredDailyBingo {
  cardId: string;
  dateKey: string;
  marks: Array<BingoMark | null>;
  checkedIds: string[];
  startedAt: number;
  bingoSeconds: number | null;
  blackoutSeconds: number | null;
}

export interface FragranceBingoGameProps {
  meta: GameModeMeta;
  pool: readonly Fragrance[];
  variant: BingoVariant;
  dateKey: string;
  onPlayAgain?: () => void;
}

const STORAGE_PREFIX = "fragrance-bingo:";

export function FragranceBingoGame({
  meta,
  pool,
  variant,
  dateKey,
  onPlayAgain,
}: FragranceBingoGameProps) {
  const searchId = useId();
  const saveRecord = useSaveRecord();
  const history = useAppStore((state) => state.history);
  const [practiceSeed] = useState(
    () => `fragrance-bingo:practice:${Date.now()}:${Math.random()}`,
  );
  const seed =
    variant === "daily" ? `fragrance-bingo:${dateKey}` : practiceSeed;
  const card = useMemo(
    () => generateFragranceBingoCard(pool, seed),
    [pool, seed],
  );
  const [marks, setMarks] = useState<Array<BingoMark | null>>(() =>
    Array.from({ length: BINGO_SQUARES }, () => null),
  );
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [activeResult, setActiveResult] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bingoSeconds, setBingoSeconds] = useState<number | null>(null);
  const [blackoutSeconds, setBlackoutSeconds] = useState<number | null>(null);
  const [status, setStatus] = useState(
    "Search a fragrance to mark every matching square automatically.",
  );
  const [progressReady, setProgressReady] = useState(variant !== "daily");
  const startedAt = useRef(0);

  const markedIndexes = useMemo(
    () =>
      new Set(
        marks.flatMap((mark, index) => (mark === null ? [] : [index])),
      ),
    [marks],
  );
  const completedLines = useMemo(
    () => completedBingoLines(markedIndexes),
    [markedIndexes],
  );
  const completedIndexes = useMemo(
    () =>
      new Set(completedLines.flatMap((line) => line.indexes)),
    [completedLines],
  );
  const markedCount = markedIndexes.size;
  const fullCard = markedCount === BINGO_SQUARES;
  const streak =
    variant === "daily" ? dailyStreak(history, "fragrance-bingo") : 0;
  const fragrancesById = useMemo(
    () => new Map(pool.map((fragrance) => [fragrance.id, fragrance])),
    [pool],
  );
  const checkedFragrances = checkedIds
    .map((id) => fragrancesById.get(id))
    .filter((fragrance): fragrance is Fragrance => Boolean(fragrance));
  const searchResults = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (normalized.length < 2) return [];
    const terms = normalized.split(" ").filter(Boolean);
    return pool
      .filter((fragrance) => {
        const key = normalizeSearch(`${fragrance.name} ${fragrance.house}`);
        return terms.every((term) => key.includes(term));
      })
      .sort(
        (a, b) =>
          (b.votes ?? 0) - (a.votes ?? 0) ||
          b.rating - a.rating ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 8);
  }, [pool, query]);

  useEffect(() => {
    if (variant !== "daily") return;
    const restore = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${dateKey}`);
        if (raw) {
          const stored = JSON.parse(raw) as StoredDailyBingo;
          if (
            stored.cardId === card.id &&
            stored.dateKey === dateKey &&
            Array.isArray(stored.marks) &&
            stored.marks.length === BINGO_SQUARES
          ) {
            setMarks(stored.marks);
            setCheckedIds(stored.checkedIds ?? []);
            setBingoSeconds(stored.bingoSeconds ?? null);
            setBlackoutSeconds(stored.blackoutSeconds ?? null);
            startedAt.current = stored.startedAt || Date.now();
            setElapsedSeconds(
              stored.blackoutSeconds ??
                Math.max(
                  0,
                  Math.floor((Date.now() - startedAt.current) / 1_000),
                ),
            );
            setStatus("Today’s saved card restored.");
          }
        }
      } catch {
        setStatus(
          "Saved progress could not be restored. Starting a fresh card.",
        );
      }
      startedAt.current ||= Date.now();
      setProgressReady(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, [card.id, dateKey, variant]);

  useEffect(() => {
    if (!progressReady || blackoutSeconds !== null) return;
    startedAt.current ||= Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt.current) / 1_000)),
      );
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [blackoutSeconds, progressReady]);

  useEffect(() => {
    if (!progressReady || variant !== "daily") return;
    const stored: StoredDailyBingo = {
      cardId: card.id,
      dateKey,
      marks,
      checkedIds,
      startedAt: startedAt.current,
      bingoSeconds,
      blackoutSeconds,
    };
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${dateKey}`,
      JSON.stringify(stored),
    );
  }, [
    bingoSeconds,
    blackoutSeconds,
    card.id,
    checkedIds,
    dateKey,
    marks,
    progressReady,
    variant,
  ]);

  function toggleManual(index: number) {
    const nextMarks = marks.map((mark, markIndex) =>
      markIndex === index
        ? mark
          ? null
          : { source: "manual" as const }
        : mark,
    );
    commitMarks(
      nextMarks,
      marks[index]
        ? `Square ${index + 1} unmarked.`
        : `Square ${index + 1} marked manually.`,
    );
  }

  function checkFragrance(fragrance: Fragrance) {
    const matchingIndexes = matchingBingoSquareIndexes(card, fragrance);
    const newlyMatched = matchingIndexes.filter((index) => !marks[index]);
    let nextMarks = marks;
    if (matchingIndexes.length > 0) {
      const matchingSet = new Set(matchingIndexes);
      nextMarks = marks.map((mark, index) =>
          mark ??
          (matchingSet.has(index)
            ? {
                source: "automatic",
                fragranceId: fragrance.id,
                fragranceName: fragrance.name,
              }
            : null),
      );
    }
    setCheckedIds((current) => [
      fragrance.id,
      ...current.filter((id) => id !== fragrance.id),
    ].slice(0, 5));
    setQuery("");
    setActiveResult(0);
    commitMarks(
      nextMarks,
      matchingIndexes.length === 0
        ? `${fragrance.name} does not match this card.`
        : newlyMatched.length === 0
          ? `${fragrance.name} matches ${matchingIndexes.length}, already marked.`
          : `${fragrance.name} automatically marked ${newlyMatched.length} ${newlyMatched.length === 1 ? "square" : "squares"}.`,
    );
  }

  function commitMarks(
    nextMarks: Array<BingoMark | null>,
    feedback: string,
  ) {
    setMarks(nextMarks);
    if (!progressReady) {
      setStatus(feedback);
      return;
    }

    const nextMarkedIndexes = new Set(
      nextMarks.flatMap((mark, index) => (mark === null ? [] : [index])),
    );
    const nextLines = completedBingoLines(nextMarkedIndexes);
    const finalSeconds = elapsedSeconds;
    let nextStatus = feedback;

    if (nextLines.length > 0 && bingoSeconds === null) {
      setBingoSeconds(finalSeconds);
      setElapsedSeconds(finalSeconds);
      nextStatus = `Bingo! ${nextLines[0]?.label ?? "Line"} completed.`;
      saveRecord({
        mode: "fragrance-bingo",
        score: Math.max(1, 3_600 - finalSeconds),
        total: 3_600,
        label:
          variant === "daily"
            ? `daily:${dateKey} · ${formatBingoTime(finalSeconds)}`
            : `practice · ${formatBingoTime(finalSeconds)}`,
      });
    }
    if (
      nextMarkedIndexes.size === BINGO_SQUARES &&
      blackoutSeconds === null
    ) {
      setBlackoutSeconds(finalSeconds);
      setElapsedSeconds(finalSeconds);
      nextStatus = `Full card completed in ${formatBingoTime(finalSeconds)}.`;
    }
    setStatus(nextStatus);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResult((current) =>
        searchResults.length ? (current + 1) % searchResults.length : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResult((current) =>
        searchResults.length
          ? (current - 1 + searchResults.length) % searchResults.length
          : 0,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = searchResults[activeResult];
      if (result) checkFragrance(result);
    } else if (event.key === "Escape") {
      setQuery("");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            {variant === "daily" ? `${dateKey} UTC · Daily card` : "Practice card"}
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {meta.title}
          </h1>
        </div>
        <div
          className="flex flex-wrap gap-2 text-sm font-semibold tabular-nums"
          aria-label={`${markedCount} of ${BINGO_SQUARES} marked, ${completedLines.length} completed lines, time ${formatBingoTime(elapsedSeconds)}`}
        >
          <Stat label="Marked" value={`${markedCount}/${BINGO_SQUARES}`} />
          <Stat label="Lines" value={String(completedLines.length)} />
          <Stat label="Time" value={formatBingoTime(elapsedSeconds)} />
          {variant === "daily" && <Stat label="Streak" value={`${streak}d`} />}
        </div>
      </header>

      {completedLines.length > 0 && (
        <section
          className="rounded-2xl border border-success bg-success-soft px-5 py-4 text-center"
          aria-live="polite"
        >
          <p className="font-display text-xl font-bold text-success">
            {fullCard ? "Full card!" : "Bingo!"}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {fullCard
              ? `All 25 conditions completed in ${formatBingoTime(blackoutSeconds ?? elapsedSeconds)}.`
              : `${completedLines.map((line) => line.label).join(", ")} · first line in ${formatBingoTime(bingoSeconds ?? elapsedSeconds)}.`}
          </p>
        </section>
      )}

      <div
        aria-label="Fragrance Bingo card"
        className="grid grid-cols-5 gap-1.5 sm:gap-2"
      >
        {card.squares.map((condition, index) => {
          const mark = marks[index];
          const inCompletedLine = completedIndexes.has(index);
          return (
            <button
              key={condition.id}
              type="button"
              aria-pressed={Boolean(mark)}
              onClick={() => toggleManual(index)}
              title={`Query: ${JSON.stringify(condition.query)}${mark?.fragranceName ? ` · Matched by ${mark.fragranceName}` : ""}`}
              className={`relative flex min-h-24 flex-col items-center justify-center rounded-xl border p-1.5 text-center transition-[background-color,border-color,transform] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-32 sm:p-3 ${
                inCompletedLine
                  ? "border-success bg-success-soft"
                  : mark
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-card hover:border-accent"
              }`}
            >
              <span className="absolute left-1.5 top-1 text-[0.6rem] font-bold tabular-nums text-muted sm:left-2 sm:top-1.5">
                {index + 1}
              </span>
              <span
                className={`mb-1 text-[0.52rem] font-bold uppercase tracking-wide sm:text-[0.62rem] ${
                  condition.rarity === "rare"
                    ? "text-fuchsia-600 dark:text-fuchsia-300"
                    : condition.rarity === "uncommon"
                      ? "text-accent"
                      : "text-muted"
                }`}
              >
                {condition.rarity}
              </span>
              <span className="text-[0.68rem] font-semibold leading-tight sm:text-sm">
                {condition.label}
              </span>
              {mark && (
                <span className="mt-1 text-[0.55rem] font-bold uppercase tracking-wide text-success sm:text-[0.65rem]">
                  {mark.source === "automatic"
                    ? mark.fragranceName ?? "Matched"
                    : "Manual"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <section
        className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-card p-4 sm:p-5"
        aria-labelledby={`${searchId}-title`}
      >
        <h2 id={`${searchId}-title`} className="text-center font-bold">
          A fragrance appeared
        </h2>
        <p className="mt-1 text-center text-sm text-muted">
          Find it below. Matching squares mark automatically.
        </p>
        <div className="relative mt-4">
          <label htmlFor={`${searchId}-input`} className="sr-only">
            Search fragrance or house
          </label>
          <input
            id={`${searchId}-input`}
            type="search"
            role="combobox"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveResult(0);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search fragrance or house…"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={searchResults.length > 0}
            aria-controls={`${searchId}-listbox`}
            aria-activedescendant={
              searchResults[activeResult]
                ? `${searchId}-option-${activeResult}`
                : undefined
            }
            className="h-12 w-full rounded-full border border-border bg-background px-5 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          {searchResults.length > 0 && (
            <ul
              id={`${searchId}-listbox`}
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 max-h-72 overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-xl"
            >
              {searchResults.map((fragrance, index) => (
                <li key={fragrance.id}>
                  <button
                    id={`${searchId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeResult}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveResult(index)}
                    onClick={() => checkFragrance(fragrance)}
                    className={`flex w-full items-center rounded-xl px-3 py-2 text-left ${
                      index === activeResult
                        ? "bg-accent-soft"
                        : "hover:bg-card-hover"
                    }`}
                  >
                    <FragranceSearchResultVisual fragrance={fragrance} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p
          role="status"
          aria-live="polite"
          className="mt-3 min-h-5 text-center text-sm text-muted"
        >
          {status}
        </p>
        {checkedFragrances.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {checkedFragrances.map((fragrance) => (
              <button
                key={fragrance.id}
                type="button"
                onClick={() => checkFragrance(fragrance)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:border-accent"
              >
                {fragrance.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap justify-center gap-3 pb-4">
        {variant === "practice" && onPlayAgain && (
          <button
            type="button"
            onClick={onPlayAgain}
            className="rounded-full bg-accent px-6 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-black"
          >
            Generate another card
          </button>
        )}
        <p className="w-full text-center text-xs text-muted">
          Tap any square for manual marking. Automatic marks show their matching
          fragrance.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-border bg-card px-3 py-1.5">
      <span className="text-muted">{label}</span> {value}
    </span>
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
