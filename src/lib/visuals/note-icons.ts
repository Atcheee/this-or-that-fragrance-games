/**
 * Resolve perfume-note names to Fragrantica's simple ingredient icons
 * (fimgs.net/mdimg/sastojci) — the same illustrated thumbnails used in
 * perfume pyramids, not noisy Wikipedia photos.
 */

import noteIcons from "@/data/note-icons.json";

const NOTE_IDS = noteIcons as Record<string, number>;

/** Extra aliases not present (or differently labeled) on the notes index. */
const ALIASES: Record<string, string> = {
  "white musk": "musk",
  "cedarwood": "cedar",
  "cedar wood": "cedar",
  "virginia cedar": "cedar",
  "atlas cedar": "cedar",
  "tonka": "tonka bean",
  "ylang ylang": "ylang-ylang",
  "oak moss": "oakmoss",
  "ambergris": "ambergris",
  "orange blossom": "orange blossom",
  "mandarin": "mandarin orange",
  "clementine": "mandarin orange",
  "haitian vetiver": "vetiver",
  "java vetiver": "vetiver",
  "provencal lavender": "lavender",
  "french lavender": "lavender",
  "english lavender": "lavender",
  "damask rose": "rose",
  "turkish rose": "rose",
  "bulgarian rose": "rose",
  "moroccan rose": "rose",
  "pink peppercorn": "pink pepper",
  "sichuan pepper": "sichuan pepper",
  "iso e super": "iso e super",
};

function normKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lookupId(key: string): number | undefined {
  if (NOTE_IDS[key] != null) return NOTE_IDS[key];
  const alias = ALIASES[key];
  if (alias && NOTE_IDS[alias] != null) return NOTE_IDS[alias];
  return undefined;
}

/** Fragrantica note icon id for a free-text note label, if known. */
export function resolveNoteIconId(name: string): number | null {
  const key = normKey(name);
  const direct = lookupId(key);
  if (direct != null) return direct;

  const words = key.split(" ").filter(Boolean);
  // "Provençal Lavender" / "Haitian Vetiver" → try the head note
  if (words.length > 1) {
    for (let i = 1; i < words.length; i++) {
      const tail = words.slice(i).join(" ");
      const id = lookupId(tail);
      if (id != null) return id;
    }
    const last = words[words.length - 1]!;
    const id = lookupId(last);
    if (id != null) return id;
  }

  return null;
}

/** Absolute URL for the simple Fragrantica note illustration. */
export function noteIconUrl(name: string): string | null {
  const id = resolveNoteIconId(name);
  if (id == null) return null;
  return `https://fimgs.net/mdimg/sastojci/t.${id}.jpg`;
}
