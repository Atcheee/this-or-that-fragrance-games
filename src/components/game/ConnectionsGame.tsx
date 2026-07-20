"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ConnectionDifficulty, ConnectionGroup, GameModeMeta } from "@/lib/types";
import type { PreparedConnectionPuzzle } from "@/lib/engines/connections";
import { utcDateKey } from "@/lib/engines/connections";
import { shuffle } from "@/lib/random";
import {
  type DailyConnectionsProgress,
  useAppStore,
} from "@/lib/store";
import { animateCorrect, animateWrong } from "@/lib/animations";
import { ResultsSummary } from "@/components/ResultsSummary";
import { useSaveRecord } from "./useSaveRecord";

export type ConnectionsVariant = "curated" | "generated" | "daily";

interface ConnectionsGameProps {
  meta: GameModeMeta;
  puzzle: PreparedConnectionPuzzle;
  variant: ConnectionsVariant;
  /** Non-daily only: never end the game from mistakes. */
  infiniteMistakes?: boolean;
  onPlayAgain: () => void;
}

const MAX_MISTAKES = 4;

const GROUP_STYLES: Record<ConnectionDifficulty, string> = {
  yellow: "bg-connection-yellow text-connection-yellow-foreground",
  green: "bg-connection-green text-connection-green-foreground",
  blue: "bg-connection-blue text-connection-blue-foreground",
  purple: "bg-connection-purple text-connection-purple-foreground",
};

