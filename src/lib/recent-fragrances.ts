export interface RecentFragrance {
  id: string;
  name: string;
  house: string;
  year: number;
  slug: string;
  imageUrl?: string;
}

const STORAGE_KEY = "tot-recent-searches";
const MAX_RECENT = 9;

function isRecentFragrance(value: unknown): value is RecentFragrance {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.house === "string" &&
    typeof item.year === "number" &&
    typeof item.slug === "string" &&
    (item.imageUrl === undefined || typeof item.imageUrl === "string")
  );
}

export function getRecentFragrances(): RecentFragrance[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentFragrance).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function addRecentFragrance(fragrance: RecentFragrance): void {
  if (typeof window === "undefined") return;
  const next = [
    fragrance,
    ...getRecentFragrances().filter((item) => item.id !== fragrance.id),
  ].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function clearRecentFragrances(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
