"use client";

import { useMemo, useState } from "react";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import {
  AVOID_PICKS,
  DEFAULT_ANSWERS,
  DEFAULT_LIMITS,
  DISCOVERY_GOALS,
  NOTE_PICKS,
  VIBE_ACCORDS,
  buildPreferenceProfile,
  filteredCount,
  rankMatches,
  type DiscoveryAnswers,
  type DiscoveryGoal,
  type DiscoveryLimits,
  type EraFilter,
  type PopularityFilter,
  type RatingFloor,
  type ScoredFragrance,
} from "@/lib/engines/discovery";
import { FragranceCard } from "@/components/FragranceCard";
import { ResultsSummary } from "@/components/ResultsSummary";
import { RoundStage } from "./RoundStage";
import { useSaveRecord } from "./useSaveRecord";

type Phase = "goal" | "limits" | "questions" | "results";

const QUESTION_STEPS = [
  "vibes",
  "climate",
  "sweetness",
  "intensity",
  "notes",
  "avoid",
] as const;

type QuestionStep = (typeof QUESTION_STEPS)[number];

interface DiscoveryGameProps {
  meta: GameModeMeta;
  pool: Fragrance[];
  onPlayAgain: () => void;
}

export function DiscoveryGame({ meta, pool, onPlayAgain }: DiscoveryGameProps) {
  const [phase, setPhase] = useState<Phase>("goal");
  const [goal, setGoal] = useState<DiscoveryGoal>("favorite");
  const [limits, setLimits] = useState<DiscoveryLimits>(DEFAULT_LIMITS);
  const [answers, setAnswers] = useState<DiscoveryAnswers>(DEFAULT_ANSWERS);
  const [stepIndex, setStepIndex] = useState(0);
  const [ranked, setRanked] = useState<ScoredFragrance[]>([]);
  const saveRecord = useSaveRecord();

  const candidates = useMemo(() => filteredCount(pool, limits), [pool, limits]);
  const step = QUESTION_STEPS[stepIndex];
  const profile = useMemo(
    () => (ranked.length ? buildPreferenceProfile(ranked, answers) : null),
    [ranked, answers],
  );

  function finish() {
    const top = rankMatches(pool, limits, answers, 10);
    setRanked(top);
    setPhase("results");

    const label =
      goal === "notes"
        ? buildPreferenceProfile(top, answers)
            .accords.slice(0, 3)
            .map((a) => a.name)
            .join(", ") || "taste profile"
        : top[0]
          ? `${top[0].fragrance.name} — ${top[0].fragrance.house}`
          : "no match";

    saveRecord({
      mode: meta.id,
      score: 0,
      total: 0,
      label,
    });
  }

  function nextQuestion() {
    if (stepIndex + 1 >= QUESTION_STEPS.length) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  }

  function prevQuestion() {
    if (stepIndex === 0) {
      setPhase("limits");
      return;
    }
    setStepIndex((i) => i - 1);
  }

  if (phase === "goal") {
    return (
      <WizardShell
        title="What do you want to find?"
        subtitle="Pick a goal — then set limits and answer preference questions."
        onBack={null}
      >
        <div className="grid gap-3">
          {DISCOVERY_GOALS.map((g) => (
            <ChoiceButton
              key={g.id}
              selected={goal === g.id}
              title={g.title}
              description={g.description}
              onClick={() => setGoal(g.id)}
            />
          ))}
        </div>
        <PrimaryButton onClick={() => setPhase("limits")}>Continue</PrimaryButton>
      </WizardShell>
    );
  }

  if (phase === "limits") {
    return (
      <WizardShell
        title="Set your limits"
        subtitle={`${candidates.toLocaleString()} fragrances currently match these filters.`}
        onBack={() => setPhase("goal")}
      >
        <LimitSection label="Minimum rating">
          {(
            [
              [0, "Any"],
              [3.5, "3.5+"],
              [4, "4.0+"],
              [4.5, "4.5+"],
            ] as const
          ).map(([value, label]) => (
            <Chip
              key={label}
              selected={limits.ratingFloor === value}
              onClick={() =>
                setLimits((l) => ({ ...l, ratingFloor: value as RatingFloor }))
              }
            >
              {label}
            </Chip>
          ))}
        </LimitSection>

        <LimitSection label="Era">
          {(
            [
              ["any", "Any era"],
              ["classic", "Classic (pre-2000)"],
              ["modern", "Modern (2000+)"],
            ] as const
          ).map(([value, label]) => (
            <Chip
              key={value}
              selected={limits.era === value}
              onClick={() =>
                setLimits((l) => ({ ...l, era: value as EraFilter }))
              }
            >
              {label}
            </Chip>
          ))}
        </LimitSection>

        <LimitSection label="Popularity">
          {(
            [
              ["any", "Whole catalog"],
              ["known", "Well-known"],
              ["cult", "Cult classics"],
            ] as const
          ).map(([value, label]) => (
            <Chip
              key={value}
              selected={limits.popularity === value}
              onClick={() =>
                setLimits((l) => ({
                  ...l,
                  popularity: value as PopularityFilter,
                }))
              }
            >
              {label}
            </Chip>
          ))}
        </LimitSection>

        <LimitSection label="Must include an accord (optional)">
          {VIBE_ACCORDS.slice(0, 12).map((a) => (
            <Chip
              key={a}
              selected={limits.mustAccords.includes(a)}
              onClick={() =>
                setLimits((l) => ({
                  ...l,
                  mustAccords: toggleList(l.mustAccords, a),
                }))
              }
            >
              {a}
            </Chip>
          ))}
        </LimitSection>

        <LimitSection label="Exclude accords (optional)">
          {VIBE_ACCORDS.slice(0, 12).map((a) => (
            <Chip
              key={`ex-${a}`}
              selected={limits.excludeAccords.includes(a)}
              onClick={() =>
                setLimits((l) => ({
                  ...l,
                  excludeAccords: toggleList(l.excludeAccords, a),
                }))
              }
            >
              {a}
            </Chip>
          ))}
        </LimitSection>

        <PrimaryButton
          onClick={() => {
            setStepIndex(0);
            setPhase("questions");
          }}
          disabled={candidates < 5}
        >
          {candidates < 5 ? "Too few matches — loosen filters" : "Start questions"}
        </PrimaryButton>
      </WizardShell>
    );
  }

  if (phase === "questions" && step) {
    return (
      <WizardShell
        title={questionTitle(step)}
        subtitle={`Question ${stepIndex + 1} of ${QUESTION_STEPS.length}`}
        onBack={prevQuestion}
        progress={(stepIndex + 1) / QUESTION_STEPS.length}
      >
        <RoundStage roundKey={step} className="space-y-4">
          <QuestionBody
            step={step}
            answers={answers}
            setAnswers={setAnswers}
          />
        </RoundStage>
        <PrimaryButton onClick={nextQuestion}>
          {stepIndex + 1 >= QUESTION_STEPS.length ? "See results" : "Next"}
        </PrimaryButton>
      </WizardShell>
    );
  }

  // Results
  const top = ranked[0];
  const resultTitle =
    goal === "favorite"
      ? "Your perfect match"
      : goal === "top10"
        ? "Your top 10"
        : "Your fragrance preferences";

  const scoreText =
    goal === "notes"
      ? profile?.accords[0]?.name ?? "Your profile"
      : top
        ? top.fragrance.name
        : "No matches";

  const subText =
    goal === "notes"
      ? "Accords & notes that fit your answers"
      : top
        ? `${top.fragrance.house} · ${top.fragrance.year}${top.score > 0 ? ` · match ${Math.min(99, Math.round(40 + top.score))}%` : ""}`
        : "Try loosening your limits and running again.";

  return (
    <ResultsSummary
      title={resultTitle}
      scoreText={scoreText}
      subText={subText}
      onPlayAgain={onPlayAgain}
    >
      {goal === "notes" && profile && (
        <div className="w-full space-y-6" data-animate="result">
          <ProfileBlock title="Preferred accords" items={profile.accords} />
          <ProfileBlock title="Preferred notes" items={profile.notes} />
          {ranked.length > 0 && (
            <div className="space-y-3 text-left">
              <p className="text-sm font-medium uppercase tracking-widest text-muted">
                Bottles that fit
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {ranked.slice(0, 4).map(({ fragrance }) => (
                  <FragranceCard
                    key={fragrance.id}
                    fragrance={fragrance}
                    showPyramid
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {goal === "favorite" && top && (
        <div className="w-full max-w-sm" data-animate="result">
          <FragranceCard fragrance={top.fragrance} showPyramid state="correct" />
        </div>
      )}

      {goal === "top10" && (
        <ol className="w-full space-y-3 text-left" data-animate="result">
          {ranked.map(({ fragrance, score }, i) => (
            <li
              key={fragrance.id}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold tracking-tight">
                  {fragrance.name}
                </p>
                <p className="text-sm text-muted">
                  {fragrance.house} · {fragrance.year}
                  {fragrance.rating > 0 ? ` · ★ ${fragrance.rating.toFixed(1)}` : ""}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-muted">
                  {fragrance.accords.slice(0, 4).join(" · ")}
                  {score > 0 ? ` · score ${Math.round(score)}` : ""}
                </p>
              </div>
            </li>
          ))}
          {ranked.length === 0 && (
            <p className="text-center text-muted">No fragrances matched.</p>
          )}
        </ol>
      )}
    </ResultsSummary>
  );
}

function QuestionBody({
  step,
  answers,
  setAnswers,
}: {
  step: QuestionStep;
  answers: DiscoveryAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<DiscoveryAnswers>>;
}) {
  if (step === "vibes") {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm text-muted">
          Pick up to 4 vibes that feel like you.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {VIBE_ACCORDS.map((a) => {
            const selected = answers.likedAccords.includes(a);
            const atCap =
              !selected && answers.likedAccords.length >= 4;
            return (
              <Chip
                key={a}
                selected={selected}
                disabled={atCap}
                onClick={() =>
                  setAnswers((ans) => ({
                    ...ans,
                    likedAccords: toggleList(ans.likedAccords, a, 4),
                  }))
                }
              >
                {a}
              </Chip>
            );
          })}
        </div>
      </div>
    );
  }

  if (step === "climate") {
    return (
      <div className="grid gap-3">
        {(
          [
            ["fresh", "Fresh & airy", "Citrus, green, aquatic energy"],
            ["either", "Either works", "I'm flexible on climate"],
            ["warm", "Warm & cozy", "Woods, spices, amber, resin"],
          ] as const
        ).map(([value, title, description]) => (
          <ChoiceButton
            key={value}
            selected={answers.climate === value}
            title={title}
            description={description}
            onClick={() => setAnswers((a) => ({ ...a, climate: value }))}
          />
        ))}
      </div>
    );
  }

  if (step === "sweetness") {
    return (
      <div className="grid gap-3">
        {(
          [
            ["love", "Love sweet", "Vanilla, gourmand, candy-adjacent"],
            ["neutral", "Sometimes", "Sweet is fine when balanced"],
            ["avoid", "Keep it dry", "Skip sweet and gourmand"],
          ] as const
        ).map(([value, title, description]) => (
          <ChoiceButton
            key={value}
            selected={answers.sweetness === value}
            title={title}
            description={description}
            onClick={() => setAnswers((a) => ({ ...a, sweetness: value }))}
          />
        ))}
      </div>
    );
  }

  if (step === "intensity") {
    return (
      <div className="grid gap-3">
        {(
          [
            ["soft", "Soft & close", "Skin scent, light projection"],
            ["balanced", "Balanced", "Present but not overwhelming"],
            ["bold", "Bold presence", "Dense, statement-making"],
          ] as const
        ).map(([value, title, description]) => (
          <ChoiceButton
            key={value}
            selected={answers.intensity === value}
            title={title}
            description={description}
            onClick={() => setAnswers((a) => ({ ...a, intensity: value }))}
          />
        ))}
      </div>
    );
  }

  if (step === "notes") {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm text-muted">
          Pick notes you love (up to 6). Skip if unsure.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {NOTE_PICKS.map((n) => {
            const selected = answers.likedNotes.includes(n);
            const atCap = !selected && answers.likedNotes.length >= 6;
            return (
              <Chip
                key={n}
                selected={selected}
                disabled={atCap}
                onClick={() =>
                  setAnswers((ans) => ({
                    ...ans,
                    likedNotes: toggleList(ans.likedNotes, n, 6),
                  }))
                }
              >
                {n}
              </Chip>
            );
          })}
        </div>
      </div>
    );
  }

  // avoid
  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted">
        Anything you want off the list? Optional.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {AVOID_PICKS.map((term) => (
          <Chip
            key={term}
            selected={answers.avoid.includes(term)}
            onClick={() =>
              setAnswers((ans) => ({
                ...ans,
                avoid: toggleList(ans.avoid, term),
              }))
            }
          >
            {term}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function questionTitle(step: QuestionStep): string {
  switch (step) {
    case "vibes":
      return "Which vibes draw you in?";
    case "climate":
      return "Fresh or warm?";
    case "sweetness":
      return "How do you feel about sweet?";
    case "intensity":
      return "How loud should it wear?";
    case "notes":
      return "Any notes you already love?";
    case "avoid":
      return "Dealbreakers?";
  }
}

function toggleList(list: string[], item: string, max?: number): string[] {
  if (list.includes(item)) return list.filter((x) => x !== item);
  if (max !== undefined && list.length >= max) return list;
  return [...list, item];
}

function WizardShell({
  title,
  subtitle,
  onBack,
  progress,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: (() => void) | null;
  progress?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 py-6 animate-card-in">
      <div className="text-center">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted hover:text-foreground"
          >
            ← Back
          </button>
        )}
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
        {progress !== undefined && (
          <div className="mx-auto mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function LimitSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium uppercase tracking-widest text-muted">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  selected,
  onClick,
  disabled,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-semibold capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        selected
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-card text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ChoiceButton({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
        selected
          ? "border-accent bg-accent-soft"
          : "border-border bg-card hover:bg-card-hover"
      }`}
    >
      <p className="font-semibold tracking-tight">{title}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </button>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="mx-auto mt-2 rounded-full bg-accent px-10 py-3 text-lg font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:text-black"
    >
      {children}
    </button>
  );
}

function ProfileBlock({
  title,
  items,
}: {
  title: string;
  items: { name: string; weight: number }[];
}) {
  const max = items[0]?.weight ?? 1;
  return (
    <div className="space-y-3 text-left">
      <p className="text-sm font-medium uppercase tracking-widest text-muted">
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.name} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium capitalize">{item.name}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.round((item.weight / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
