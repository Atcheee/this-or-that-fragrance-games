"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { FragranceSearchResultVisual } from "@/components/FragranceSearchResultVisual";

interface SearchResult {
  id: string;
  name: string;
  house: string;
  year: number;
  slug: string;
  imageUrl?: string;
}

export function FragranceSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/catalog/search?q=${encodeURIComponent(normalized)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search request failed");
        const data = (await response.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
        setActiveIndex(data.results?.length ? 0 : -1);
        setOpen(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
          setActiveIndex(-1);
          setOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function goToResult(result: SearchResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    // Blur before navigate so iOS doesn't keep the input-focus zoom on the next page.
    inputRef.current?.blur();
    router.push(`/fragrance/${result.slug}`);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setActiveIndex(-1);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        results.length === 0 ? -1 : (current + 1) % results.length,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        results.length === 0
          ? -1
          : (current - 1 + results.length) % results.length,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const result = results[activeIndex];
      if (result) goToResult(result);
    } else if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showPopover = open && query.trim().length >= 2;

  return (
    <div
      className="relative w-full max-w-none md:max-w-md"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const result = results[activeIndex] ?? results[0];
          if (result) goToResult(result);
        }}
      >
        <label htmlFor={`${listboxId}-input`} className="sr-only">
          Search fragrances
        </label>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"
          >
            <MagnifyingGlass aria-hidden size={17} weight="regular" />
          </span>
          <input
            ref={inputRef}
            id={`${listboxId}-input`}
            type="search"
            role="combobox"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            onFocus={() => {
              if (query.trim().length >= 2) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search fragrances or houses…"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={showPopover}
            aria-controls={listboxId}
            aria-activedescendant={
              showPopover && activeIndex >= 0
                ? `${listboxId}-option-${activeIndex}`
                : undefined
            }
            className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-10 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          {loading ? (
            <span
              aria-hidden
              className="absolute inset-y-0 right-3 flex items-center"
            >
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-accent" />
            </span>
          ) : null}
        </div>
      </form>

      <span className="sr-only" role="status" aria-live="polite">
        {loading
          ? "Searching"
          : showPopover
            ? `${results.length} search results`
            : ""}
      </span>

      {showPopover ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          {results.length > 0 ? (
            <ul id={listboxId} role="listbox" className="max-h-80 overflow-y-auto p-1.5">
              {results.map((result, index) => (
                <li key={result.id}>
                  <button
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => goToResult(result)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                      index === activeIndex
                        ? "bg-accent-soft text-foreground"
                        : "hover:bg-card-hover"
                    }`}
                  >
                    <FragranceSearchResultVisual fragrance={result} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-5 text-center text-sm text-muted">
              No fragrances found.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