export function ConnectionsGame({
  meta,
  puzzle,
  variant,
  infiniteMistakes = false,
  onPlayAgain,
}: ConnectionsGameProps) {
  const daily = variant === "daily";
  const unlimitedMistakes = !daily && infiniteMistakes;
  const dateKey = useMemo(
    () => puzzle.dateKey ?? utcDateKey(),
    [puzzle.dateKey],
  );
  const savedAtStart = useMemo(() => {
    const saved = useAppStore.getState().dailyConnections;
    return daily && saved?.dateKey === dateKey && saved.puzzleId === puzzle.id
      ? saved
      : undefined;
  }, [daily, dateKey, puzzle.id]);

  const [tileOrder, setTileOrder] = useState(
    () => savedAtStart?.tileOrder ?? puzzle.tileOrder,
  );
  const [selectedIds, setSelectedIds] = useState(
    () => savedAtStart?.selectedIds ?? [],
  );
  const [solvedGroupIds, setSolvedGroupIds] = useState(
    () => savedAtStart?.solvedGroupIds ?? [],
  );
  const [mistakes, setMistakes] = useState(() => savedAtStart?.mistakes ?? 0);
  const [outcome, setOutcome] = useState<"won" | "lost" | null>(
    () => savedAtStart?.outcome ?? null,
  );
  const [feedback, setFeedback] = useState("");
  const [isNewBest, setIsNewBest] = useState(false);

  const setDailyConnections = useAppStore((state) => state.setDailyConnections);
  const saveRecord = useSaveRecord();
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());

  const fragranceById = useMemo(
    () =>
      new Map(
        puzzle.fragrances.map((fragrance) => [fragrance.id, fragrance]),
      ),
    [puzzle.fragrances],
  );
  const solvedSet = useMemo(() => new Set(solvedGroupIds), [solvedGroupIds]);
  const solvedFragranceIds = useMemo(
    () =>
      new Set(
        puzzle.groups
          .filter((group) => solvedSet.has(group.id))
          .flatMap((group) => group.fragranceIds),
      ),
    [puzzle.groups, solvedSet],
  );

  useEffect(() => {
    if (!daily || savedAtStart) return;
    const current = useAppStore.getState().dailyConnections;
    if (current?.dateKey === dateKey && current.puzzleId === puzzle.id) return;
    setDailyConnections({
      dateKey,
      puzzleId: puzzle.id,
      tileOrder,
      selectedIds: [],
      solvedGroupIds: [],
      mistakes: 0,
      outcome: null,
    });
  }, [
    daily,
    dateKey,
    puzzle.id,
    savedAtStart,
    setDailyConnections,
    tileOrder,
  ]);

  useEffect(() => {
    if (!daily) return;
    const now = new Date();
    const nextUtcMidnight = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
    );
    const timeout = window.setTimeout(
      onPlayAgain,
      Math.max(1_000, nextUtcMidnight - now.getTime() + 1_000),
    );
    return () => window.clearTimeout(timeout);
  }, [daily, onPlayAgain]);

  function persistDaily(
    overrides: Partial<DailyConnectionsProgress> = {},
  ) {
    if (!daily) return;
    setDailyConnections({
      dateKey,
      puzzleId: puzzle.id,
      tileOrder,
      selectedIds,
      solvedGroupIds,
      mistakes,
      outcome,
      ...overrides,
    });
  }

  function toggleTile(id: string) {
    if (outcome || solvedFragranceIds.has(id)) return;

    const next = selectedIds.includes(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : selectedIds.length < 4
        ? [...selectedIds, id]
        : selectedIds;
    setSelectedIds(next);
    setFeedback("");
    persistDaily({ selectedIds: next });
  }

  function clearSelection() {
    if (outcome) return;
    setSelectedIds([]);
    setFeedback("");
    persistDaily({ selectedIds: [] });
  }

  function shuffleRemaining() {
    if (outcome) return;
    const remainingIds = tileOrder.filter((id) => !solvedFragranceIds.has(id));
    const nextRemaining = shuffle(remainingIds);
    const solvedIds = tileOrder.filter((id) => solvedFragranceIds.has(id));
    const nextOrder = [...solvedIds, ...nextRemaining];
    setTileOrder(nextOrder);
    persistDaily({ tileOrder: nextOrder });
  }

  function submitSelection() {
    if (outcome || selectedIds.length !== 4) return;

    const selected = new Set(selectedIds);
    const matchingGroup = puzzle.groups.find(
      (group) =>
        !solvedSet.has(group.id) &&
        group.fragranceIds.every((id) => selected.has(id)),
    );

    if (matchingGroup) {
      selectedIds.forEach((id) => animateCorrect(tileRefs.current.get(id) ?? null));
      const nextSolved = [...solvedGroupIds, matchingGroup.id];
      const nextOutcome = nextSolved.length === puzzle.groups.length ? "won" : null;
      setSolvedGroupIds(nextSolved);
      setSelectedIds([]);
      setFeedback(`Found: ${matchingGroup.label}`);
      setOutcome(nextOutcome);
      persistDaily({
        selectedIds: [],
        solvedGroupIds: nextSolved,
        outcome: nextOutcome,
      });
      if (nextOutcome) finishGame("won", nextSolved.length, mistakes);
      return;
    }

    selectedIds.forEach((id) => animateWrong(tileRefs.current.get(id) ?? null));
    const nextMistakes = mistakes + 1;
    const oneAway = puzzle.groups.some(
      (group) =>
        !solvedSet.has(group.id) &&
        group.fragranceIds.filter((id) => selected.has(id)).length === 3,
    );
    const nextOutcome =
      !unlimitedMistakes && nextMistakes >= MAX_MISTAKES ? "lost" : null;
    setMistakes(nextMistakes);
    setSelectedIds([]);
    setFeedback(
      nextOutcome
        ? "No mistakes remaining."
        : oneAway
          ? "One away…"
          : "Not quite.",
    );
    setOutcome(nextOutcome);
    persistDaily({
      selectedIds: [],
      mistakes: nextMistakes,
      outcome: nextOutcome,
    });
    if (nextOutcome) finishGame("lost", solvedGroupIds.length, nextMistakes);
  }

  function finishGame(
    finalOutcome: "won" | "lost",
    groupsSolved: number,
    finalMistakes: number,
  ) {
    const mistakeLabel = `${finalMistakes} ${
      finalMistakes === 1 ? "mistake" : "mistakes"
    }`;
    const label = daily ? `${dateKey} · ${mistakeLabel}` : mistakeLabel;
    setIsNewBest(
      saveRecord({
        mode: meta.id,
        score: groupsSolved,
        total: puzzle.groups.length,
        label: `${label} · ${finalOutcome}`,
      }),
    );
  }

  const visibleTileIds = tileOrder.filter((id) => !solvedFragranceIds.has(id));
  const solvedGroups = puzzle.groups.filter((group) => solvedSet.has(group.id));
  const groupsForResults =
    outcome === "lost" ? puzzle.groups : solvedGroups;

  if (outcome) {
    return (
      <ResultsSummary
        title={meta.title}
        scoreText={outcome === "won" ? "Solved!" : `${solvedGroupIds.length} / 4`}
        subText={
          daily
            ? outcome === "won"
              ? "Today's puzzle is complete. Come back after midnight UTC."
              : "Today's attempt is over. A new puzzle arrives after midnight UTC."
            : outcome === "won"
              ? `You solved every group with ${mistakes} ${
                  mistakes === 1 ? "mistake" : "mistakes"
                }.`
              : unlimitedMistakes
                ? "You found as many groups as you could."
                : "You found as many groups as you could before four mistakes."
        }
        isNewBest={isNewBest}
        onPlayAgain={daily ? undefined : onPlayAgain}
      >
        <div className="grid w-full gap-2">
          {groupsForResults.map((group) => (
            <SolvedGroup
              key={group.id}
              group={group}
              fragranceById={fragranceById}
            />
          ))}
        </div>
      </ResultsSummary>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="font-medium text-muted">
          Find four groups of four
          {daily && <span> · {dateKey} UTC</span>}
        </p>
        <MistakeMeter mistakes={mistakes} unlimited={unlimitedMistakes} />
      </div>

      {solvedGroups.length > 0 && (
        <div className="grid gap-2">
          {solvedGroups.map((group) => (
            <SolvedGroup
              key={group.id}
              group={group}
              fragranceById={fragranceById}
            />
          ))}
        </div>
      )}

      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        aria-label="Unsolved fragrances"
      >
        {visibleTileIds.map((id) => {
          const fragrance = fragranceById.get(id);
          if (!fragrance) return null;
          const selected = selectedIds.includes(id);
          return (
            <button
              key={id}
              ref={(node) => {
                if (node) tileRefs.current.set(id, node);
                else tileRefs.current.delete(id);
              }}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleTile(id)}
              className={`gsap-surface min-h-24 rounded-xl border-2 px-3 py-4 text-sm font-semibold leading-tight transition-[border-color,background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-28 ${
                selected
                  ? "border-accent bg-accent-soft text-accent shadow-md"
                  : "border-border bg-card hover:border-accent hover:bg-card-hover"
              }`}
            >
              {fragrance.name}
            </button>
          );
        })}
      </div>

      <p
        role="status"
        aria-live="polite"
        className="min-h-6 text-center text-sm font-semibold text-muted"
      >
        {feedback}
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={shuffleRemaining}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Shuffle
        </button>
        <button
          type="button"
          onClick={clearSelection}
          disabled={selectedIds.length === 0}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Deselect
        </button>
        <button
          type="button"
          onClick={submitSelection}
          disabled={selectedIds.length !== 4}
          className="rounded-full bg-accent px-6 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 dark:text-black"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function MistakeMeter({
  mistakes,
  unlimited,
}: {
  mistakes: number;
  unlimited: boolean;
}) {
  if (unlimited) {
    return (
      <div
        className="flex items-center gap-2"
        aria-label={`${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"} so far`}
      >
        <span className="text-muted">Mistakes:</span>
        <span className="font-semibold tabular-nums">{mistakes}</span>
      </div>
    );
  }

  const remaining = MAX_MISTAKES - mistakes;
  return (
    <div
      className="flex items-center gap-2"
      aria-label={`${remaining} ${remaining === 1 ? "mistake" : "mistakes"} remaining`}
    >
      <span className="text-muted">Mistakes remaining:</span>
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: MAX_MISTAKES }, (_, index) => (
          <span
            key={index}
            className={`h-2.5 w-2.5 rounded-full ${
              index < remaining ? "bg-foreground" : "bg-border"
            }`}
          />
        ))}
      </span>
    </div>
  );
}

function SolvedGroup({
  group,
  fragranceById,
}: {
  group: ConnectionGroup;
  fragranceById: ReadonlyMap<string, { name: string }>;
}) {
  return (
    <section
      className={`rounded-xl px-4 py-3 text-center animate-reveal ${GROUP_STYLES[group.difficulty]}`}
      aria-label={`${group.difficulty} group: ${group.label}`}
    >
      <h3 className="font-bold">{group.label}</h3>
      <p className="mt-1 text-sm font-medium">
        {group.fragranceIds
          .map((id) => fragranceById.get(id)?.name)
          .filter(Boolean)
          .join(" · ")}
      </p>
    </section>
  );
}
