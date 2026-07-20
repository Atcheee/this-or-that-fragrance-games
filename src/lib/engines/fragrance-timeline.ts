import type { Fragrance } from "../types";

export const MIN_TIMELINE_SIZE = 3;
export const MAX_TIMELINE_SIZE = 5;
export const DEFAULT_TIMELINE_SIZE = 4;

export interface FragranceTimelinePuzzle {
  id: string;
  seed: string;
  fragrances: Fragrance[];
  initialOrder: Fragrance[];
  correctOrder: Fragrance[];
}

export interface FragranceTimelineOptions {
  seed?: string;
  size?: number;
}

export interface TimelinePlacement {
  fragranceId: string;
  playerIndex: number;
  correctIndex: number;
  displacement: number;
  correct: boolean;
}

export interface FragranceTimelineResult {
  placements: TimelinePlacement[];
  correctPositions: number;
  correctPairs: number;
  totalPairs: number;
  elapsedSeconds: number;
  hintsUsed: number;
  score: number;
  maximumScore: number;
  perfect: boolean;
}

const TIME_BONUS_LIMIT = 120;
const EXACT_POSITION_POINTS = 100;
const RELATIVE_ORDER_POINTS = 25;
const HINT_PENALTY = 100;

export function fragranceTimelineUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dailyFragranceTimelineSeed(
  date: Date | string = new Date(),
): string {
  const dateKey =
    typeof date === "string"
      ? date.slice(0, 10)
      : fragranceTimelineUtcDateKey(date);
  return `fragrance-timeline:daily:${dateKey}`;
}

