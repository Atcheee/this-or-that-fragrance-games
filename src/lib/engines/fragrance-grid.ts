import type { Fragrance } from "../types";
import { allNotes } from "../types";

export const FRAGRANCE_GRID_SIZE = 3;
export const FRAGRANCE_GRID_CELLS = FRAGRANCE_GRID_SIZE ** 2;
export const DEFAULT_GRID_ATTEMPTS = 12;

export type FragranceGridCriterion =
  | { id: string; kind: "house"; value: string; label: string }
  | { id: string; kind: "note"; value: string; label: string }
  | { id: string; kind: "accord"; value: string; label: string }
  | { id: string; kind: "decade"; value: number; label: string }
  | { id: string; kind: "year-before"; value: number; label: string }
  | { id: string; kind: "year-after"; value: number; label: string }
  | { id: string; kind: "longevity"; value: string; label: string }
  | { id: string; kind: "sillage"; value: string; label: string };

export interface FragranceGridIntersection {
  row: number;
  column: number;
  validAnswerIds: string[];
}

export interface PreparedFragranceGrid {
  id: string;
  seed: string;
  rows: [FragranceGridCriterion, FragranceGridCriterion, FragranceGridCriterion];
  columns: [FragranceGridCriterion, FragranceGridCriterion, FragranceGridCriterion];
  intersections: FragranceGridIntersection[];
}

export type FragranceGridValidation =
  | { valid: true }
  | { valid: false; reason: "duplicate" | "row" | "column" | "unknown" };

export interface FragranceGridGenerationOptions {
  seed?: string;
  /** Minimum answers kept per intersection. Falls back to one when needed. */
  minimumAnswersPerCell?: number;
}

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const MAX_GENERATION_ATTEMPTS = 4_000;

export function normalizeGridValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchesGridCriterion(
  fragrance: Fragrance,
  criterion: FragranceGridCriterion,
): boolean {
  if (criterion.kind === "house") {
    return normalizeGridValue(fragrance.house) === normalizeGridValue(criterion.value);
  }
  if (criterion.kind === "note") {
    const target = normalizeGridValue(criterion.value);
    return allNotes(fragrance).some((note) => normalizeGridValue(note) === target);
  }
  if (criterion.kind === "accord") {
    const target = normalizeGridValue(criterion.value);
    return fragrance.accords.some(
      (accord) => normalizeGridValue(accord) === target,
    );
  }
  if (criterion.kind === "decade") {
    return fragrance.year >= criterion.value && fragrance.year < criterion.value + 10;
  }
  if (criterion.kind === "year-before") return fragrance.year > 0 && fragrance.year < criterion.value;
  if (criterion.kind === "year-after") return fragrance.year > criterion.value;
  if (criterion.kind === "longevity") {
    return normalizeGridValue(fragrance.longevity ?? "") === normalizeGridValue(criterion.value);
  }
  return normalizeGridValue(fragrance.sillage ?? "") === normalizeGridValue(criterion.value);
}

export function validAnswersForCell(
  catalog: readonly Fragrance[],
  row: FragranceGridCriterion,
  column: FragranceGridCriterion,
): Fragrance[] {
  return catalog.filter(
    (fragrance) =>
      matchesGridCriterion(fragrance, row) &&
      matchesGridCriterion(fragrance, column),
  );
}

export function validateGridAnswer(
  fragrance: Fragrance | undefined,
  row: FragranceGridCriterion,
  column: FragranceGridCriterion,
  usedFragranceIds: ReadonlySet<string> = new Set(),
): FragranceGridValidation {
  if (!fragrance) return { valid: false, reason: "unknown" };
  if (usedFragranceIds.has(fragrance.id)) {
    return { valid: false, reason: "duplicate" };
  }
  if (!matchesGridCriterion(fragrance, row)) {
    return { valid: false, reason: "row" };
  }
  if (!matchesGridCriterion(fragrance, column)) {
    return { valid: false, reason: "column" };
  }
  return { valid: true };
}

export function calculateFragranceGridScore(
  correctCells: number,
  mistakes: number,
  elapsedSeconds: number,
  completed = correctCells === FRAGRANCE_GRID_CELLS,
): number {
  const accuracyPoints = Math.max(0, correctCells) * 100;
  const mistakePenalty = Math.max(0, mistakes) * 15;
  const timeBonus = completed ? Math.max(0, 300 - Math.max(0, elapsedSeconds) * 2) : 0;
  return Math.max(0, accuracyPoints - mistakePenalty + timeBonus);
}

export function createFragranceGridShare(
  answers: readonly (string | null)[],
  options: {
    score?: number;
    elapsedSeconds?: number;
    title?: string;
    incorrectCells?: readonly number[];
  } = {},
): string {
  const title = options.title ?? "Fragrance Grid";
  const incorrectCells = new Set(options.incorrectCells ?? []);
  const rows = Array.from({ length: FRAGRANCE_GRID_SIZE }, (_, row) =>
    Array.from({ length: FRAGRANCE_GRID_SIZE }, (_, column) => {
      const index = row * FRAGRANCE_GRID_SIZE + column;
      return answers[index] ? "🟩" : incorrectCells.has(index) ? "🟥" : "⬜";
    }).join(""),
  );
  const details = [
    options.score === undefined ? null : `${options.score} points`,
    options.elapsedSeconds === undefined
      ? null
      : formatGridTime(options.elapsedSeconds),
  ].filter(Boolean);
  return [title, ...rows, details.join(" · ")].filter(Boolean).join("\n");
}

