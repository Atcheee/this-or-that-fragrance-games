"use client";

import { useEffect, useRef, useState } from "react";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import {
  createHouseChallenge,
  createNoteChallenge,
  matchGuess,
  type NamingChallenge,
} from "@/lib/engines/naming";
import { popularFragrances } from "@/lib/data-source";
import { Timer } from "@/components/Timer";
import { ResultsSummary } from "@/components/ResultsSummary";
import { animateChipIn, animateFlash, useGSAP } from "@/lib/animations";
import { useSaveRecord } from "./useSaveRecord";

interface NamingGameProps {
  meta: GameModeMeta;
  duration: number;
  onPlayAgain: () => void;
}

export function NamingGame({ meta, duration, onPlayAgain }: NamingGameProps) {
  const [challenge] = useState<NamingChallenge>(() =>
    meta.id === "name-by-house"
      ? createHouseChallenge(popularFragrances)
      : createNoteChallenge(popularFragrances),
  );
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [input, setInput] = useState("");
  const [found, setFound] = useState<Fragrance[]>([]);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  const [done, setDone] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const saveRecord = useSaveRecord();
  const savedRef = useRef(false);
  const foundRef = useRef<Fragrance[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const latestChipRef = useRef<HTMLSpanElement | null>(null);

  foundRef.current = found;

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) finish(foundRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  useGSAP(
    () => {
      if (found.length === 0) return;
      animateChipIn(latestChipRef.current);
    },
    { dependencies: [found.length] },
  );

  function finish(finalFound: Fragrance[]) {
    if (savedRef.current) return;
    savedRef.current = true;
    setIsNewBest(
      saveRecord({
        mode: meta.id,
        score: finalFound.length,
        total: challenge.answers.length,
        label: challenge.subject,
      }),
    );
    setDone(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (done || !input.trim()) return;
    const remaining = challenge.answers.filter(
      (f) => !found.some((x) => x.id === f.id),
    );
    const match = matchGuess(input, remaining);
    if (match) {
      const nextFound = [...found, match];
      setFound(nextFound);
      setFlash("hit");
      animateFlash(formRef.current, "hit");
      if (nextFound.length === challenge.answers.length) {
        finish(nextFound);
      }
    } else {
      setFlash("miss");
      animateFlash(inputRef.current, "miss");
    }
    setInput("");
    setTimeout(() => setFlash(null), 500);
    inputRef.current?.focus();
  }

  const subjectLabel =
    challenge.kind === "house"
      ? `fragrances by ${challenge.subject}`
      : `fragrances with the note ${challenge.subject}`;

  if (done) {
    const missed = challenge.answers.filter(
      (f) => !found.some((x) => x.id === f.id),
    );
    return (
      <ResultsSummary
        title={`You named ${subjectLabel}`}
        scoreText={`${found.length} / ${challenge.answers.length}`}
        subText={
          missed.length === 0
            ? "You found them all!"
            : "Here's what you missed:"
        }
        isNewBest={isNewBest}
        onPlayAgain={onPlayAgain}
      >
        {missed.length > 0 && (
          <ul className="flex max-w-lg flex-wrap justify-center gap-2 text-sm" data-animate="result">
            {missed.map((f) => (
              <li
                key={f.id}
                className="rounded-full border border-border bg-card px-3 py-1"
              >
                {f.name}{" "}
                {challenge.kind === "note" && (
                  <span className="text-muted">({f.house})</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </ResultsSummary>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">
          Found{" "}
          <span className="font-bold text-foreground">{found.length}</span> of{" "}
          {challenge.answers.length}
        </p>
        <Timer secondsLeft={secondsLeft} totalSeconds={duration} />
      </div>

      <div className="rounded-2xl border-2 border-border bg-card p-6 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-muted">
          Name {challenge.kind === "house" ? "fragrances by" : "fragrances containing"}
        </p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-accent">
          {challenge.subject}
        </p>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          placeholder="Type a fragrance name…"
          className={`flex-1 rounded-xl border-2 bg-card px-4 py-3 outline-none transition-colors focus:border-accent ${
            flash === "hit"
              ? "border-success"
              : flash === "miss"
                ? "border-danger"
                : "border-border"
          }`}
        />
        <button
          type="submit"
          className="rounded-xl bg-accent px-5 font-semibold text-white transition-opacity hover:opacity-90 active:scale-95 dark:text-black"
        >
          Guess
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {found.map((f, i) => (
          <span
            key={f.id}
            ref={i === found.length - 1 ? latestChipRef : undefined}
            className="gsap-surface rounded-full bg-success-soft px-3 py-1 text-sm font-medium text-success"
          >
            {f.name}
          </span>
        ))}
      </div>

      <button
        onClick={() => finish(found)}
        className="mx-auto text-sm text-muted underline hover:text-foreground"
      >
        Give up
      </button>
    </div>
  );
}
