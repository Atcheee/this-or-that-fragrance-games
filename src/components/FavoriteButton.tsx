"use client";

import { useState } from "react";
import { Heart } from "@phosphor-icons/react";
import {
  isFavoriteFragranceId,
  toggleFavoriteFragrance,
  type FavoriteFragrance,
} from "@/lib/favorite-fragrances";
import { useHydrated } from "@/lib/useHydrated";
import { useAppStore } from "@/lib/store";
import type { TasteFragrance } from "@/lib/taste-passport";

type FavoriteTarget = Omit<FavoriteFragrance, "savedAt">;

export function FavoriteButton({
  fragrance,
  tasteFragrance,
  className = "",
}: {
  fragrance: FavoriteTarget;
  tasteFragrance?: TasteFragrance;
  className?: string;
}) {
  const hydrated = useHydrated();
  const [active, setActive] = useState(() =>
    isFavoriteFragranceId(fragrance.id),
  );
  const recordTasteEvent = useAppStore((state) => state.recordTasteEvent);

  if (!hydrated) {
    return (
      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background ${className}`}
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
      onClick={() => {
        const next = toggleFavoriteFragrance(fragrance);
        setActive(next);
        if (tasteFragrance) {
          recordTasteEvent({
            type: next ? "fragrance_liked" : "fragrance_unliked",
            primary: tasteFragrance,
          });
        }
      }}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-background text-muted hover:border-accent hover:text-accent"
      } ${className}`}
    >
      <Heart aria-hidden size={20} weight={active ? "fill" : "regular"} />
    </button>
  );
}
