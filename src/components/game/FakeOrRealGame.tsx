"use client";

import Link from "next/link";
import { useState } from "react";
import { ScoreBar } from "@/components/ScoreBar";
import { ResultsSummary } from "@/components/ResultsSummary";
import type { FakeOrRealRound } from "@/lib/engines/fake-or-real";
import type { GameModeMeta } from "@/lib/types";
import { AnswerReveal, continueLabel } from "./AnswerReveal";
import { RoundStage } from "./RoundStage";
import { useSaveRecord } from "./useSaveRecord";

interface FakeOrRealGameProps {
  meta: GameModeMeta;
  gameRounds: FakeOrRealRound[];
  onPlayAgain: () => void;
}

export function FakeOrRealGame({
  meta,
  gameRounds,
  onPlayAgain,
}: FakeOrRealGameProps) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const saveRecord = useSaveRecord();
  const current = gameRounds[index];

  function handleAnswer(guessIsReal: boolean) {
    if (answer !== null || !current) return;
    setAnswer(guessIsReal);
    if (guessIsReal === current.isReal) {
      const nextStreak = streak + 1;
      setScore((value) => value + 1);
      setStreak(nextStreak);
      setBestStreak((value) => Math.max(value, nextStreak));
    } else {
      setStreak(0);
    }
  }

  function continueGame() {
    if (answer === null) return;
    if (index + 1 >= gameRounds.length) {
      setIsNewBest(
        saveRecord({ mode: meta.id, score, total: gameRounds.length }),
      );
      setDone(true);
      return;
    }
    setIndex((value) => value + 1);
    setAnswer(null);
  }

  if (done) {
    return (
      <ResultsSummary
        title={meta.title}
        scoreText={`${score} / ${gameRounds.length}`}
        subText={
          score === gameRounds.length
            ? `Perfect read. ${bestStreak}-answer streak.`
            : `${Math.round((score / gameRounds.length) * 100)}% correct · best streak ${bestStreak}.`
        }
        isNewBest={isNewBest}
        onPlayAgain={onPlayAgain}
      />
    );
  }

  if (!current) return null;

  const revealed = answer !== null;
  const wasCorrect = answer === current.isReal;
  const isLast = index + 1 >= gameRounds.length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <ScoreBar
        round={index}
        totalRounds={gameRounds.length}
        score={score}
        streak={streak}
      />

      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Catalog entry or convincing fiction?
        </p>
        <h2 className="mt-2 text-xl font-semibold">
          Is this fragrance fake or real?
        </h2>
      </div>

      <RoundStage roundKey={index}>
        <ConceptCard concept={current} revealed={revealed} />
      </RoundStage>

      {revealed ? (
        <AnswerReveal
          correct={wasCorrect}
          status={
            wasCorrect
              ? `Correct — it is ${current.isReal ? "real" : "fake"}.`
              : `Not this time — it is ${current.isReal ? "real" : "fake"}.`
          }
          continueLabel={continueLabel(isLast)}
          onContinue={continueGame}
        >
          <div className="mx-auto max-w-xl space-y-4 text-center">
            <div
              className={`mx-auto w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${
                current.isReal
                  ? "bg-success-soft text-success"
                  : "bg-danger-soft text-danger"
              }`}
            >
              {current.isReal ? "Real catalog entry" : "Invented concept"}
            </div>
            <p className="text-sm leading-6 text-muted">
              {current.explanation}
            </p>
            {current.isReal && current.realSlug && (
              <Link
                href={`/fragrance/${current.realSlug}`}
                className="inline-flex rounded-full border border-accent px-5 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft"
              >
                View {current.name}
              </Link>
            )}
          </div>
        </AnswerReveal>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:mx-auto sm:w-[22rem]">
          <button
            type="button"
            onClick={() => handleAnswer(false)}
            className="min-h-14 rounded-2xl border-2 border-danger/50 bg-danger-soft px-5 text-lg font-bold text-danger transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-danger"
          >
            Fake
          </button>
          <button
            type="button"
            onClick={() => handleAnswer(true)}
            className="min-h-14 rounded-2xl border-2 border-success/50 bg-success-soft px-5 text-lg font-bold text-success transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-success"
          >
            Real
          </button>
        </div>
      )}
    </div>
  );
}

function ConceptCard({
  concept,
  revealed,
}: {
  concept: FakeOrRealRound;
  revealed: boolean;
}) {
  const tiers = [
    { label: "Top", notes: concept.topNotes },
    { label: "Heart", notes: concept.heartNotes },
    { label: "Base", notes: concept.baseNotes },
  ];

  return (
    <article
      className={`rounded-3xl border-2 bg-card px-5 py-7 shadow-sm transition-colors sm:px-9 sm:py-9 ${
        revealed
          ? concept.isReal
            ? "border-success/60"
            : "border-danger/60"
          : "border-border"
      }`}
    >
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {concept.house}
        </p>
        <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {concept.name}
        </h3>
        {concept.year > 0 && (
          <p className="mt-1 text-sm tabular-nums text-muted">{concept.year}</p>
        )}
      </header>

      <blockquote className="mx-auto mt-6 max-w-2xl text-center text-sm leading-7 text-muted sm:text-base">
        “{concept.description}”
      </blockquote>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {concept.accords.slice(0, 5).map((accord) => (
          <span
            key={accord}
            className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium capitalize"
          >
            {accord}
          </span>
        ))}
      </div>

      <div className="mt-7 grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
        {tiers.map((tier) => (
          <div key={tier.label} className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              {tier.label} notes
            </p>
            <p className="mt-2 text-sm leading-6">
              {tier.notes.slice(0, 5).join(" · ")}
              {tier.notes.length > 5 ? ` · +${tier.notes.length - 5}` : ""}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
