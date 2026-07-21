"use client";

import { useMemo, useState } from "react";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import { generatePairRounds } from "@/lib/engines/this-or-that";
import { FragranceCard, type CardState } from "@/components/FragranceCard";
import { ScoreBar } from "@/components/ScoreBar";
import { ResultsSummary } from "@/components/ResultsSummary";
import { RoundStage } from "./RoundStage";
import {
  AnswerReveal,
  ThisOrThatRevealContent,
  continueLabel,
} from "./AnswerReveal";
import { useSaveRecord } from "./useSaveRecord";

interface ThisOrThatGameProps {
  meta: GameModeMeta;
  pool: Fragrance[];
  rounds: number;
  onPlayAgain: () => void;
}

export function ThisOrThatGame({ meta, pool, rounds, onPlayAgain }: ThisOrThatGameProps) {
  const isPrice = meta.id === "cost-more";
  const value = useMemo(
    () => (isPrice ? (f: Fragrance) => f.price : (f: Fragrance) => f.rating),
    [isPrice],
  );
  const gameRounds = useMemo(
    () => generatePairRounds(pool, rounds, value),
    [pool, rounds, value],
  );

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const saveRecord = useSaveRecord();

  const current = gameRounds[index];

  function handlePick(id: string) {
    if (pickedId || !current) return;
    setPickedId(id);
    const correct = id === current.correctId;
    if (correct) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
  }

  function continueGame() {
    if (!pickedId) return;
    if (index + 1 >= gameRounds.length) {
      setIsNewBest(
        saveRecord({ mode: meta.id, score, total: gameRounds.length }),
      );
      setDone(true);
    } else {
      setIndex((i) => i + 1);
      setPickedId(null);
    }
  }

  if (done) {
    return (
      <ResultsSummary
        title={meta.title}
        scoreText={`${score} / ${gameRounds.length}`}
        subText={
          score === gameRounds.length
            ? "Perfect game!"
            : `You got ${Math.round((score / gameRounds.length) * 100)}% right.`
        }
        isNewBest={isNewBest}
        onPlayAgain={onPlayAgain}
      />
    );
  }

  if (!current) return null;

  const revealed = pickedId !== null;
  const wasCorrect = pickedId === current.correctId;
  const previous = index > 0 ? gameRounds[index - 1] : null;
  const championId = previous?.correctId ?? null;
  const question = isPrice
    ? "Which one costs more?"
    : "Which one is rated higher?";
  const isLast = index + 1 >= gameRounds.length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <ScoreBar round={index} totalRounds={gameRounds.length} score={score} streak={streak} />
      <h2 className="text-center text-xl font-semibold">{question}</h2>
      <RoundStage
        roundKey={index}
        className="grid flex-1 grid-cols-1 content-start gap-4 sm:grid-cols-2"
      >
        {[current.a, current.b].map((f) => (
          <FragranceCard
            key={f.id}
            fragrance={f}
            onClick={() => handlePick(f.id)}
            disabled={revealed}
            animateIn={championId !== f.id}
            state={cardState(f.id, current.correctId, pickedId)}
            detail={
              revealed ? (
                isPrice ? (
                  <span>${f.price}</span>
                ) : (
                  <span>★ {f.rating.toFixed(1)}</span>
                )
              ) : undefined
            }
          />
        ))}
      </RoundStage>
      {revealed && (
        <AnswerReveal
          correct={wasCorrect}
          status={wasCorrect ? "Correct!" : "Not quite."}
          continueLabel={continueLabel(isLast)}
          onContinue={continueGame}
        >
          <ThisOrThatRevealContent
            a={current.a}
            b={current.b}
            correctId={current.correctId}
            isPrice={isPrice}
          />
        </AnswerReveal>
      )}
    </div>
  );
}

function cardState(
  id: string,
  correctId: string,
  pickedId: string | null,
): CardState {
  if (!pickedId) return "idle";
  if (id === correctId) return "correct";
  if (id === pickedId) return "wrong";
  return "dimmed";
}
