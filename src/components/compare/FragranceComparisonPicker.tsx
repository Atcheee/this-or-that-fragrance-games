"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowsLeftRight,
  Check,
  Copy,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { FragranceSearchResultVisual } from "@/components/FragranceSearchResultVisual";

export interface ComparisonPickerFragrance {
  id: string;
  name: string;
  house: string;
  year: number;
  slug: string;
  imageUrl?: string;
}

type Side = "first" | "second";

export function FragranceComparisonPicker({
  first,
  second,
}: {
  first?: ComparisonPickerFragrance;
  second?: ComparisonPickerFragrance;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function navigate(side: Side, fragrance?: ComparisonPickerFragrance) {
    const nextFirst = side === "first" ? fragrance : first;
    const nextSecond = side === "second" ? fragrance : second;
    const params = new URLSearchParams();
    if (nextFirst) params.set("first", nextFirst.slug);
    if (nextSecond) params.set("second", nextSecond.slug);
    const query = params.toString();
    startTransition(() => router.push(query ? `/compare?${query}` : "/compare"));
  }

  function swap() {
    if (!first && !second) return;
    const params = new URLSearchParams();
    if (second) params.set("first", second.slug);
    if (first) params.set("second", first.slug);
    startTransition(() => router.push(`/compare?${params.toString()}`));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      aria-label="Choose fragrances to compare"
      className="rounded-3xl border border-border bg-card p-5 sm:p-7"
    >
      <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <FragranceField
          key={`first:${first?.id ?? ""}:${second?.id ?? ""}`}
          side="first"
          label="First fragrance"
          selected={first}
          excludedId={second?.id}
          onSelect={(fragrance) => navigate("first", fragrance)}
        />
        <button
          type="button"
          onClick={swap}
          disabled={isPending || (!first && !second)}
          aria-label="Swap fragrances"
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40 md:mb-0.5"
        >
          <ArrowsLeftRight aria-hidden size={19} weight="bold" />
        </button>
        <FragranceField
          key={`second:${second?.id ?? ""}:${first?.id ?? ""}`}
          side="second"
          label="Second fragrance"
          selected={second}
          excludedId={first?.id}
          onSelect={(fragrance) => navigate("second", fragrance)}
        />
      </div>

      <div className="mt-4 flex min-h-9 items-center justify-center">
        {first && second ? (
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-foreground"
          >
            {copied ? (
              <Check aria-hidden size={16} weight="bold" />
            ) : (
              <Copy aria-hidden size={16} />
            )}
            {copied ? "Link copied" : "Copy comparison link"}
          </button>
        ) : (
          <p className="text-center text-sm text-muted">
            Select two different fragrances to reveal their comparison.
          </p>
        )}
      </div>
    </section>
  );
}

function FragranceField({
  side,
  label,
  selected,
  excludedId,
  onSelect,
}: {
  side: Side;
  label: string;
  selected?: ComparisonPickerFragrance;
  excludedId?: string;
  onSelect: (fragrance?: ComparisonPickerFragrance) => void;
}) {
  const listboxId = useId();
  const selectedLabel = selected
    ? `${selected.name} — ${selected.house}`
    : "";
  const [query, setQuery] = useState(selectedLabel);
  const [results, setResults] = useState<ComparisonPickerFragrance[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalized = query.trim();
    if (!open || normalized.length < 2 || normalized === selectedLabel) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/catalog/search?q=${encodeURIComponent(normalized)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search request failed");
        const data = (await response.json()) as {
          results?: ComparisonPickerFragrance[];
        };
        setResults(
          (data.results ?? []).filter((result) => result.id !== excludedId),
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [excludedId, open, query, selectedLabel]);

  function choose(fragrance: ComparisonPickerFragrance) {
    setQuery(`${fragrance.name} — ${fragrance.house}`);
    setResults([]);
    setLoading(false);
    setOpen(false);
    onSelect(fragrance);
  }

  return (
    <div className="relative">
      <label
        htmlFor={`${listboxId}-input`}
        className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted"
      >
        {label}
      </label>
      <span className="relative block">
        <MagnifyingGlass
          aria-hidden
          size={17}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          id={`${listboxId}-input`}
          type="search"
          value={query}
          onFocus={(event) => {
            setOpen(true);
            event.currentTarget.select();
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setResults([]);
            setLoading(nextQuery.trim().length >= 2);
            setOpen(true);
          }}
          placeholder={
            side === "first"
              ? "Search first fragrance…"
              : "Search second fragrance…"
          }
          autoComplete="off"
          role="combobox"
          aria-expanded={open && (loading || results.length > 0)}
          aria-controls={listboxId}
          className="h-12 w-full rounded-xl border border-border bg-background pl-10 pr-10 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        {query ? (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery("");
              setResults([]);
              setLoading(false);
              setOpen(true);
              onSelect(undefined);
            }}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-card-hover hover:text-foreground"
          >
            <X aria-hidden size={15} weight="bold" />
          </button>
        ) : null}
      </span>

      {open && query.trim().length >= 2 && query !== selectedLabel ? (
        <span className="absolute left-0 right-0 top-full z-30 mt-2 block overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl">
          {loading ? (
            <span className="block px-3 py-5 text-center text-sm text-muted">
              Searching…
            </span>
          ) : results.length > 0 ? (
            <span id={listboxId} role="listbox" className="block">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  role="option"
                  aria-selected="false"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(result)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-card-hover"
                >
                  <FragranceSearchResultVisual fragrance={result} />
                </button>
              ))}
            </span>
          ) : (
            <span className="block px-3 py-5 text-center text-sm text-muted">
              No fragrances found.
            </span>
          )}
        </span>
      ) : null}
    </div>
  );
}
