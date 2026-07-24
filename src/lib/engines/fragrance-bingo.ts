import { hashSeed, seededShuffle } from "../daily";
import type { Fragrance } from "../types";
import { allNotes } from "../types";

export const BINGO_SIZE = 5;
export const BINGO_SQUARES = BINGO_SIZE ** 2;

export type BingoRarity = "common" | "uncommon" | "rare";

export type BingoConditionQuery =
  | { field: "note"; operator: "includes"; value: string }
  | { field: "note"; operator: "includes-any"; values: string[] }
  | { field: "top-note" | "base-note"; operator: "includes"; value: string }
  | { field: "accord"; operator: "includes"; value: string }
  | {
      field: "year" | "rating" | "price" | "votes" | "note-count";
      operator: "lt" | "lte" | "gte";
      value: number;
    };

export interface BingoCondition {
  id: string;
  label: string;
  rarity: BingoRarity;
  query: BingoConditionQuery;
}

export interface FragranceBingoCard {
  id: string;
  seed: string;
  squares: BingoCondition[];
}

export interface CompletedBingoLine {
  id: string;
  label: string;
  indexes: number[];
}

const UNUSUAL_NOTES = [
  "Cannabis",
  "Caviar",
  "Concrete",
  "Gunpowder",
  "Ink",
  "Metallic Notes",
  "Rubber",
  "Seaweed",
  "Truffle",
  "Vinyl",
];

const CONDITIONS: BingoCondition[] = [
  note("vanilla", "Contains vanilla", "common"),
  note("bergamot", "Contains bergamot", "common"),
  note("musk", "Contains musk", "common"),
  note("jasmine", "Contains jasmine", "common"),
  note("rose", "Contains rose", "common"),
  note("patchouli", "Contains patchouli", "common"),
  note("cedar", "Contains cedar", "common"),
  note("amber", "Contains amber", "common"),
  accord("woody", "Has a woody accord", "common"),
  accord("floral", "Has a floral accord", "common"),
  accord("fresh", "Has a fresh accord", "common"),
  accord("citrus", "Has a citrus accord", "common"),
  accord("sweet", "Has a sweet accord", "common"),
  accord("aromatic", "Has an aromatic accord", "common"),
  numeric("year-after-2010", "Released in 2010 or later", "common", {
    field: "year",
    operator: "gte",
    value: 2010,
  }),
  numeric("rating-4", "Rating at least 4.0", "common", {
    field: "rating",
    operator: "gte",
    value: 4,
  }),
  numeric("notes-8", "Lists 8 or more notes", "common", {
    field: "note-count",
    operator: "gte",
    value: 8,
  }),
  note("tobacco", "Contains tobacco", "uncommon"),
  note("incense", "Contains incense", "uncommon"),
  note("leather", "Contains leather", "uncommon"),
  note("coconut", "Contains coconut", "uncommon"),
  note("coffee", "Contains coffee", "uncommon"),
  note("oud", "Contains oud", "uncommon"),
  note("iris", "Contains iris", "uncommon"),
  note("fig", "Contains fig", "uncommon"),
  note("salt", "Contains salt", "uncommon"),
  note("cherry", "Contains cherry", "uncommon"),
  note("honey", "Contains honey", "uncommon"),
  note("tea", "Contains tea", "uncommon"),
  accord("aquatic", "Has an aquatic accord", "uncommon"),
  accord("powdery", "Has a powdery accord", "uncommon"),
  accord("smoky", "Has a smoky accord", "uncommon"),
  accord("gourmand", "Has a gourmand accord", "uncommon"),
  numeric("before-1990", "Released before 1990", "uncommon", {
    field: "year",
    operator: "lt",
    value: 1990,
  }),
  numeric("rating-4-2", "Rating at least 4.2", "uncommon", {
    field: "rating",
    operator: "gte",
    value: 4.2,
  }),
  numeric("price-150", "Costs at least $150 / 100ml", "uncommon", {
    field: "price",
    operator: "gte",
    value: 150,
  }),
  numeric("votes-5000", "Has 5,000+ community votes", "uncommon", {
    field: "votes",
    operator: "gte",
    value: 5_000,
  }),
  positionedNote(
    "top-lemon",
    "Lemon appears as a top note",
    "uncommon",
    "top-note",
    "lemon",
  ),
  positionedNote(
    "base-vanilla",
    "Vanilla appears as a base note",
    "uncommon",
    "base-note",
    "vanilla",
  ),
  {
    id: "unusual-note",
    label: "Uses an unusual note",
    rarity: "rare",
    query: {
      field: "note",
      operator: "includes-any",
      values: UNUSUAL_NOTES,
    },
  },
  note("cannabis", "Contains cannabis", "rare"),
  note("gunpowder", "Contains gunpowder", "rare"),
  note("seaweed", "Contains seaweed", "rare"),
  note("truffle", "Contains truffle", "rare"),
  note("caviar", "Contains caviar", "rare"),
  note("rubber", "Contains rubber", "rare"),
  numeric("before-1970", "Released before 1970", "rare", {
    field: "year",
    operator: "lt",
    value: 1970,
  }),
  numeric("rating-4-5", "Rating at least 4.5", "rare", {
    field: "rating",
    operator: "gte",
    value: 4.5,
  }),
  numeric("price-300", "Costs at least $300 / 100ml", "rare", {
    field: "price",
    operator: "gte",
    value: 300,
  }),
  numeric("votes-20000", "Has 20,000+ community votes", "rare", {
    field: "votes",
    operator: "gte",
    value: 20_000,
  }),
];

