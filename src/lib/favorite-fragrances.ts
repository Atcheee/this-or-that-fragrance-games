export interface FavoriteFragrance {
  id: string;
  name: string;
  house: string;
  year: number;
  slug: string;
  imageUrl?: string;
  rating: number;
  votes?: number;
  savedAt: string;
}

const STORAGE_KEY = "tot-favorite-fragrances";
const MAX_FAVORITES = 100;

function isFavoriteFragrance(value: unknown): value is FavoriteFragrance {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.house === "string" &&
    typeof item.year === "number" &&
    typeof item.slug === "string" &&
    typeof item.rating === "number" &&
    typeof item.savedAt === "string" &&
    (item.imageUrl === undefined || typeof item.imageUrl === "string") &&
    (item.votes === undefined || typeof item.votes === "number")
  );
}

export function getFavoriteFragrances(): FavoriteFragrance[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFavoriteFragrance).slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

export function isFavoriteFragranceId(id: string): boolean {
  return getFavoriteFragrances().some((item) => item.id === id);
}

export function toggleFavoriteFragrance(
  fragrance: Omit<FavoriteFragrance, "savedAt">,
): boolean {
  if (typeof window === "undefined") return false;

  const current = getFavoriteFragrances();
  const exists = current.some((item) => item.id === fragrance.id);
  const next = exists
    ? current.filter((item) => item.id !== fragrance.id)
    : [
        { ...fragrance, savedAt: new Date().toISOString() },
        ...current,
      ].slice(0, MAX_FAVORITES);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private-mode failures.
  }

  return !exists;
}

export function clearFavoriteFragrances(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
