"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import {
  calculateOddOneOutPoints,
  createOddOneOutPracticeSeed,
  dailyOddOneOutSeed,
  generateOddOneOutRounds,
  oddOneOutUtcDateKey,
  type OddOneOutRound,
} from "@/lib/engines/odd-one-out";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { ResultsSummary } from "@/components/ResultsSummary";
import { ScoreBar } from "@/components/ScoreBar";
import { AnswerFeedback } from "./AnswerFeedback";
import { HouseMark } from "./HouseMark";
import { RoundStage } from "./RoundStage";
import { useSaveRecord } from "./useSaveRecord";

export type OddOneOutVariant = "daily" | "practice";

export interface OddOneOutGameProps {
  meta: GameModeMeta;
  pool: Fragrance[];
  rounds?: number;
  onPlayAgain?: () => void;
  variant?: OddOneOutVariant;
  /** YYYY-MM-DD UTC date. Useful for previews and deterministic tests. */
  dateKey?: string;
  /** Overrides generated seed. Same pool + seed gives same puzzle. */
  seed?: string;
  preparedRounds?: OddOneOutRound[];
  /** Bottle art can be hidden when image coverage is poor. */
  showBottles?: boolean;
}

interface AnswerRecord {
  roundId: string;
  selectedId: string;
  correct: boolean;
  points: number;
}

interface PersistedDailyGame {
  version: 1;
  seed: string;
  index: number;
  score: number;
  streak: number;
  bestStreak: number;
  answers: AnswerRecord[];
  finished: boolean;
}

interface OddOneOutStats {
  gamesPlayed: number;
  correctAnswers: number;
  totalAnswers: number;
  bestScore: number;
  bestStreak: number;
}

const DAILY_STORAGE_PREFIX = "fragrance-games:odd-one-out:daily";
const STATS_STORAGE_KEY = "fragrance-games:odd-one-out:stats";