const TARGET_MIX: Record<BingoRarity, number> = {
  common: 11,
  uncommon: 9,
  rare: 5,
};

export function matchesBingoCondition(
  fragrance: Fragrance,
  condition: BingoCondition,
): boolean {
  const query = condition.query;
  if (query.field === "note") {
    const notes = allNotes(fragrance).map(normalize);
    if (query.operator === "includes-any") {
      const values = query.values.map(normalize);
      return values.some((value) => notes.includes(value));
    }
    return notes.includes(normalize(query.value));
  }
  if (query.field === "top-note" || query.field === "base-note") {
    const notes =
      query.field === "top-note" ? fragrance.topNotes : fragrance.baseNotes;
    return notes.map(normalize).includes(normalize(query.value));
  }
  if (query.field === "accord") {
    return fragrance.accords
      .map(normalize)
      .includes(normalize(query.value));
  }
  if (typeof query.value !== "number") return false;

  const actual =
    query.field === "year"
      ? fragrance.year
      : query.field === "rating"
        ? fragrance.rating
        : query.field === "price"
          ? fragrance.price
          : query.field === "votes"
            ? (fragrance.votes ?? 0)
            : allNotes(fragrance).length;
  if (actual <= 0) return false;
  if (query.operator === "lt") return actual < query.value;
  if (query.operator === "lte") return actual <= query.value;
  return actual >= query.value;
}

export function generateFragranceBingoCard(
  catalog: readonly Fragrance[],
  seed: string,
): FragranceBingoCard {
  const viable = CONDITIONS.filter((condition) =>
    catalog.some((fragrance) => matchesBingoCondition(fragrance, condition)),
  );
  if (viable.length < BINGO_SQUARES) {
    throw new Error("Catalog does not contain enough Fragrance Bingo conditions.");
  }

  const picked: BingoCondition[] = [];
  for (const rarity of ["common", "uncommon", "rare"] as const) {
    const candidates = viable.filter((condition) => condition.rarity === rarity);
    picked.push(
      ...seededShuffle(candidates, hashSeed(`${seed}:${rarity}`)).slice(
        0,
        TARGET_MIX[rarity],
      ),
    );
  }

  if (picked.length < BINGO_SQUARES) {
    const used = new Set(picked.map((condition) => condition.id));
    picked.push(
      ...seededShuffle(
        viable.filter((condition) => !used.has(condition.id)),
        hashSeed(`${seed}:fallback`),
      ).slice(0, BINGO_SQUARES - picked.length),
    );
  }

  return {
    id: `fragrance-bingo-${hashSeed(seed).toString(36)}`,
    seed,
    squares: seededShuffle(picked, hashSeed(`${seed}:board`)),
  };
}

export function matchingBingoSquareIndexes(
  card: FragranceBingoCard,
  fragrance: Fragrance,
): number[] {
  return card.squares.flatMap((condition, index) =>
    matchesBingoCondition(fragrance, condition) ? [index] : [],
  );
}

export function completedBingoLines(
  markedIndexes: ReadonlySet<number>,
): CompletedBingoLine[] {
  return bingoLines().filter((line) =>
    line.indexes.every((index) => markedIndexes.has(index)),
  );
}

export function formatBingoTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function bingoLines(): CompletedBingoLine[] {
  const lines: CompletedBingoLine[] = [];
  for (let row = 0; row < BINGO_SIZE; row += 1) {
    lines.push({
      id: `row-${row}`,
      label: `Row ${row + 1}`,
      indexes: Array.from(
        { length: BINGO_SIZE },
        (_, column) => row * BINGO_SIZE + column,
      ),
    });
  }
  for (let column = 0; column < BINGO_SIZE; column += 1) {
    lines.push({
      id: `column-${column}`,
      label: `Column ${column + 1}`,
      indexes: Array.from(
        { length: BINGO_SIZE },
        (_, row) => row * BINGO_SIZE + column,
      ),
    });
  }
  lines.push(
    {
      id: "diagonal-down",
      label: "Diagonal",
      indexes: Array.from(
        { length: BINGO_SIZE },
        (_, index) => index * BINGO_SIZE + index,
      ),
    },
    {
      id: "diagonal-up",
      label: "Reverse diagonal",
      indexes: Array.from(
        { length: BINGO_SIZE },
        (_, index) => index * BINGO_SIZE + (BINGO_SIZE - index - 1),
      ),
    },
  );
  return lines;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function note(
  value: string,
  label: string,
  rarity: BingoRarity,
): BingoCondition {
  return {
    id: `note-${value}`,
    label,
    rarity,
    query: { field: "note", operator: "includes", value },
  };
}

function accord(
  value: string,
  label: string,
  rarity: BingoRarity,
): BingoCondition {
  return {
    id: `accord-${value}`,
    label,
    rarity,
    query: { field: "accord", operator: "includes", value },
  };
}

function numeric(
  id: string,
  label: string,
  rarity: BingoRarity,
  query: Extract<
    BingoConditionQuery,
    { field: "year" | "rating" | "price" | "votes" | "note-count" }
  >,
): BingoCondition {
  return { id, label, rarity, query };
}

function positionedNote(
  id: string,
  label: string,
  rarity: BingoRarity,
  field: "top-note" | "base-note",
  value: string,
): BingoCondition {
  return {
    id,
    label,
    rarity,
    query: { field, operator: "includes", value },
  };
}
