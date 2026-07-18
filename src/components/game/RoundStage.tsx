"use client";

import { useRef, type ReactNode } from "react";
import { animateRoundIn, useGSAP } from "@/lib/animations";

interface RoundStageProps {
  roundKey: string | number;
  children: ReactNode;
  className?: string;
}

/**
 * Staggers children marked with data-animate="item" on each roundKey change.
 * Avoids remounting the root (keeps layout stable); GSAP context reverts on update.
 */
export function RoundStage({ roundKey, children, className = "" }: RoundStageProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      animateRoundIn(rootRef.current);
    },
    { dependencies: [roundKey], scope: rootRef, revertOnUpdate: true },
  );

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
