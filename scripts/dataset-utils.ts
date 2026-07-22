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

/**
 * Different sources spell houses differently; map to the catalog's canonical
 * names so entries land in the same house.
 */
const BRAND_ALIASES: Record<string, string> = {
  christiandior: "Dior",
  dior: "Dior",
  gianniversace: "Versace",
  versace: "Versace",
  rabanne: "Paco Rabanne",
  pacorabanne: "Paco Rabanne",
  armani: "Giorgio Armani",
  giorgioarmani: "Giorgio Armani",
  emporioarmani: "Giorgio Armani",
  ysl: "Yves Saint Laurent",
  yvessaintlaurent: "Yves Saint Laurent",
  jeanpaulgaultier: "Jean Paul Gaultier",
  thierrymugler: "Mugler",
  mugler: "Mugler",
  dolcegabbana: "Dolce & Gabbana",
  dolceandgabbana: "Dolce & Gabbana",
  hermes: "Hermès",
  jomalone: "Jo Malone London",
  jomalonelondon: "Jo Malone London",
  viktorrolf: "Viktor & Rolf",
  viktorandrolf: "Viktor & Rolf",
  tomford: "Tom Ford",
  maisonfranciskurkdjian: "Maison Francis Kurkdjian",
  mfk: "Maison Francis Kurkdjian",
  fredericmalle: "Frederic Malle",
  editionsdeparfumsfredericmalle: "Frederic Malle",
  abercrombiefitch: "Abercrombie & Fitch",
  abercrombieandfitch: "Abercrombie & Fitch",
  bulgari: "Bvlgari",
  bvlgari: "Bvlgari",
  acquadiparma: "Acqua di Parma",
  bykilian: "Kilian",
  kilianparis: "Kilian",
  kilian: "Kilian",
  etatlibredorange: "Etat Libre d'Orange",
  boadiceathevictorious: "Boadicea the Victorious",
  juliettehasagun: "Juliette Has a Gun",
  penhaligons: "Penhaligon's",
  rojadove: "Roja Parfums",
  roja: "Roja Parfums",
  rojaparfums: "Roja Parfums",
  lacostefragrances: "Lacoste",
  lacoste: "Lacoste",
  alfreddunhill: "Dunhill",
  dunhilllondon: "Dunhill",
  dunhill: "Dunhill",
  chopard: "Chopard",
};

export function canonicalHouse(raw: string): string {
  return BRAND_ALIASES[norm(raw)] ?? raw.trim();
}
