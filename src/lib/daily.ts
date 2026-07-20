import type { GameModeId, GameRecord } from "./types";

export function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const random = seededRandom(seed);
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

export function dailySeed(mode: GameModeId, date = new Date()): number {
  return hashSeed(`${mode}:${utcDateKey(date)}`);
}

export function dailyStreak(
  history: readonly GameRecord[],
  mode?: GameModeId,
  today = new Date(),
): number {
  const playedDates = new Set(
    history
      .filter((record) => !mode || record.mode === mode)
      .filter((record) => record.label?.startsWith("daily:"))
      .map((record) => record.label!.slice(6, 16)),
  );

  const cursor = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  if (!playedDates.has(utcDateKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while (playedDates.has(utcDateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
