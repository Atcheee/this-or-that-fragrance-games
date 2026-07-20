import type {
  ConnectionDifficulty,
  ConnectionGroup,
  ConnectionPuzzle,
  Fragrance,
} from "../types";
import { allNotes } from "../types";

export const CONNECTION_DIFFICULTIES: ConnectionDifficulty[] = [
  "yellow",
  "green",
  "blue",
  "purple",
];

export interface PreparedConnectionPuzzle {
  id: string;
  groups: [ConnectionGroup, ConnectionGroup, ConnectionGroup, ConnectionGroup];
  fragrances: Fragrance[];
  tileOrder: string[];
  dateKey?: string;
}

interface GeneratedCandidate {
  key: string;
  label: string;
  difficulty: ConnectionDifficulty;
  match: ConnectionGroup["match"];
  members: Fragrance[];
  memberIds: Set<string>;
}

const DAY_MS = 86_400_000;
const GENERATED_ATTEMPTS = 350;
const MIN_RECOGNITION_VOTES = 150;
const MAX_TILE_NAME_LENGTH = 42;
const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function shuffleWith<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [
      shuffled[target],
      shuffled[index],
    ];
  }
  return shuffled;
}

function asFour<T>(items: T[]): [T, T, T, T] | null {
  return items.length === 4
    ? [items[0], items[1], items[2], items[3]]
    : null;
}

export function matchesConnectionGroup(
  fragrance: Fragrance,
  group: ConnectionGroup,
): boolean {
  const match = group.match;
  if (match.kind === "curated") return true;
  if (match.kind === "house") {
    return normalize(fragrance.house) === normalize(match.value);
  }
  if (match.kind === "note") {
    const target = normalize(match.value);
    return allNotes(fragrance).some((note) => normalize(note) === target);
  }
  if (match.kind === "accord") {
    const target = normalize(match.value);
    const accords =
      match.maxIndex === undefined
        ? fragrance.accords
        : fragrance.accords.slice(0, match.maxIndex + 1);
    return accords.some((accord) => normalize(accord) === target);
  }
  if (match.kind === "year-range") {
    return fragrance.year >= match.min && fragrance.year <= match.max;
  }
  if (match.kind === "longevity") {
    return normalize(fragrance.longevity ?? "") === normalize(match.value);
  }
  return normalize(fragrance.sillage ?? "") === normalize(match.value);
}

export function validateConnectionPuzzle(
  puzzle: ConnectionPuzzle,
  catalog: readonly Fragrance[],
): string[] {
  const errors: string[] = [];
  const catalogById = new Map(catalog.map((fragrance) => [fragrance.id, fragrance]));
  const seenIds = new Set<string>();
  const seenDifficulties = new Set<ConnectionDifficulty>();

  if (puzzle.groups.length !== 4) errors.push("Puzzle must contain four groups.");

  for (const group of puzzle.groups) {
    if (seenDifficulties.has(group.difficulty)) {
      errors.push(`Difficulty ${group.difficulty} is used more than once.`);
    }
    seenDifficulties.add(group.difficulty);

    if (group.fragranceIds.length !== 4) {
      errors.push(`Group ${group.id} must contain four fragrances.`);
    }

    for (const id of group.fragranceIds) {
      if (seenIds.has(id)) errors.push(`Fragrance ${id} appears more than once.`);
      seenIds.add(id);

      const fragrance = catalogById.get(id);
      if (!fragrance) {
        errors.push(`Fragrance ${id} does not exist in the catalog.`);
      } else if (!matchesConnectionGroup(fragrance, group)) {
        errors.push(`Fragrance ${id} does not match group ${group.id}.`);
      }
    }
  }

  for (const difficulty of CONNECTION_DIFFICULTIES) {
    if (!seenDifficulties.has(difficulty)) {
      errors.push(`Puzzle is missing the ${difficulty} group.`);
    }
  }

  return errors;
}

