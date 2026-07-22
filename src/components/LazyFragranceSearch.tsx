"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const FragranceSearch = dynamic(
  () =>
    import("@/components/FragranceSearch").then((mod) => mod.FragranceSearch),
  {
    ssr: false,
    loading: () => <SearchPlaceholder />,
  },
);

export function LazyFragranceSearch() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (!isShortcut) return;
      event.preventDefault();
      setEnabled(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!enabled) {
    return (
      <SearchPlaceholder
        onActivate={() => {
          setEnabled(true);
        }}
      />
    );
  }

  return <FragranceSearch />;
}

function SearchPlaceholder({ onActivate }: { onActivate?: () => void }) {
  return (
    <div className="relative w-full max-w-none md:max-w-md">
      <label className="sr-only" htmlFor="fragrance-search-placeholder">
        Search fragrances
      </label>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"
      >
        <svg viewBox="0 0 256 256" width="17" height="17" fill="currentColor">
          <path d="M229.66 218.34l-50.07-50.06a88.11 88.11 0 1 0-11.31 11.31l50.06 50.07a8 8 0 0 0 11.32-11.32ZM40 112a72 72 0 1 1 72 72 72.08 72.08 0 0 1-72-72Z" />
        </svg>
      </span>
      <input
        id="fragrance-search-placeholder"
        type="search"
        readOnly
        placeholder="Search fragrances or houses…"
        autoComplete="off"
        onFocus={onActivate}
        onClick={onActivate}
        className="h-10 w-full cursor-text rounded-full border border-border bg-card pl-10 pr-10 text-base outline-none placeholder:text-muted"
      />
    </div>
  );
}