export function OddOneOutGame({
  meta,
  pool,
  rounds: requestedRounds = 5,
  onPlayAgain,
  variant = "practice",
  dateKey,
  seed,
  preparedRounds,
  showBottles = true,
}: OddOneOutGameProps) {
  const daily = variant === "daily";
  const [resolvedDateKey] = useState(
    () => dateKey?.slice(0, 10) ?? oddOneOutUtcDateKey(),
  );
  const [practiceSeed, setPracticeSeed] = useState(
    () => seed ?? createOddOneOutPracticeSeed(),
  );
  const effectiveSeed = daily
    ? seed ?? dailyOddOneOutSeed(resolvedDateKey)
    : practiceSeed;
  const roundCount = Math.max(1, Math.floor(requestedRounds));
  const generated = useMemo(() => {
    if (preparedRounds) return { rounds: preparedRounds, error: null };
    const generationSeed = daily
      ? seed ?? dailyOddOneOutSeed(resolvedDateKey)
      : practiceSeed;
    if (!generationSeed) return { rounds: [] as OddOneOutRound[], error: null };
    try {
      return {
        rounds: generateOddOneOutRounds(pool, roundCount, { seed: generationSeed }),
        error: null,
      };
    } catch (error) {
      return {
        rounds: [] as OddOneOutRound[],
        error: error instanceof Error ? error.message : "Could not build this puzzle.",
      };
    }
  }, [daily, pool, practiceSeed, preparedRounds, resolvedDateKey, roundCount, seed]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [finished, setFinished] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const statsSavedRef = useRef(false);
  const saveRecord = useSaveRecord();

  const dailyStorageKey = `${DAILY_STORAGE_PREFIX}:${resolvedDateKey}:${roundCount}`;

  useEffect(() => {
    if (!effectiveSeed) return;
    const timer = window.setTimeout(() => {
      if (!generated.error && daily) {
        const saved = readDailyGame(
          dailyStorageKey,
          effectiveSeed,
          generated.rounds.length,
        );
        if (saved) {
          setIndex(saved.index);
          setScore(saved.score);
          setStreak(saved.streak);
          setBestStreak(saved.bestStreak);
          setAnswers(saved.answers);
          setFinished(saved.finished);
        }
      }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [daily, dailyStorageKey, effectiveSeed, generated.error, generated.rounds.length]);

  useEffect(() => {
    if (!daily || !storageReady || !effectiveSeed) return;
    const state: PersistedDailyGame = {
      version: 1,
      seed: effectiveSeed,
      index,
      score,
      streak,
      bestStreak,
      answers,
      finished,
    };
    try {
      window.localStorage.setItem(dailyStorageKey, JSON.stringify(state));
    } catch {
      // Daily gameplay still works when storage is unavailable or full.
    }
  }, [
    answers,
    bestStreak,
    daily,
    dailyStorageKey,
    effectiveSeed,
    finished,
    index,
    score,
    storageReady,
    streak,
  ]);

  useEffect(() => {
    if (!storageReady || finished || answers.length > 0) return;
    cardRefs.current[0]?.focus();
  }, [answers.length, finished, index, storageReady]);

  const current = generated.rounds[index];
  const currentAnswer = current
    ? answers.find((answer) => answer.roundId === current.id)
    : undefined;
  const correctCount = answers.filter((answer) => answer.correct).length;

  function selectAnswer(fragranceId: string) {
    if (!current || currentAnswer || finished) return;
    const correct = fragranceId === current.oddFragranceId;
    const points = correct ? calculateOddOneOutPoints(streak) : 0;
    const nextStreak = correct ? streak + 1 : 0;
    setAnswers((previous) => [
      ...previous,
      {
        roundId: current.id,
        selectedId: fragranceId,
        correct,
        points,
      },
    ]);
    setScore((previous) => previous + points);
    setStreak(nextStreak);
    setBestStreak((previous) => Math.max(previous, nextStreak));
  }

  function continueGame() {
    if (!currentAnswer) return;
    if (index + 1 < generated.rounds.length) {
      setIndex((previous) => previous + 1);
      return;
    }

    setFinished(true);
    if (!statsSavedRef.current) {
      statsSavedRef.current = true;
      saveLifetimeStats(score, bestStreak, answers, daily ? resolvedDateKey : undefined);
      setIsNewBest(
        saveRecord({
          mode: meta.id,
          score: correctCount,
          total: generated.rounds.length,
          label: daily
            ? `daily:${resolvedDateKey} · ${score} pts · ${bestStreak} best streak`
            : `${score} pts · ${bestStreak} best streak`,
        }),
      );
    }
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLButtonElement>, cardIndex: number) {
    const lastIndex = current?.fragrances.length ? current.fragrances.length - 1 : 0;
    let target: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      target = cardIndex === lastIndex ? 0 : cardIndex + 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      target = cardIndex === 0 ? lastIndex : cardIndex - 1;
    } else if (event.key === "Home") {
      target = 0;
    } else if (event.key === "End") {
      target = lastIndex;
    }
    if (target === null) return;
    event.preventDefault();
    cardRefs.current[target]?.focus();
  }

  function restartPractice() {
    if (onPlayAgain) {
      onPlayAgain();
      return;
    }
    setIndex(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setAnswers([]);
    setFinished(false);
    setStorageReady(false);
    setIsNewBest(false);
    setShareStatus("");
    statsSavedRef.current = false;
    setPracticeSeed(createOddOneOutPracticeSeed());
  }

  async function shareResults() {
    const text = oddOneOutShareText({
      title: meta.title,
      dailyDate: daily ? resolvedDateKey : undefined,
      score,
      bestStreak,
      answers,
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
      setShareStatus("Sharing is unavailable. Select and copy the summary below.");
    }
  }

  if (!effectiveSeed || !storageReady) {
    return (
      <p className="flex flex-1 items-center justify-center text-muted" role="status">
        Preparing an unambiguous puzzle…
      </p>
    );
  }

  if (generated.error || generated.rounds.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-danger bg-danger-soft p-6 text-center">
        <h2 className="text-lg font-semibold text-danger">Puzzle unavailable</h2>
        <p className="mt-2 text-sm text-muted">
          {generated.error ?? "This fragrance pool has too little objective data."}
        </p>
        {!daily && (
          <button
            type="button"
            onClick={restartPractice}
            className="mt-5 rounded-full bg-accent px-5 py-2 font-semibold text-white dark:text-black"
          >
            Try another pool
          </button>
        )}
      </div>
    );
  }

  if (finished) {
    const shareText = oddOneOutShareText({
      title: meta.title,
      dailyDate: daily ? resolvedDateKey : undefined,
      score,
      bestStreak,
      answers,
    });
    return (
      <ResultsSummary
        title={meta.title}
        scoreText={`${score} pts`}
        subText={`${correctCount} of ${generated.rounds.length} correct · Best streak ${bestStreak}`}
        isNewBest={isNewBest}
        onPlayAgain={daily ? undefined : restartPractice}
      >
        <div className="w-full space-y-3 text-left">
          <h2 className="text-center text-lg font-semibold">Round explanations</h2>
          {generated.rounds.map((round, roundIndex) => {
            const answer = answers.find((entry) => entry.roundId === round.id);
            const odd = round.fragrances[round.answerIndex];
            return (
              <details
                key={round.id}
                className="rounded-xl border border-border bg-card px-4 py-3"
              >
                <summary className="cursor-pointer font-semibold">
                  {answer?.correct ? "✓" : "×"} Round {roundIndex + 1}: {odd.name}
                </summary>
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-background p-2">
                  <span className="flex h-14 w-12 shrink-0 items-center justify-center rounded-lg bg-white p-1 ring-1 ring-border" aria-hidden="true">
                    <FragranceBottleImage
                      key={`${odd.id}:${odd.imageUrl ?? ""}`}
                      imageUrl={odd.imageUrl}
                      alt=""
                      className="max-h-full w-auto max-w-full object-contain drop-shadow-sm"
                      placeholderClassName="h-10 w-auto text-stone-400 opacity-40"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{odd.name}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <HouseMark name={odd.house} size="xs" />
                      <span className="truncate">{odd.house}</span>
                    </span>
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{round.explanation}</p>
              </details>
            );
          })}
        </div>
        <div className="flex w-full flex-col items-center gap-2">
          <button
            type="button"
            onClick={shareResults}
            className="rounded-full border border-border bg-card px-5 py-2 font-semibold transition-colors hover:border-accent hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Share results
          </button>
          <p className="min-h-5 text-sm text-muted" role="status" aria-live="polite">
            {shareStatus}
          </p>
          {shareStatus.startsWith("Sharing is unavailable") && (
            <textarea
              readOnly
              value={shareText}
              aria-label="Shareable result summary"
              className="h-28 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm"
              onFocus={(event) => event.currentTarget.select()}
            />
          )}
        </div>
      </ResultsSummary>
    );
  }

  if (!current) return null;
  const revealed = Boolean(currentAnswer);
  const oddFragrance = current.fragrances[current.answerIndex];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5">
      <ScoreBar
        round={index}
        totalRounds={generated.rounds.length}
        score={score}
        streak={streak}
        label={`Round ${index + 1} of ${generated.rounds.length}${daily ? ` · ${resolvedDateKey} UTC` : ""}`}
      />
      <div className="text-center">
        <h2 className="text-xl font-semibold">Which fragrance does not belong?</h2>
        <p className="mt-1 text-sm text-muted">
          Three share one catalog fact. Pick the odd one out.
        </p>
      </div>

      <RoundStage roundKey={current.id} className="space-y-5">
        <div
          className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4"
          role="group"
          aria-label={`Odd One Out choices, round ${index + 1}`}
        >
          {current.fragrances.map((fragrance, cardIndex) => {
            const isOdd = fragrance.id === current.oddFragranceId;
            const isSelected = currentAnswer?.selectedId === fragrance.id;
            let style = "border-border bg-card hover:border-accent hover:bg-card-hover";
            if (revealed) {
              if (isOdd) style = "border-success bg-success-soft text-success";
              else if (isSelected) style = "border-danger bg-danger-soft text-danger";
              else style = "border-border bg-card opacity-55";
            }
            return (
              <button
                key={fragrance.id}
                ref={(node) => {
                  cardRefs.current[cardIndex] = node;
                }}
                type="button"
                data-animate="item"
                disabled={revealed}
                aria-pressed={isSelected}
                aria-label={`${fragrance.name} by ${fragrance.house}`}
                onClick={() => selectAnswer(fragrance.id)}
                onKeyDown={(event) => handleCardKeyDown(event, cardIndex)}
                className={`gsap-surface flex min-h-40 flex-col items-center justify-center rounded-2xl border-2 p-4 text-center transition-[border-color,background-color,opacity,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${style}`}
              >
                {showBottles && (
                  <span className="mb-3 flex h-24 w-full items-end justify-center sm:h-28" aria-hidden="true">
                    <FragranceBottleImage
                      imageUrl={fragrance.imageUrl}
                      alt=""
                      className="max-h-full w-auto max-w-[70%] object-contain drop-shadow-md"
                      placeholderClassName="h-20 w-auto text-muted opacity-25"
                    />
                  </span>
                )}
                <span className="flex max-w-full items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted">
                  <HouseMark name={fragrance.house} size="xs" />
                  <span className="truncate">{fragrance.house}</span>
                </span>
                <span className="mt-1 font-semibold leading-tight">{fragrance.name}</span>
                {revealed && isOdd && (
                  <span className="mt-2 rounded-full bg-success px-2 py-0.5 text-xs font-bold text-white">
                    Odd one out
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {currentAnswer && (
          <div className="space-y-2 text-center animate-reveal">
            <AnswerFeedback correct={currentAnswer.correct}>
              {currentAnswer.correct
                ? `Correct! +${currentAnswer.points} points.`
                : `Not this time. ${oddFragrance.name} is the odd one out.`}
            </AnswerFeedback>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted">
              <span className="font-semibold text-foreground">Connection:</span>{" "}
              {current.explanation}
            </p>
            <button
              type="button"
              onClick={continueGame}
              className="mt-3 rounded-full bg-accent px-6 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-black"
            >
              {index + 1 === generated.rounds.length ? "View results" : "Next round"}
            </button>
          </div>
        )}
      </RoundStage>
    </div>
  );
}

export function oddOneOutShareText({
  title,
  dailyDate,
  score,
  bestStreak,
  answers,
}: {
  title: string;
  dailyDate?: string;
  score: number;
  bestStreak: number;
  answers: readonly Pick<AnswerRecord, "correct">[];
}): string {
  const heading = `${title}${dailyDate ? ` ${dailyDate}` : ""}`;
  const grid = answers.map((answer) => (answer.correct ? "🟩" : "🟥")).join("");
  return `${heading}\n${grid}\n${score} pts · Best streak ${bestStreak}`;
}

function readDailyGame(
  storageKey: string,
  expectedSeed: string,
  roundCount: number,
): PersistedDailyGame | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PersistedDailyGame>;
    if (
      value.version !== 1 ||
      value.seed !== expectedSeed ||
      !Number.isInteger(value.index) ||
      value.index! < 0 ||
      value.index! >= roundCount ||
      !Array.isArray(value.answers)
    ) {
      return null;
    }
    return value as PersistedDailyGame;
  } catch {
    return null;
  }
}

function saveLifetimeStats(
  score: number,
  bestStreak: number,
  answers: readonly AnswerRecord[],
  dailyDate?: string,
) {
  try {
    const dailyMarker = dailyDate
      ? `${STATS_STORAGE_KEY}:recorded:${dailyDate}`
      : undefined;
    if (dailyMarker && window.localStorage.getItem(dailyMarker)) return;
    const raw = window.localStorage.getItem(STATS_STORAGE_KEY);
    const previous: OddOneOutStats = raw
      ? (JSON.parse(raw) as OddOneOutStats)
      : {
          gamesPlayed: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          bestScore: 0,
          bestStreak: 0,
        };
    const next: OddOneOutStats = {
      gamesPlayed: previous.gamesPlayed + 1,
      correctAnswers:
        previous.correctAnswers + answers.filter((answer) => answer.correct).length,
      totalAnswers: previous.totalAnswers + answers.length,
      bestScore: Math.max(previous.bestScore, score),
      bestStreak: Math.max(previous.bestStreak, bestStreak),
    };
    window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(next));
    if (dailyMarker) window.localStorage.setItem(dailyMarker, "1");
  } catch {
    // Storage denial must not block completion.
  }
}