export function formatGridTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

export function generateFragranceGrid(
  catalog: readonly Fragrance[],
  options: FragranceGridGenerationOptions = {},
): PreparedFragranceGrid {
  const seed = options.seed ?? "fragrance-grid";
  const requestedMinimum = Math.max(1, options.minimumAnswersPerCell ?? 2);
  const uniqueCatalog = uniqueById(catalog).sort((a, b) => a.id.localeCompare(b.id));
  if (uniqueCatalog.length < FRAGRANCE_GRID_CELLS) {
    throw new Error("Fragrance Grid requires at least nine unique fragrances.");
  }

  const houses = buildHouseCriteria(uniqueCatalog);
  const columns = buildColumnCriteria(uniqueCatalog);
  if (houses.length < FRAGRANCE_GRID_SIZE || columns.length < FRAGRANCE_GRID_SIZE) {
    throw new Error("Catalog does not contain enough criteria for a Fragrance Grid.");
  }

  for (const minimum of descendingMinimums(requestedMinimum)) {
    const prepared = findSolvableGrid(uniqueCatalog, houses, columns, seed, minimum);
    if (prepared) return prepared;
  }
  throw new Error("Could not generate a solvable Fragrance Grid from this catalog.");
}

function findSolvableGrid(
  catalog: readonly Fragrance[],
  houseCriteria: readonly FragranceGridCriterion[],
  columnCriteria: readonly FragranceGridCriterion[],
  seed: string,
  minimumAnswers: number,
): PreparedFragranceGrid | null {
  const random = seededGridRandom(`${seed}:${minimumAnswers}`);
  const houses = shuffleWith(houseCriteria, random);
  const columns = shuffleWith(columnCriteria, random);
  const catalogByHouse = new Map<string, Fragrance[]>();
  for (const fragrance of catalog) {
    const key = normalizeGridValue(fragrance.house);
    const entries = catalogByHouse.get(key);
    if (entries) entries.push(fragrance);
    else catalogByHouse.set(key, [fragrance]);
  }
  const intersectionCache = new Map<string, string[]>();

  function answersFor(
    row: FragranceGridCriterion,
    column: FragranceGridCriterion,
  ): string[] {
    const key = `${row.id}|${column.id}`;
    const cached = intersectionCache.get(key);
    if (cached) return cached;
    if (row.kind !== "house") return [];
    const houseCatalog = catalogByHouse.get(normalizeGridValue(row.value)) ?? [];
    const answers = houseCatalog
      .filter((fragrance) => matchesGridCriterion(fragrance, column))
      .sort(rankFragrances)
      .map((fragrance) => fragrance.id);
    intersectionCache.set(key, answers);
    return answers;
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const selectedColumns = pickDistinct(columns, FRAGRANCE_GRID_SIZE, random);
    if (
      new Set(selectedColumns.map((criterion) => criterion.kind)).size < 2 ||
      new Set(selectedColumns.map((criterion) => criterion.id)).size < FRAGRANCE_GRID_SIZE
    ) {
      continue;
    }

    const selectedRows = shuffleWith(houses, random)
      .filter((row) => {
        const rowAnswers = selectedColumns.map((column) => answersFor(row, column));
        return (
          rowAnswers.every((answers) => answers.length >= minimumAnswers) &&
          hasUniqueAssignment(rowAnswers)
        );
      })
      .slice(0, FRAGRANCE_GRID_SIZE);
    if (selectedRows.length < FRAGRANCE_GRID_SIZE) continue;

    const answerSets = selectedRows.flatMap((row) =>
      selectedColumns.map((column) => answersFor(row, column)),
    );
    if (answerSets.some((answers) => answers.length < minimumAnswers)) continue;
    if (!hasUniqueAssignment(answerSets)) continue;

    const rows = asTriple(selectedRows);
    const columnTriple = asTriple(selectedColumns);
    if (!rows || !columnTriple) continue;
    return {
      id: `fragrance-grid-${hashSeed(seed).toString(36)}-${minimumAnswers}`,
      seed,
      rows,
      columns: columnTriple,
      intersections: answerSets.map((validAnswerIds, index) => ({
        row: Math.floor(index / FRAGRANCE_GRID_SIZE),
        column: index % FRAGRANCE_GRID_SIZE,
        validAnswerIds,
      })),
    };
  }
  return null;
}

