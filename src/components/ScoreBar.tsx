"use client";

import { useRef } from "react";
import {
  animateProgress,
  animateScoreBump,
  animateStreakIn,
  useGSAP,
} from "@/lib/animations";

interface ScoreBarProps {
  round: number;
  totalRounds: number;
  score: number;
  streak: number;
  label?: string;
}

export function ScoreBar({ round, totalRounds, score, streak, label }: ScoreBarProps) {
  const progress = totalRounds > 0 ? round / totalRounds : 0;
  const scoreRef = useRef<HTMLSpanElement>(null);
  const streakRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const prevScore = useRef(score);
  const prevStreak = useRef(streak);

  useGSAP(
    () => {
      animateProgress(fillRef.current, progress);
    },
    { dependencies: [progress] },
  );

  useGSAP(
    () => {
      if (score === prevScore.current) return;
      prevScore.current = score;
      animateScoreBump(scoreRef.current);
    },
    { dependencies: [score] },
  );

  useGSAP(
    () => {
      if (streak === prevStreak.current || streak < 3) {
        prevStreak.current = streak;
        return;
      }
      prevStreak.current = streak;
      animateStreakIn(streakRef.current);
    },
    { dependencies: [streak] },
  );

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-muted">
          {label ?? `Round ${Math.min(round + 1, totalRounds)} of ${totalRounds}`}
        </span>
        <span className="flex items-center gap-3">
          {streak >= 3 && (
            <span ref={streakRef} className="gsap-surface font-semibold text-accent">
              {streak} streak
            </span>
          )}
          <span ref={scoreRef} className="gsap-surface inline-block font-semibold">
            {score} <span className="font-normal text-muted">pts</span>
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          ref={fillRef}
          className="gsap-surface h-full w-full origin-left rounded-full bg-accent"
          style={{ transform: "scaleX(0)" }}
        />
      </div>
    </div>
  );
}
