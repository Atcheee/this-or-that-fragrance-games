"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type DragEvent,
} from "react";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { ResultsSummary } from "@/components/ResultsSummary";
import {
  createFragranceTimelinePracticeSeed,
  createFragranceTimelineShare,
  dailyFragranceTimelineSeed,
  evaluateFragranceTimeline,
  formatTimelineTime,
  fragranceTimelineUtcDateKey,
  generateFragranceTimeline,
  moveTimelineItem,
  type FragranceTimelinePuzzle,
  type FragranceTimelineResult,
} from "@/lib/engines/fragrance-timeline";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import { HouseMark } from "./HouseMark";
import { useSaveRecord } from "./useSaveRecord";

export interface FragranceTimelineGameProps {
  meta: GameModeMeta;
  pool: Fragrance[];
  onPlayAgain?: () => void;
  variant?: "daily" | "practice";
  size?: number;
}

export function FragranceTimelineGame({
  meta,
  pool,
  onPlayAgain,
  variant = "practice",
  size = 4,
}: FragranceTimelineGameProps) {
  const daily = variant === "daily";
  const [dateKey] = useState(fragranceTimelineUtcDateKey);
  const [practiceSeed, setPracticeSeed] = useState<string | null>(null);
  const seed = daily ? dailyFragranceTimelineSeed(dateKey) : practiceSeed;
  const prepared = useMemo(() => {
    if (!seed) return { puzzle: null, error: null };
    try {
      return {
        puzzle: generateFragranceTimeline(pool, { seed, size }),
        error: null,
      };
    } catch (error) {
      return {
        puzzle: null,
        error:
          error instanceof Error
            ? error.message
            : "Could not build this fragrance timeline.",
      };
    }
  }, [pool, seed, size]);

  useEffect(() => {
    if (daily || practiceSeed) return;
    // Avoid different random seeds in server HTML and the hydrated client tree.
    const timer = window.setTimeout(() => {
      setPracticeSeed(createFragranceTimelinePracticeSeed());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [daily, practiceSeed]);

  function playAgain() {
    if (onPlayAgain) {
      onPlayAgain();
      return;
    }
    setPracticeSeed(createFragranceTimelinePracticeSeed());
  }

  if (!prepared.puzzle) {
    if (!prepared.error) {
      return (
        <p className="flex flex-1 items-center justify-center text-muted" role="status">
          Preparing timeline…
        </p>
      );
    }
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-danger bg-danger-soft p-6 text-center">
        <h2 className="text-lg font-semibold text-danger">Timeline unavailable</h2>
        <p className="mt-2 text-sm text-muted">{prepared.error}</p>
      </div>
    );
  }

  return (
    <TimelineRound
      key={`${prepared.puzzle.id}:${seed}`}
      meta={meta}
      puzzle={prepared.puzzle}
      daily={daily}
      dateKey={dateKey}
      onPlayAgain={daily ? undefined : playAgain}
    />
  );
}

function TimelineRound({
  meta,
  puzzle,
  daily,
  dateKey,
  onPlayAgain,
}: {
  meta: GameModeMeta;
  puzzle: FragranceTimelinePuzzle;
  daily: boolean;
  dateKey: string;
  onPlayAgain?: () => void;
}) {
  const instructionsId = useId();
  const [order, setOrder] = useState(() =>
    puzzle.initialOrder.map((fragrance) => fragrance.id),
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hintedId, setHintedId] = useState<string | null>(null);
  const [result, setResult] = useState<FragranceTimelineResult | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [moveStatus, setMoveStatus] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const saveRecord = useSaveRecord();
  const fragrancesById = useMemo(
    () => new Map(puzzle.fragrances.map((fragrance) => [fragrance.id, fragrance])),
    [puzzle.fragrances],
  );

  useEffect(() => {
    if (result) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [result]);

  function moveCard(fromIndex: number, toIndex: number) {
    if (result || fromIndex === toIndex) return;
    const fragrance = fragrancesById.get(order[fromIndex]);
    setOrder((current) => moveTimelineItem(current, fromIndex, toIndex));
    if (fragrance) {
      setMoveStatus(`${fragrance.name} moved to position ${toIndex + 1}.`);
    }
  }

  function handleDrop(event: DragEvent<HTMLLIElement>, toIndex: number) {
    event.preventDefault();
    const fragranceId = event.dataTransfer.getData("text/plain");
    const fromIndex = order.indexOf(fragranceId);
    if (fromIndex >= 0) moveCard(fromIndex, toIndex);
  }

  function useHint() {
    if (hintedId || result) return;
    const oldest = puzzle.correctOrder[0];
    setHintedId(oldest.id);
    setMoveStatus(
      `Hint: ${oldest.name} is the oldest fragrance. It was released in ${oldest.year}.`,
    );
  }

  function submitTimeline() {
    if (result) return;
    const nextResult = evaluateFragranceTimeline(order, puzzle.correctOrder, {
      elapsedSeconds,
      hintsUsed: hintedId ? 1 : 0,
    });
    setResult(nextResult);
    setIsNewBest(
      saveRecord({
        mode: meta.id,
        score: nextResult.score,
        total: nextResult.maximumScore,
        label: daily
          ? `daily:${dateKey} · ${nextResult.correctPositions}/${order.length} exact · ${nextResult.score} pts`
          : `${nextResult.correctPositions}/${order.length} exact · ${nextResult.score} pts`,
      }),
    );
  }

  async function shareResults() {
    if (!result) return;
    const text = createFragranceTimelineShare({
      title: meta.title,
      dateKey: daily ? dateKey : undefined,
      result,
    });
    try {
      if (navigator.share) {
        await navigator.share({ text });
        setShareStatus("Shared.");
      } else {
        await navigator.clipboard.writeText(text);
        setShareStatus("Results copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("Sharing unavailable. Select and copy the summary below.");
    }
  }

  if (result) {
    const shareText = createFragranceTimelineShare({
      title: meta.title,
      dateKey: daily ? dateKey : undefined,
      result,
    });
    return (
      <ResultsSummary
        title={meta.title}
        scoreText={`${result.score} pts`}
        subText={`${result.correctPositions} of ${order.length} exact · ${result.correctPairs} of ${result.totalPairs} relative pairs · ${formatTimelineTime(result.elapsedSeconds)} · ${result.hintsUsed} ${result.hintsUsed === 1 ? "hint" : "hints"}`}
        isNewBest={isNewBest}
        onPlayAgain={onPlayAgain}
      >
        <div className="grid w-full gap-5 text-left sm:grid-cols-2">
          <ResultOrder
            title="Your order"
            order={order}
            fragrancesById={fragrancesById}
            result={result}
          />
          <ResultOrder
            title="Correct order"
            order={puzzle.correctOrder.map((fragrance) => fragrance.id)}
            fragrancesById={fragrancesById}
          />
        </div>
        <div className="flex w-full flex-col items-center gap-2">
          <button
            type="button"
            onClick={shareResults}
            className="rounded-full border border-border bg-card px-5 py-2.5 font-semibold transition-colors hover:border-accent hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Share results
          </button>
          <p className="min-h-5 text-sm text-muted" role="status" aria-live="polite">
            {shareStatus}
          </p>
          {shareStatus.startsWith("Sharing unavailable") ? (
            <textarea
              readOnly
              value={shareText}
              aria-label="Shareable result summary"
              className="h-28 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm"
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : null}
        </div>
      </ResultsSummary>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-muted">
            {daily ? `${dateKey} UTC · Daily` : "Practice"}
          </p>
          <h2 className="mt-1 text-xl font-bold">Oldest to newest</h2>
        </div>
        <time
          className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold tabular-nums"
          aria-label={`Elapsed time ${formatTimelineTime(elapsedSeconds)}`}
        >
          {formatTimelineTime(elapsedSeconds)}
        </time>
      </header>

      <p id={instructionsId} className="text-sm leading-relaxed text-muted">
        Drag cards into order, or use each card&apos;s move buttons. Release years stay
        hidden until submission.
      </p>

      <ol
        className="space-y-3"
        aria-label="Fragrances ordered from oldest to newest"
        aria-describedby={instructionsId}
      >
        {order.map((fragranceId, index) => {
          const fragrance = fragrancesById.get(fragranceId);
          if (!fragrance) return null;
          const hinted = fragrance.id === hintedId;
          return (
            <li
              key={fragrance.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", fragrance.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => handleDrop(event, index)}
              className={`flex items-center gap-3 rounded-2xl border-2 bg-card p-3 shadow-sm transition-[border-color,background-color,box-shadow] sm:gap-4 sm:p-4 ${
                hinted ? "border-accent bg-accent-soft" : "border-border"
              }`}
            >
              <span
                className="w-7 shrink-0 text-center text-lg font-bold tabular-nums text-muted"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span
                className="hidden cursor-grab select-none text-xl text-muted active:cursor-grabbing sm:block"
                aria-hidden="true"
                title="Drag to reorder"
              >
                ≡
              </span>
              <span className="flex h-16 w-14 shrink-0 items-center justify-center" aria-hidden="true">
                <FragranceBottleImage
                  imageUrl={fragrance.imageUrl}
                  alt=""
                  className="max-h-full w-auto max-w-full object-contain drop-shadow-sm"
                  placeholderClassName="h-14 w-auto text-muted opacity-25"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{fragrance.name}</span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted">
                  <HouseMark name={fragrance.house} size="xs" />
                  <span className="truncate">{fragrance.house}</span>
                </span>
                {hinted ? (
                  <span className="mt-1 block text-xs font-semibold text-accent">
                    Oldest · {fragrance.year}
                  </span>
                ) : null}
              </span>
              <span className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveCard(index, index - 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-lg font-bold transition-colors hover:border-accent hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`Move ${fragrance.name} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === order.length - 1}
                  onClick={() => moveCard(index, index + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-lg font-bold transition-colors hover:border-accent hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`Move ${fragrance.name} down`}
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      <p className="sr-only" role="status" aria-live="polite">
        {moveStatus}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={useHint}
          disabled={Boolean(hintedId)}
          className="rounded-full border border-border bg-card px-5 py-2.5 font-semibold transition-colors hover:border-accent hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-45"
        >
          {hintedId ? "Oldest revealed" : "Reveal oldest (-100 pts)"}
        </button>
        <button
          type="button"
          onClick={submitTimeline}
          className="rounded-full bg-accent px-7 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-black"
        >
          Submit timeline
        </button>
      </div>
    </div>
  );
}

function ResultOrder({
  title,
  order,
  fragrancesById,
  result,
}: {
  title: string;
  order: readonly string[];
  fragrancesById: ReadonlyMap<string, Fragrance>;
  result?: FragranceTimelineResult;
}) {
  const placementById = new Map(
    result?.placements.map((placement) => [placement.fragranceId, placement]),
  );
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-center text-sm font-bold uppercase tracking-widest text-muted">
        {title}
      </h2>
      <ol className="mt-3 space-y-2">
        {order.map((fragranceId, index) => {
          const fragrance = fragrancesById.get(fragranceId);
          if (!fragrance) return null;
          const placement = placementById.get(fragranceId);
          return (
            <li
              key={fragrance.id}
              className={`rounded-xl border p-3 ${
                placement?.correct
                  ? "border-success bg-success-soft"
                  : placement
                    ? "border-danger bg-danger-soft"
                    : "border-border bg-background"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold tabular-nums text-muted">{index + 1}.</span>
                <span className="flex h-14 w-11 shrink-0 items-center justify-center rounded-lg bg-white p-1 ring-1 ring-border" aria-hidden="true">
                  <FragranceBottleImage
                    key={`${fragrance.id}:${fragrance.imageUrl ?? ""}`}
                    imageUrl={fragrance.imageUrl}
                    alt=""
                    className="max-h-full w-auto max-w-full object-contain drop-shadow-sm"
                    placeholderClassName="h-10 w-auto text-stone-400 opacity-40"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight">
                    {fragrance.name}
                  </span>
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted">
                    <HouseMark name={fragrance.house} size="xs" />
                    <span className="truncate">{fragrance.house} · {fragrance.year}</span>
                  </span>
                  {placement ? (
                    <span
                      className={`mt-1 block text-xs font-semibold ${placement.correct ? "text-success" : "text-danger"}`}
                    >
                      {placement.correct
                        ? "Correct position"
                        : `${placement.displacement} ${placement.displacement === 1 ? "place" : "places"} away`}
                    </span>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
