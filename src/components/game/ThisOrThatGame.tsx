"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import { generatePairRounds } from "@/lib/engines/this-or-that";
import { FragranceCard, type CardState } from "@/components/FragranceCard";
import { ScoreBar } from "@/components/ScoreBar";
import { ResultsSummary } from "@/components/ResultsSummary";
import { AnswerFeedback } from "./AnswerFeedback";
import { RoundStage } from "./RoundStage";
import { useSaveRecord } from "./useSaveRecord";

const REVEAL_MS = 1700;

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
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

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
    timeoutRef.current = setTimeout(() => {
      if (index + 1 >= gameRounds.length) {
        const finalScore = correct ? score + 1 : score;
        setIsNewBest(
          saveRecord({ mode: meta.id, score: finalScore, total: gameRounds.length }),
        );
        setDone(true);
      } else {
        setIndex((i) => i + 1);
        setPickedId(null);
      }
    }, REVEAL_MS);
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
  const question = isPrice
    ? "Which one costs more?"
    : "Which one is rated higher?";

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
        <AnswerFeedback correct={wasCorrect}>
          {wasCorrect ? "Correct!" : "Not quite."}
        </AnswerFeedback>
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