export function prepareConnectionPuzzle(
  puzzle: ConnectionPuzzle,
  catalog: readonly Fragrance[],
  random: () => number = Math.random,
): PreparedConnectionPuzzle {
  const errors = validateConnectionPuzzle(puzzle, catalog);
  if (errors.length > 0) {
    throw new Error(`Invalid Connections puzzle "${puzzle.id}": ${errors.join(" ")}`);
  }

  const catalogById = new Map(catalog.map((fragrance) => [fragrance.id, fragrance]));
  const groups = [...puzzle.groups].sort(
    (a, b) =>
      CONNECTION_DIFFICULTIES.indexOf(a.difficulty) -
      CONNECTION_DIFFICULTIES.indexOf(b.difficulty),
  ) as PreparedConnectionPuzzle["groups"];
  const fragrances = groups.flatMap((group) =>
    group.fragranceIds.map((id) => catalogById.get(id)!),
  );

  return {
    id: puzzle.id,
    groups,
    fragrances,
    tileOrder: shuffleWith(
      fragrances.map((fragrance) => fragrance.id),
      random,
    ),
  };
}

export function randomConnectionPuzzle(
  puzzles: readonly ConnectionPuzzle[],
  catalog: readonly Fragrance[],
): PreparedConnectionPuzzle {
  const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
  if (!puzzle) throw new Error("No curated Connections puzzles are available.");
  return prepareConnectionPuzzle(puzzle, catalog);
}

export function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dailyConnectionPuzzle(
  puzzles: readonly ConnectionPuzzle[],
  catalog: readonly Fragrance[],
  date = new Date(),
): PreparedConnectionPuzzle {
  if (puzzles.length === 0) {
    throw new Error("No daily Connections puzzles are available.");
  }

  const dayNumber = Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS,
  );
  const puzzle =
    puzzles[((dayNumber % puzzles.length) + puzzles.length) % puzzles.length]!;
  return {
    ...prepareConnectionPuzzle(
      puzzle,
      catalog,
      seededRandom(`${utcDateKey(date)}:${puzzle.id}`),
    ),
    dateKey: utcDateKey(date),
  };
}

export function generateConnectionPuzzle(
  catalog: readonly Fragrance[],
  fallback: ConnectionPuzzle,
): PreparedConnectionPuzzle {
  const eligible = uniqueRecognizableFragrances(catalog);
  const candidates = buildGeneratedCandidates(eligible);
  const byDifficulty = new Map<ConnectionDifficulty, GeneratedCandidate[]>();
  for (const difficulty of CONNECTION_DIFFICULTIES) {
    byDifficulty.set(
      difficulty,
      candidates.filter((candidate) => candidate.difficulty === difficulty),
    );
  }

  for (let attempt = 0; attempt < GENERATED_ATTEMPTS; attempt += 1) {
    const selected = CONNECTION_DIFFICULTIES.map((difficulty) => {
      const pool = byDifficulty.get(difficulty) ?? [];
      return pool[Math.floor(Math.random() * pool.length)];
    });
    if (selected.some((candidate) => !candidate)) break;

    const usedIds = new Set<string>();
    const groups: ConnectionGroup[] = [];
    const selectedGroups = new Map<string, Set<string>>();
    let failed = false;

    for (const candidate of selected as GeneratedCandidate[]) {
      const available = candidate.members.filter(
        (fragrance) => !usedIds.has(fragrance.id),
      );
      const picked = asFour(shuffleWith(available.slice(0, 30), Math.random).slice(0, 4));
      if (!picked) {
        failed = true;
        break;
      }

      const ids = picked.map((fragrance) => fragrance.id) as [
        string,
        string,
        string,
        string,
      ];
      ids.forEach((id) => usedIds.add(id));
      selectedGroups.set(candidate.key, new Set(ids));
      groups.push({
        id: `generated-${candidate.key.replace(/[^a-z0-9]+/g, "-")}`,
        label: candidate.label,
        difficulty: candidate.difficulty,
        fragranceIds: ids,
        match: candidate.match,
      });
    }

    if (failed || groups.length !== 4) continue;
    const boardIds = new Set(groups.flatMap((group) => group.fragranceIds));
    if (hasUnintendedCompleteGroup(boardIds, candidates, selectedGroups)) continue;

    const puzzle: ConnectionPuzzle = {
      id: `generated-${groups.map((group) => group.id).join("_")}`,
      groups: groups as ConnectionPuzzle["groups"],
    };
    return prepareConnectionPuzzle(puzzle, catalog);
  }

  return prepareConnectionPuzzle(fallback, catalog);
}

