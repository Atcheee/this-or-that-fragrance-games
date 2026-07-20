"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import {
  generateDescriptionRounds,
  generateWhichHouseRounds,
} from "@/lib/engines/multiple-choice";
import { allHouses } from "@/lib/data-source";
import { FragranceCard } from "@/components/FragranceCard";
import { ScoreBar } from "@/components/ScoreBar";
import { ResultsSummary } from "@/components/ResultsSummary";
import { animateCorrect, animateRevealOptions, gsap } from "@/lib/animations";
import { AnswerFeedback } from "./AnswerFeedback";
import { HouseMark } from "./HouseMark";
import { RoundStage } from "./RoundStage";
import { useSaveRecord } from "./useSaveRecord";

const REVEAL_MS = 2000;

interface MultipleChoiceGameProps {
  meta: GameModeMeta;
  pool: Fragrance[];
  rounds: number;
  onPlayAgain: () => void;
}

export function MultipleChoiceGame({
  meta,
  pool,
  rounds,
  onPlayAgain,
}: MultipleChoiceGameProps) {
  const isDescription = meta.id === "guess-description";
  const gameRounds = useMemo(
    () =>
      isDescription
        ? generateDescriptionRounds(pool, rounds)
        : generateWhichHouseRounds(pool, rounds, allHouses()),
    [pool, rounds, isDescription],
  );

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const saveRecord = useSaveRecord();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const revealTlRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);

  useEffect(
    () => () => {
      clearTimeout(timeoutRef.current);
      revealTlRef.current?.kill();
    },
    [],
  );

  const current = gameRounds[index];

  function handlePick(optionIndex: number) {
    if (picked !== null || !current) return;
    setPicked(optionIndex);
    const correct = optionIndex === current.answerIndex;
    if (correct) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
      animateCorrect(optionRefs.current[optionIndex]);
    } else {
      setStreak(0);
      revealTlRef.current?.kill();
      revealTlRef.current =
        animateRevealOptions(
          optionRefs.current[optionIndex],
          optionRefs.current[current.answerIndex],
        ) ?? null;
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
        setPicked(null);
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

  const revealed = picked !== null;
  const wasCorrect = picked === current.answerIndex;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6">
      <ScoreBar round={index} totalRounds={gameRounds.length} score={score} streak={streak} />
      <h2 className="text-center text-xl font-semibold">
        {isDescription ? "Which fragrance is this?" : "Which house makes it?"}
      </h2>

      <RoundStage roundKey={index} className="space-y-6">
        {isDescription ? (
          <blockquote
            data-animate="item"
            className="rounded-2xl border-2 border-border bg-card p-6 text-center text-lg leading-relaxed italic"
          >
            “{current.promptText}”
          </blockquote>
        ) : (
          <FragranceCard fragrance={current.fragrance} hideHouse={!revealed} />
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {current.options.map((option, i) => {
            let styles = "border-border bg-card hover:border-accent";
            if (revealed) {
              if (i === current.answerIndex) {
                styles = "border-success bg-success-soft text-success";
              } else if (i === picked) {
                styles = "border-danger bg-danger-soft text-danger";
              } else {
                styles = "border-border bg-card opacity-50";
              }
            }
            return (
              <button
                key={`${index}-${i}`}
                ref={(node) => {
                  optionRefs.current[i] = node;
                }}
                data-animate="item"
                onClick={() => handlePick(i)}
                disabled={revealed}
                className={`gsap-surface rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-[border-color,background-color,opacity,color] duration-200 ${styles} ${
                  !revealed ? "cursor-pointer hover:border-accent hover:shadow-md" : ""
                } ${
                  isDescription
                    ? ""
                    : "flex flex-col items-center justify-center gap-2 py-4"
                }`}
              >
                {!isDescription && <HouseMark name={option} />}
                {option}
              </button>
            );
          })}
        </div>
      </RoundStage>

      {revealed && (
        <AnswerFeedback correct={wasCorrect}>
          {wasCorrect ? "Correct!" : <>It was {current.options[current.answerIndex]}.</>}
        </AnswerFeedback>
      )}
    </div>
  );
}
