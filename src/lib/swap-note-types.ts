export type NoteTier = "top" | "heart" | "base";

export type SwapNoteEdit =
  | {
      operation: "remove";
      note: string;
      tier: NoteTier;
    }
  | {
      operation: "replace";
      note: string;
      replacementNote: string;
      tier: NoteTier;
    }
  | {
      operation: "add";
      note: string;
      tier: NoteTier;
    };

export interface SwapNoteFragrance {
  id: string;
  name: string;
  house: string;
  year: number;
  rating: number;
  votes?: number;
  slug: string;
  imageUrl?: string;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  accords: string[];
}

export interface SwapNoteComparison {
  removedNotes: string[];
  addedNotes: string[];
  removedAccords: string[];
  addedAccords: string[];
}

export interface SwapNoteMatch {
  fragrance: SwapNoteFragrance;
  similarity: number;
  originalSimilarity: number;
  editGain: number;
  sharedModifiedNotes: string[];
  newComparedWithOriginal: string[];
  missingFromOriginal: string[];
  explanation: string;
}

export interface SwapNoteMatchResponse {
  original: SwapNoteFragrance;
  modified: SwapNoteFragrance;
  comparison: SwapNoteComparison;
  matches: SwapNoteMatch[];
}
