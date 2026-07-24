import type { Fragrance } from "../types";

export type PriceLadderDifficulty = "easy" | "medium" | "hard";

export interface PriceLadderPuzzle {
  id: string;
  seed: string;
  difficulty: PriceLadderDifficulty;
  fragrances: Fragrance[];
  initialOrder: Fragrance[];
  correctOrder: Fragrance[];
}

export interface PriceLadderPlacement {
  fragranceId: string;
  playerIndex: number;
  correctIndex: number;
  displacement: number;
  correct: boolean;
}

export interface PriceLadderResult {
  placements: PriceLadderPlacement[];
  correctPositions: number;
  correctPairs: number;
  totalPairs: number;
  elapsedSeconds: number;
  speedBonus: number;
  score: number;
  maximumScore: number;
  perfect: boolean;
}

export interface PriceNormalizationInput {
  amount: number;
  bottleSizeMl: number;
  usdPerCurrencyUnit?: number;
}

const DIFFICULTY_CONFIG: Record<
  PriceLadderDifficulty,
  { size: number; minimumGapRatio: number }
> = {
  easy: { size: 4, minimumGapRatio: 0.28 },
  medium: { size: 4, minimumGapRatio: 0.12 },
  hard: { size: 5, minimumGapRatio: 0.025 },
};

const UNRELIABLE_PRICE_PREFIXES = ["fragella-", "parfumo-"];
const VARIABLE_PRICE_PATTERN =
  /\b(discontinued|discontinuation|vintage|auction|collector'?s?|resale)\b/i;
const EXACT_POSITION_POINTS = 100;
const RELATIVE_ORDER_POINTS = 30;
const SPEED_BONUS_LIMIT = 120;
const SPEED_BONUS_SECONDS = 90;

/** Convert a retail listing to USD per 100ml. */
export function normalizePriceTo100Ml({
  amount,
  bottleSizeMl,
  usdPerCurrencyUnit = 1,
}: PriceNormalizationInput): number {
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isFinite(bottleSizeMl) ||
    bottleSizeMl <= 0 ||
    !Number.isFinite(usdPerCurrencyUnit) ||
    usdPerCurrencyUnit <= 0
  ) {
    throw new Error("Price normalization needs positive price, size, and currency values.");
  }
  return Math.round(amount * usdPerCurrencyUnit * (100 / bottleSizeMl) * 100) / 100;
}

/**
 * Catalog prices without a dependable size/concentration basis are excluded.
 * Remaining `price` values are documented as approximate USD per 100ml.
 */
export function isReliablePriceCandidate(fragrance: Fragrance): boolean {
  return (
    Number.isFinite(fragrance.price) &&
    fragrance.price >= 25 &&
    fragrance.price <= 600 &&
    !UNRELIABLE_PRICE_PREFIXES.some((prefix) => fragrance.id.startsWith(prefix)) &&
    !VARIABLE_PRICE_PATTERN.test(fragrance.description)
  );
}

export function priceLadderUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dailyPriceLadderSeed(
  difficulty: PriceLadderDifficulty,
  date: Date | string = new Date(),
): string {
  const dateKey =
    typeof date === "string" ? date.slice(0, 10) : priceLadderUtcDateKey(date);
  return `price-ladder:daily:${dateKey}:${difficulty}`;
}

