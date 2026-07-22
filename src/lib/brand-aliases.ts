/**
 * Brand abbreviations / alternate spellings → canonical house names.
 * Used for dataset ingest and for expanding search/guess inputs (ysl → Yves Saint Laurent).
 */
export const BRAND_ALIASES: Record<string, string> = {
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
  jpg: "Jean Paul Gaultier",
  thierrymugler: "Mugler",
  mugler: "Mugler",
  dolcegabbana: "Dolce & Gabbana",
  dolceandgabbana: "Dolce & Gabbana",
  dng: "Dolce & Gabbana",
  hermes: "Hermès",
  jomalone: "Jo Malone London",
  jomalonelondon: "Jo Malone London",
  viktorrolf: "Viktor & Rolf",
  viktorandrolf: "Viktor & Rolf",
  tomford: "Tom Ford",
  tf: "Tom Ford",
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
  parfumsdemarly: "Parfums de Marly",
  pdm: "Parfums de Marly",
};

const COMBINING_MARKS = /[\u0300-\u036f]/g;

/** Compact key used for alias lookup (letters/digits only). */
export function compactBrandKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Map a raw house string to the catalog's canonical name when known. */
export function canonicalHouse(raw: string): string {
  return BRAND_ALIASES[compactBrandKey(raw)] ?? raw.trim();
}

/** Resolve a typed token (e.g. "ysl") to its canonical house, if any. */
export function resolveBrandAlias(term: string): string | undefined {
  return BRAND_ALIASES[compactBrandKey(term)];
}

/**
 * Expand abbreviated brand tokens in a search query.
 * "ysl libre" → ["yves", "saint", "laurent", "libre"] (after normalizeHouse).
 */
export function expandBrandSearchTerms(
  terms: readonly string[],
  normalizeHouse: (value: string) => string,
): string[] {
  return terms.flatMap((term) => {
    const canonical = resolveBrandAlias(term);
    if (!canonical) return [term];
    const expanded = normalizeHouse(canonical)
      .split(/\s+/)
      .filter(Boolean);
    return expanded.length > 0 ? expanded : [term];
  });
}

/** Abbreviation tokens for a house (e.g. Yves Saint Laurent → ["ysl", ...]). */
export function brandAliasTokensForHouse(house: string): string[] {
  const target = compactBrandKey(house);
  if (!target) return [];

  const tokens: string[] = [];
  for (const [alias, canonical] of Object.entries(BRAND_ALIASES)) {
    if (compactBrandKey(canonical) === target && alias !== target) {
      tokens.push(alias);
    }
  }
  return tokens;
}
