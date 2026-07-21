"use client";

import { useRef, type ReactNode } from "react";
import type { Fragrance } from "@/lib/types";
import { allNotes } from "@/lib/types";
import { animateFeedbackIn, useGSAP } from "@/lib/animations";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { PerfumePyramid } from "@/components/PerfumePyramid";
import { AccordBars } from "@/components/AccordBars";
import { AccordBadge, NoteBadge } from "./SubjectBadge";
import { HouseMark } from "./HouseMark";

interface AnswerRevealProps {
  correct: boolean;
  status: ReactNode;
  continueLabel: string;
  onContinue: () => void;
  children: ReactNode;
}

/** Post-answer panel: status, rich explain content, then Continue. */
export function AnswerReveal({
  correct,
  status,
  continueLabel,
  onContinue,
  children,
}: AnswerRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      animateFeedbackIn(ref.current);
    },
    { scope: ref },
  );

  return (
    <div
      ref={ref}
      className="gsap-surface space-y-4 rounded-2xl border-2 border-border bg-card p-4 sm:p-5"
      role="region"
      aria-label="Answer details"
    >
      <p
        className={`text-center text-lg font-semibold ${
          correct ? "text-success" : "text-danger"
        }`}
        role="status"
        aria-live="polite"
      >
        {status}
      </p>
      <div className="space-y-4 border-t border-border pt-4">{children}</div>
      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-full bg-accent px-6 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-black"
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}

export function continueLabel(isLast: boolean): string {
  return isLast ? "View results" : "Next round";
}

export function shortDescription(text: string, max = 240): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function notesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function noteTier(
  fragrance: Fragrance,
  note: string,
): "top" | "heart" | "base" | null {
  if (fragrance.topNotes.some((n) => notesMatch(n, note))) return "top";
  if (fragrance.heartNotes.some((n) => notesMatch(n, note))) return "heart";
  if (fragrance.baseNotes.some((n) => notesMatch(n, note))) return "base";
  return null;
}

const TIER_LABEL: Record<"top" | "heart" | "base", string> = {
  top: "top notes",
  heart: "heart notes",
  base: "base notes",
};

interface YesNoRevealProps {
  fragrance: Fragrance;
  subject: string;
  answer: boolean;
  isNote: boolean;
}

export function YesNoRevealContent({
  fragrance,
  subject,
  answer,
  isNote,
}: YesNoRevealProps) {
  const tier = isNote ? noteTier(fragrance, subject) : null;
  const description = shortDescription(fragrance.description);
  const subjectPresent =
    answer &&
    (isNote
      ? allNotes(fragrance).some((n) => notesMatch(n, subject))
      : fragrance.accords.some((a) => notesMatch(a, subject)));

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 text-center">
        {isNote ? <NoteBadge name={subject} /> : <AccordBadge name={subject} />}
        <p className="max-w-md text-sm leading-relaxed text-muted">
          {isNote
            ? subjectPresent && tier
              ? `${subject} is in the ${TIER_LABEL[tier]} of ${fragrance.name}.`
              : `${fragrance.name} does not list ${subject} among its notes.`
            : subjectPresent
              ? `${subject} is one of the main accords of ${fragrance.name}.`
              : `${fragrance.name} is not built around a ${subject} accord.`}
        </p>
      </div>

      {isNote ? (
        <PerfumePyramid
          topNotes={fragrance.topNotes}
          heartNotes={fragrance.heartNotes}
          baseNotes={fragrance.baseNotes}
          highlight={subject}
        />
      ) : (
        <div className="mx-auto max-w-sm">
          <AccordBars accords={fragrance.accords} />
        </div>
      )}

      {description && (
        <p className="mx-auto max-w-lg text-center text-sm leading-relaxed text-muted">
          {description}
        </p>
      )}
    </div>
  );
}

interface ThisOrThatRevealProps {
  a: Fragrance;
  b: Fragrance;
  correctId: string;
  isPrice: boolean;
}

export function ThisOrThatRevealContent({
  a,
  b,
  correctId,
  isPrice,
}: ThisOrThatRevealProps) {
  const winner = a.id === correctId ? a : b;
  const loser = a.id === correctId ? b : a;
  const winValue = isPrice ? winner.price : winner.rating;
  const loseValue = isPrice ? loser.price : loser.rating;
  const delta = Math.abs(winValue - loseValue);

  return (
    <div className="space-y-5">
      <p className="text-center text-sm leading-relaxed text-muted">
        {isPrice ? (
          <>
            <span className="font-semibold text-foreground">{winner.name}</span>{" "}
            costs ${winner.price} — ${delta} more than {loser.name} (${loser.price}).
          </>
        ) : (
          <>
            <span className="font-semibold text-foreground">{winner.name}</span>{" "}
            rates ★ {winner.rating.toFixed(1)}
            {delta > 0.05
              ? ` — ${delta.toFixed(1)} points above ${loser.name} (★ ${loser.rating.toFixed(1)}).`
              : ` — just ahead of ${loser.name} (★ ${loser.rating.toFixed(1)}).`}
          </>
        )}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CompareSide fragrance={a} isWinner={a.id === correctId} isPrice={isPrice} />
        <CompareSide fragrance={b} isWinner={b.id === correctId} isPrice={isPrice} />
      </div>
    </div>
  );
}

