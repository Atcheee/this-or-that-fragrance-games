/** Helpers shared by the dataset build/import scripts. */

export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function dedupeKey(name: string, house: string): string {
  return `${norm(name)}|${norm(house)}`;
}

const SMALL_WORDS = new Set([
  "of", "the", "and", "in", "on", "a", "an", "de", "la", "le", "du", "des",
]);

/** Matches the curated dataset's note casing, e.g. "pink pepper" -> "Pink Pepper". */
export function titleCase(s: string): string {
  return s
    .split(" ")
    .map((word, wordIndex) =>
      word
        .split("-")
        .map((part, partIndex) => {
          const lower = part.toLowerCase();
          if ((wordIndex > 0 || partIndex > 0) && SMALL_WORDS.has(lower)) {
            return lower;
          }
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join("-"),
    )
    .join(" ");
}

export {
  BRAND_ALIASES,
  canonicalHouse,
} from "../src/lib/brand-aliases";