export function createFragranceTimelinePracticeSeed(): string {
  return `fragrance-timeline:practice:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

/** Same catalog, seed, and size always produce the same cards and starting order. */
export function generateFragranceTimeline(
  catalog: readonly Fragrance[],
  options: FragranceTimelineOptions = {},
): FragranceTimelinePuzzle {
  const size = clampTimelineSize(options.size);
  const seed = options.seed ?? "fragrance-timeline";
  const eligible = uniqueById(catalog)
    .filter((fragrance) => Number.isInteger(fragrance.year) && fragrance.year > 0)
    .sort(rankByRecognition);

  if (eligible.length < size) {
    throw new Error(
      `Fragrance Timeline needs ${size} fragrances with known release years.`,
    );
  }

  const distinctYears = new Set(eligible.map((fragrance) => fragrance.year));
  if (distinctYears.size < size) {
    throw new Error(
      `Fragrance Timeline needs ${size} different known release years.`,
    );
  }

  // Keep daily puzzles recognizable while still allowing enough seed-driven variety.
  const recognitionPoolSize = Math.min(
    eligible.length,
    Math.max(60, size * 16),
  );
  const recognitionPool = eligible.slice(0, recognitionPoolSize);
  const random = seededTimelineRandom(seed);
  const selected = pickDistinctYears(recognitionPool, size, random);
  if (selected.length < size) {
    for (const fragrance of shuffleWith(eligible, random)) {
      if (selected.length >= size) break;
      if (
        selected.some(
          (item) => item.id === fragrance.id || item.year === fragrance.year,
        )
      ) {
        continue;
      }
      selected.push(fragrance);
    }
  }

  if (selected.length < size) {
    throw new Error("Could not build an unambiguous fragrance timeline.");
  }

  const correctOrder = [...selected].sort(
    (a, b) => a.year - b.year || a.id.localeCompare(b.id),
  );
  let initialOrder = shuffleWith(selected, random);
  if (initialOrder.every((fragrance, index) => fragrance.id === correctOrder[index]?.id)) {
    initialOrder = [...initialOrder.slice(1), initialOrder[0]];
  }

  return {
    id: `fragrance-timeline-${shortHash(seed)}-${size}`,
    seed,
    fragrances: selected,
    initialOrder,
    correctOrder,
  };
}

export const generateFragranceTimelinePuzzle = generateFragranceTimeline;

export function evaluateFragranceTimeline(
  playerOrder: readonly string[],
  correctOrder: readonly Fragrance[],
  options: { elapsedSeconds?: number; hintsUsed?: number } = {},
): FragranceTimelineResult {
  const correctIds = correctOrder.map((fragrance) => fragrance.id);
  validateOrder(playerOrder, correctIds);

  const correctIndexes = new Map(
    correctIds.map((fragranceId, index) => [fragranceId, index]),
  );
  const placements = playerOrder.map((fragranceId, playerIndex) => {
    const correctIndex = correctIndexes.get(fragranceId)!;
    const displacement = Math.abs(playerIndex - correctIndex);
    return {
      fragranceId,
      playerIndex,
      correctIndex,
      displacement,
      correct: displacement === 0,
    };
  });

  let correctPairs = 0;
  for (let left = 0; left < playerOrder.length; left += 1) {
    for (let right = left + 1; right < playerOrder.length; right += 1) {
      if (
        correctIndexes.get(playerOrder[left])! <
        correctIndexes.get(playerOrder[right])!
      ) {
        correctPairs += 1;
      }
    }
  }

  const correctPositions = placements.filter((placement) => placement.correct).length;
  const totalPairs = (playerOrder.length * (playerOrder.length - 1)) / 2;
  const elapsedSeconds = Math.max(0, Math.floor(options.elapsedSeconds ?? 0));
  const hintsUsed = Math.max(0, Math.floor(options.hintsUsed ?? 0));
  const accuracyRatio = totalPairs > 0 ? correctPairs / totalPairs : 1;
  const timeBonus = Math.round(
    Math.max(0, TIME_BONUS_LIMIT - elapsedSeconds) * accuracyRatio,
  );
  const maximumScore =
    playerOrder.length * EXACT_POSITION_POINTS +
    totalPairs * RELATIVE_ORDER_POINTS +
    TIME_BONUS_LIMIT;
  const score = Math.max(
    0,
    correctPositions * EXACT_POSITION_POINTS +
      correctPairs * RELATIVE_ORDER_POINTS +
      timeBonus -
      hintsUsed * HINT_PENALTY,
  );

  return {
    placements,
    correctPositions,
    correctPairs,
    totalPairs,
    elapsedSeconds,
    hintsUsed,
    score,
    maximumScore,
    perfect: correctPositions === playerOrder.length,
  };
}

export const scoreFragranceTimeline = evaluateFragranceTimeline;

export function moveTimelineItem<T>(
  items: readonly T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return [...items];
  }
  const result = [...items];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}

export function createFragranceTimelineShare({
  title = "Fragrance Timeline",
  dateKey,
  result,
}: {
  title?: string;
  dateKey?: string;
  result: FragranceTimelineResult;
}): string {
  const grid = result.placements
    .map((placement) =>
      placement.correct ? "🟩" : placement.displacement === 1 ? "🟨" : "⬜",
    )
    .join("");
  const hintLabel = `${result.hintsUsed} ${result.hintsUsed === 1 ? "hint" : "hints"}`;
  return [
    `${title}${dateKey ? ` ${dateKey}` : ""}`,
    grid,
    `${result.correctPositions}/${result.placements.length} exact · ${result.correctPairs}/${result.totalPairs} pairs`,
    `${result.score} pts · ${formatTimelineTime(result.elapsedSeconds)} · ${hintLabel}`,
  ].join("\n");
}

export function formatTimelineTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function clampTimelineSize(size = DEFAULT_TIMELINE_SIZE): number {
  return Math.min(
    MAX_TIMELINE_SIZE,
    Math.max(MIN_TIMELINE_SIZE, Math.floor(size)),
  );
}

function pickDistinctYears(
  items: readonly Fragrance[],
  size: number,
  random: () => number,
): Fragrance[] {
  const selected: Fragrance[] = [];
  const years = new Set<number>();
  for (const fragrance of shuffleWith(items, random)) {
    if (years.has(fragrance.year)) continue;
    years.add(fragrance.year);
    selected.push(fragrance);
    if (selected.length === size) break;
  }
  return selected;
}

function rankByRecognition(a: Fragrance, b: Fragrance): number {
  return (
    (b.votes ?? 0) - (a.votes ?? 0) ||
    b.rating - a.rating ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  );
}

function uniqueById(items: readonly Fragrance[]): Fragrance[] {
  return [...new Map(items.map((fragrance) => [fragrance.id, fragrance])).values()];
}

function validateOrder(playerOrder: readonly string[], correctIds: readonly string[]) {
  if (
    playerOrder.length !== correctIds.length ||
    new Set(playerOrder).size !== playerOrder.length ||
    playerOrder.some((id) => !correctIds.includes(id))
  ) {
    throw new Error("Player order must contain every timeline fragrance exactly once.");
  }
}

function shuffleWith<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function seededTimelineRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hashSeed(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function shortHash(value: string): string {
  return hashSeed(value).toString(36);
}
