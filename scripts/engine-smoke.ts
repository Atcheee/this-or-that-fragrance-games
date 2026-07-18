/* Quick smoke test for the game engines. Run: npx tsx scripts/engine-smoke.ts */
import data from "../src/data/fragrances.json";
import type { Fragrance } from "../src/lib/types";
import { allNotes } from "../src/lib/types";
import { generatePairRounds } from "../src/lib/engines/this-or-that";
import { generateYesNoRounds } from "../src/lib/engines/yes-no";
import {
  generateWhichHouseRounds,
  generateDescriptionRounds,
  redact,
} from "../src/lib/engines/multiple-choice";
import { createBracket } from "../src/lib/engines/bracket";
import {
  createHouseChallenge,
  createNoteChallenge,
  matchGuess,
} from "../src/lib/engines/naming";

const pool = data as Fragrance[];
let failures = 0;

function check(name: string, ok: boolean, extra?: unknown) {
  if (!ok) {
    failures++;
    console.error(`FAIL: ${name}`, extra ?? "");
  } else {
    console.log(`ok: ${name}`);
  }
}

const curated = pool.filter(
  (f) =>
    !f.id.startsWith("parfumo-") &&
    !f.id.startsWith("fragella-") &&
    !f.id.startsWith("ff-"),
);
check("dataset size >= 5000", pool.length >= 5000, pool.length);
check("curated subset >= 100", curated.length >= 100, curated.length);
check(
  "all entries have core data",
  pool.every(
    (f) =>
      f.id &&
      f.name &&
      f.house &&
      f.rating > 0 &&
      f.rating <= 5 &&
      f.topNotes.length + f.heartNotes.length + f.baseNotes.length > 0 &&
      f.accords.length > 0,
  ),
);
check(
  "curated entries have price and description",
  curated.every((f) => f.price > 0 && f.description.length > 20),
);
check("unique ids", new Set(pool.map((f) => f.id)).size === pool.length);

const pairs = generatePairRounds(pool.slice(0, 40), 20, (f) => f.rating);
check("pair rounds count", pairs.length === 20, pairs.length);
check(
  "pair rounds have distinct values and correct winner",
  pairs.every((r) => {
    const winner = r.correctId === r.a.id ? r.a : r.b;
    const loser = r.correctId === r.a.id ? r.b : r.a;
    return winner.rating > loser.rating;
  }),
);

const yn = generateYesNoRounds(
  pool.slice(0, 30),
  20,
  allNotes,
  [...new Set(pool.flatMap(allNotes))],
);
check("yes-no rounds count", yn.length === 20);
check(
  "yes-no answers consistent",
  yn.every((r) => allNotes(r.fragrance).includes(r.subject) === r.answer),
);
const yesCount = yn.filter((r) => r.answer).length;
check("yes-no mix has both answers", yesCount > 0 && yesCount < yn.length, yesCount);

const houses = [...new Set(pool.map((f) => f.house))];
const wh = generateWhichHouseRounds(pool.slice(0, 30), 15, houses);
check(
  "which-house rounds valid",
  wh.length === 15 &&
    wh.every(
      (r) =>
        r.options.length === 4 &&
        new Set(r.options).size === 4 &&
        r.options[r.answerIndex] === r.fragrance.house,
    ),
);

const desc = generateDescriptionRounds(pool, 15);
check(
  "description rounds redacted",
  desc.every(
    (r) =>
      !r.promptText!.toLowerCase().includes(r.fragrance.name.toLowerCase()) &&
      !r.promptText!.toLowerCase().includes(r.fragrance.house.toLowerCase()) &&
      r.options[r.answerIndex] === `${r.fragrance.name} — ${r.fragrance.house}`,
  ),
);
check(
  "redact handles special chars",
  redact("N°5 by Chanel is Chanel's icon", ["N°5", "Chanel"]) ===
    "▮▮▮▮▮ by ▮▮▮▮▮ is ▮▮▮▮▮ icon",
  redact("N°5 by Chanel is Chanel's icon", ["N°5", "Chanel"]),
);

check("bracket size", createBracket(pool, 16).length === 16);
check(
  "bracket unique entries",
  new Set(createBracket(pool, 32).map((f) => f.id)).size === 32,
);

const hc = createHouseChallenge(pool);
check(
  "house challenge answers all from subject",
  hc.answers.length >= 3 && hc.answers.every((f) => f.house === hc.subject),
  hc.subject,
);
const nc = createNoteChallenge(pool);
check(
  "note challenge answers contain note",
  nc.answers.length >= 4 && nc.answers.every((f) => allNotes(f).includes(nc.subject)),
  nc.subject,
);

const aventus = pool.find((f) => f.id === "creed-aventus")!;
const no5 = pool.find((f) => f.id === "chanel-no5")!;
const laNuit = pool.find((f) => f.id === "ysl-la-nuit-de-lhomme")!;
check("match exact", matchGuess("Aventus", [aventus, no5]) === aventus);
check("match typo", matchGuess("avantus", [aventus, no5]) === aventus);
check("match diacritics/apostrophes", matchGuess("la nuit de lhomme", [laNuit]) === laNuit);
check("match no5 symbol", matchGuess("no 5", [no5]) === no5);
check("no match garbage", matchGuess("zzzzzz", [aventus, no5]) === null);
check("no match empty", matchGuess("   ", [aventus]) === null);

console.log(failures === 0 ? "\nAll engine checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
