"use client";

import Link from "next/link";
import { Heart, MagnifyingGlass } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { CatalogFragranceCard } from "@/components/CatalogFragranceCard";
import {
  clearFavoriteFragrances,
  getFavoriteFragrances,
  type FavoriteFragrance,
} from "@/lib/favorite-fragrances";
import { useHydrated } from "@/lib/useHydrated";

export default function FavoritesPage() {
  const hydrated = useHydrated();
  const [favorites, setFavorites] = useState<FavoriteFragrance[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    setFavorites(getFavoriteFragrances());
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            <Heart aria-hidden size={14} weight="fill" />
            Saved for later
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Favorites
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Fragrances you heart stay on this device so you can revisit them
            anytime.
          </p>
        </div>
        {favorites.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              if (!confirm("Clear all favorite fragrances?")) return;
              clearFavoriteFragrances();
              setFavorites([]);
            }}
            className="w-fit rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-danger hover:text-danger"
          >
            Clear all
          </button>
        ) : null}
      </header>

      {favorites.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <Heart
            aria-hidden
            size={36}
            weight="regular"
            className="text-muted"
          />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">No favorites yet</h2>
            <p className="mx-auto max-w-md text-sm text-muted">
              Open any fragrance and tap the heart to save it here for later.
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/fragrances"
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 dark:text-black"
            >
              Browse fragrances
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-foreground"
            >
              <MagnifyingGlass aria-hidden size={16} />
              Search catalog
            </Link>
          </div>
        </section>
      ) : (
        <section>
          <p className="mb-4 text-sm text-muted">
            {favorites.length} saved fragrance
            {favorites.length === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {favorites.map((fragrance) => (
              <CatalogFragranceCard key={fragrance.id} fragrance={fragrance} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
