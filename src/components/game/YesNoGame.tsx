"use client";

import { useMemo, useState } from "react";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import { allNotes } from "@/lib/types";
import { generateYesNoRounds } from "@/lib/engines/yes-no";
import { accordVocabulary, noteVocabulary } from "@/lib/data-source";
import { FragranceCard } from "@/components/FragranceCard";
import { ScoreBar } from "@/components/ScoreBar";
import { ResultsSummary } from "@/components/ResultsSummary";
import { RoundStage } from "./RoundStage";
import { AccordBadge, NoteBadge } from "./SubjectBadge";
import {
  AnswerReveal,
  YesNoRevealContent,
  continueLabel,
} from "./AnswerReveal";
import { useSaveRecord } from "./useSaveRecord";
import { useAppStore } from "@/lib/store";
import { fragranceToTasteFragrance } from "@/lib/taste-passport";

interface YesNoGameProps {
  meta: GameModeMeta;
  pool: Fragrance[];
  rounds: number;
  onPlayAgain: () => void;
}

export function YesNoGame({ meta, pool, rounds, onPlayAgain }: YesNoGameProps) {
  const isNote = meta.id === "contains-note";
  const gameRounds = useMemo(() => {
    const extract = isNote ? allNotes : (f: Fragrance) => f.accords;
    // Vocabulary comes from the pool itself so decoys stay plausible even
    // when the pool was fetched from the API.
    const vocab = isNote ? noteVocabulary(pool) : accordVocabulary(pool);
    return generateYesNoRounds(pool, rounds, extract, vocab);
  }, [pool, rounds, isNote]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const saveRecord = useSaveRecord();
  const recordTasteEvent = useAppStore((state) => state.recordTasteEvent);

  const current = gameRounds[index];

  function handleAnswer(guess: boolean) {
    if (answered !== null || !current) return;
    setAnswered(guess);
    const correct = guess === current.answer;
    recordTasteEvent({
      type: "guess",
      gameMode: meta.id,
      primary: fragranceToTasteFragrance(current.fragrance),
      correct,
      feature: {
        kind: isNote ? "note" : "accord",
        value: current.subject,
      },
    });
    if (correct) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
  }

  function continueGame() {
    if (answered === null) return;
    if (index + 1 >= gameRounds.length) {
      setIsNewBest(
        saveRecord({ mode: meta.id, score, total: gameRounds.length }),
      );
      setDone(true);
    } else {
      setIndex((i) => i + 1);
      setAnswered(null);
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

  const revealed = answered !== null;
  const wasCorrect = answered === current.answer;
  const isLast = index + 1 >= gameRounds.length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
      <ScoreBar round={index} totalRounds={gameRounds.length} score={score} streak={streak} />
      <h2 className="text-center text-xl font-semibold leading-relaxed">
        {isNote ? "Does it contain the note" : "Does it have the main accord"}{" "}
        {isNote ? (
          <NoteBadge name={current.subject} />
        ) : (
          <AccordBadge name={current.subject} />
        )}
        ?
      </h2>
      <RoundStage roundKey={index}>
        <FragranceCard
          key={index}
          fragrance={current.fragrance}
          state={revealed ? (wasCorrect ? "correct" : "wrong") : "idle"}
        />
      </RoundStage>
      {revealed ? (
        <AnswerReveal
          correct={wasCorrect}
          status={
            wasCorrect ? (
              "Correct!"
            ) : (
              <>Wrong — the answer was {current.answer ? "Yes" : "No"}.</>
            )
          }
          continueLabel={continueLabel(isLast)}
          onContinue={continueGame}
        >
          <YesNoRevealContent
            fragrance={current.fragrance}
            subject={current.subject}
            answer={current.answer}
            isNote={isNote}
          />
        </AnswerReveal>
      ) : (
        <div className="flex justify-center gap-4">
          <button
            onClick={() => handleAnswer(true)}
            className="w-32 rounded-full bg-success-soft py-3 text-lg font-bold text-success transition-[box-shadow,filter] hover:shadow-md hover:brightness-95"
          >
            Yes
          </button>
          <button
            onClick={() => handleAnswer(false)}
            className="w-32 rounded-full bg-danger-soft py-3 text-lg font-bold text-danger transition-[box-shadow,filter] hover:shadow-md hover:brightness-95"
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}
