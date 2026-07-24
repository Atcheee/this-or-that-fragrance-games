import "server-only";

import rawNotes from "@/data/notes.json";
import {
  getFragranceById,
  getRecommendationCandidates,
  type CatalogFragrance,
} from "@/lib/catalog";
import type {
  NoteTier,
  SwapNoteComparison,
  SwapNoteEdit,
  SwapNoteFragrance,
  SwapNoteMatch,
  SwapNoteMatchResponse,
} from "@/lib/swap-note-types";
import { allNotes } from "@/lib/types";

type SparseVector = Map<string, number>;

interface PreparedCandidate {
  fragrance: CatalogFragrance;
  vector: SparseVector;
}

const TIER_WEIGHTS: Record<NoteTier, number> = {
  top: 1,
  heart: 0.86,
  base: 0.72,
};

const POPULAR_NOTES = [
  "Bergamot",
  "Vanilla",
  "Musk",
  "Jasmine",
  "Rose",
  "Sandalwood",
  "Cedar",
  "Patchouli",
  "Amber",
  "Lavender",
  "Vetiver",
  "Lemon",
  "Orange Blossom",
  "Iris",
  "Cardamom",
  "Tobacco",
  "Oud",
  "Tonka Bean",
] as const;

const DIRECT_ACCORD_RULES: Array<{
  accord: string;
  terms: readonly string[];
}> = [
  {
    accord: "citrus",
    terms: ["bergamot", "lemon", "lime", "orange", "grapefruit", "mandarin", "citron", "yuzu"],
  },
  {
    accord: "fruity",
    terms: ["apple", "pear", "peach", "plum", "berry", "cherry", "pineapple", "mango", "fig", "melon"],
  },
  {
    accord: "floral",
    terms: ["rose", "jasmine", "iris", "violet", "lily", "peony", "orchid", "ylang", "magnolia", "tuberose"],
  },
  {
    accord: "white floral",
    terms: ["jasmine", "tuberose", "gardenia", "orange blossom", "neroli", "lily"],
  },
  {
    accord: "woody",
    terms: ["cedar", "sandalwood", "vetiver", "oud", "agarwood", "oak", "birch", "guaiac"],
  },
  {
    accord: "green",
    terms: ["leaf", "grass", "galbanum", "basil", "mint", "tea", "herb", "sage"],
  },
  {
    accord: "fresh spicy",
    terms: ["pepper", "cardamom", "ginger", "coriander", "juniper"],
  },
  {
    accord: "warm spicy",
    terms: ["cinnamon", "clove", "nutmeg", "saffron", "allspice"],
  },
  {
    accord: "sweet",
    terms: ["vanilla", "tonka", "caramel", "honey", "sugar", "praline", "marshmallow"],
  },
  {
    accord: "gourmand",
    terms: ["chocolate", "cacao", "coffee", "caramel", "praline", "cake", "biscuit", "vanilla"],
  },
  {
    accord: "aromatic",
    terms: ["lavender", "rosemary", "sage", "thyme", "mint", "basil"],
  },
  {
    accord: "aquatic",
    terms: ["water", "marine", "sea", "salt", "ozone", "calone"],
  },
  {
    accord: "smoky",
    terms: ["smoke", "incense", "birch", "tobacco", "charred", "burnt"],
  },
  {
    accord: "leathery",
    terms: ["leather", "suede", "birch", "castoreum"],
  },
  {
    accord: "powdery",
    terms: ["iris", "orris", "violet", "heliotrope", "musk", "vanilla"],
  },
  {
    accord: "resinous",
    terms: ["amber", "benzoin", "labdanum", "myrrh", "frankincense", "opoponax"],
  },
];

