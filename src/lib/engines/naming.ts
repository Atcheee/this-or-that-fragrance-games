import type { Fragrance } from "../types";
import { allNotes } from "../types";
import { pick } from "../random";

export interface NamingChallenge {
  /** "house" or "note" */
  kind: "house" | "note";
  subject: string;
  answers: Fragrance[];
}

export function createHouseChallenge(data: Fragrance[]): NamingChallenge {
  const counts = new Map<string, Fragrance[]>();
  for (const f of data) {
    counts.set(f.house, [...(counts.get(f.house) ?? []), f]);
  }
  // Cap the answer count so the challenge stays winnable.
  const eligible = [...counts.entries()].filter(
    ([, list]) => list.length >= 3 && list.length <= 50,
  );
  const [subject, answers] = pick(eligible);
  return { kind: "house", subject, answers };
}

export function createNoteChallenge(data: Fragrance[]): NamingChallenge {
  const counts = new Map<string, Fragrance[]>();
  for (const f of data) {
    for (const note of new Set(allNotes(f))) {
      counts.set(note, [...(counts.get(note) ?? []), f]);
    }
  }
  const eligible = [...counts.entries()].filter(
    ([, list]) => list.length >= 4 && list.length <= 40,
  );
  const [subject, answers] = pick(eligible);
  return { kind: "note", subject, answers };
}

/**
 * Matches a typed guess against the remaining answers. Comparison is
 * normalized (case, diacritics, punctuation) with a small Levenshtein
 * tolerance for typos on longer names.
 */
export function matchGuess(
  input: string,
  candidates: Fragrance[],
): Fragrance | null {
  const guess = normalize(input);
  if (!guess) return null;

  for (const candidate of candidates) {
    for (const key of nameKeys(candidate)) {
      if (key === guess) return candidate;
      const tolerance = key.length >= 10 ? 2 : key.length >= 6 ? 1 : 0;
      if (tolerance > 0 && levenshtein(guess, key) <= tolerance) {
        return candidate;
      }
    }
  }
  return null;
}

function nameKeys(f: Fragrance): string[] {
  const keys = new Set<string>();
  const name = normalize(f.name);
  keys.add(name);
  keys.add(normalize(`${f.name} ${f.house}`));
  keys.add(normalize(`${f.house} ${f.name}`));
  // "K by Dolce & Gabbana" should match a plain "k"
  const withoutBy = f.name.replace(new RegExp(`\\s+by\\s+${f.house}.*$`, "i"), "");
  keys.add(normalize(withoutBy));
  return [...keys].filter(Boolean);
}

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[°º]/g, "o")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return Infinity;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}
