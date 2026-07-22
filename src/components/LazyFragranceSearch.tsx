"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

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
  const pendingFocus = useRef(false);

  useEffect(() => {
    if (!enabled || !pendingFocus.current) return;
    pendingFocus.current = false;
    const frame = window.requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(
        'header [data-search-slot="primary"] input[type="search"]:not([readonly])',
      );
      input?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [enabled]);

  if (!enabled) {
    return (
      <SearchPlaceholder
        onActivate={() => {
          pendingFocus.current = true;
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
        className="h-10 w-full cursor-text rounded-full border border-border bg-card pl-10 pr-10 text-sm outline-none placeholder:text-muted sm:text-base"
      />
    </div>
  );
}
