"use client";

import { useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import { FragranceSearchResultVisual } from "@/components/FragranceSearchResultVisual";
import {
  createNotePyramidChallenge,
  createNotePyramidShareText,
  fragranceGuessLabel,
  resolveExactFragranceGuess,
  scoreNotePyramid,
  searchNotePyramidFragrances,
  type NotePyramidClueKind,
  type NotePyramidVariant,
} from "@/lib/engines/note-pyramid";
import { NoteImage } from "@/components/NoteImage";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { PerfumePyramid } from "@/components/PerfumePyramid";
import { ResultsSummary } from "@/components/ResultsSummary";
import { AccordBadge } from "./SubjectBadge";
import { HouseMark } from "./HouseMark";
import { useSaveRecord } from "./useSaveRecord";

export interface NotePyramidGameProps {
  meta: GameModeMeta;
  pool: Fragrance[];
  onPlayAgain: () => void;
  variant?: NotePyramidVariant;
  date?: Date;
  maxGuesses?: number;
}

type GameStatus = "playing" | "won" | "lost";

export function NotePyramidGame({
  meta,
  pool,
  onPlayAgain,
  variant = "practice",
  date,
  maxGuesses,
}: NotePyramidGameProps) {
  const dateKey = date?.toISOString().slice(0, 10);
  const challenge = useMemo(
    () =>
      createNotePyramidChallenge(pool, {
        variant,
        date: dateKey ? new Date(`${dateKey}T00:00:00.000Z`) : undefined,
        maxGuesses,
      }),
    [pool, variant, dateKey, maxGuesses],
  );
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<Fragrance[]>([]);
  const [revealedCount, setRevealedCount] = useState(1);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("Start with the first clue.");
  const [listOpen, setListOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared">("idle");
  const [isNewBest, setIsNewBest] = useState(false);
  const savedRef = useRef(false);
  const saveRecord = useSaveRecord();

  const guessedIds = useMemo(() => new Set(guesses.map((guess) => guess.id)), [guesses]);
  const suggestions = useMemo(
    () =>
      searchNotePyramidFragrances(query, pool, 8).filter(
        (fragrance) => !guessedIds.has(fragrance.id),
      ),
    [query, pool, guessedIds],
  );
  const guessesLeft = challenge.maxGuesses - guesses.length;

  function saveResult(finalScore: number) {
    if (savedRef.current) return;
    savedRef.current = true;
    setIsNewBest(
      saveRecord({
        mode: "note-pyramid",
        score: finalScore,
        total: 100,
        label:
          variant === "daily" && challenge.dateKey
            ? `daily:${challenge.dateKey}`
            : "practice",
      }),
    );
  }

  function selectSuggestion(fragrance: Fragrance) {
    setQuery(fragranceGuessLabel(fragrance));
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "playing") return;

    const selected = selectedId
      ? pool.find((fragrance) => fragrance.id === selectedId) ?? null
      : resolveExactFragranceGuess(query, pool);

    if (!selected) {
      setMessage("Choose an exact fragrance from the suggestions.");
      setListOpen(true);
      return;
    }
    if (guessedIds.has(selected.id)) {
      setMessage("You already guessed that fragrance.");
      return;
    }

    const nextGuesses = [...guesses, selected];
    setGuesses(nextGuesses);
    setQuery("");
    setSelectedId(null);
    setListOpen(false);
    setActiveOption(-1);

    if (selected.id === challenge.fragrance.id) {
      const finalScore = scoreNotePyramid(revealedCount);
      setScore(finalScore);
      saveResult(finalScore);
      setStatus("won");
      setMessage(`Correct. It was ${fragranceGuessLabel(challenge.fragrance)}.`);
      return;
    }

    const outOfGuesses = nextGuesses.length >= challenge.maxGuesses;
    const allCluesUsed = revealedCount >= challenge.clues.length;
    if (outOfGuesses || allCluesUsed) {
      saveResult(0);
      setStatus("lost");
      setMessage(`Round over. It was ${fragranceGuessLabel(challenge.fragrance)}.`);
      return;
    }

    setRevealedCount((count) => Math.min(count + 1, challenge.clues.length));
    setMessage(`${fragranceGuessLabel(selected)} is not the answer. New clue revealed.`);
  }

  function giveUp() {
    saveResult(0);
    setStatus("lost");
    setMessage(`Round over. It was ${fragranceGuessLabel(challenge.fragrance)}.`);
  }

  async function shareResult() {
    const text = createNotePyramidShareText({
      challenge,
      won: status === "won",
      cluesUsed: revealedCount,
      guesses: guesses.length,
      score,
    });

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: meta.title, text });
        setShareState("shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setShareState("copied");
    } catch {
      setShareState("idle");
      setMessage("Sharing is unavailable in this browser.");
    }
  }

  if (status !== "playing") {
    return (
      <ResultsSummary
        title={status === "won" ? "Note Pyramid solved" : "Note Pyramid revealed"}
        scoreText={`${score} points`}
        subText={message}
        isNewBest={isNewBest}
        onPlayAgain={onPlayAgain}
        playAgainLabel={variant === "daily" ? "Replay today’s puzzle" : "Play again"}
      >
        <div className="grid w-full max-w-xl gap-6 rounded-2xl border border-border bg-card p-5 text-left sm:grid-cols-[10rem_1fr]">
          <div className="flex min-h-44 items-center justify-center rounded-xl bg-background p-3">
            <FragranceBottleImage
              imageUrl={challenge.fragrance.imageUrl}
              alt={`${challenge.fragrance.name} by ${challenge.fragrance.house}`}
              eager
            />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight">{challenge.fragrance.name}</p>
            <p className="mt-1 flex items-center gap-2 text-muted">
              <HouseMark name={challenge.fragrance.house} size="sm" />
              {challenge.fragrance.house}
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <ResultStat label="Clues" value={`${revealedCount}/${challenge.clues.length}`} />
              <ResultStat label="Guesses" value={String(guesses.length)} />
              <ResultStat label="Score" value={String(score)} />
            </dl>
          </div>
        </div>

        <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-5">
          <PerfumePyramid
            topNotes={challenge.fragrance.topNotes}
            heartNotes={challenge.fragrance.heartNotes}
            baseNotes={challenge.fragrance.baseNotes}
          />
        </div>

        <button
          type="button"
          onClick={shareResult}
          className="rounded-full border border-accent bg-accent-soft px-6 py-2.5 font-semibold text-accent transition-opacity hover:opacity-80 active:scale-95"
        >
          {shareState === "copied"
            ? "Result copied"
            : shareState === "shared"
              ? "Result shared"
              : "Share result"}
        </button>
      </ResultsSummary>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5">
      <div className="flex items-center justify-between gap-3 text-sm text-muted">
        <p>
          Clue <strong className="text-foreground">{revealedCount}</strong> of {challenge.clues.length}
        </p>
        <p>
          <strong className="text-foreground">{guessesLeft}</strong> guesses left
        </p>
        <p>
          Up to <strong className="text-accent">{scoreNotePyramid(revealedCount)}</strong> pts
        </p>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-border" aria-hidden="true">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${(revealedCount / challenge.clues.length) * 100}%` }}
        />
      </div>

      <section aria-labelledby="note-pyramid-clues" className="space-y-3">
        <h2 id="note-pyramid-clues" className="text-center text-xl font-semibold">
          Which fragrance has this pyramid?
        </h2>
        <ol className="space-y-3">
          {challenge.clues.slice(0, revealedCount).map((clue, index) => (
            <li
              key={clue.kind}
              className="rounded-2xl border border-border bg-card p-4 animate-card-in"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                    {clue.label}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {clue.values.map((value) => (
                      <li key={value}>
                        <ClueValue kind={clue.kind} value={value} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div
          className="relative"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setListOpen(false);
          }}
        >
          <label htmlFor="note-pyramid-guess" className="sr-only">
            Search for a fragrance
          </label>
          <input
            id="note-pyramid-guess"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls="note-pyramid-suggestions"
            aria-activedescendant={
              activeOption >= 0 ? `note-pyramid-option-${activeOption}` : undefined
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

          {listOpen && suggestions.length > 0 && (
            <ul
              id="note-pyramid-suggestions"
              role="listbox"
              aria-label="Fragrance suggestions"
              className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl"
            >
              {suggestions.map((fragrance, index) => (
                <li key={fragrance.id}>
                  <button
                    id={`note-pyramid-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={activeOption === index}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSuggestion(fragrance)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      activeOption === index ? "bg-accent-soft text-accent" : "hover:bg-card-hover"
                    }`}
                  >
                    <FragranceSearchResultVisual fragrance={fragrance} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!query.trim()}
            className="flex-1 rounded-xl bg-accent px-5 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99] dark:text-black"
          >
            Submit guess
          </button>
          <button
            type="button"
            onClick={giveUp}
            className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-muted hover:text-foreground"
          >
            Give up
          </button>
        </div>
        <p aria-live="polite" className="min-h-5 text-center text-sm text-muted">
          {message}
        </p>
      </form>

      {guesses.length > 0 && (
        <section aria-labelledby="note-pyramid-guesses">
          <h3
            id="note-pyramid-guesses"
            className="text-xs font-semibold uppercase tracking-widest text-muted"
          >
            Previous guesses
          </h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {guesses.map((guess) => (
              <li
                key={guess.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-danger bg-danger-soft p-2 text-danger"
              >
                <FragranceSearchResultVisual fragrance={guess} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ClueValue({ kind, value }: { kind: NotePyramidClueKind; value: string }) {
  if (kind === "accords") return <AccordBadge name={value} compact />;

  if (kind === "house") {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-background py-1 pl-1 pr-3 text-sm font-medium">
        <HouseMark name={value} size="sm" />
        {value}
      </span>
    );
  }

  if (kind === "year") {
    return (
      <span className="inline-flex min-h-9 items-center rounded-full border border-border bg-background px-3 text-sm font-medium tabular-nums">
        {value}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-background py-1 pl-1 pr-3 text-sm font-medium">
      <NoteImage name={value} className="h-9 w-9 rounded-lg" />
      {value}
    </span>
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
