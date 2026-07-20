import type { Fragrance } from "../types";
import { allNotes } from "../types";

export type OddOneOutProperty =
  | { kind: "house"; value: string }
  | { kind: "note"; value: string }
  | { kind: "accord"; value: string }
  | { kind: "release-decade"; startYear: number }
  | { kind: "longevity"; value: string }
  | { kind: "sillage"; value: string };

export interface OddOneOutRound {
  id: string;
  property: OddOneOutProperty;
  fragrances: [Fragrance, Fragrance, Fragrance, Fragrance];
  matchingFragranceIds: [string, string, string];
  oddFragranceId: string;
  answerIndex: number;
  connection: string;
  explanation: string;
}

export interface OddOneOutGenerationOptions {
  /** Same catalog + seed always yields same rounds and card order. */
  seed?: string;
  /** Prefer known fragrances when enough popularity data exists. Defaults to true. */
  recognizableOnly?: boolean;
}

interface PropertyCandidate {
  key: string;
  property: OddOneOutProperty;
  members: Fragrance[];
  memberIds: Set<string>;
}

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const MAX_NAME_LENGTH = 52;
const MIN_RECOGNITION_VOTES = 100;
const MAX_TRIES_PER_PROPERTY = 180;

/** 100 base points, plus 10% per prior correct answer, capped at 1.5x. */
export function calculateOddOneOutPoints(streakBeforeAnswer: number): number {
  const multiplier = 1 + Math.min(Math.max(0, streakBeforeAnswer), 5) * 0.1;
  return Math.round(100 * multiplier);
}

export function normalizeOddOneOutValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function oddOneOutUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dailyOddOneOutSeed(date: Date | string = new Date()): string {
  const key = typeof date === "string" ? date.slice(0, 10) : oddOneOutUtcDateKey(date);
  return `odd-one-out:daily:${key}`;
}

