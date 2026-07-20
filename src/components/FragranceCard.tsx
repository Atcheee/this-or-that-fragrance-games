"use client";

import { useRef } from "react";
import type { Fragrance } from "@/lib/types";
import { animateCorrect, animateWrong, useGSAP } from "@/lib/animations";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";

export type CardState = "idle" | "correct" | "wrong" | "dimmed";

interface FragranceCardProps {
  fragrance: Fragrance;
  onClick?: () => void;
  disabled?: boolean;
  state?: CardState;
  /** Revealed detail line, e.g. a rating or price, shown after answering */
  detail?: React.ReactNode;
  showPyramid?: boolean;
  hideIdentity?: boolean;
  hideHouse?: boolean;
  className?: string;
}

const STATE_CLASSES: Record<CardState, string> = {
  idle: "border-border bg-card",
  correct: "border-success bg-success-soft",
  wrong: "border-danger bg-danger-soft",
  dimmed: "border-border bg-card opacity-50",
};

export function FragranceCard({
  fragrance,
  onClick,
  disabled,
  state = "idle",
  detail,
  showPyramid,
  hideIdentity,
  hideHouse,
  className = "",
}: FragranceCardProps) {
  const interactive = onClick && !disabled;
  const cardRef = useRef<HTMLElement | null>(null);
  // Hide bottles when identity/house is concealed — distinctive bottles spoil the quiz.
  const revealBottle = !hideIdentity && !hideHouse;
  const candidateKey = `${fragrance.id}:${fragrance.imageUrl ?? ""}`;

  // useGSAP cleans up tweens on unmount / dependency change
  useGSAP(
    () => {
      if (state === "correct") animateCorrect(cardRef.current);
      if (state === "wrong") animateWrong(cardRef.current);
    },
    { dependencies: [state] },
  );

  // No CSS transform hover/active — those fight GSAP's transform matrix
  const sharedClassName = `gsap-surface flex w-full flex-col items-center gap-1 rounded-2xl border-2 p-5 text-center transition-[border-color,background-color,opacity,box-shadow] duration-200 sm:p-6 ${
    STATE_CLASSES[state]
  } ${
    interactive
      ? "cursor-pointer hover:border-accent hover:bg-card-hover hover:shadow-md"
      : ""
  } ${className}`;

  const body = (
    <>
      {revealBottle ? (
        <div className="mb-3 flex h-36 w-full items-end justify-center sm:h-44">
          <FragranceBottleImage
            key={candidateKey}
            imageUrl={fragrance.imageUrl}
            alt=""
            className="max-h-full w-auto max-w-[70%] object-contain drop-shadow-md"
          />
        </div>
      ) : null}
      <span className="text-xs font-medium uppercase tracking-widest text-muted">
        {hideIdentity || hideHouse ? "? ? ?" : fragrance.house}
      </span>
      <span className="text-xl font-semibold tracking-tight sm:text-2xl">
        {hideIdentity ? "Mystery Fragrance" : fragrance.name}
      </span>
      {!hideIdentity && fragrance.year > 0 && (
        <span className="text-sm text-muted">{fragrance.year}</span>
      )}
      {detail && (
        <div className="mt-2 text-lg font-semibold animate-reveal">{detail}</div>
      )}
      {showPyramid && (
        <div className="mt-3 space-y-1 text-xs text-muted animate-reveal">
          <PyramidRow label="Top" notes={fragrance.topNotes} />
          <PyramidRow label="Heart" notes={fragrance.heartNotes} />
          <PyramidRow label="Base" notes={fragrance.baseNotes} />
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        ref={(node) => {
          cardRef.current = node;
        }}
        type="button"
        data-animate="item"
        onClick={onClick}
        disabled={disabled}
        className={sharedClassName}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      ref={(node) => {
        cardRef.current = node;
      }}
      data-animate="item"
      className={sharedClassName}
    >
      {body}
    </div>
  );
}

function PyramidRow({ label, notes }: { label: string; notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <p>
      <span className="font-semibold">{label}:</span> {notes.join(", ")}
    </p>
  );
}
