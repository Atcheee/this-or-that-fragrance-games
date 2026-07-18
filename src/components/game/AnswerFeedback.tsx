"use client";

import { useRef, type ReactNode } from "react";
import { animateFeedbackIn, useGSAP } from "@/lib/animations";

interface AnswerFeedbackProps {
  correct: boolean;
  children: ReactNode;
}

export function AnswerFeedback({ correct, children }: AnswerFeedbackProps) {
  const ref = useRef<HTMLParagraphElement>(null);

  useGSAP(
    () => {
      animateFeedbackIn(ref.current);
    },
    { scope: ref },
  );

  return (
    <p
      ref={ref}
      className={`gsap-surface text-center text-lg font-semibold ${
        correct ? "text-success" : "text-danger"
      }`}
      role="status"
      aria-live="polite"
    >
      {children}
    </p>
  );
}