function uniqueRecognizableFragrances(
  catalog: readonly Fragrance[],
): Fragrance[] {
  const byName = new Map<string, Fragrance>();
  const ranked = [...catalog]
    .filter(
      (fragrance) =>
        fragrance.name.length <= MAX_TILE_NAME_LENGTH &&
        ((fragrance.votes ?? 0) >= MIN_RECOGNITION_VOTES || fragrance.price > 0),
    )
    .sort(
      (a, b) =>
        (b.votes ?? 0) - (a.votes ?? 0) ||
        b.rating - a.rating ||
        a.name.localeCompare(b.name),
    );

  for (const fragrance of ranked) {
    const key = normalize(fragrance.name);
    if (!byName.has(key)) byName.set(key, fragrance);
  }
  return [...byName.values()];
}

function buildGeneratedCandidates(
  fragrances: readonly Fragrance[],
): GeneratedCandidate[] {
  const houses = new Map<string, { label: string; members: Fragrance[] }>();
  const notes = new Map<string, { label: string; members: Fragrance[] }>();
  const accords = new Map<string, { label: string; members: Fragrance[] }>();
  const years = new Map<number, Fragrance[]>();

  for (const fragrance of fragrances) {
    addToGroup(houses, normalize(fragrance.house), fragrance.house, fragrance);
    for (const note of new Set(allNotes(fragrance))) {
      addToGroup(notes, normalize(note), note, fragrance);
    }
    for (const accord of new Set(fragrance.accords.slice(0, 3))) {
      addToGroup(accords, normalize(accord), accord, fragrance);
    }
    if (fragrance.year >= 1970) {
      const members = years.get(fragrance.year);
      if (members) members.push(fragrance);
      else years.set(fragrance.year, [fragrance]);
    }
  }

  const result: GeneratedCandidate[] = [];
  for (const [key, group] of houses) {
    if (group.members.length >= 8 && group.members.length <= 80) {
      result.push(
        candidate(
          `house:${key}`,
          `Made by ${group.label}`,
          "yellow",
          { kind: "house", value: group.label },
          group.members,
        ),
      );
    }
  }
  for (const [key, group] of notes) {
    if (group.members.length >= 8 && group.members.length <= 110) {
      result.push(
        candidate(
          `note:${key}`,
          `Contain ${group.label}`,
          "green",
          { kind: "note", value: group.label },
          group.members,
        ),
      );
    }
  }
  for (const [key, group] of accords) {
    if (group.members.length >= 8 && group.members.length <= 160) {
      result.push(
        candidate(
          `accord:${key}`,
          `${capitalize(group.label)} is a top-three accord`,
          "blue",
          { kind: "accord", value: group.label, maxIndex: 2 },
          group.members,
        ),
      );
    }
  }
  for (const [year, members] of years) {
    if (members.length >= 8 && members.length <= 90) {
      result.push(
        candidate(
          `year:${year}`,
          `Released in ${year}`,
          "purple",
          { kind: "year-range", min: year, max: year },
          members,
        ),
      );
    }
  }
  return result;
}

function addToGroup(
  groups: Map<string, { label: string; members: Fragrance[] }>,
  key: string,
  label: string,
  fragrance: Fragrance,
) {
  const group = groups.get(key);
  if (group) {
    if (!group.members.some((member) => member.id === fragrance.id)) {
      group.members.push(fragrance);
    }
  } else {
    groups.set(key, { label, members: [fragrance] });
  }
}

function candidate(
  key: string,
  label: string,
  difficulty: ConnectionDifficulty,
  match: ConnectionGroup["match"],
  members: Fragrance[],
): GeneratedCandidate {
  const ranked = [...members].sort(
    (a, b) =>
      (b.votes ?? 0) - (a.votes ?? 0) ||
      b.rating - a.rating ||
      a.name.localeCompare(b.name),
  );
  return {
    key,
    label,
    difficulty,
    match,
    members: ranked,
    memberIds: new Set(ranked.map((fragrance) => fragrance.id)),
  };
}

function hasUnintendedCompleteGroup(
  boardIds: Set<string>,
  candidates: readonly GeneratedCandidate[],
  selectedGroups: ReadonlyMap<string, Set<string>>,
): boolean {
  for (const candidateGroup of candidates) {
    const matchingIds = [...boardIds].filter((id) =>
      candidateGroup.memberIds.has(id),
    );
    if (matchingIds.length < 4) continue;

    const intended = selectedGroups.get(candidateGroup.key);
    if (
      matchingIds.length !== 4 ||
      !intended ||
      matchingIds.some((id) => !intended.has(id))
    ) {
      return true;
    }
  }
  return false;
}

function capitalize(value: string): string {
  return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function seededRandom(seed: string): () => number {
  let state = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16_777_619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
