"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { GameIcon } from "@/components/GameIcon";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import { getPoolForMode, seedFragrances } from "@/lib/data-source";
import { useAppStore } from "@/lib/store";
import { dailyStreak, utcDateKey } from "@/lib/daily";
import { BRACKET_SIZES, type BracketSize } from "@/lib/engines/bracket";
import {
  generateFragranceGrid,
  type PreparedFragranceGrid,
} from "@/lib/engines/fragrance-grid";
import {
  createOddOneOutPracticeSeed,
  dailyOddOneOutSeed,
  generateOddOneOutRounds,
  type OddOneOutRound,
} from "@/lib/engines/odd-one-out";
import {
  dailyConnectionPuzzle,
  generateConnectionPuzzle,
  randomConnectionPuzzle,
  type PreparedConnectionPuzzle,
} from "@/lib/engines/connections";
import { CONNECTION_PUZZLES } from "@/data/connections-puzzles";
import { ThisOrThatGame } from "./ThisOrThatGame";
import { YesNoGame } from "./YesNoGame";
import { MultipleChoiceGame } from "./MultipleChoiceGame";
import { BracketGame } from "./BracketGame";
import { NamingGame } from "./NamingGame";
import { DiscoveryGame } from "./DiscoveryGame";
import {
  ConnectionsGame,
  type ConnectionsVariant,
} from "./ConnectionsGame";
import { NotePyramidGame } from "./NotePyramidGame";
import { FragranceGridGame } from "./FragranceGridGame";
import { OddOneOutGame } from "./OddOneOutGame";
import { BuildAnAccordGame } from "./BuildAnAccordGame";
import { FragranceTimelineGame } from "./FragranceTimelineGame";
import { BottleSilhouetteGame } from "./BottleSilhouetteGame";

const ROUND_CHOICES = [10, 15, 20];
const CHALLENGE_ROUND_CHOICES = [5, 7, 10];
const DURATION_CHOICES = [60, 90, 120];
const CHALLENGE_VARIANTS = ["daily", "practice"] as const;
type ChallengeVariant = (typeof CHALLENGE_VARIANTS)[number];
const CONNECTIONS_MODE_CHOICES = ["curated", "generated"] as const;
type ConnectionsPuzzleMode = (typeof CONNECTIONS_MODE_CHOICES)[number];
/** Broad catalog window for preference scoring */
const DISCOVERY_POOL_SIZE = 800;

interface GameControllerProps {
  meta: GameModeMeta;
}

