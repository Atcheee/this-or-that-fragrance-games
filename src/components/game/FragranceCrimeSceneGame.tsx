"use client";

import {
  Fingerprint,
  Lightbulb,
  MagnifyingGlass,
  MapPin,
  Warning,
} from "@phosphor-icons/react";
import { useId, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { FragranceSearchResultVisual } from "@/components/FragranceSearchResultVisual";
import { ResultsSummary } from "@/components/ResultsSummary";
import {
  createCrimeSceneChallenge,
  scoreCrimeScene,
} from "@/lib/engines/fragrance-crime-scene";
import {
  fragranceGuessLabel,
  resolveExactFragranceGuess,
  searchNotePyramidFragrances,
} from "@/lib/engines/note-pyramid";
import type { Fragrance } from "@/lib/types";
import { HouseMark } from "./HouseMark";
import { useSaveRecord } from "./useSaveRecord";

interface FragranceCrimeSceneGameProps {
  pool: Fragrance[];
  onPlayAgain: () => void;
}

type GameStatus = "playing" | "won" | "lost";

export function FragranceCrimeSceneGame({
  pool,
  onPlayAgain,
}: FragranceCrimeSceneGameProps) {
  const challenge = useMemo(() => createCrimeSceneChallenge(pool), [pool]);
  const listboxId = useId();
  const savedRef = useRef(false);
  const saveRecord = useSaveRecord();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<Fragrance[]>([]);
  const [revealedCount, setRevealedCount] = useState(1);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState(
    "Evidence logged. Name a suspect fragrance.",
  );
  const [listOpen, setListOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);
  const [isNewBest, setIsNewBest] = useState(false);

  const guessedIds = useMemo(
    () => new Set(guesses.map((guess) => guess.id)),
    [guesses],
  );
  const suggestions = useMemo(
    () => {
      if (query.trim().length < 2) return [];
      return searchNotePyramidFragrances(query, pool, 8).filter(
        (fragrance) => !guessedIds.has(fragrance.id),
      );
    },
    [guessedIds, pool, query],
  );
  const guessesLeft = challenge.maxGuesses - guesses.length;
  const pointsAvailable = scoreCrimeScene(revealedCount);

  function saveResult(finalScore: number) {
    if (savedRef.current) return;
    savedRef.current = true;
    setIsNewBest(
      saveRecord({
        mode: "fragrance-crime-scene",
        score: finalScore,
        total: 100,
        label: challenge.title,
      }),
    );
  }

  function selectSuggestion(fragrance: Fragrance) {
    setQuery(fragranceGuessLabel(fragrance));
    setSelectedId(fragrance.id);
    setListOpen(false);
    setActiveOption(-1);
    setMessage(`${fragrance.name} added to suspect list.`);
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
      setMessage("Choose an exact fragrance from the suspect list.");
      setListOpen(true);
      return;
    }
    if (guessedIds.has(selected.id)) {
      setMessage("That fragrance has already been cleared.");
      return;
    }

    const nextGuesses = [...guesses, selected];
    setGuesses(nextGuesses);
    setQuery("");
    setSelectedId(null);
    setListOpen(false);
    setActiveOption(-1);

    if (selected.id === challenge.fragrance.id) {
      const finalScore = scoreCrimeScene(revealedCount);
      setScore(finalScore);
      saveResult(finalScore);
      setStatus("won");
      setMessage(`Case closed: ${fragranceGuessLabel(challenge.fragrance)}.`);
      return;
    }

    if (nextGuesses.length >= challenge.maxGuesses) {
      saveResult(0);
      setStatus("lost");
      setMessage(`Case went cold. The fragrance was ${fragranceGuessLabel(challenge.fragrance)}.`);
      return;
    }

    if (revealedCount < challenge.clues.length) {
      setRevealedCount((count) => count + 1);
      setMessage(`${selected.name} is cleared. New evidence unlocked.`);
    } else {
      setMessage(`${selected.name} is cleared. Review the full evidence file.`);
    }
  }

  function revealHint() {
    if (status !== "playing") return;
    if (revealedCount >= challenge.clues.length) {
      setMessage("All evidence is already on the board.");
      return;
    }
    setRevealedCount((count) => count + 1);
    setMessage("Lab report received. Score potential reduced.");
  }

  function giveUp() {
    saveResult(0);
    setStatus("lost");
    setMessage(`Case closed by the lab: ${fragranceGuessLabel(challenge.fragrance)}.`);
  }

  if (status !== "playing") {
    return (
      <ResultsSummary
        title={status === "won" ? "Case closed" : "Case file revealed"}
        scoreText={`${score} points`}
        subText={message}
        isNewBest={isNewBest}
        onPlayAgain={onPlayAgain}
        playAgainLabel="Open another case"
      >
        <section className="grid w-full max-w-2xl gap-5 overflow-hidden rounded-3xl border border-border bg-card p-5 text-left sm:grid-cols-[11rem_1fr] sm:p-6">
          <div className="flex min-h-48 items-center justify-center rounded-2xl bg-background p-4">
            <FragranceBottleImage
              imageUrl={challenge.fragrance.imageUrl}
              alt={`${challenge.fragrance.name} by ${challenge.fragrance.house}`}
              eager
            />
          </div>
          <div className="self-center">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">
              Match confirmed · Case {challenge.caseNumber}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              {challenge.fragrance.name}
            </h2>
            <p className="mt-2 flex items-center gap-2 text-muted">
              <HouseMark name={challenge.fragrance.house} size="sm" />
              {challenge.fragrance.house}
              {challenge.fragrance.year > 0 && ` · ${challenge.fragrance.year}`}
            </p>
          </div>
        </section>

        <section className="w-full max-w-2xl text-left">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                Evidence decoded
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                How every clue fits
              </h3>
            </div>
            <Fingerprint aria-hidden size={34} className="text-accent" />
          </div>
          <ol className="grid gap-3">
            {challenge.clues.map((clue, index) => (
              <li
                key={clue.id}
                className="grid gap-2 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[2.25rem_1fr]"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft font-mono text-sm font-bold text-accent">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm leading-6 text-muted">{clue.text}</p>
                  <p className="mt-2 font-medium leading-6">
                    {clue.explanation}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </ResultsSummary>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5">
      <header className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="flex flex-col gap-5 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">
              Active case · {challenge.caseNumber}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {challenge.title}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <MapPin aria-hidden size={16} />
              {challenge.location}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:w-48">
            <CaseStat label="Guesses" value={`${guessesLeft} left`} />
            <CaseStat label="Reward" value={`${pointsAvailable} pt`} accent />
          </div>
        </div>
        <div className="bg-background/60 px-5 py-4 sm:px-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
            Incident report
          </p>
          <p className="mt-2 max-w-2xl leading-7">{challenge.briefing}</p>
        </div>
      </header>

      <section aria-labelledby="evidence-board">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
              Evidence board
            </p>
            <h2 id="evidence-board" className="mt-1 text-xl font-semibold">
              Scent trace {revealedCount} of {challenge.clues.length}
            </h2>
          </div>
          <div
            className="flex gap-1.5"
            aria-label={`${revealedCount} of ${challenge.clues.length} clues revealed`}
          >
            {challenge.clues.map((clue, index) => (
              <span
                key={clue.id}
                className={`h-2 w-7 rounded-full ${
                  index < revealedCount ? "bg-accent" : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>

        <ol className="grid gap-3">
          {challenge.clues.slice(0, revealedCount).map((clue, index) => (
            <li
              key={clue.id}
              className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 animate-card-in sm:pl-20"
            >
              <span className="mb-3 flex size-11 items-center justify-center rounded-full border border-accent/50 bg-accent-soft font-mono text-sm font-bold text-accent sm:absolute sm:left-5 sm:top-5 sm:mb-0">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
                {clue.label} · Lab transcript
              </p>
              <p className="mt-2 text-base leading-7 sm:text-lg">{clue.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="crime-scene-guess" className="font-semibold">
              Name the fragrance
            </label>
            <span className="text-xs font-medium text-muted">
              Exact catalog match required
            </span>
          </div>
          <div
            className="relative"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setListOpen(false);
              }
            }}
          >
            <MagnifyingGlass
              aria-hidden
              size={20}
              className="pointer-events-none absolute left-4 top-3.5 z-10 text-muted"
            />
            <input
              id="crime-scene-guess"
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={listOpen}
              aria-controls={listboxId}
              aria-activedescendant={
                activeOption >= 0
                  ? `${listboxId}-option-${activeOption}`
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
              className="min-h-12 w-full rounded-xl border-2 border-border bg-background py-3 pl-12 pr-4 outline-none transition-colors focus:border-accent"
            />

            {listOpen && suggestions.length > 0 && (
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Fragrance suspects"
                className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl"
              >
                {suggestions.map((fragrance, index) => (
                  <li key={fragrance.id}>
                    <button
                      id={`${listboxId}-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={activeOption === index}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectSuggestion(fragrance)}
                      className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        activeOption === index
                          ? "bg-accent-soft text-accent"
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

          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <button
              type="submit"
              disabled={!query.trim()}
              className="min-h-12 rounded-xl bg-accent px-6 py-3 font-semibold text-[#17120a] transition-[opacity,transform] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Submit suspect
            </button>
            <button
              type="button"
              onClick={revealHint}
              disabled={revealedCount >= challenge.clues.length}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 font-semibold transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Lightbulb aria-hidden size={18} />
              New evidence
            </button>
            <button
              type="button"
              onClick={giveUp}
              className="min-h-12 rounded-xl px-4 py-3 text-sm font-semibold text-muted hover:text-foreground"
            >
              Close case
            </button>
          </div>

          <p
            aria-live="polite"
            className="flex min-h-6 items-center justify-center gap-2 text-center text-sm text-muted"
          >
            <Warning aria-hidden size={16} className="shrink-0 text-accent" />
            {message}
          </p>
        </form>
      </section>

      {guesses.length > 0 && (
        <section aria-labelledby="cleared-suspects">
          <h2
            id="cleared-suspects"
            className="text-xs font-bold uppercase tracking-[0.18em] text-muted"
          >
            Cleared suspects
          </h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {guesses.map((guess) => (
              <li
                key={guess.id}
                className="rounded-xl border border-border bg-card p-3 opacity-75"
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

function CaseStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-sm font-bold ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
