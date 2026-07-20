"use client";

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { ResultsSummary } from "@/components/ResultsSummary";
import {
  bottleGuessLabel,
  createBottleSilhouetteChallenge,
  createBottleSilhouettePracticeSeed,
  createBottleSilhouetteShareText,
  resolveExactBottleGuess,
  scoreBottleSilhouette,
  searchBottleSilhouetteFragrances,
  type BottleSilhouetteChallenge,
  type BottleSilhouetteVariant,
} from "@/lib/engines/bottle-silhouette";
import { utcDateKey } from "@/lib/daily";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import { useSaveRecord } from "./useSaveRecord";

export interface BottleSilhouetteGameProps {
  meta: GameModeMeta;
  pool: Fragrance[];
  onPlayAgain?: () => void;
  variant?: BottleSilhouetteVariant;
  /** YYYY-MM-DD UTC date. Useful for deterministic previews and tests. */
  dateKey?: string;
}

type GameStatus = "playing" | "won" | "lost";
type ShareStatus = "idle" | "copied" | "shared" | "unavailable";

interface GeneratedChallenge {
  challenge: BottleSilhouetteChallenge | null;
  error: string | null;
}

const BOTTLE_FILTERS = [
  "brightness(0) contrast(2)",
  "brightness(0) contrast(2)",
  "grayscale(1) blur(22px) brightness(0.72)",
  "blur(14px) saturate(1.35) brightness(0.9)",
  "blur(6px) saturate(1.05)",
  "blur(2.5px)",
  "none",
] as const;