export function GameController({ meta }: GameControllerProps) {
  const apiKey = useAppStore((s) => s.apiKey);
  const history = useAppStore((s) => s.history);
  const [phase, setPhase] = useState<"setup" | "loading" | "playing">("setup");
  const [rounds, setRounds] = useState(10);
  const [challengeVariant, setChallengeVariant] =
    useState<ChallengeVariant>("daily");
  const [bracketSize, setBracketSize] = useState<BracketSize>(16);
  const [duration, setDuration] = useState(60);
  const [connectionsMode, setConnectionsMode] = useState<ConnectionsPuzzleMode>(
    () => (meta.id === "connections-generated" ? "generated" : "curated"),
  );
  const [unlimitedGuesses, setUnlimitedGuesses] = useState(false);
  const [pool, setPool] = useState<Fragrance[]>([]);
  const [source, setSource] = useState<"seed" | "fraganty">("seed");
  const [connectionsPuzzle, setConnectionsPuzzle] =
    useState<PreparedConnectionPuzzle | null>(null);
  const [fragranceGridPuzzle, setFragranceGridPuzzle] =
    useState<PreparedFragranceGrid | null>(null);
  const [oddOneOutRounds, setOddOneOutRounds] =
    useState<OddOneOutRound[] | null>(null);
  const [oddOneOutSeed, setOddOneOutSeed] = useState<string>();
  const [challengeDateKey, setChallengeDateKey] = useState(utcDateKey);
  const [gameKey, setGameKey] = useState(0);
  const isDailyConnections = meta.id === "connections-daily";
  const isChallengeGame =
    meta.kind === "note-pyramid" ||
    meta.kind === "fragrance-grid" ||
    meta.kind === "odd-one-out" ||
    meta.kind === "build-an-accord" ||
    meta.kind === "fragrance-timeline" ||
    meta.kind === "bottle-silhouette";
  const connectionsVariant: ConnectionsVariant = isDailyConnections
    ? "daily"
    : connectionsMode;
  const currentDailyStreak = dailyStreak(history, meta.id);

  const start = useCallback(async () => {
    setPhase("loading");
    const nextDateKey = utcDateKey();
    setChallengeDateKey(nextDateKey);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (meta.kind === "connections") {
      const fallback = CONNECTION_PUZZLES[0];
      if (!fallback) throw new Error("No Connections puzzles are configured.");
      const puzzle =
        connectionsVariant === "daily"
          ? dailyConnectionPuzzle(CONNECTION_PUZZLES, seedFragrances)
          : connectionsVariant === "generated"
            ? generateConnectionPuzzle(seedFragrances, fallback)
            : randomConnectionPuzzle(CONNECTION_PUZZLES, seedFragrances);
      setConnectionsPuzzle(puzzle);
      setSource("seed");
    } else if (meta.kind === "fragrance-grid") {
      const seed =
        challengeVariant === "daily"
          ? `fragrance-grid:${nextDateKey}`
          : `fragrance-grid:practice:${Date.now()}:${Math.random()}`;
      setFragranceGridPuzzle(generateFragranceGrid(seedFragrances, { seed }));
      setPool(seedFragrances);
      setSource("seed");
    } else if (meta.kind === "odd-one-out") {
      const seed =
        challengeVariant === "daily"
          ? dailyOddOneOutSeed(nextDateKey)
          : createOddOneOutPracticeSeed();
      setOddOneOutSeed(seed);
      setOddOneOutRounds(
        generateOddOneOutRounds(seedFragrances, rounds, { seed }),
      );
      setPool(seedFragrances);
      setSource("seed");
    } else if (meta.kind === "naming" || isChallengeGame) {
      setPool(seedFragrances);
      setSource("seed");
    } else {
      const poolCount =
        meta.kind === "discovery"
          ? DISCOVERY_POOL_SIZE
          : meta.kind === "bracket"
            ? bracketSize
            : meta.kind === "this-or-that"
              ? rounds * 2
              : Math.max(rounds, 16);
      const result = await getPoolForMode(meta.id, poolCount, apiKey);
      setPool(result.pool);
      setSource(result.source);
    }
    setGameKey((k) => k + 1);
    setPhase("playing");
  }, [
    meta,
    rounds,
    bracketSize,
    apiKey,
    connectionsVariant,
    isChallengeGame,
    challengeVariant,
  ]);

  if (phase === "setup") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 py-4 sm:py-10 animate-card-in">
        <Link
          href="/#games"
          className="w-fit text-sm font-medium text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          ← All games
        </Link>

        <section className="rounded-3xl border border-border bg-card px-6 py-8 sm:px-10 sm:py-10">
          <div className="text-center">
            <span className="mx-auto flex size-20 items-center justify-center rounded-full border border-accent/70 text-accent sm:size-24">
              <GameIcon modeId={meta.id} size={44} />
            </span>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Fragrance game
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
              {meta.title}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">
              {meta.howTo}
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-xl border-t border-border pt-8">
          {isChallengeGame ? (
            <div className="space-y-5">
            <OptionPicker
              label="Challenge"
              choices={CHALLENGE_VARIANTS}
              value={challengeVariant}
              onChange={setChallengeVariant}
              format={(value) =>
                value === "daily" ? "Daily puzzle" : "Random practice"
              }
            />
            {(meta.kind === "odd-one-out" ||
              meta.kind === "build-an-accord") && (
              <OptionPicker
                label="Rounds"
                choices={CHALLENGE_ROUND_CHOICES}
                value={rounds}
                onChange={setRounds}
                format={(value) => `${value} rounds`}
              />
            )}
            <p className="text-center text-sm text-muted">
              {challengeVariant === "daily"
                ? "Same UTC puzzle for everyone today."
                : "A fresh puzzle is generated each time."}
              {currentDailyStreak > 0
                ? ` Current streak: ${currentDailyStreak} ${currentDailyStreak === 1 ? "day" : "days"}.`
                : ""}
            </p>
            </div>
          ) : meta.kind === "bracket" ? (
          <OptionPicker
            label="Bracket size"
            choices={[...BRACKET_SIZES]}
            value={bracketSize}
            onChange={(v) => setBracketSize(v as BracketSize)}
            format={(v) => `${v} fragrances`}
          />
        ) : meta.kind === "naming" ? (
          <OptionPicker
            label="Time limit"
            choices={DURATION_CHOICES}
            value={duration}
            onChange={setDuration}
            format={(v) => `${v} seconds`}
          />
        ) : meta.kind === "discovery" ? (
          <p className="text-center text-sm text-muted">
            You&apos;ll pick a goal, set limits, then answer a short preference
            quiz. Results come from the fragrance catalog — not a scored test.
          </p>
        ) : meta.kind === "connections" ? (
          <div className="space-y-4">
            <p className="text-center text-sm text-muted">
              Select exactly four fragrance names, then submit the strongest
              connection.
              {isDailyConnections
                ? " Four incorrect submissions end the game."
                : unlimitedGuesses
                  ? " Keep guessing until every group is found."
                  : " Four incorrect submissions end the game."}
            </p>
            {!isDailyConnections && (
              <>
                <OptionPicker
                  label="Puzzle mode"
                  choices={CONNECTIONS_MODE_CHOICES}
                  value={connectionsMode}
                  onChange={setConnectionsMode}
                  format={(value) =>
                    value === "curated" ? "Curated" : "Generated"
                  }
                />
                <Toggle
                  label="Unlimited guesses"
                  checked={unlimitedGuesses}
                  onChange={setUnlimitedGuesses}
                />
              </>
            )}
          </div>
        ) : (
          <OptionPicker
            label="Rounds"
            choices={ROUND_CHOICES}
            value={rounds}
            onChange={setRounds}
            format={(v) => `${v} rounds`}
          />
          )}

            <button
              onClick={start}
              className="mx-auto mt-8 block min-h-12 rounded-full bg-accent px-10 py-3 text-lg font-semibold text-[#17120a] transition-[opacity,transform] hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {meta.kind === "discovery"
                ? "Begin"
                : isDailyConnections
                  ? "Play today’s puzzle"
                  : "Start"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center text-muted">
        Preparing fragrances…
      </div>
    );
  }

  const common = { meta, onPlayAgain: start };

  return (
    <div className="flex flex-1 flex-col gap-4">
      {source === "fraganty" && (
        <p className="text-center text-xs text-muted">
          Pool loaded from the Fraganty API
        </p>
      )}
      {meta.kind === "this-or-that" && (
        <ThisOrThatGame key={gameKey} {...common} pool={pool} rounds={rounds} />
      )}
      {meta.kind === "yes-no" && (
        <YesNoGame key={gameKey} {...common} pool={pool} rounds={rounds} />
      )}
      {meta.kind === "multiple-choice" && (
        <MultipleChoiceGame key={gameKey} {...common} pool={pool} rounds={rounds} />
      )}
      {meta.kind === "bracket" && (
        <BracketGame key={gameKey} {...common} pool={pool} size={bracketSize} />
      )}
      {meta.kind === "discovery" && (
        <DiscoveryGame key={gameKey} {...common} pool={pool} />
      )}
      {meta.kind === "naming" && (
        <NamingGame key={gameKey} {...common} duration={duration} />
      )}
      {meta.kind === "connections" && connectionsPuzzle && (
        <ConnectionsGame
          key={gameKey}
          {...common}
          puzzle={connectionsPuzzle}
          variant={connectionsVariant}
          unlimitedGuesses={!isDailyConnections && unlimitedGuesses}
        />
      )}
      {meta.kind === "note-pyramid" && (
        <NotePyramidGame
          key={gameKey}
          {...common}
          pool={pool}
          variant={challengeVariant}
        />
      )}
      {meta.kind === "fragrance-grid" && (
        <FragranceGridGame
          key={gameKey}
          pool={pool}
          puzzle={fragranceGridPuzzle ?? undefined}
          title={
            challengeVariant === "daily"
              ? `Daily Fragrance Grid · ${challengeDateKey} UTC`
              : undefined
          }
          variant={challengeVariant}
          dateKey={challengeDateKey}
          onPlayAgain={start}
        />
      )}
      {meta.kind === "odd-one-out" && (
        <OddOneOutGame
          key={gameKey}
          {...common}
          pool={pool}
          rounds={rounds}
          variant={challengeVariant}
          dateKey={challengeDateKey}
          seed={oddOneOutSeed}
          preparedRounds={oddOneOutRounds ?? undefined}
        />
      )}
      {meta.kind === "build-an-accord" && (
        <BuildAnAccordGame
          key={gameKey}
          {...common}
          rounds={rounds}
          variant={challengeVariant}
        />
      )}
      {meta.kind === "fragrance-timeline" && (
        <FragranceTimelineGame
          key={gameKey}
          {...common}
          pool={pool}
          variant={challengeVariant}
        />
      )}
      {meta.kind === "bottle-silhouette" && (
        <BottleSilhouetteGame
          key={gameKey}
          {...common}
          pool={pool}
          variant={challengeVariant}
        />
      )}
    </div>
  );
}

function OptionPicker<T extends string | number>({
  label,
  choices,
  value,
  onChange,
  format,
}: {
  label: string;
  choices: readonly T[];
  value: T;
  onChange: (value: T) => void;
  format: (value: T) => string;
}) {
  return (
    <div className="space-y-2 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-muted">
        {label}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {choices.map((choice) => (
          <button
            key={choice}
            onClick={() => onChange(choice)}
            className={`min-h-10 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              choice === value
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-card text-muted hover:text-foreground"
            }`}
          >
            {format(choice)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="mx-auto flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent"
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-1 left-1 size-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