function CompareSide({
  fragrance,
  isWinner,
  isPrice,
}: {
  fragrance: Fragrance;
  isWinner: boolean;
  isPrice: boolean;
}) {
  const description = shortDescription(fragrance.description, 160);

  return (
    <div
      className={`rounded-xl border p-4 ${
        isWinner ? "border-success bg-success-soft/40" : "border-border bg-background"
      }`}
    >
      <div className="mb-3 flex h-28 items-end justify-center">
        <FragranceBottleImage
          imageUrl={fragrance.imageUrl}
          alt=""
          className="max-h-full w-auto max-w-[55%] object-contain drop-shadow-md"
          placeholderClassName="h-20 w-auto text-muted opacity-25"
        />
      </div>
      <p className="text-center text-xs font-medium uppercase tracking-widest text-muted">
        {fragrance.house}
      </p>
      <p className="text-center font-semibold leading-tight">{fragrance.name}</p>
      <p className="mt-2 text-center text-lg font-bold tabular-nums">
        {isPrice ? `$${fragrance.price}` : `★ ${fragrance.rating.toFixed(1)}`}
      </p>
      {(fragrance.longevity || fragrance.sillage) && (
        <p className="mt-1 text-center text-xs text-muted">
          {[fragrance.longevity, fragrance.sillage].filter(Boolean).join(" · ")}
        </p>
      )}
      {fragrance.accords.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {fragrance.accords.slice(0, 4).map((accord) => (
            <AccordBadge key={accord} name={accord} compact />
          ))}
        </div>
      )}
      {description && (
        <p className="mt-3 text-center text-xs leading-relaxed text-muted">{description}</p>
      )}
    </div>
  );
}

interface MultipleChoiceRevealProps {
  fragrance: Fragrance;
  isDescription: boolean;
  correctOption: string;
}

export function MultipleChoiceRevealContent({
  fragrance,
  isDescription,
  correctOption,
}: MultipleChoiceRevealProps) {
  const description = shortDescription(fragrance.description, isDescription ? 360 : 220);

  return (
    <div className="space-y-5">
      {isDescription ? (
        <>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-36 w-full items-end justify-center sm:h-40">
              <FragranceBottleImage
                imageUrl={fragrance.imageUrl}
                alt=""
                className="max-h-full w-auto max-w-[55%] object-contain drop-shadow-md"
                placeholderClassName="h-28 w-auto text-muted opacity-25"
              />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted">
                {fragrance.house}
              </p>
              <p className="text-lg font-semibold">{fragrance.name}</p>
              {fragrance.year > 0 && (
                <p className="text-sm text-muted">{fragrance.year}</p>
              )}
            </div>
          </div>
          {description && (
            <blockquote className="rounded-xl border border-border bg-background px-4 py-3 text-center text-sm leading-relaxed not-italic text-muted">
              “{description}”
            </blockquote>
          )}
          <PerfumePyramid
            topNotes={fragrance.topNotes}
            heartNotes={fragrance.heartNotes}
            baseNotes={fragrance.baseNotes}
          />
        </>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3 text-center">
            <HouseMark name={correctOption} size="lg" />
            <div>
              <p className="text-lg font-semibold">{correctOption}</p>
              <p className="mt-1 text-sm text-muted">
                makes {fragrance.name}
                {fragrance.year > 0 ? ` (${fragrance.year})` : ""}.
              </p>
            </div>
          </div>
          {fragrance.accords.length > 0 && (
            <div className="mx-auto max-w-sm">
              <AccordBars accords={fragrance.accords} />
            </div>
          )}
          {description && (
            <p className="mx-auto max-w-lg text-center text-sm leading-relaxed text-muted">
              {description}
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface OddOneOutRevealProps {
  fragrances: Fragrance[];
  oddFragranceId: string;
  matchingFragranceIds: string[];
  explanation: string;
  propertyKind: string;
  propertyLabel: string;
}

export function OddOneOutRevealContent({
  fragrances,
  oddFragranceId,
  matchingFragranceIds,
  explanation,
  propertyKind,
  propertyLabel,
}: OddOneOutRevealProps) {
  const matching = fragrances.filter((f) => matchingFragranceIds.includes(f.id));
  const odd = fragrances.find((f) => f.id === oddFragranceId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2 text-center">
        {propertyKind === "note" ? (
          <NoteBadge name={propertyLabel} />
        ) : propertyKind === "accord" ? (
          <AccordBadge name={propertyLabel} />
        ) : propertyKind === "house" ? (
          <span className="inline-flex items-center gap-2 rounded-xl bg-accent-soft py-1.5 pl-2 pr-3 text-accent">
            <HouseMark name={propertyLabel} size="sm" />
            <span className="font-semibold">{propertyLabel}</span>
          </span>
        ) : (
          <span className="rounded-xl bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent">
            {propertyLabel}
          </span>
        )}
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          <span className="font-semibold text-foreground">Connection:</span> {explanation}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Share the connection
          </p>
          <div className="grid grid-cols-3 gap-2">
            {matching.map((fragrance) => (
              <MiniBottleCard key={fragrance.id} fragrance={fragrance} />
            ))}
          </div>
        </div>
        {odd && (
          <div>
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Odd one out
            </p>
            <div className="mx-auto max-w-[8rem]">
              <MiniBottleCard fragrance={odd} highlight />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniBottleCard({
  fragrance,
  highlight = false,
}: {
  fragrance: Fragrance;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-xl border p-2 text-center ${
        highlight ? "border-success bg-success-soft/50" : "border-border bg-background"
      }`}
    >
      <div className="mb-1 flex h-16 w-full items-end justify-center">
        <FragranceBottleImage
          imageUrl={fragrance.imageUrl}
          alt=""
          className="max-h-full w-auto max-w-[70%] object-contain drop-shadow-sm"
          placeholderClassName="h-12 w-auto text-muted opacity-25"
        />
      </div>
      <p className="line-clamp-2 text-[11px] font-semibold leading-tight">{fragrance.name}</p>
    </div>
  );
}
