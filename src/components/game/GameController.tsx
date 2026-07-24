"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import Link from "next/link";
import { GameIcon } from "@/components/GameIcon";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import { startGameSession } from "@/lib/data-source";
import { useAppStore } from "@/lib/store";
import { dailyStreak, utcDateKey } from "@/lib/daily";
import { BRACKET_SIZES, type BracketSize } from "@/lib/engines/bracket";
import type { PreparedFragranceGrid } from "@/lib/engines/fragrance-grid";
import type { OddOneOutRound } from "@/lib/engines/odd-one-out";
import type { PreparedConnectionPuzzle } from "@/lib/engines/connections";
import type { NamingChallenge } from "@/lib/engines/naming";
import type { FakeOrRealRound } from "@/lib/engines/fake-or-real";
import type { PriceLadderDifficulty } from "@/lib/engines/price-ladder";
import type { ConnectionsVariant } from "./ConnectionsGame";

const ThisOrThatGame = dynamic(
  () => import("./ThisOrThatGame").then((m) => m.ThisOrThatGame),
  { loading: GameChunkFallback },
);
const YesNoGame = dynamic(
  () => import("./YesNoGame").then((m) => m.YesNoGame),
  { loading: GameChunkFallback },
);
const MultipleChoiceGame = dynamic(
  () => import("./MultipleChoiceGame").then((m) => m.MultipleChoiceGame),
  { loading: GameChunkFallback },
);
const FakeOrRealGame = dynamic(
  () => import("./FakeOrRealGame").then((m) => m.FakeOrRealGame),
  { loading: GameChunkFallback },
);
const BracketGame = dynamic(
  () => import("./BracketGame").then((m) => m.BracketGame),
  { loading: GameChunkFallback },
);
const NamingGame = dynamic(
  () => import("./NamingGame").then((m) => m.NamingGame),
  { loading: GameChunkFallback },
);
const DiscoveryGame = dynamic(
  () => import("./DiscoveryGame").then((m) => m.DiscoveryGame),
  { loading: GameChunkFallback },
);
const ConnectionsGame = dynamic(
  () => import("./ConnectionsGame").then((m) => m.ConnectionsGame),
  { loading: GameChunkFallback },
);
const NotePyramidGame = dynamic(
  () => import("./NotePyramidGame").then((m) => m.NotePyramidGame),
  { loading: GameChunkFallback },
);
const FragranceCrimeSceneGame = dynamic(
  () =>
    import("./FragranceCrimeSceneGame").then(
      (m) => m.FragranceCrimeSceneGame,
    ),
  { loading: GameChunkFallback },
);
const FragranceGridGame = dynamic(
  () => import("./FragranceGridGame").then((m) => m.FragranceGridGame),
  { loading: GameChunkFallback },
);
const OddOneOutGame = dynamic(
  () => import("./OddOneOutGame").then((m) => m.OddOneOutGame),
  { loading: GameChunkFallback },
);
const BuildAnAccordGame = dynamic(
  () => import("./BuildAnAccordGame").then((m) => m.BuildAnAccordGame),
  { loading: GameChunkFallback },
);
const FragranceTimelineGame = dynamic(
  () =>
    import("./FragranceTimelineGame").then((m) => m.FragranceTimelineGame),
  { loading: GameChunkFallback },
);
const PriceLadderGame = dynamic(
  () => import("./PriceLadderGame").then((m) => m.PriceLadderGame),
  { loading: GameChunkFallback },
);
const BottleSilhouetteGame = dynamic(
  () =>
    import("./BottleSilhouetteGame").then((m) => m.BottleSilhouetteGame),
  { loading: GameChunkFallback },
);
const Fragrance20QuestionsGame = dynamic(
  () =>
    import("./Fragrance20QuestionsGame").then(
      (m) => m.Fragrance20QuestionsGame,
    ),
  { loading: GameChunkFallback },
);
const FragranceBingoGame = dynamic(
  () => import("./FragranceBingoGame").then((m) => m.FragranceBingoGame),
  { loading: GameChunkFallback },
);

function GameChunkFallback() {
  return (
    <div className="flex flex-1 items-center justify-center text-muted">
      Loading game…
    </div>
  );
}

