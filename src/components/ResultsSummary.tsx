"use client";

import Link from "next/link";
import { useRef } from "react";
import { animateResultsIn, useGSAP } from "@/lib/animations";

interface ResultsSummaryProps {
  title: string;
  scoreText: string;
  subText?: string;
  isNewBest?: boolean;
  onPlayAgain?: () => void;
  playAgainLabel?: string;
  children?: React.ReactNode;
}

export function ResultsSummary({
  title,
  scoreText,
  subText,
  isNewBest,
  onPlayAgain,
  playAgainLabel = "Play again",
  children,
}: ResultsSummaryProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      animateResultsIn(rootRef.current);
    },
    { scope: rootRef },
  );

  return (
    <div
      ref={rootRef}
      className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 py-8 text-center"
    >
      <div data-animate="result">
        <p className="text-sm font-medium uppercase tracking-widest text-muted">
          {title}
        </p>
        <p className="mt-2 text-5xl font-bold tracking-tight">{scoreText}</p>
        {subText && <p className="mt-2 text-muted">{subText}</p>}
        {isNewBest && (
          <p className="mt-2 inline-block rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent animate-best">
            New personal best!
          </p>
        )}
      </div>
      {children}
      <div className="flex gap-3" data-animate="result">
        {onPlayAgain && (
          <button
            onClick={onPlayAgain}
            className="rounded-full bg-accent px-6 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 active:scale-95 dark:text-black"
          >
            {playAgainLabel}
          </button>
        )}
        <Link
          href="/"
          className="rounded-full border border-border bg-card px-6 py-2.5 font-semibold transition-colors hover:bg-card-hover active:scale-95"
        >
          All games
        </Link>
      </div>
    </div>
  );
}
