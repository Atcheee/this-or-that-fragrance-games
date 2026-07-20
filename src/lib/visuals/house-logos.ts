/**
 * Map fragrance houses to brand websites, then resolve a logo via DuckDuckGo's
 * favicon CDN. Unknown houses fall back to a best-effort `{slug}.com` guess.
 */

const HOUSE_DOMAINS: Record<string, string> = {
  guerlain: "guerlain.com",
  "giorgio armani": "armani.com",
  xerjoff: "xerjoff.com",
  dior: "dior.com",
  "yves saint laurent": "ysl.com",
  "roja parfums": "rojadove.com",
  "paco rabanne": "rabanne.com",
  amouage: "amouage.com",
  "penhaligon's": "penhaligons.com",
  versace: "versace.com",
  "hugo boss": "hugoboss.com",
  creed: "creedboutique.com",
  valentino: "valentino.com",
  chanel: "chanel.com",
  "tom ford": "tomford.com",
  "jean paul gaultier": "jeanpaulgaultier.com",
  hermes: "hermes.com",
  "calvin klein": "calvinklein.com",
  mancera: "manceraparfums.com",
  prada: "prada.com",
  "dolce & gabbana": "dolcegabbana.com",
  bvlgari: "bulgari.com",
  lattafa: "lattafa.com",
  givenchy: "givenchy.com",
  "jil sander": "jilsander.com",
  "m. micallef": "micallef.com",
  "tiziana terenzi": "tizianaterenzi.com",
  "acqua di parma": "acquadiparma.com",
  lancome: "lancome.com",
  "jo malone": "jomalone.com",
  "jo malone london": "jomalone.com",
  "l'artisan parfumeur": "artisanparfumeur.com",
  kenzo: "kenzo.com",
  gucci: "gucci.com",
  montale: "montaleparfums.com",
  "pierre guillaume": "pierreguillaumeparis.com",
  avon: "avon.com",
  lalique: "lalique.com",
  "elizabeth arden": "elizabetharden.com",
  "ormonde jayne": "ormondejayne.com",
  armaf: "armaf.com",
  byredo: "byredo.com",
  davidoff: "davidoff.com",
  escada: "escada.com",
  fragonard: "fragonard.com",
  "van cleef & arpels": "vancleefarpels.com",
  "estee lauder": "esteelauder.com",
  "maison francis kurkdjian": "franciskurkdjian.com",
  zara: "zara.com",
  "yves rocher": "yves-rocher.com",
  "issey miyake": "isseymiyake.com",
  rasasi: "rasasi.com",
  lacoste: "lacoste.com",
  "l'occitane en provence": "loccitane.com",
  "miller harris": "millerharris.com",
  nishane: "nishane.com",
  "bath & body works": "bathandbodyworks.com",
  "parfums de marly": "parfumsdemarly.com",
  mugler: "mugler.com",
  burberry: "burberry.com",
  trussardi: "trussardi.com",
  "etat libre d'orange": "etatlibredorange.com",
  zoologist: "zoologistperfumes.com",
  "carolina herrera": "carolinaherrera.com",
  kilian: "bykilian.com",
  "salvatore ferragamo": "ferragamo.com",
  chopard: "chopard.com",
  etro: "etro.com",
  "ex nihilo": "exnihilo.com",
  floris: "florislondon.com",
  "marc jacobs": "marcjacobs.com",
  "anna sui": "annasui.com",
  electimuss: "electimuss.com",
  "victor & rolf": "viktor-rolf.com",
  "viktor & rolf": "viktor-rolf.com",
  "frederic malle": "fredericmalle.com",
  "juliette has a gun": "juliettehasagun.com",
  "initio parfums prives": "initioparfums.com",
  "memo paris": "memoparisc.com",
  "diptyque": "diptyqueparis.com",
  "le labo": "lelabofragrances.com",
  "aesop": "aesop.com",
  "clean reserve": "cleanbeauty.com",
  "commodity": "commodityfragrances.com",
  "phlur": "phlur.com",
  "ellis brooklyn": "ellisbrooklyn.com",
  "nest": "nestnewyork.com",
  "nest fragrances": "nestnewyork.com",
};

function normKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Best-effort website for a house name. */
export function houseDomain(name: string): string | null {
  const key = normKey(name);
  if (HOUSE_DOMAINS[key]) return HOUSE_DOMAINS[key]!;

  // Strip parenthetical / slash aliases: "Al Haramain / الحرمين" → "Al Haramain"
  const cleaned = name
    .split(/[|/]/)[0]!
    .replace(/\s+/g, " ")
    .trim();
  const cleanedKey = normKey(cleaned);
  if (HOUSE_DOMAINS[cleanedKey]) return HOUSE_DOMAINS[cleanedKey]!;

  const slug = cleanedKey.replace(/[^a-z0-9]+/g, "");
  if (slug.length < 3) return null;
  return `${slug}.com`;
}

export function houseLogoUrl(name: string): string | null {
  const domain = houseDomain(name);
  if (!domain) return null;
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

/** Initials for the monogram fallback (e.g. "Tom Ford" → "TF"). */
export function houseInitials(name: string): string {
  const parts = name
    .replace(/[|/].*$/, "")
    .trim()
    .split(/\s+/)
    .filter((p) => !/^(de|di|du|la|le|the|and|&)$/i.test(p));
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