export function createPriceLadderEndlessSeed(): string {
  return `price-ladder:endless:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function generatePriceLadder(
  catalog: readonly Fragrance[],
  options: { seed?: string; difficulty?: PriceLadderDifficulty } = {},
): PriceLadderPuzzle {
  const difficulty = options.difficulty ?? "medium";
  const seed = options.seed ?? "price-ladder";
  const config = DIFFICULTY_CONFIG[difficulty];
  const random = seededRandom(seed);
  const eligible = uniqueById(catalog)
    .filter(isReliablePriceCandidate)
    .sort(rankByRecognition);

  if (eligible.length < config.size) {
    throw new Error(
      `Price Ladder needs ${config.size} fragrances with reliable normalized prices.`,
    );
  }

  const byPrice = new Map<number, Fragrance[]>();
  for (const fragrance of eligible) {
    const normalizedPrice = normalizedCatalogPrice(fragrance);
    const group = byPrice.get(normalizedPrice) ?? [];
    group.push(fragrance);
    byPrice.set(normalizedPrice, group);
  }

  const representatives = [...byPrice.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, fragrances]) => fragrances[Math.floor(random() * fragrances.length)]);
  const selected =
    difficulty === "hard"
      ? selectHardLadder(representatives, config.size, random)
      : selectSpacedLadder(
          representatives,
          config.size,
          config.minimumGapRatio,
          random,
        );

  if (!selected) {
    throw new Error(`Could not build a reliable ${difficulty} price ladder.`);
  }

  const correctOrder = [...selected].sort(comparePrice);
  let initialOrder = shuffleWith(selected, random);
  if (initialOrder.every((fragrance, index) => fragrance.id === correctOrder[index]?.id)) {
    initialOrder = [...initialOrder.slice(1), initialOrder[0]];
  }

  return {
    id: `price-ladder-${shortHash(seed)}-${difficulty}`,
    seed,
    difficulty,
    fragrances: selected,
    initialOrder,
    correctOrder,
  };
}

export function evaluatePriceLadder(
  playerOrder: readonly string[],
  correctOrder: readonly Fragrance[],
  options: { elapsedSeconds?: number } = {},
): PriceLadderResult {
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
      if (correctIndexes.get(playerOrder[left])! < correctIndexes.get(playerOrder[right])!) {
        correctPairs += 1;
      }
    }
  }

  const correctPositions = placements.filter((placement) => placement.correct).length;
  const totalPairs = (playerOrder.length * (playerOrder.length - 1)) / 2;
  const elapsedSeconds = Math.max(0, Math.floor(options.elapsedSeconds ?? 0));
  const accuracyRatio = totalPairs > 0 ? correctPairs / totalPairs : 1;
  const speedBonus = Math.round(
    Math.max(
      0,
      SPEED_BONUS_LIMIT -
        (elapsedSeconds / SPEED_BONUS_SECONDS) * SPEED_BONUS_LIMIT,
    ) * accuracyRatio,
  );
  const maximumScore =
    playerOrder.length * EXACT_POSITION_POINTS +
    totalPairs * RELATIVE_ORDER_POINTS +
    SPEED_BONUS_LIMIT;
  const score =
    correctPositions * EXACT_POSITION_POINTS +
    correctPairs * RELATIVE_ORDER_POINTS +
    speedBonus;

  return {
    placements,
    correctPositions,
    correctPairs,
    totalPairs,
    elapsedSeconds,
    speedBonus,
    score,
    maximumScore,
    perfect: correctPositions === playerOrder.length,
  };
}

export function movePriceLadderItem<T>(
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

export function normalizedCatalogPrice(fragrance: Fragrance): number {
  return normalizePriceTo100Ml({
    amount: fragrance.price,
    bottleSizeMl: 100,
    usdPerCurrencyUnit: 1,
  });
}

export function formatPriceLadderTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

export function formatNormalizedPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
  }).format(price);
}

function selectSpacedLadder(
  fragrances: readonly Fragrance[],
  size: number,
  minimumGapRatio: number,
  random: () => number,
): Fragrance[] | null {
  for (let attempt = 0; attempt < 1_200; attempt += 1) {
    const candidate = shuffleWith(fragrances, random).slice(0, size).sort(comparePrice);
    if (
      new Set(candidate.map((fragrance) => fragrance.house)).size === size &&
      hasMinimumPriceGaps(candidate, minimumGapRatio)
    ) {
      return candidate;
    }
  }
  return null;
}

function selectHardLadder(
  fragrances: readonly Fragrance[],
  size: number,
  random: () => number,
): Fragrance[] | null {
  const candidates: Fragrance[][] = [];
  for (let index = 0; index <= fragrances.length - size; index += 1) {
    const candidate = fragrances.slice(index, index + size);
    const firstPrice = normalizedCatalogPrice(candidate[0]);
    const lastPrice = normalizedCatalogPrice(candidate[candidate.length - 1]);
    if (
      new Set(candidate.map((fragrance) => fragrance.house)).size === size &&
      hasMinimumPriceGaps(candidate, DIFFICULTY_CONFIG.hard.minimumGapRatio) &&
      lastPrice / firstPrice <= 1.55
    ) {
      candidates.push(candidate);
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(random() * candidates.length)];
}

function hasMinimumPriceGaps(
  fragrances: readonly Fragrance[],
  minimumGapRatio: number,
): boolean {
  return fragrances.every((fragrance, index) => {
    if (index === 0) return true;
    const previous = normalizedCatalogPrice(fragrances[index - 1]);
    const current = normalizedCatalogPrice(fragrance);
    return (current - previous) / previous >= minimumGapRatio;
  });
}

function comparePrice(left: Fragrance, right: Fragrance): number {
  return (
    normalizedCatalogPrice(left) - normalizedCatalogPrice(right) ||
    left.id.localeCompare(right.id)
  );
}

function rankByRecognition(left: Fragrance, right: Fragrance): number {
  return (
    (right.votes ?? 0) - (left.votes ?? 0) ||
    right.rating - left.rating ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
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
    throw new Error("Player order must contain every price-ladder fragrance exactly once.");
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

function seededRandom(seed: string): () => number {
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