export function BottleSilhouetteGame({
  meta,
  pool,
  onPlayAgain,
  variant = "practice",
  dateKey,
}: BottleSilhouetteGameProps) {
  const [defaultDateKey] = useState(() => utcDateKey());
  const [practiceSeed, setPracticeSeed] = useState(() =>
    createBottleSilhouettePracticeSeed(),
  );
  const resolvedDateKey = dateKey?.slice(0, 10) ?? defaultDateKey;
  const generated = useMemo<GeneratedChallenge>(() => {
    try {
      return {
        challenge: createBottleSilhouetteChallenge(pool, {
          variant,
          dateKey: resolvedDateKey,
          seed: practiceSeed,
        }),
        error: null,
      };
    } catch (error) {
      return {
        challenge: null,
        error:
          error instanceof Error
            ? error.message
            : "Could not prepare a bottle challenge.",
      };
    }
  }, [pool, practiceSeed, resolvedDateKey, variant]);

  const [stageIndex, setStageIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<Fragrance[]>([]);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState(
    "Identify the fragrance from its bottle outline.",
  );
  const [listOpen, setListOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);
  const [isNewBest, setIsNewBest] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);
  const saveRecord = useSaveRecord();

  const guessedIds = useMemo(
    () => new Set(guesses.map((guess) => guess.id)),
    [guesses],
  );
  const suggestions = useMemo(
    () =>
      searchBottleSilhouetteFragrances(query, pool, 8).filter(
        (fragrance) => !guessedIds.has(fragrance.id),
      ),
    [guessedIds, pool, query],
  );

  const challenge = generated.challenge;
  const finalStageIndex = challenge ? challenge.stages.length - 1 : 0;
  const currentStage = challenge?.stages[stageIndex];

  function selectSuggestion(fragrance: Fragrance) {
    setQuery(bottleGuessLabel(fragrance));
    setSelectedId(fragrance.id);
    setListOpen(false);
    setActiveOption(-1);
    setMessage(`${fragrance.name} selected.`);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setListOpen(false);
      setActiveOption(-1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setListOpen(true);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveOption((current) => {
        if (suggestions.length === 0) return -1;
        return (current + direction + suggestions.length) % suggestions.length;
      });
      return;
    }
    if (event.key === "Enter" && listOpen && activeOption >= 0) {
      const suggestion = suggestions[activeOption];
      if (suggestion) {
        event.preventDefault();
        selectSuggestion(suggestion);
      }
    }
  }

  function saveFinishedRound(
    won: boolean,
    finalScore: number,
    attempts: number,
    revealIndex: number,
  ) {
    if (!challenge || savedRef.current) return;
    savedRef.current = true;
    const modeLabel = challenge.dateKey
      ? `daily:${challenge.dateKey}`
      : "practice";
    setIsNewBest(
      saveRecord({
        mode: meta.id,
        score: finalScore,
        total: 100,
        label: `${modeLabel} · ${won ? "solved" : "revealed"} · ${attempts} attempt${attempts === 1 ? "" : "s"} · stage ${revealIndex + 1}`,
      }),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || status !== "playing") return;

    const selected = selectedId
      ? pool.find((fragrance) => fragrance.id === selectedId) ?? null
      : resolveExactBottleGuess(query, pool);
    if (!selected) {
      setMessage("Choose an exact fragrance from the suggestions.");
      setListOpen(true);
      return;
    }
    if (guessedIds.has(selected.id)) {
      setMessage("You already guessed that fragrance. Try another.");
      return;
    }

    const nextGuesses = [...guesses, selected];
    setGuesses(nextGuesses);
    setQuery("");
    setSelectedId(null);
    setListOpen(false);
    setActiveOption(-1);

    if (selected.id === challenge.fragrance.id) {
      const earned = scoreBottleSilhouette(stageIndex);
      setScore(earned);
      setStatus("won");
      setMessage(`Correct. It was ${bottleGuessLabel(challenge.fragrance)}.`);
      saveFinishedRound(true, earned, nextGuesses.length, stageIndex);
      return;
    }

    const nextStageIndex = Math.min(stageIndex + 1, finalStageIndex);
    setStageIndex(nextStageIndex);
    if (nextStageIndex === finalStageIndex) {
      setStatus("lost");
      setMessage(`Round over. It was ${bottleGuessLabel(challenge.fragrance)}.`);
      saveFinishedRound(false, 0, nextGuesses.length, nextStageIndex);
      return;
    }

    const nextStage = challenge.stages[nextStageIndex]!;
    setMessage(
      `${bottleGuessLabel(selected)} is not the answer. ${nextStage.label} unlocked.`,
    );
    focusInputSoon();
  }

  function revealHint() {
    if (!challenge || status !== "playing") return;
    const nextStageIndex = Math.min(stageIndex + 1, finalStageIndex);
    setStageIndex(nextStageIndex);
    setQuery("");
    setSelectedId(null);
    setListOpen(false);
    setActiveOption(-1);

    if (nextStageIndex === finalStageIndex) {
      setStatus("lost");
      setMessage(`No clues remain. It was ${bottleGuessLabel(challenge.fragrance)}.`);
      saveFinishedRound(false, 0, guesses.length, nextStageIndex);
      return;
    }

    setMessage(`${challenge.stages[nextStageIndex]!.label} unlocked.`);
    focusInputSoon();
  }

  function giveUp() {
    if (!challenge || status !== "playing") return;
    setStageIndex(finalStageIndex);
    setScore(0);
    setStatus("lost");
    setMessage(`Round over. It was ${bottleGuessLabel(challenge.fragrance)}.`);
    saveFinishedRound(false, 0, guesses.length, finalStageIndex);
  }

  function focusInputSoon() {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function restartRound() {
    if (onPlayAgain) {
      onPlayAgain();
      return;
    }
    if (variant === "practice") {
      setPracticeSeed(createBottleSilhouettePracticeSeed());
    }
    setStageIndex(0);
    setQuery("");
    setSelectedId(null);
    setGuesses([]);
    setStatus("playing");
    setScore(0);
    setMessage("Identify the fragrance from its bottle outline.");
    setListOpen(false);
    setActiveOption(-1);
    setIsNewBest(false);
    setShareStatus("idle");
    savedRef.current = false;
  }

  async function shareResult() {
    if (!challenge || status === "playing") return;
    const text = createBottleSilhouetteShareText({
      challenge,
      won: status === "won",
      stageIndex,
      attempts: guesses.length,
      score,
    });

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: meta.title, text });
        setShareStatus("shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setShareStatus("copied");
    } catch {
      setShareStatus("unavailable");
    }
  }

  if (generated.error || !challenge || !currentStage) {
    return (
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-danger bg-danger-soft p-6 text-center">
        <h2 className="text-lg font-semibold text-danger">Puzzle unavailable</h2>
        <p className="mt-2 text-sm text-muted">
          {generated.error ?? "Could not prepare a bottle challenge."}
        </p>
        {onPlayAgain ? (
          <button
            type="button"
            onClick={onPlayAgain}
            className="mt-5 rounded-full bg-accent px-5 py-2 font-semibold text-white dark:text-black"
          >
            Try another pool
          </button>
        ) : null}
      </div>
    );
  }

  if (status !== "playing") {
    const shareText = createBottleSilhouetteShareText({
      challenge,
      won: status === "won",
      stageIndex,
      attempts: guesses.length,
      score,
    });
    return (
      <ResultsSummary
        title={status === "won" ? "Bottle identified" : "Bottle revealed"}
        scoreText={`${score} points`}
        subText={message}
        isNewBest={isNewBest}
        onPlayAgain={restartRound}
        playAgainLabel={variant === "daily" ? "Play daily again" : "Another bottle"}
      >
        <section
          aria-labelledby="bottle-result-title"
          className="grid w-full max-w-xl gap-5 rounded-2xl border border-border bg-card p-5 text-left sm:grid-cols-[11rem_1fr]"
        >
          <div className="flex min-h-52 items-center justify-center rounded-xl bg-white p-4">
            <FragranceBottleImage
              imageUrl={challenge.fragrance.imageUrl}
              alt={`${challenge.fragrance.name} by ${challenge.fragrance.house}`}
              eager
              className="max-h-52 w-auto max-w-full object-contain drop-shadow-md"
            />
          </div>
          <div className="self-center">
            <h2 id="bottle-result-title" className="text-2xl font-bold tracking-tight">
              {challenge.fragrance.name}
            </h2>
            <p className="text-muted">{challenge.fragrance.house}</p>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <ResultStat label="Attempts" value={String(guesses.length)} />
              <ResultStat
                label="Reveal"
                value={`${stageIndex + 1}/${challenge.stages.length}`}
              />
              <ResultStat label="Score" value={String(score)} />
            </dl>
          </div>
        </section>

        {guesses.length > 0 ? (
          <section className="w-full max-w-xl text-left" aria-labelledby="bottle-result-guesses">
            <h3
              id="bottle-result-guesses"
              className="text-xs font-semibold uppercase tracking-widest text-muted"
            >
              Attempts
            </h3>
            <ol className="mt-2 flex flex-wrap gap-2">
              {guesses.map((guess) => (
                <li
                  key={guess.id}
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    guess.id === challenge.fragrance.id
                      ? "bg-success-soft text-success"
                      : "bg-danger-soft text-danger"
                  }`}
                >
                  {guess.name} <span className="opacity-70">· {guess.house}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <div className="flex w-full max-w-xl flex-col items-center gap-2">
          <button
            type="button"
            onClick={shareResult}
            className="rounded-full border border-border bg-card px-5 py-2.5 font-semibold transition-colors hover:border-accent hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {shareStatus === "copied"
              ? "Result copied"
              : shareStatus === "shared"
                ? "Result shared"
                : "Share result"}
          </button>
          <p className="min-h-5 text-sm text-muted" role="status" aria-live="polite">
            {shareStatus === "unavailable"
              ? "Sharing unavailable. Select and copy the summary below."
              : ""}
          </p>
          {shareStatus === "unavailable" ? (
            <textarea
              readOnly
              value={shareText}
              aria-label="Shareable result summary"
              className="h-24 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm"
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : null}
        </div>
      </ResultsSummary>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5">
      <header className="flex items-center justify-between gap-3 text-sm text-muted">
        <p>
          Reveal <strong className="text-foreground">{stageIndex + 1}</strong> of{" "}
          {challenge.stages.length}
        </p>
        <p>
          <strong className="text-foreground">{guesses.length}</strong>{" "}
          {guesses.length === 1 ? "attempt" : "attempts"}
        </p>
        <p>
          Up to <strong className="text-accent">{currentStage.points}</strong> pts
        </p>
      </header>

      <div className="h-2 overflow-hidden rounded-full bg-border" aria-hidden="true">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${((stageIndex + 1) / challenge.stages.length) * 100}%` }}
        />
      </div>

      <section className="text-center" aria-labelledby="bottle-question">
        <h2 id="bottle-question" className="text-xl font-semibold">
          Which fragrance is this?
        </h2>
        <p className="mt-1 text-sm text-muted">
          {currentStage.label} · {currentStage.description}
        </p>
        <BottleVisual
          key={`${challenge.id}:${stageIndex}`}
          fragrance={challenge.fragrance}
          stageIndex={stageIndex}
          stageLabel={currentStage.label}
        />
        {currentStage.id === "brand" ? (
          <p className="mt-3 inline-flex rounded-full border border-accent bg-accent-soft px-4 py-1.5 text-sm font-semibold text-accent animate-reveal">
            House: {challenge.fragrance.house}
          </p>
        ) : null}
      </section>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div
          className="relative"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setListOpen(false);
          }}
        >
          <label htmlFor="bottle-silhouette-guess" className="sr-only">
            Search for a fragrance
          </label>
          <input
            ref={inputRef}
            id="bottle-silhouette-guess"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls="bottle-silhouette-suggestions"
            aria-activedescendant={
              activeOption >= 0
                ? `bottle-silhouette-option-${activeOption}`
                : undefined
            }
            autoComplete="off"
            autoFocus
            value={query}
            onFocus={() => setListOpen(true)}
            onKeyDown={handleInputKeyDown}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedId(null);
              setListOpen(true);
              setActiveOption(-1);
            }}
            placeholder="Search fragrance or house…"
            className="w-full rounded-xl border-2 border-border bg-card px-4 py-3 outline-none transition-colors focus:border-accent"
          />

          {listOpen && suggestions.length > 0 ? (
            <ul
              id="bottle-silhouette-suggestions"
              role="listbox"
              aria-label="Fragrance suggestions"
              className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl"
            >
              {suggestions.map((fragrance, index) => (
                <li key={fragrance.id}>
                  <button
                    id={`bottle-silhouette-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={activeOption === index}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSuggestion(fragrance)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      activeOption === index
                        ? "bg-accent-soft text-accent"
                        : "hover:bg-card-hover"
                    }`}
                  >
                    <span className="font-semibold">{fragrance.name}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {fragrance.house}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
          <button
            type="submit"
            disabled={!query.trim()}
            className="col-span-2 rounded-xl bg-accent px-5 py-3 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99] dark:text-black sm:col-span-1"
          >
            Submit guess
          </button>
          <button
            type="button"
            onClick={revealHint}
            className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:border-accent hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Reveal hint
          </button>
          <button
            type="button"
            onClick={giveUp}
            className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Give up
          </button>
        </div>
        <p aria-live="polite" className="min-h-5 text-center text-sm text-muted">
          {message}
        </p>
      </form>

      {guesses.length > 0 ? (
        <section aria-labelledby="bottle-previous-guesses">
          <h3
            id="bottle-previous-guesses"
            className="text-xs font-semibold uppercase tracking-widest text-muted"
          >
            Previous attempts
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {guesses.map((guess) => (
              <li
                key={guess.id}
                className="rounded-full bg-danger-soft px-3 py-1 text-sm font-medium text-danger"
              >
                {guess.name} <span className="opacity-70">· {guess.house}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function BottleVisual({
  fragrance,
  stageIndex,
  stageLabel,
}: {
  fragrance: Fragrance;
  stageIndex: number;
  stageLabel: string;
}) {
  const filter = BOTTLE_FILTERS[stageIndex] ?? BOTTLE_FILTERS.at(-1)!;
  const labelShield = stageIndex === 4 || stageIndex === 5;
  const imageClassName =
    "max-h-full w-auto max-w-full object-contain transition-[filter,opacity] duration-500";

  return (
    <div
      role="img"
      aria-label={`Obscured fragrance bottle. ${stageLabel}, reveal ${stageIndex + 1} of 7.`}
      className="relative mx-auto mt-4 aspect-[4/5] w-full max-w-72 overflow-hidden rounded-3xl border border-border bg-white shadow-sm animate-reveal"
    >
      <div
        className="absolute inset-0 flex items-center justify-center p-6"
        style={{ filter } as CSSProperties}
        aria-hidden="true"
      >
        <FragranceBottleImage
          imageUrl={fragrance.imageUrl}
          alt=""
          eager
          className={imageClassName}
          placeholderClassName="h-32 w-auto text-black"
        />
      </div>

      {stageIndex === 1 ? (
        <div
          className="absolute inset-0 flex items-center justify-center p-6"
          style={
            {
              clipPath: "inset(0 0 67% 0)",
              filter: "grayscale(1) blur(4px) brightness(0.62) contrast(1.2)",
            } as CSSProperties
          }
          aria-hidden="true"
        >
          <FragranceBottleImage
            imageUrl={fragrance.imageUrl}
            alt=""
            eager
            className={imageClassName}
            placeholderClassName="h-32 w-auto text-black"
          />
        </div>
      ) : null}

      {labelShield ? (
        <div
          aria-hidden="true"
          className="absolute left-[18%] right-[18%] top-[45%] h-[23%] rounded-xl border border-white/50 bg-white/65 shadow-sm backdrop-blur-xl"
        />
      ) : null}

      {stageIndex === 0 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/5 bg-gradient-to-t from-white to-transparent"
        />
      ) : null}
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background p-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-bold text-foreground">{value}</dd>
    </div>
  );
}
