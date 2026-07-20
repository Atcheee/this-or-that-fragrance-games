"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Fragrance } from "@/lib/types";
import {
  DEFAULT_GRID_ATTEMPTS,
  FRAGRANCE_GRID_CELLS,
  FRAGRANCE_GRID_SIZE,
  calculateFragranceGridScore,
  createFragranceGridShare,
  formatGridTime,
  generateFragranceGrid,
  normalizeGridValue,
  validateGridAnswer,
  type PreparedFragranceGrid,
} from "@/lib/engines/fragrance-grid";
import { ResultsSummary } from "@/components/ResultsSummary";
import { utcDateKey } from "@/lib/daily";
import { useSaveRecord } from "./useSaveRecord";

export interface FragranceGridGameProps {
  pool: readonly Fragrance[];
  puzzle?: PreparedFragranceGrid;
  seed?: string;
  title?: string;
  maxAttempts?: number;
  onPlayAgain?: () => void;
  variant?: "daily" | "practice";
  dateKey?: string;
}

type Outcome = "won" | "lost" | null;

export function FragranceGridGame({
  pool,
  puzzle: suppliedPuzzle,
  seed = "fragrance-grid",
  title = "Fragrance Grid",
  maxAttempts = DEFAULT_GRID_ATTEMPTS,
  onPlayAgain,
  variant = "practice",
  dateKey,
}: FragranceGridGameProps) {
  const puzzle = useMemo(
    () => suppliedPuzzle ?? generateFragranceGrid(pool, { seed }),
    [pool, seed, suppliedPuzzle],
  );
  const fragrancesById = useMemo(
    () => new Map(pool.map((fragrance) => [fragrance.id, fragrance])),
    [pool],
  );
  const [answers, setAnswers] = useState<(string | null)[]>(() =>
    Array.from({ length: FRAGRANCE_GRID_CELLS }, () => null),
  );
  const [failedCells, setFailedCells] = useState<Set<number>>(() => new Set());
  const [activeCell, setActiveCell] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(
    Math.max(1, maxAttempts),
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [feedback, setFeedback] = useState("Pick a cell, then find a matching fragrance.");
  const [shareStatus, setShareStatus] = useState("");
  const [isNewBest, setIsNewBest] = useState(false);
  const savedRef = useRef(false);
  const saveRecord = useSaveRecord();
  const startedAt = useRef<number | null>(null);
  const searchId = useId();

  const usedIds = useMemo(
    () => new Set(answers.filter((id): id is string => id !== null)),
    [answers],
  );
  const searchResults = useMemo(() => {
    const normalized = normalizeGridValue(query);
    if (normalized.length < 2) return [];
    const terms = normalized.split(" ");
    return pool
      .filter((fragrance) => {
        if (usedIds.has(fragrance.id)) return false;
        const key = normalizeGridValue(`${fragrance.name} ${fragrance.house}`);
        return terms.every((term) => key.includes(term));
      })
      .sort(
        (a, b) =>
          (b.votes ?? 0) - (a.votes ?? 0) ||
          b.rating - a.rating ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 8);
  }, [pool, query, usedIds]);

  useEffect(() => {
    if (outcome) return;
    startedAt.current ??= Date.now();
    const timer = window.setInterval(() => {
      const start = startedAt.current;
      if (start !== null) {
        setElapsedSeconds(Math.floor((Date.now() - start) / 1_000));
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [outcome]);

  const rowIndex = Math.floor(activeCell / FRAGRANCE_GRID_SIZE);
  const columnIndex = activeCell % FRAGRANCE_GRID_SIZE;
  const rowCriterion = puzzle.rows[rowIndex];
  const columnCriterion = puzzle.columns[columnIndex];
  const selectedFragrance = selectedId ? fragrancesById.get(selectedId) : undefined;
  const mistakes = Math.max(0, Math.max(1, maxAttempts) - attemptsRemaining);
  const score = calculateFragranceGridScore(
    usedIds.size,
    mistakes,
    elapsedSeconds,
    outcome === "won",
  );

  useEffect(() => {
    if (!outcome || savedRef.current) return;
    savedRef.current = true;
    setIsNewBest(
      saveRecord({
        mode: "fragrance-grid",
        score,
        total: 1200,
        label:
          variant === "daily"
            ? `daily:${dateKey ?? utcDateKey()}`
            : "practice",
      }),
    );
  }, [dateKey, outcome, saveRecord, score, variant]);

  function currentElapsedSeconds(): number {
    return startedAt.current === null
      ? elapsedSeconds
      : Math.floor((Date.now() - startedAt.current) / 1_000);
  }

  function selectCell(index: number) {
    if (outcome || answers[index]) return;
    setActiveCell(index);
    setQuery("");
    setSelectedId(null);
    setFeedback(
      `Find a fragrance matching ${puzzle.rows[Math.floor(index / 3)].label} and ${puzzle.columns[index % 3].label}.`,
    );
  }

  function selectSearchResult(fragrance: Fragrance) {
    setSelectedId(fragrance.id);
    setQuery(`${fragrance.name} — ${fragrance.house}`);
    setFeedback(`${fragrance.name} selected. Submit when ready.`);
  }

  function submitAnswer() {
    if (outcome || !rowCriterion || !columnCriterion) return;
    const validation = validateGridAnswer(
      selectedFragrance,
      rowCriterion,
      columnCriterion,
      usedIds,
    );
    if (validation.valid) {
      const nextAnswers = [...answers];
      nextAnswers[activeCell] = selectedFragrance!.id;
      const completed = nextAnswers.every(Boolean);
      setAnswers(nextAnswers);
      setQuery("");
      setSelectedId(null);
      if (completed) {
        const finalElapsed = currentElapsedSeconds();
        setElapsedSeconds(finalElapsed);
        setOutcome("won");
        setFeedback("Grid complete.");
        return;
      }
      const nextCell = nextAnswers.findIndex((answer) => answer === null);
      setActiveCell(nextCell);
      setFeedback(`${selectedFragrance!.name} fits. Next cell selected.`);
      return;
    }

    if (validation.reason === "duplicate") {
      setFeedback("That fragrance is already used. Choose a different one.");
      return;
    }
    if (validation.reason === "unknown") {
      setFeedback("Select a fragrance from the search results first.");
      return;
    }

    const nextAttempts = attemptsRemaining - 1;
    setFailedCells((current) => new Set(current).add(activeCell));
    setAttemptsRemaining(nextAttempts);
    setSelectedId(null);
    setQuery("");
    setFeedback(
      validation.reason === "row"
        ? `Not a match for ${rowCriterion.label}. Attempt used.`
        : `Not a match for ${columnCriterion.label}. Attempt used.`,
    );
    if (nextAttempts <= 0) {
      const finalElapsed = currentElapsedSeconds();
      setElapsedSeconds(finalElapsed);
      setOutcome("lost");
    }
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResult((current) =>
        searchResults.length ? (current + 1 + searchResults.length) % searchResults.length : -1,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResult((current) =>
        searchResults.length ? (current - 1 + searchResults.length) % searchResults.length : -1,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (selectedFragrance) submitAnswer();
      else {
        const result = searchResults[activeResult];
        if (result) selectSearchResult(result);
      }
    } else if (event.key === "Escape") {
      setQuery("");
      setSelectedId(null);
    }
  }

  async function shareResult() {
    const text = createFragranceGridShare(answers, {
      title,
      score,
      elapsedSeconds,
      incorrectCells: [...failedCells],
    });
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus("Result copied.");
    } catch {
      setShareStatus("Copy unavailable. Select the result below.");
    }
  }

  if (outcome) {
    const shareText = createFragranceGridShare(answers, {
      title,
      score,
      elapsedSeconds,
      incorrectCells: [...failedCells],
    });
    return (
      <ResultsSummary
        title={title}
        scoreText={`${score} points`}
        subText={
          outcome === "won"
            ? `Completed in ${formatGridTime(elapsedSeconds)} with ${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"}.`
            : `${usedIds.size} of 9 cells filled in ${formatGridTime(elapsedSeconds)}.`
        }
        isNewBest={isNewBest}
        onPlayAgain={onPlayAgain}
      >
        <GridBoard
          puzzle={puzzle}
          answers={answers}
          fragrancesById={fragrancesById}
          activeCell={-1}
          failedCells={failedCells}
          disabled
          onSelect={() => undefined}
        />
        <section className="w-full text-left" aria-labelledby="grid-valid-answers">
          <h3 id="grid-valid-answers" className="text-center text-sm font-bold uppercase tracking-widest text-muted">
            Answers and alternatives
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {puzzle.intersections.map((intersection, index) => {
              const answer = answers[index] ? fragrancesById.get(answers[index]!) : undefined;
              const alternatives = intersection.validAnswerIds
                .filter((id) => id !== answer?.id)
                .map((id) => fragrancesById.get(id))
                .filter((fragrance): fragrance is Fragrance => Boolean(fragrance))
                .slice(0, 3);
              return (
                <div key={`${intersection.row}-${intersection.column}`} className="rounded-xl border border-border bg-card p-3 text-sm">
                  <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted">
                    {puzzle.rows[intersection.row].label} × {puzzle.columns[intersection.column].label}
                  </p>
                  <p className="font-semibold">
                    {answer ? `${answer.name} · ${answer.house}` : "Unfilled"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Other valid: {alternatives.length ? alternatives.map((item) => item.name).join(", ") : "None in catalog"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={shareResult}
            className="rounded-full border border-border bg-card px-5 py-2.5 font-semibold transition-colors hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Copy share result
          </button>
          <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted">
            {shareStatus}
          </p>
          {shareStatus.startsWith("Copy unavailable") ? (
            <textarea readOnly value={shareText} aria-label="Share result" className="h-28 w-64 rounded-xl border border-border bg-card p-3 text-sm" />
          ) : null}
        </div>
      </ResultsSummary>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">
        <p className="text-muted">Fill every intersection</p>
        <div className="flex gap-4 tabular-nums" aria-label={`${attemptsRemaining} attempts remaining, time ${formatGridTime(elapsedSeconds)}`}>
          <span>Attempts: {attemptsRemaining}</span>
          <time>{formatGridTime(elapsedSeconds)}</time>
        </div>
      </div>

      <GridBoard
        puzzle={puzzle}
        answers={answers}
        fragrancesById={fragrancesById}
        activeCell={activeCell}
        failedCells={failedCells}
        onSelect={selectCell}
      />

      <section className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="grid-search-title">
        <h2 id="grid-search-title" className="text-center font-bold">
          {rowCriterion.label} + {columnCriterion.label}
        </h2>
        <div className="relative mt-4">
          <label htmlFor={`${searchId}-input`} className="sr-only">Search fragrances for selected cell</label>
          <input
            id={`${searchId}-input`}
            type="search"
            role="combobox"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedId(null);
              setActiveResult(0);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search fragrance or house…"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={searchResults.length > 0 && !selectedId}
            aria-controls={`${searchId}-listbox`}
            aria-activedescendant={searchResults[activeResult] ? `${searchId}-option-${activeResult}` : undefined}
            className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          {searchResults.length > 0 && !selectedId ? (
            <ul id={`${searchId}-listbox`} role="listbox" className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 max-h-64 overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-xl">
              {searchResults.map((fragrance, index) => (
                <li key={fragrance.id}>
                  <button
                    id={`${searchId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeResult}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveResult(index)}
                    onClick={() => selectSearchResult(fragrance)}
                    className={`flex w-full justify-between gap-3 rounded-xl px-3 py-2.5 text-left ${index === activeResult ? "bg-accent-soft" : "hover:bg-card-hover"}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{fragrance.name}</span>
                      <span className="block truncate text-xs text-muted">{fragrance.house}</span>
                    </span>
                    {fragrance.year > 0 ? <span className="shrink-0 text-xs tabular-nums text-muted">{fragrance.year}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <p role="status" aria-live="polite" className="mt-3 min-h-5 text-center text-sm text-muted">
          {feedback}
        </p>
        <button
          type="button"
          onClick={submitAnswer}
          disabled={!selectedFragrance}
          className="mx-auto mt-2 block rounded-full bg-accent px-7 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:text-black"
        >
          Submit fragrance
        </button>
      </section>
    </div>
  );
}

function GridBoard({
  puzzle,
  answers,
  fragrancesById,
  activeCell,
  failedCells,
  disabled = false,
  onSelect,
}: {
  puzzle: PreparedFragranceGrid;
  answers: readonly (string | null)[];
  fragrancesById: ReadonlyMap<string, Fragrance>;
  activeCell: number;
  failedCells: ReadonlySet<number>;
  disabled?: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <div
      role="grid"
      aria-label="Fragrance criteria grid"
      className="grid grid-cols-[minmax(4.5rem,.8fr)_repeat(3,minmax(4.5rem,1fr))] gap-1.5 sm:gap-2"
    >
      <div role="row" className="contents">
        <div aria-hidden="true" />
        {puzzle.columns.map((criterion) => (
          <div key={criterion.id} role="columnheader" className="flex min-h-16 items-center justify-center rounded-xl bg-accent-soft p-1.5 text-center text-[0.68rem] font-bold leading-tight text-accent sm:p-2 sm:text-xs">
            {criterion.label}
          </div>
        ))}
      </div>
      {puzzle.rows.map((row, rowIndex) => (
        <GridRow
          key={row.id}
          row={row}
          rowIndex={rowIndex}
          puzzle={puzzle}
          answers={answers}
          fragrancesById={fragrancesById}
          activeCell={activeCell}
          failedCells={failedCells}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function GridRow({
  row,
  rowIndex,
  puzzle,
  answers,
  fragrancesById,
  activeCell,
  failedCells,
  disabled,
  onSelect,
}: {
  row: PreparedFragranceGrid["rows"][number];
  rowIndex: number;
  puzzle: PreparedFragranceGrid;
  answers: readonly (string | null)[];
  fragrancesById: ReadonlyMap<string, Fragrance>;
  activeCell: number;
  failedCells: ReadonlySet<number>;
  disabled: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <div role="row" className="contents">
      <div role="rowheader" className="flex min-h-20 items-center justify-center rounded-xl bg-accent-soft p-1.5 text-center text-[0.68rem] font-bold leading-tight text-accent sm:min-h-24 sm:p-2 sm:text-xs">
        {row.label}
      </div>
      {puzzle.columns.map((column, columnIndex) => {
        const index = rowIndex * FRAGRANCE_GRID_SIZE + columnIndex;
        const fragrance = answers[index] ? fragrancesById.get(answers[index]!) : undefined;
        const selected = index === activeCell;
        const failed = failedCells.has(index);
        return (
          <button
            key={`${row.id}-${column.id}`}
            type="button"
            role="gridcell"
            disabled={disabled || Boolean(fragrance)}
            aria-selected={selected}
            aria-label={fragrance ? `${row.label} and ${column.label}: ${fragrance.name} by ${fragrance.house}` : `${row.label} and ${column.label}, ${failed ? "incorrect attempt" : "empty"}${selected ? ", selected" : ""}`}
            onClick={() => onSelect(index)}
            className={`min-h-20 rounded-xl border p-1.5 text-center leading-tight transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-24 sm:p-2 ${
              fragrance
                ? "border-success bg-success-soft text-success"
                : selected
                  ? "border-accent bg-card shadow-md"
                  : failed
                    ? "border-danger bg-danger-soft"
                  : "border-border bg-card hover:border-accent hover:bg-card-hover"
            }`}
          >
            {fragrance ? (
              <span>
                <span className="block text-[0.68rem] font-bold sm:text-sm">{fragrance.name}</span>
                <span className="mt-1 block text-[0.6rem] opacity-80 sm:text-xs">{fragrance.house}</span>
              </span>
            ) : (
              <span aria-hidden="true" className="text-xl text-muted">+</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