const ROUND_CHOICES = [10, 15, 20];
const CHALLENGE_ROUND_CHOICES = [5, 7, 10];
const DURATION_CHOICES = [60, 90, 120];
const CHALLENGE_VARIANTS = ["daily", "practice"] as const;
type ChallengeVariant = (typeof CHALLENGE_VARIANTS)[number];
const PRICE_DIFFICULTIES: PriceLadderDifficulty[] = ["easy", "medium", "hard"];
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
  const [phase, setPhase] = useState<"setup" | "loading" | "playing" | "error">(
    "setup",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rounds, setRounds] = useState(10);
  const [challengeVariant, setChallengeVariant] =
    useState<ChallengeVariant>("daily");
  const [priceDifficulty, setPriceDifficulty] =
    useState<PriceLadderDifficulty>("medium");
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
  const [namingChallenge, setNamingChallenge] =
    useState<NamingChallenge | null>(null);
  const [fakeOrRealRounds, setFakeOrRealRounds] = useState<
    FakeOrRealRound[] | null
  >(null);
  const [challengeDateKey, setChallengeDateKey] = useState(utcDateKey);
  const [gameKey, setGameKey] = useState(0);
  const isDailyConnections = meta.id === "connections-daily";
  const isChallengeGame =
    meta.kind === "note-pyramid" ||
    meta.kind === "fragrance-grid" ||
    meta.kind === "odd-one-out" ||
    meta.kind === "build-an-accord" ||
    meta.kind === "fragrance-timeline" ||
    meta.kind === "price-ladder" ||
    meta.kind === "bottle-silhouette" ||
    meta.kind === "bingo";
  const connectionsVariant: ConnectionsVariant = isDailyConnections
    ? "daily"
    : connectionsMode;
  const currentDailyStreak = dailyStreak(history, meta.id);

  const start = useCallback(async () => {
    setPhase("loading");
    setLoadError(null);
    const nextDateKey = utcDateKey();
    setChallengeDateKey(nextDateKey);

    try {
      const poolCount =
        meta.kind === "discovery"
          ? DISCOVERY_POOL_SIZE
          : meta.kind === "bracket"
            ? bracketSize
            : meta.kind === "this-or-that"
              ? rounds + 16
              : meta.kind === "yes-no" || meta.kind === "multiple-choice"
                ? Math.max(rounds, 16)
                : undefined;

      const result = await startGameSession({
        modeId: meta.id,
        kind: meta.kind,
        rounds,
        bracketSize,
        challengeVariant,
        connectionsVariant,
        dateKey: nextDateKey,
        apiKey,
        poolCount,
      });

      setPool(result.pool);
      setSource(result.source);
      setConnectionsPuzzle(result.connectionsPuzzle ?? null);
      setFragranceGridPuzzle(result.fragranceGridPuzzle ?? null);
      setOddOneOutRounds(result.oddOneOutRounds ?? null);
      setOddOneOutSeed(result.oddOneOutSeed);
      setNamingChallenge(result.namingChallenge ?? null);
      setFakeOrRealRounds(result.fakeOrRealRounds ?? null);
      setGameKey((k) => k + 1);
      setPhase("playing");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not prepare this game.",
      );
      setPhase("error");
    }
  }, [
    meta,
    rounds,
    bracketSize,
    apiKey,
    connectionsVariant,
    challengeVariant,
  ]);

  if (phase === "setup" || phase === "error") {
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
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] sm:text-5xl">
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
                value === "daily"
                  ? "Daily puzzle"
                  : meta.kind === "price-ladder"
                    ? "Endless mode"
                    : "Random practice"
              }
            />
            {meta.kind === "price-ladder" && (
              <OptionPicker
                label="Difficulty"
                choices={PRICE_DIFFICULTIES}
                value={priceDifficulty}
                onChange={setPriceDifficulty}
                format={(value) =>
                  value === "easy"
                    ? "Easy · 4"
                    : value === "medium"
                      ? "Medium · 4"
                      : "Hard · 5"
                }
              />
            )}
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
                : meta.kind === "price-ladder"
                  ? "Keep playing fresh ladders for as long as you like."
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
        ) : meta.kind === "crime-scene" ? (
          <div className="space-y-3 text-center text-sm text-muted">
            <p>
              Five evidence cards translate real notes and accords into a
              fictional scene. Wrong guesses reveal the next clue.
            </p>
            <p>
              Solve from the first trace for 100 points. Each extra clue lowers
              the available score.
            </p>
          </div>
        ) : meta.kind === "twenty-questions" ? (
          <div className="space-y-3 text-center text-sm text-muted">
            <p>
              Your mystery scent is selected from 240 recognizable fragrances.
              Only questions that still split the candidate pool are shown.
            </p>
            <p>
              Answers may be <strong className="text-foreground">yes</strong>,{" "}
              <strong className="text-foreground">no</strong>, or{" "}
              <strong className="text-foreground">unknown</strong> when the
              catalog has no value.
            </p>
          </div>
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

            {loadError && (
              <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">
                {loadError}
              </p>
            )}

            <button
              onClick={start}
              className="mx-auto mt-8 block min-h-12 rounded-full bg-accent px-10 py-3 text-lg font-semibold text-[#17120a] transition-[opacity,transform] hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {meta.kind === "discovery"
                ? "Begin"
                : isDailyConnections
                  ? "Play today’s puzzle"
                  : phase === "error"
                    ? "Try again"
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
      {meta.kind === "fake-or-real" && fakeOrRealRounds && (
        <FakeOrRealGame
          key={gameKey}
          {...common}
          gameRounds={fakeOrRealRounds}
        />
      )}
      {meta.kind === "bracket" && (
        <BracketGame key={gameKey} {...common} pool={pool} size={bracketSize} />
      )}
      {meta.kind === "discovery" && (
        <DiscoveryGame key={gameKey} {...common} pool={pool} />
      )}
      {meta.kind === "naming" && namingChallenge && (
        <NamingGame
          key={gameKey}
          {...common}
          duration={duration}
          challenge={namingChallenge}
        />
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
      {meta.kind === "crime-scene" && (
        <FragranceCrimeSceneGame
          key={gameKey}
          pool={pool}
          onPlayAgain={start}
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
      {meta.kind === "price-ladder" && (
        <PriceLadderGame
          key={gameKey}
          {...common}
          pool={pool}
          variant={challengeVariant}
          difficulty={priceDifficulty}
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
      {meta.kind === "twenty-questions" && (
        <Fragrance20QuestionsGame key={gameKey} {...common} pool={pool} />
      )}
      {meta.kind === "bingo" && (
        <FragranceBingoGame
          key={gameKey}
          {...common}
          pool={pool}
          variant={challengeVariant}
          dateKey={challengeDateKey}
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