export function createOddOneOutPracticeSeed(): string {
  return `odd-one-out:practice:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function matchesOddOneOutProperty(
  fragrance: Fragrance,
  property: OddOneOutProperty,
): boolean {
  if (property.kind === "house") {
    return normalizeOddOneOutValue(fragrance.house) === normalizeOddOneOutValue(property.value);
  }
  if (property.kind === "note") {
    const target = normalizeOddOneOutValue(property.value);
    return allNotes(fragrance).some((note) => normalizeOddOneOutValue(note) === target);
  }
  if (property.kind === "accord") {
    const target = normalizeOddOneOutValue(property.value);
    return fragrance.accords.some(
      (accord) => normalizeOddOneOutValue(accord) === target,
    );
  }
  if (property.kind === "release-decade") {
    return (
      fragrance.year >= property.startYear &&
      fragrance.year <= property.startYear + 9
    );
  }
  if (property.kind === "longevity") {
    return (
      normalizeOddOneOutValue(fragrance.longevity ?? "") ===
      normalizeOddOneOutValue(property.value)
    );
  }
  return (
    normalizeOddOneOutValue(fragrance.sillage ?? "") ===
    normalizeOddOneOutValue(property.value)
  );
}

/**
 * Returns every objective 3-vs-1 split discoverable from catalog fields on the
 * four cards. A valid generated round may have several connections, but every
 * one must identify the same odd fragrance.
 */
export function objectiveOddAnswers(
  fragrances: readonly Fragrance[],
): Map<string, OddOneOutProperty[]> {
  const answers = new Map<string, OddOneOutProperty[]>();
  for (const property of propertiesPresentOn(fragrances)) {
    const matches = fragrances.filter((fragrance) =>
      matchesOddOneOutProperty(fragrance, property),
    );
    if (matches.length !== 3) continue;
    const odd = fragrances.find(
      (fragrance) => !matchesOddOneOutProperty(fragrance, property),
    );
    if (!odd) continue;
    const existing = answers.get(odd.id);
    if (existing) existing.push(property);
    else answers.set(odd.id, [property]);
  }
  return answers;
}

export function validateOddOneOutRound(round: OddOneOutRound): string[] {
  const errors: string[] = [];
  const uniqueIds = new Set(round.fragrances.map((fragrance) => fragrance.id));
  if (round.fragrances.length !== 4 || uniqueIds.size !== 4) {
    errors.push("Round must contain four different fragrances.");
  }

  const matching = round.fragrances.filter((fragrance) =>
    matchesOddOneOutProperty(fragrance, round.property),
  );
  if (matching.length !== 3) {
    errors.push("Round property must match exactly three fragrances.");
  }
  if (matching.some((fragrance) => fragrance.id === round.oddFragranceId)) {
    errors.push("Odd fragrance must not match the round property.");
  }
  const oddIndex = round.fragrances.findIndex(
    (fragrance) => fragrance.id === round.oddFragranceId,
  );
  if (oddIndex < 0) errors.push("Odd fragrance is missing from round.");
  if (round.answerIndex !== oddIndex) errors.push("Answer index does not identify odd fragrance.");

  const objectiveAnswers = objectiveOddAnswers(round.fragrances);
  if (objectiveAnswers.size === 0) {
    errors.push("Round has no objective three-versus-one connection.");
  } else if (
    objectiveAnswers.size !== 1 ||
    !objectiveAnswers.has(round.oddFragranceId)
  ) {
    errors.push("Round has another defensible odd fragrance.");
  }

  return errors;
}

export function generateDailyOddOneOutRounds(
  catalog: readonly Fragrance[],
  count: number,
  date: Date | string = new Date(),
): OddOneOutRound[] {
  return generateOddOneOutRounds(catalog, count, {
    seed: dailyOddOneOutSeed(date),
  });
}

export function generateOddOneOutRounds(
  catalog: readonly Fragrance[],
  count: number,
  options: OddOneOutGenerationOptions = {},
): OddOneOutRound[] {
  const targetCount = Math.max(1, Math.floor(count));
  const seed = options.seed ?? createOddOneOutPracticeSeed();
  const random = seededRandom(seed);
  const eligible = eligibleFragrances(
    catalog,
    targetCount,
    options.recognizableOnly !== false,
  );

  if (eligible.length < 4) {
    throw new Error("Odd One Out needs at least four eligible fragrances.");
  }

  const candidates = diversifiedCandidates(
    buildPropertyCandidates(eligible),
    random,
  );
  const rounds: OddOneOutRound[] = [];
  const usedProperties = new Set<string>();
  const usedFragrances = new Set<string>();

  for (const avoidRepeats of [true, false]) {
    for (const candidate of candidates) {
      if (rounds.length >= targetCount) break;
      if (usedProperties.has(candidate.key)) continue;
      const round = buildRound(
        candidate,
        eligible,
        random,
        seed,
        rounds.length,
        avoidRepeats ? usedFragrances : undefined,
      );
      if (!round) continue;
      rounds.push(round);
      usedProperties.add(candidate.key);
      round.fragrances.forEach((fragrance) => usedFragrances.add(fragrance.id));
    }
    if (rounds.length >= targetCount) break;
  }

  if (rounds.length < targetCount) {
    throw new Error(
      `Could only create ${rounds.length} unambiguous Odd One Out rounds from this pool; ${targetCount} requested.`,
    );
  }

  return rounds;
}

function buildRound(
  candidate: PropertyCandidate,
  eligible: readonly Fragrance[],
  random: () => number,
  seed: string,
  roundIndex: number,
  avoidIds?: ReadonlySet<string>,
): OddOneOutRound | null {
  const memberPool = candidate.members.filter(
    (fragrance) => !avoidIds?.has(fragrance.id),
  );
  const outsiderPool = eligible.filter(
    (fragrance) =>
      !candidate.memberIds.has(fragrance.id) && !avoidIds?.has(fragrance.id),
  );
  if (memberPool.length < 3 || outsiderPool.length === 0) return null;

  const members = shuffleWith(memberPool.slice(0, 180), random);
  const outsiders = shuffleWith(outsiderPool.slice(0, 320), random);
  for (let attempt = 0; attempt < MAX_TRIES_PER_PROPERTY; attempt += 1) {
    const matching = pickThree(members, random);
    const odd = outsiders[Math.floor(random() * outsiders.length)];
    if (!matching || !odd) break;
    const cards = asFour(shuffleWith([...matching, odd], random));
    if (!cards) continue;
    const answerIndex = cards.findIndex((fragrance) => fragrance.id === odd.id);
    const matchingIds = matching.map((fragrance) => fragrance.id) as [
      string,
      string,
      string,
    ];
    const connection = propertyConnection(candidate.property);
    const round: OddOneOutRound = {
      id: `${shortHash(`${seed}:${candidate.key}:${roundIndex}`)}-${roundIndex + 1}`,
      property: candidate.property,
      fragrances: cards,
      matchingFragranceIds: matchingIds,
      oddFragranceId: odd.id,
      answerIndex,
      connection,
      explanation: `${matching.map((fragrance) => fragrance.name).join(", ")} ${connection}. ${odd.name} does not.`,
    };
    if (validateOddOneOutRound(round).length === 0) return round;
  }
  return null;
}

function eligibleFragrances(
  catalog: readonly Fragrance[],
  roundCount: number,
  recognizableOnly: boolean,
): Fragrance[] {
  const byIdentity = new Map<string, Fragrance>();
  const ranked = [...catalog]
    .filter(
      (fragrance) =>
        Boolean(fragrance.id && fragrance.name && fragrance.house) &&
        fragrance.name.length <= MAX_NAME_LENGTH,
    )
    .sort(
      (a, b) =>
        (b.votes ?? 0) - (a.votes ?? 0) ||
        b.rating - a.rating ||
        a.id.localeCompare(b.id),
    );
  for (const fragrance of ranked) {
    const key = normalizeOddOneOutValue(`${fragrance.name} ${fragrance.house}`);
    if (!byIdentity.has(key)) byIdentity.set(key, fragrance);
  }
  const unique = [...byIdentity.values()];
  if (!recognizableOnly) return unique;
  const recognizable = unique.filter(
    (fragrance) =>
      (fragrance.votes ?? 0) >= MIN_RECOGNITION_VOTES || fragrance.price > 0,
  );
  return recognizable.length >= Math.max(12, roundCount * 4)
    ? recognizable
    : unique;
}

function buildPropertyCandidates(fragrances: readonly Fragrance[]): PropertyCandidate[] {
  const groups = new Map<
    string,
    { property: OddOneOutProperty; members: Fragrance[] }
  >();
  for (const fragrance of fragrances) {
    addProperty(groups, {
      kind: "house",
      value: fragrance.house,
    }, fragrance);
    for (const note of uniqueValues(allNotes(fragrance))) {
      addProperty(groups, { kind: "note", value: note }, fragrance);
    }
    for (const accord of uniqueValues(fragrance.accords)) {
      addProperty(groups, { kind: "accord", value: accord }, fragrance);
    }
    if (fragrance.year >= 1950) {
      addProperty(
        groups,
        {
          kind: "release-decade",
          startYear: Math.floor(fragrance.year / 10) * 10,
        },
        fragrance,
      );
    }
    if (fragrance.longevity?.trim()) {
      addProperty(groups, { kind: "longevity", value: fragrance.longevity }, fragrance);
    }
    if (fragrance.sillage?.trim()) {
      addProperty(groups, { kind: "sillage", value: fragrance.sillage }, fragrance);
    }
  }

  const minimumGroupSize = fragrances.length >= 100 ? 8 : 3;
  return [...groups.entries()]
    .filter(
      ([, group]) =>
        group.members.length >= minimumGroupSize &&
        group.members.length < fragrances.length,
    )
    .map(([key, group]) => ({
      key,
      property: group.property,
      members: group.members,
      memberIds: new Set(group.members.map((fragrance) => fragrance.id)),
    }));
}

function diversifiedCandidates(
  candidates: readonly PropertyCandidate[],
  random: () => number,
): PropertyCandidate[] {
  const kinds: OddOneOutProperty["kind"][] = [
    "note",
    "accord",
    "house",
    "release-decade",
    "longevity",
    "sillage",
  ];
  const limits: Record<OddOneOutProperty["kind"], number> = {
    note: 80,
    accord: 40,
    house: 80,
    "release-decade": 20,
    longevity: 20,
    sillage: 20,
  };
  const queues = new Map(
    kinds.map((kind) => [
      kind,
      shuffleWith(
        candidates
          .filter((candidate) => candidate.property.kind === kind)
          .sort(
            (a, b) =>
              b.members.length - a.members.length || a.key.localeCompare(b.key),
          )
          .slice(0, limits[kind]),
        random,
      ),
    ]),
  );
  const kindOrder = shuffleWith(kinds, random);
  const result: PropertyCandidate[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const kind of kindOrder) {
      const next = queues.get(kind)?.shift();
      if (!next) continue;
      result.push(next);
      added = true;
    }
  }
  return result;
}

function propertiesPresentOn(fragrances: readonly Fragrance[]): OddOneOutProperty[] {
  const candidates = buildPropertyCandidates(fragrances);
  return candidates.map((candidate) => candidate.property);
}

function addProperty(
  groups: Map<string, { property: OddOneOutProperty; members: Fragrance[] }>,
  property: OddOneOutProperty,
  fragrance: Fragrance,
) {
  const key = propertyKey(property);
  const group = groups.get(key);
  if (group) {
    if (!group.members.some((member) => member.id === fragrance.id)) {
      group.members.push(fragrance);
    }
  } else {
    groups.set(key, { property, members: [fragrance] });
  }
}

function propertyKey(property: OddOneOutProperty): string {
  if (property.kind === "release-decade") {
    return `${property.kind}:${property.startYear}`;
  }
  return `${property.kind}:${normalizeOddOneOutValue(property.value)}`;
}

function propertyConnection(property: OddOneOutProperty): string {
  if (property.kind === "house") return `are all made by ${property.value}`;
  if (property.kind === "note") return `all list ${property.value} in their note pyramids`;
  if (property.kind === "accord") return `all list ${property.value} as a main accord`;
  if (property.kind === "release-decade") {
    return `were all released in the ${property.startYear}s`;
  }
  if (property.kind === "longevity") return `all have ${property.value} longevity`;
  return `all have ${property.value} sillage`;
}

function uniqueValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeOddOneOutValue(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickThree(
  items: readonly Fragrance[],
  random: () => number,
): [Fragrance, Fragrance, Fragrance] | null {
  if (items.length < 3) return null;
  const picked = shuffleWith(items, random).slice(0, 3);
  return picked.length === 3 ? [picked[0], picked[1], picked[2]] : null;
}

function asFour<T>(items: readonly T[]): [T, T, T, T] | null {
  return items.length === 4 ? [items[0], items[1], items[2], items[3]] : null;
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

function shortHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}
