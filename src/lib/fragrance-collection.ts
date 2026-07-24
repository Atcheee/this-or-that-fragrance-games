export const COLLECTION_STATUSES = [
  "owned",
  "sampled",
  "wanted",
  "disliked",
] as const;

export type CollectionStatus = (typeof COLLECTION_STATUSES)[number];

export interface CollectionFragrance {
  id: string;
  name: string;
  house: string;
  year: number;
  slug: string;
  imageUrl?: string;
}

export interface CollectionEntry extends CollectionFragrance {
  status: CollectionStatus;
  addedAt: string;
}

export interface CollectionStat {
  name: string;
  count: number;
  share: number;
}

export interface CollectionCoverage {
  name: string;
  score: number;
}

export interface CollectionGap {
  name: string;
  count: number;
  explanation: string;
}

export interface SimilarityBreakdown {
  score: number;
  first: CollectionFragrance;
  second: CollectionFragrance;
  sharedAccords: string[];
  sharedNotes: string[];
  sameHouse: boolean;
}

export interface CollectionRecommendation {
  title: string;
  fragrance?: CollectionFragrance;
  score?: number;
  explanation: string;
}

export interface CollectionAnalysis {
  ownedCount: number;
  dominantNotes: CollectionStat[];
  dominantAccords: CollectionStat[];
  seasons: CollectionCoverage[];
  dayNight: CollectionCoverage[];
  houses: CollectionStat[];
  decades: CollectionStat[];
  categories: CollectionGap[];
  redundantPairs: SimilarityBreakdown[];
  recommendations: {
    bestNextAddition?: CollectionRecommendation;
    unusualUsefulAddition?: CollectionRecommendation;
    probablyDoNotNeed?: CollectionRecommendation;
    weakestSeasonalCoverage?: CollectionRecommendation;
  };
}

const STORAGE_KEY = "tot-fragrance-collection";
const CHANGE_EVENT = "tot-fragrance-collection-change";
const MAX_COLLECTION_SIZE = 500;

function isStatus(value: unknown): value is CollectionStatus {
  return COLLECTION_STATUSES.includes(value as CollectionStatus);
}

function isCollectionEntry(value: unknown): value is CollectionEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.house === "string" &&
    typeof item.year === "number" &&
    typeof item.slug === "string" &&
    typeof item.addedAt === "string" &&
    isStatus(item.status) &&
    (item.imageUrl === undefined || typeof item.imageUrl === "string")
  );
}

export function getCollection(): CollectionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCollectionEntry).slice(0, MAX_COLLECTION_SIZE);
  } catch {
    return [];
  }
}

function saveCollection(entries: CollectionEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_COLLECTION_SIZE)),
    );
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // Ignore quota and private-mode failures.
  }
}

export function setCollectionStatus(
  fragrance: CollectionFragrance,
  status: CollectionStatus,
): CollectionEntry[] {
  const current = getCollection();
  const previous = current.find((entry) => entry.id === fragrance.id);
  const nextEntry: CollectionEntry = {
    ...fragrance,
    status,
    addedAt: previous?.addedAt ?? new Date().toISOString(),
  };
  const next = [
    nextEntry,
    ...current.filter((entry) => entry.id !== fragrance.id),
  ];
  saveCollection(next);
  return next;
}

export function removeFromCollection(id: string): CollectionEntry[] {
  const next = getCollection().filter((entry) => entry.id !== id);
  saveCollection(next);
  return next;
}

export function clearCollection(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // Ignore storage failures.
  }
}

export function subscribeToCollection(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
