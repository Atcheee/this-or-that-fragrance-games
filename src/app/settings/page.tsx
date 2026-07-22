"use client";

import { useEffect, useState } from "react";
import {
  clearFavoriteFragrances,
  getFavoriteFragrances,
} from "@/lib/favorite-fragrances";
import { useAppStore } from "@/lib/store";
import { MODES, getMode } from "@/lib/modes";
import { useHydrated } from "@/lib/useHydrated";

export default function SettingsPage() {
  const { apiKey, setApiKey, history, best, clearHistory } = useAppStore();
  const [keyInput, setKeyInput] = useState(() => useAppStore.getState().apiKey);
  const [saved, setSaved] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    setFavoriteCount(getFavoriteFragrances().length);
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 py-4">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Settings</h1>
        <h2 className="text-lg font-semibold">Data source</h2>
        <p className="text-sm text-muted">
          By default, games use a built-in catalog of ~120 well-known
          fragrances. If you have a free{" "}
          <a
            href="https://fraganty.ai/api-docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            Fraganty API key
          </a>{" "}
          (request one at api@fraganty.ai), paste it below and compatible games
          (Higher Rating, Contains This Note, Has This Main Accord, Find Your
          Favorite) will draw from their database of 100k+ perfumes instead.
          The key is stored only in your browser.
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Fraganty API key (optional)"
            className="flex-1 rounded-xl border-2 border-border bg-card px-4 py-2.5 outline-none transition-colors focus:border-accent"
          />
          <button
            onClick={() => {
              setApiKey(keyInput);
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
            className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 dark:text-black"
          >
            {saved ? "Saved!" : "Save"}
          </button>
        </div>
        <p className="text-xs text-muted">
          {apiKey
            ? "An API key is set — compatible games will try the Fraganty API and fall back to the built-in catalog on errors."
            : "No API key set — all games use the built-in catalog."}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Personal bests</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MODES.map((mode) => (
            <div
              key={mode.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
            >
              <span>{mode.title}</span>
              <span className="font-semibold text-muted">
                {best[mode.id] === undefined
                  ? "—"
                  : mode.kind === "naming"
                    ? `${best[mode.id]} named`
                    : mode.kind === "connections"
                      ? `${Math.round(best[mode.id]! / 25)}/4 groups`
                    : mode.kind === "bracket" || mode.kind === "discovery"
                      ? "played"
                      : `${best[mode.id]}%`}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Recent games{" "}
          <span className="font-normal text-muted">({history.length})</span>
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">No games played yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {history.slice(0, 15).map((record, i) => (
              <li
                key={`${record.playedAt}-${i}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2 text-sm"
              >
                <span>
                  {getMode(record.mode)?.title ?? record.mode}
                  {record.label && (
                    <span className="text-muted"> · {record.label}</span>
                  )}
                </span>
                <span className="font-semibold">
                  {record.total > 0
                    ? `${record.score}/${record.total}`
                    : record.label
                      ? "🏆"
                      : record.score}
                </span>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => {
            if (confirm("Clear all game history and personal bests?")) {
              clearHistory();
            }
          }}
          className="rounded-xl border border-danger px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
        >
          Clear history & bests
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Favorites{" "}
          <span className="font-normal text-muted">({favoriteCount})</span>
        </h2>
        <p className="text-sm text-muted">
          Saved fragrances are stored only in this browser. Clearing them cannot
          be undone.
        </p>
        <button
          onClick={() => {
            if (confirm("Clear all favorite fragrances?")) {
              clearFavoriteFragrances();
              setFavoriteCount(0);
            }
          }}
          disabled={favoriteCount === 0}
          className="rounded-xl border border-danger px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear favorites
        </button>
      </section>
    </div>
  );
}
