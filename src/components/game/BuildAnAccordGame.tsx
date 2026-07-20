"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import { NoteImage } from "@/components/NoteImage";
import { ResultsSummary } from "@/components/ResultsSummary";
import {
  createBuildAnAccordRounds,
  createBuildAnAccordShare,
  scoreBuildAnAccord,
  type AccordNoteOption,
  type BuildAnAccordRound,
  type BuildAnAccordScore,
  type BuildAnAccordVariant,
} from "@/lib/engines/build-an-accord";
import { utcDateKey } from "@/lib/daily";
import type { GameModeMeta } from "@/lib/types";
import { useSaveRecord } from "./useSaveRecord";

export interface BuildAnAccordGameProps {
  meta: GameModeMeta;
  onPlayAgain: () => void;
  variant?: BuildAnAccordVariant;
  rounds?: number;
}

interface CompletedRound {
  round: BuildAnAccordRound;
  selectedIds: string[];
  score: BuildAnAccordScore;
}

export function BuildAnAccordGame({
  meta,
  onPlayAgain,
  variant = "practice",
  rounds = 5,
}: BuildAnAccordGameProps) {
  const [challengeDateKey] = useState(utcDateKey);
  const [gameRounds] = useState(() =>
    createBuildAnAccordRounds({
      variant,
      rounds,
      date: new Date(`${challengeDateKey}T00:00:00.000Z`),
    }),
  );
  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submittedScore, setSubmittedScore] = useState<BuildAnAccordScore | null>(null);
  const [completedRounds, setCompletedRounds] = useState<CompletedRound[]>([]);
  const [finished, setFinished] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const saveRecord = useSaveRecord();
  const currentRound = gameRounds[roundIndex];

  function toggleNote(id: string) {
    if (!currentRound || submittedScore) return;
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((candidate) => candidate !== id);
      if (current.length >= currentRound.profile.selectionLimit) return current;
      return [...current, id];
    });
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!currentRound || submittedScore || event.altKey || event.ctrlKey || event.metaKey) return;
    const optionIndex = Number(event.key) - 1;
    const option = currentRound.options[optionIndex];
    if (!Number.isInteger(optionIndex) || !option) return;
    event.preventDefault();
    toggleNote(option.id);
  }

  function submitAccord() {
    if (!currentRound || submittedScore || selectedIds.length !== currentRound.profile.selectionLimit) return;
    const score = scoreBuildAnAccord(currentRound.profile, selectedIds);
    setSubmittedScore(score);
    setCompletedRounds((current) => [
      ...current,
      { round: currentRound, selectedIds: [...selectedIds], score },
    ]);
  }

  function advanceRound() {
    if (!submittedScore) return;
    if (roundIndex + 1 < gameRounds.length) {
      setRoundIndex((current) => current + 1);
      setSelectedIds([]);
      setSubmittedScore(null);
      return;
    }

    const totalPercentage = completedRounds.reduce(
      (total, completed) => total + completed.score.percentage,
      0,
    );
    setIsNewBest(
      saveRecord({
        mode: meta.id,
        score: totalPercentage,
        total: completedRounds.length * 100,
        label:
          variant === "daily" ? `daily:${challengeDateKey}` : "practice",
      }),
    );
    setFinished(true);
  }

  async function shareResult() {
    const text = createBuildAnAccordShare({
      percentages: completedRounds.map((completed) => completed.score.percentage),
      variant,
    });
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus("Result copied.");
    } catch {
      setShareStatus("Copy unavailable. Select the result below.");
    }
  }

  if (finished) {
    const percentages = completedRounds.map((completed) => completed.score.percentage);
    const average = percentages.length
      ? Math.round(percentages.reduce((total, score) => total + score, 0) / percentages.length)
      : 0;
    const shareText = createBuildAnAccordShare({ percentages, variant });
    return (
      <ResultsSummary
        title={variant === "daily" ? `${meta.title} daily` : meta.title}
        scoreText={`${average}%`}
        subText={`${completedRounds.length} accords composed · ${gradeLabel(average)}`}
        isNewBest={isNewBest}
        onPlayAgain={onPlayAgain}
        playAgainLabel={variant === "daily" ? "Replay today’s set" : "Build new accords"}
      >
        <section className="w-full text-left" aria-labelledby="accord-recap-title">
          <h2 id="accord-recap-title" className="text-center text-sm font-bold uppercase tracking-widest text-muted">
            Composition recap
          </h2>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {completedRounds.map((completed) => {
              const selectedNotes = completed.selectedIds
                .map((id) => completed.round.profile.notes.find((note) => note.id === id))
                .filter((note): note is AccordNoteOption => Boolean(note));
              return (
                <li key={completed.round.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{completed.round.profile.name}</p>
                    <p className="font-bold tabular-nums text-accent">{completed.score.percentage}%</p>
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label="Selected notes">
                    {selectedNotes.map((note) => (
                      <li key={note.id} className="flex items-center gap-1.5 rounded-full bg-background py-1 pl-1 pr-2 text-xs font-medium">
                        <NoteImage name={note.label} className="h-7 w-7 rounded-full" />
                        {note.label}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted">
                    {completed.score.strong.length} strong · {completed.score.weak.length} conflicting
                  </p>
                </li>
              );
            })}
          </ol>
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
            <textarea
              readOnly
              value={shareText}
              aria-label="Share result"
              className="h-24 w-72 max-w-full rounded-xl border border-border bg-card p-3 text-sm"
            />
          ) : null}
        </div>
      </ResultsSummary>
    );
  }

  if (!currentRound) return null;

  const limit = currentRound.profile.selectionLimit;
  const slotsRemaining = Math.max(0, limit - selectedIds.length);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">
        <p className="text-muted">
          Round {roundIndex + 1} of {gameRounds.length}
          {variant === "daily" ? " · Daily set" : " · Practice"}
        </p>
        <p className="tabular-nums" aria-live="polite">
          {selectedIds.length} / {limit} notes
        </p>
      </header>

      <section className="rounded-3xl border border-border bg-card p-5 text-center shadow-sm sm:p-7" aria-labelledby="accord-target">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Target accord</p>
        <h2 id="accord-target" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {currentRound.profile.name}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          {currentRound.profile.brief}
        </p>
      </section>

      <section aria-labelledby="accord-notes-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 id="accord-notes-title" className="font-bold">Choose exactly {limit} notes</h3>
            <p className="text-sm text-muted">Balance structure and character across the pyramid. Keys 1–8 also select notes.</p>
          </div>
          {!submittedScore ? (
            <p className="text-sm font-medium text-muted">
              {slotsRemaining ? `${slotsRemaining} ${slotsRemaining === 1 ? "slot" : "slots"} left` : "Ready to submit"}
            </p>
          ) : null}
        </div>

        <div
          className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
          onKeyDown={handleGridKeyDown}
        >
          {currentRound.options.map((option, index) => {
            const selected = selectedIds.includes(option.id);
            const disabled = Boolean(submittedScore) || (!selected && selectedIds.length >= limit);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => toggleNote(option.id)}
                className={`min-h-36 rounded-2xl border p-3 text-left transition-[border-color,background-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed ${
                  selected
                    ? "border-accent bg-accent-soft shadow-sm"
                    : "border-border bg-card hover:border-accent hover:bg-card-hover disabled:opacity-50"
                }`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold leading-tight">{option.label}</span>
                  <span aria-hidden="true" className="text-xs text-muted">{index + 1}</span>
                </span>
                <NoteImage
                  name={option.label}
                  className="mx-auto mt-3 h-14 w-14 rounded-xl"
                />
                <span className="mt-2 block text-xs capitalize text-muted">{option.layer} note</span>
              </button>
            );
          })}
        </div>
      </section>

      {!submittedScore ? (
        <button
          type="button"
          onClick={submitAccord}
          disabled={selectedIds.length !== limit}
          className="mx-auto rounded-full bg-accent px-8 py-3 font-semibold text-white transition-[opacity,transform] hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:text-black"
        >
          Submit accord
        </button>
      ) : (
        <RoundFeedback
          round={currentRound}
          score={submittedScore}
          onContinue={advanceRound}
          finalRound={roundIndex + 1 === gameRounds.length}
        />
      )}
    </div>
  );
}