function buildHouseCriteria(catalog: readonly Fragrance[]): FragranceGridCriterion[] {
  const houses = groupValues(catalog, (fragrance) => [fragrance.house]);
  return [...houses.values()]
    .filter(({ ids }) => ids.size >= FRAGRANCE_GRID_SIZE)
    .map(({ label }) => ({
      id: `house:${normalizeGridValue(label)}`,
      kind: "house" as const,
      value: label,
      label,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildColumnCriteria(catalog: readonly Fragrance[]): FragranceGridCriterion[] {
  const minimumCount = Math.max(3, Math.min(18, Math.floor(catalog.length * 0.004)));
  const maximumCount = Math.max(minimumCount, Math.floor(catalog.length * 0.45));
  const notes = groupValues(catalog, (fragrance) => allNotes(fragrance));
  const accords = groupValues(catalog, (fragrance) => fragrance.accords);
  const criteria: FragranceGridCriterion[] = [];

  for (const { label, ids } of notes.values()) {
    if (ids.size >= minimumCount && ids.size <= maximumCount) {
      criteria.push({
        id: `note:${normalizeGridValue(label)}`,
        kind: "note",
        value: label,
        label: `Contains ${label}`,
      });
    }
  }
  for (const { label, ids } of accords.values()) {
    if (ids.size >= minimumCount && ids.size <= maximumCount) {
      criteria.push({
        id: `accord:${normalizeGridValue(label)}`,
        kind: "accord",
        value: label,
        label: `${capitalize(label)} accord`,
      });
    }
  }

  for (let decade = 1970; decade <= 2020; decade += 10) {
    const count = catalog.filter(
      (fragrance) => fragrance.year >= decade && fragrance.year < decade + 10,
    ).length;
    if (count >= minimumCount) {
      criteria.push({
        id: `decade:${decade}`,
        kind: "decade",
        value: decade,
        label: `Released in ${decade}s`,
      });
    }
  }

  for (const year of [1990, 2000, 2010]) {
    criteria.push(
      { id: `before:${year}`, kind: "year-before", value: year, label: `Before ${year}` },
      { id: `after:${year}`, kind: "year-after", value: year, label: `After ${year}` },
    );
  }

  for (const { label, ids } of groupValues(catalog, (fragrance) =>
    fragrance.longevity ? [fragrance.longevity] : [],
  ).values()) {
    if (ids.size >= minimumCount) {
      criteria.push({
        id: `longevity:${normalizeGridValue(label)}`,
        kind: "longevity",
        value: label,
        label: `${label} longevity`,
      });
    }
  }
  for (const { label, ids } of groupValues(catalog, (fragrance) =>
    fragrance.sillage ? [fragrance.sillage] : [],
  ).values()) {
    if (ids.size >= minimumCount) {
      criteria.push({
        id: `sillage:${normalizeGridValue(label)}`,
        kind: "sillage",
        value: label,
        label: `${label} sillage`,
      });
    }
  }
  return criteria.sort((a, b) => a.id.localeCompare(b.id));
}

function groupValues(
  catalog: readonly Fragrance[],
  extract: (fragrance: Fragrance) => readonly string[],
): Map<string, { label: string; ids: Set<string> }> {
  const result = new Map<string, { label: string; ids: Set<string> }>();
  for (const fragrance of catalog) {
    for (const label of new Set(extract(fragrance).filter(Boolean))) {
      const key = normalizeGridValue(label);
      if (!key) continue;
      const current = result.get(key);
      if (current) current.ids.add(fragrance.id);
      else result.set(key, { label, ids: new Set([fragrance.id]) });
    }
  }
  return result;
}

function hasUniqueAssignment(answerSets: readonly string[][]): boolean {
  const ordered = answerSets
    .map((answers, index) => ({ answers, index }))
    .sort((a, b) => a.answers.length - b.answers.length || a.index - b.index);
  const used = new Set<string>();
  function assign(index: number): boolean {
    if (index === ordered.length) return true;
    for (const id of ordered[index].answers) {
      if (used.has(id)) continue;
      used.add(id);
      if (assign(index + 1)) return true;
      used.delete(id);
    }
    return false;
  }
  return assign(0);
}

function descendingMinimums(requested: number): number[] {
  return Array.from({ length: requested }, (_, index) => requested - index);
}

function uniqueById(catalog: readonly Fragrance[]): Fragrance[] {
  return [...new Map(catalog.map((fragrance) => [fragrance.id, fragrance])).values()];
}

function rankFragrances(a: Fragrance, b: Fragrance): number {
  return (
    (b.votes ?? 0) - (a.votes ?? 0) ||
    b.rating - a.rating ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  );
}

function pickDistinct<T>(items: readonly T[], count: number, random: () => number): T[] {
  const picked: T[] = [];
  const indexes = new Set<number>();
  while (picked.length < count && indexes.size < items.length) {
    const index = Math.floor(random() * items.length);
    if (!indexes.has(index)) {
      indexes.add(index);
      picked.push(items[index]);
    }
  }
  return picked;
}

function asTriple<T>(items: readonly T[]): [T, T, T] | null {
  return items.length === 3 ? [items[0], items[1], items[2]] : null;
}

function shuffleWith<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function seededGridRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hashSeed(seed: string): number {
  let state = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16_777_619);
  }
  return state >>> 0;
}

function capitalize(value: string): string {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