const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalized(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toSwapFragrance(fragrance: CatalogFragrance): SwapNoteFragrance {
  return {
    id: fragrance.id,
    name: fragrance.name,
    house: fragrance.house,
    year: fragrance.year,
    rating: fragrance.rating,
    votes: fragrance.votes,
    slug: fragrance.slug,
    imageUrl: fragrance.imageUrl,
    topNotes: fragrance.topNotes,
    heartNotes: fragrance.heartNotes,
    baseNotes: fragrance.baseNotes,
    accords: fragrance.accords,
  };
}

function noteKey(tier: NoteTier): keyof Pick<
  CatalogFragrance,
  "topNotes" | "heartNotes" | "baseNotes"
> {
  if (tier === "top") return "topNotes";
  if (tier === "heart") return "heartNotes";
  return "baseNotes";
}

let accordEvidence: Map<string, Map<string, number>> | undefined;
let preparedCandidates: PreparedCandidate[] | undefined;
const noteChoices = unique([
  ...POPULAR_NOTES,
  ...(rawNotes as { notes: Array<{ name: string }> }).notes.map(
    (note) => note.name,
  ),
]).map((name, index) => ({
  name,
  count: index < POPULAR_NOTES.length ? POPULAR_NOTES.length - index : 0,
}));

function buildEvidence() {
  if (accordEvidence && preparedCandidates) return;

  accordEvidence = new Map();
  const candidates = getRecommendationCandidates(5000);

  for (const fragrance of candidates) {
    for (const note of new Set(allNotes(fragrance))) {
      const noteEvidence =
        accordEvidence.get(normalized(note)) ?? new Map<string, number>();
      fragrance.accords.forEach((accord, index) => {
        const accordName = normalized(accord);
        noteEvidence.set(
          accordName,
          (noteEvidence.get(accordName) ?? 0) + 1 / Math.sqrt(index + 1),
        );
      });
      accordEvidence.set(normalized(note), noteEvidence);
    }
  }

  preparedCandidates = candidates.map((fragrance) => ({
    fragrance,
    vector: vectorFor(fragrance),
  }));
}

function inferredAccords(
  fragrance: Pick<
    CatalogFragrance,
    "topNotes" | "heartNotes" | "baseNotes" | "accords"
  >,
): string[] {
  buildEvidence();
  const scores = new Map<string, number>();
  const addNotes = (notes: string[], tier: NoteTier) => {
    for (const note of notes) {
      const key = normalized(note);
      const evidence = accordEvidence!.get(key);
      if (evidence) {
        const peak = Math.max(...evidence.values(), 1);
        for (const [accord, score] of evidence) {
          scores.set(
            accord,
            (scores.get(accord) ?? 0) +
              (score / peak) * TIER_WEIGHTS[tier] * 0.7,
          );
        }
      }
      for (const rule of DIRECT_ACCORD_RULES) {
        if (rule.terms.some((term) => key.includes(term))) {
          scores.set(
            rule.accord,
            (scores.get(rule.accord) ?? 0) + TIER_WEIGHTS[tier] * 1.25,
          );
        }
      }
    }
  };

  addNotes(fragrance.topNotes, "top");
  addNotes(fragrance.heartNotes, "heart");
  addNotes(fragrance.baseNotes, "base");

  fragrance.accords.forEach((accord, index) => {
    const key = normalized(accord);
    scores.set(key, (scores.get(key) ?? 0) + 0.35 / Math.sqrt(index + 1));
  });

  return [...scores.entries()]
    .sort(([a, aScore], [b, bScore]) => bScore - aScore || a.localeCompare(b))
    .slice(0, 6)
    .map(([accord]) => accord);
}

function vectorFor(
  fragrance: Pick<
    CatalogFragrance,
    "topNotes" | "heartNotes" | "baseNotes" | "accords"
  >,
): SparseVector {
  const vector = new Map<string, number>();
  const addNotes = (notes: string[], tier: NoteTier) => {
    for (const note of notes) {
      vector.set(`note:${normalized(note)}`, TIER_WEIGHTS[tier]);
    }
  };
  addNotes(fragrance.topNotes, "top");
  addNotes(fragrance.heartNotes, "heart");
  addNotes(fragrance.baseNotes, "base");
  fragrance.accords.forEach((accord, index) => {
    vector.set(`accord:${normalized(accord)}`, 0.9 / Math.sqrt(index + 1));
  });
  return vector;
}

function cosineSimilarity(left: SparseVector, right: SparseVector): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (const value of left.values()) leftMagnitude += value * value;
  for (const [key, value] of right) {
    rightMagnitude += value * value;
    dot += value * (left.get(key) ?? 0);
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

function applyEdit(
  original: CatalogFragrance,
  edit: SwapNoteEdit,
): CatalogFragrance {
  const modified: CatalogFragrance = {
    ...original,
    topNotes: [...original.topNotes],
    heartNotes: [...original.heartNotes],
    baseNotes: [...original.baseNotes],
    accords: [...original.accords],
  };
  const key = noteKey(edit.tier);
  const notes = modified[key];

  if (edit.operation === "add") {
    if (
      allNotes(original).some(
        (existingNote) => normalized(existingNote) === normalized(edit.note),
      )
    ) {
      throw new Error(`${edit.note} is already in this fragrance.`);
    }
    modified[key] = unique([...notes, edit.note]);
  } else {
    const target = normalized(edit.note);
    const index = notes.findIndex((note) => normalized(note) === target);
    if (index < 0) {
      throw new Error(`${edit.note} is not in the selected ${edit.tier} tier.`);
    }
    if (edit.operation === "remove") {
      modified[key] = notes.filter((_, noteIndex) => noteIndex !== index);
    } else {
      const replacement = edit.replacementNote.trim();
      if (!replacement) throw new Error("Choose a replacement note.");
      if (
        allNotes(original).some(
          (existingNote) =>
            normalized(existingNote) === normalized(replacement),
        )
      ) {
        throw new Error(
          `${replacement} is already in this fragrance. Choose another note.`,
        );
      }
      modified[key] = unique(
        notes.map((note, noteIndex) =>
          noteIndex === index ? replacement : note,
        ),
      );
    }
  }

  modified.accords = inferredAccords(modified);
  return modified;
}

function difference(left: string[], right: string[]): string[] {
  const rightKeys = new Set(right.map(normalized));
  return unique(left).filter((value) => !rightKeys.has(normalized(value)));
}

function comparisonFor(
  original: CatalogFragrance,
  modified: CatalogFragrance,
): SwapNoteComparison {
  const originalNotes = allNotes(original);
  const modifiedNotes = allNotes(modified);
  return {
    removedNotes: difference(originalNotes, modifiedNotes),
    addedNotes: difference(modifiedNotes, originalNotes),
    removedAccords: difference(original.accords, modified.accords),
    addedAccords: difference(modified.accords, original.accords),
  };
}

function makeExplanation(
  fragrance: CatalogFragrance,
  similarity: number,
  originalSimilarity: number,
  sharedNotes: string[],
  newNotes: string[],
  missingNotes: string[],
): string {
  const gain = similarity - originalSimilarity;
  const parts: string[] = [];
  if (gain >= 3) parts.push(`${gain} points closer to the edited profile`);
  else if (gain <= -3) {
    parts.push(
      `${Math.abs(gain)} points farther from the edited profile than from the original`,
    );
  } else {
    parts.push("similarly close to both versions");
  }
  if (sharedNotes.length > 0) {
    parts.push(`shares ${sharedNotes.slice(0, 3).join(", ")}`);
  }
  if (newNotes.length > 0) {
    parts.push(`introduces ${newNotes.slice(0, 2).join(" and ")}`);
  }
  if (missingNotes.length > 0) {
    parts.push(`leaves out ${missingNotes.slice(0, 2).join(" and ")}`);
  }
  return `${fragrance.name} is ${parts.join("; ")}.`;
}

export function getSwapNoteFragrance(id: string): SwapNoteFragrance | null {
  const fragrance = getFragranceById(id);
  return fragrance ? toSwapFragrance(fragrance) : null;
}

export function searchSwapNotes(query: string, limit = 18): string[] {
  const key = normalized(query);
  const choices = noteChoices;
  if (!key) return choices.slice(0, limit).map((choice) => choice.name);
  return choices
    .filter((choice) => normalized(choice.name).includes(key))
    .sort((a, b) => {
      const aStarts = normalized(a.name).startsWith(key) ? 1 : 0;
      const bStarts = normalized(b.name).startsWith(key) ? 1 : 0;
      return bStarts - aStarts || b.count - a.count || a.name.localeCompare(b.name);
    })
    .slice(0, limit)
    .map((choice) => choice.name);
}

export function matchSwapNote(
  fragranceId: string,
  edit: SwapNoteEdit,
  limit = 6,
): SwapNoteMatchResponse {
  buildEvidence();
  const original = getFragranceById(fragranceId);
  if (!original) throw new Error("Fragrance not found.");
  const modified = applyEdit(original, edit);
  const modifiedVector = vectorFor(modified);
  const originalVector = vectorFor(original);
  const originalNotes = allNotes(original);
  const modifiedNotes = allNotes(modified);

  const matches: SwapNoteMatch[] = preparedCandidates!
    .filter(({ fragrance }) => fragrance.id !== original.id)
    .map(({ fragrance, vector }) => {
      const similarity = Math.round(cosineSimilarity(modifiedVector, vector) * 100);
      const originalSimilarity = Math.round(
        cosineSimilarity(originalVector, vector) * 100,
      );
      const candidateNotes = allNotes(fragrance);
      const sharedModifiedNotes = unique(modifiedNotes).filter((note) =>
        candidateNotes.some(
          (candidateNote) => normalized(candidateNote) === normalized(note),
        ),
      );
      const newComparedWithOriginal = difference(candidateNotes, originalNotes);
      const missingFromOriginal = difference(originalNotes, candidateNotes);
      return {
        fragrance: toSwapFragrance(fragrance),
        similarity,
        originalSimilarity,
        editGain: similarity - originalSimilarity,
        sharedModifiedNotes,
        newComparedWithOriginal,
        missingFromOriginal,
        explanation: makeExplanation(
          fragrance,
          similarity,
          originalSimilarity,
          sharedModifiedNotes,
          newComparedWithOriginal,
          missingFromOriginal,
        ),
        rank:
          similarity * 0.94 +
          Math.min(fragrance.rating / 5, 1) * 3 +
          Math.min(Math.log10((fragrance.votes ?? 0) + 1) / 5, 1) * 3,
      };
    })
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        b.similarity - a.similarity ||
        (b.fragrance.votes ?? 0) - (a.fragrance.votes ?? 0),
    )
    .slice(0, Math.max(1, Math.min(limit, 10)))
    .map(({ rank, ...match }) => {
      void rank;
      return match;
    });

  return {
    original: toSwapFragrance(original),
    modified: toSwapFragrance(modified),
    comparison: comparisonFor(original, modified),
    matches,
  };
}