function RoundFeedback({
  round,
  score,
  onContinue,
  finalRound,
}: {
  round: BuildAnAccordRound;
  score: BuildAnAccordScore;
  onContinue: () => void;
  finalRound: boolean;
}) {
  const ideal = round.profile.idealNoteIds
    .map((id) => round.profile.notes.find((candidate) => candidate.id === id))
    .filter((note): note is AccordNoteOption => Boolean(note));
  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-7" aria-labelledby="accord-feedback-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Round result</p>
          <h3 id="accord-feedback-title" className="mt-1 text-xl font-bold">{score.summary}</h3>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums text-accent">{score.percentage}%</p>
          <p className="text-xs text-muted">
            {score.relevancePoints} relevance + {score.balanceBonus} balance
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <FeedbackGroup title="Strong selections" notes={score.strong} tone="strong" empty="No defining notes selected yet." />
        <FeedbackGroup title="Weak selections" notes={score.weak} tone="weak" empty="No conflicting notes — well controlled." />
        {score.neutral.length ? (
          <FeedbackGroup title="Neutral selections" notes={score.neutral} tone="neutral" empty="" />
        ) : null}
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-sm font-bold">Suggested combination</p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {ideal.map((note) => (
              <li key={note.id} className="flex items-center gap-2 text-sm font-medium">
                <NoteImage name={note.label} className="h-9 w-9 rounded-lg" />
                <span>{note.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-accent-soft p-4">
        <p className="text-sm font-bold text-accent">How this accord works</p>
        <p className="mt-1 text-sm leading-6">{round.profile.explanation}</p>
      </div>

      <button
        type="button"
        onClick={onContinue}
        autoFocus
        className="mx-auto mt-5 block rounded-full bg-accent px-8 py-3 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:text-black"
      >
        {finalRound ? "See final results" : "Next accord"}
      </button>
    </section>
  );
}

function FeedbackGroup({
  title,
  notes,
  tone,
  empty,
}: {
  title: string;
  notes: readonly AccordNoteOption[];
  tone: "strong" | "weak" | "neutral";
  empty: string;
}) {
  const styles =
    tone === "strong"
      ? "border-success bg-success-soft"
      : tone === "weak"
        ? "border-danger bg-danger-soft"
        : "border-border bg-background";
  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <p className="text-sm font-bold">{title}</p>
      {notes.length ? (
        <ul className="mt-2 space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="flex items-start gap-2 text-sm">
              <NoteImage name={note.label} className="h-9 w-9 rounded-lg" />
              <span className="min-w-0">
                <span className="font-semibold">{note.label}</span>
                <span className="text-muted"> — {note.insight}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}

function gradeLabel(average: number): string {
  if (average >= 90) return "Master perfumer instincts";
  if (average >= 70) return "Well-balanced compositions";
  if (average >= 45) return "Promising accord knowledge";
  return "Keep training your nose";
}
