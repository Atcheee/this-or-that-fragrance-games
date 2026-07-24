"use client";

import {
  ArrowRight,
  ArrowsLeftRight,
  Check,
  MagnifyingGlass,
  Minus,
  Plus,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { NoteImage } from "@/components/NoteImage";
import type {
  NoteTier,
  SwapNoteFragrance,
  SwapNoteMatchResponse,
} from "@/lib/swap-note-types";

interface SearchResult {
  id: string;
  name: string;
  house: string;
  year: number;
  slug: string;
  imageUrl?: string;
}

type Operation = "remove" | "replace" | "add";

const OPERATIONS: Array<{
  id: Operation;
  label: string;
  help: string;
  Icon: typeof Minus;
}> = [
  { id: "remove", label: "Remove", help: "Take one note out", Icon: Minus },
  {
    id: "replace",
    label: "Replace",
    help: "Trade one note for another",
    Icon: ArrowsLeftRight,
  },
  { id: "add", label: "Add", help: "Layer in one new note", Icon: Plus },
];

const TIERS: Array<{ id: NoteTier; label: string; eyebrow: string }> = [
  { id: "top", label: "Top notes", eyebrow: "Opening" },
  { id: "heart", label: "Heart notes", eyebrow: "Center" },
  { id: "base", label: "Base notes", eyebrow: "Drydown" },
];

function notesForTier(fragrance: SwapNoteFragrance, tier: NoteTier): string[] {
  if (tier === "top") return fragrance.topNotes;
  if (tier === "heart") return fragrance.heartNotes;
  return fragrance.baseNotes;
}

function allProfileNotes(fragrance: SwapNoteFragrance): string[] {
  return [
    ...fragrance.topNotes,
    ...fragrance.heartNotes,
    ...fragrance.baseNotes,
  ];
}

export function SwapNoteWorkbench() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SwapNoteFragrance | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [operation, setOperation] = useState<Operation>("replace");
  const [tier, setTier] = useState<NoteTier>("top");
  const [selectedNote, setSelectedNote] = useState("");
  const [newNote, setNewNote] = useState("");
  const [noteSuggestions, setNoteSuggestions] = useState<string[]>([]);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [result, setResult] = useState<SwapNoteMatchResponse | null>(null);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState("");
  const searchListId = useId();
  const noteListId = useId();
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2 || selected) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/catalog/search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search failed.");
        const data = (await response.json()) as { results?: SearchResult[] };
        setSearchResults(data.results ?? []);
      } catch (requestError) {
        if (
          !(requestError instanceof DOMException) ||
          requestError.name !== "AbortError"
        ) {
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  useEffect(() => {
    if (!notePickerOpen || (operation !== "add" && operation !== "replace")) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/swap-note?notes=${encodeURIComponent(newNote.trim())}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Note search failed.");
        const data = (await response.json()) as { notes?: string[] };
        setNoteSuggestions(data.notes ?? []);
      } catch (requestError) {
        if (
          !(requestError instanceof DOMException) ||
          requestError.name !== "AbortError"
        ) {
          setNoteSuggestions([]);
        }
      }
    }, 140);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [newNote, notePickerOpen, operation]);

  useEffect(() => {
    if (result) {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [result]);

  const existingNoteKeys = useMemo(
    () =>
      new Set(
        selected
          ? allProfileNotes(selected).map((note) => note.toLowerCase())
          : [],
      ),
    [selected],
  );
  const duplicateNewNote = existingNoteKeys.has(newNote.trim().toLowerCase());
  const invalidReplacement =
    operation === "replace" &&
    existingNoteKeys.has(newNote.trim().toLowerCase());
  const canMatch =
    Boolean(selected) &&
    Boolean(newNote.trim() || operation === "remove") &&
    Boolean(selectedNote || operation === "add") &&
    !matching &&
    !(operation === "add" && duplicateNewNote) &&
    !invalidReplacement;

  async function chooseFragrance(searchResult: SearchResult) {
    setSelecting(true);
    setError("");
    try {
      const response = await fetch(
        `/api/swap-note?id=${encodeURIComponent(searchResult.id)}`,
      );
      const data = (await response.json()) as {
        fragrance?: SwapNoteFragrance;
        error?: string;
      };
      if (!response.ok || !data.fragrance) {
        throw new Error(data.error || "Could not load fragrance.");
      }
      const fragrance = data.fragrance;
      setSelected(fragrance);
      setQuery(`${fragrance.name} — ${fragrance.house}`);
      setSearchResults([]);
      setTier(fragrance.topNotes.length > 0 ? "top" : "heart");
      setSelectedNote(
        fragrance.topNotes[0] ??
          fragrance.heartNotes[0] ??
          fragrance.baseNotes[0] ??
          "",
      );
      setNewNote("");
      setResult(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load fragrance.",
      );
    } finally {
      setSelecting(false);
    }
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setSelectedNote("");
    setNewNote("");
    setResult(null);
    setError("");
  }

  function changeOperation(nextOperation: Operation) {
    setOperation(nextOperation);
    setResult(null);
    setError("");
    if (nextOperation === "add") setSelectedNote("");
    else if (selected) {
      const firstTier = TIERS.find(
        (candidate) => notesForTier(selected, candidate.id).length > 0,
      )?.id;
      if (firstTier) {
        setTier(firstTier);
        setSelectedNote(notesForTier(selected, firstTier)[0] ?? "");
      }
    }
    setNewNote("");
  }

  function chooseTier(nextTier: NoteTier) {
    setTier(nextTier);
    setResult(null);
    if (operation !== "add" && selected) {
      setSelectedNote(notesForTier(selected, nextTier)[0] ?? "");
    }
  }

  async function findMatches() {
    if (!selected || !canMatch) return;
    setMatching(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/swap-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fragranceId: selected.id,
          operation,
          tier,
          note: operation === "add" ? newNote.trim() : selectedNote,
          ...(operation === "replace"
            ? { replacementNote: newNote.trim() }
            : {}),
        }),
      });
      const data = (await response.json()) as SwapNoteMatchResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not recalculate profile.");
      }
      setResult(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not recalculate profile.",
      );
    } finally {
      setMatching(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-12">
      <header className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-accent">
          <Sparkle aria-hidden size={14} weight="fill" />
          Scent laboratory
        </span>
        <h1 className="mt-5 text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl">
          Swap a note.
          <br />
          <span className="text-accent">Find what it becomes.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
          Rewrite one part of a fragrance. We rebuild its scent profile and
          search real bottles for the closest version of your idea.
        </p>
      </header>

      <section
        aria-labelledby="choose-fragrance-title"
        className="rounded-3xl border border-border bg-card p-5 shadow-[0_20px_70px_-55px_rgba(0,0,0,0.8)] sm:p-7"
      >
        <div className="flex items-start gap-4">
          <StepNumber value="1" complete={Boolean(selected)} />
          <div className="min-w-0 flex-1">
            <h2
              id="choose-fragrance-title"
              className="font-display text-xl font-semibold sm:text-2xl"
            >
              Choose a fragrance
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Search by fragrance or house.
            </p>

            <div className="relative mt-5 max-w-2xl">
              <MagnifyingGlass
                aria-hidden
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  if (selected) clearSelection();
                  if (event.target.value.trim().length < 2) {
                    setSearchResults([]);
                    setSearching(false);
                  }
                  setQuery(event.target.value);
                }}
                placeholder="Try Aventus, Guerlain, Black Orchid…"
                aria-label="Search for a fragrance"
                aria-controls={searchListId}
                autoComplete="off"
                className="h-13 w-full rounded-2xl border border-border bg-background pl-12 pr-12 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
              {(query || selected) && (
                <button
                  type="button"
                  onClick={clearSelection}
                  aria-label="Clear fragrance"
                  className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-card-hover hover:text-foreground"
                >
                  <X aria-hidden size={16} weight="bold" />
                </button>
              )}
              {!selected && query.trim().length >= 2 && (
                <div
                  id={searchListId}
                  className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl"
                >
                  {searching || selecting ? (
                    <p className="px-4 py-5 text-center text-sm text-muted">
                      Searching catalog…
                    </p>
                  ) : searchResults.length > 0 ? (
                    <ul className="max-h-80 overflow-y-auto">
                      {searchResults.map((fragrance) => (
                        <li key={fragrance.id}>
                          <button
                            type="button"
                            onClick={() => chooseFragrance(fragrance)}
                            className="flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left hover:bg-card-hover"
                          >
                            <span className="flex h-14 w-12 shrink-0 items-end justify-center">
                              <FragranceBottleImage
                                imageUrl={fragrance.imageUrl}
                                alt=""
                                width={60}
                                height={80}
                                sizes="48px"
                                className="max-h-14 w-auto max-w-12 object-contain"
                                placeholderClassName="h-10 w-auto text-muted opacity-30"
                              />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                {fragrance.name}
                              </span>
                              <span className="mt-0.5 block truncate text-sm text-muted">
                                {fragrance.house}
                                {fragrance.year > 0
                                  ? ` · ${fragrance.year}`
                                  : ""}
                              </span>
                            </span>
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
              )}
            </div>

            {selected && <SelectedFragrance fragrance={selected} />}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="edit-note-title"
        className={`rounded-3xl border bg-card p-5 transition sm:p-7 ${
          selected ? "border-border" : "border-border/60 opacity-55"
        }`}
      >
        <div className="flex items-start gap-4">
          <StepNumber value="2" complete={Boolean(result)} />
          <div className="min-w-0 flex-1">
            <h2
              id="edit-note-title"
              className="font-display text-xl font-semibold sm:text-2xl"
            >
              Make one change
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              One controlled edit makes its effect easy to understand.
            </p>

            <fieldset disabled={!selected} className="mt-5">
              <legend className="sr-only">Type of note edit</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {OPERATIONS.map(({ id, label, help, Icon }) => {
                  const active = operation === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => changeOperation(id)}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-accent bg-accent-soft text-foreground"
                          : "border-border bg-background hover:border-accent/60"
                      }`}
                    >
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                          active
                            ? "bg-accent text-[#17120a]"
                            : "bg-card-hover text-muted"
                        }`}
                      >
                        <Icon aria-hidden size={17} weight="bold" />
                      </span>
                      <span>
                        <span className="block text-sm font-bold">{label}</span>
                        <span className="block text-xs text-muted">{help}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                    {operation === "add"
                      ? "Choose where it appears"
                      : "Choose note to change"}
                  </p>
                  <div className="mt-3 space-y-4">
                    {TIERS.map((tierOption) => {
                      const tierNotes = selected
                        ? notesForTier(selected, tierOption.id)
                        : [];
                      if (operation !== "add" && tierNotes.length === 0) {
                        return null;
                      }
                      return (
                        <div key={tierOption.id}>
                          <button
                            type="button"
                            onClick={() => chooseTier(tierOption.id)}
                            className={`mb-2 flex items-center gap-2 text-left text-sm font-bold ${
                              tier === tierOption.id
                                ? "text-accent"
                                : "text-muted hover:text-foreground"
                            }`}
                          >
                            <span
                              className={`size-2 rounded-full ${
                                tier === tierOption.id
                                  ? "bg-accent"
                                  : "bg-border"
                              }`}
                            />
                            {tierOption.label}
                            <span className="font-normal text-muted">
                              · {tierOption.eyebrow}
                            </span>
                          </button>
                          {operation !== "add" && (
                            <div className="flex flex-wrap gap-2">
                              {tierNotes.map((note) => {
                                const active =
                                  tier === tierOption.id &&
                                  selectedNote === note;
                                return (
                                  <button
                                    key={note}
                                    type="button"
                                    onClick={() => {
                                      setTier(tierOption.id);
                                      setSelectedNote(note);
                                      setResult(null);
                                    }}
                                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                                      active
                                        ? "border-accent bg-accent text-[#17120a]"
                                        : "border-border bg-background hover:border-accent/60"
                                    }`}
                                  >
                                    {note}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  {operation === "remove" ? (
                    <EditPreview
                      operation={operation}
                      selectedNote={selectedNote}
                      newNote=""
                      tier={tier}
                    />
                  ) : (
                    <div>
                      <label
                        htmlFor={noteListId}
                        className="text-xs font-bold uppercase tracking-[0.14em] text-muted"
                      >
                        {operation === "replace"
                          ? "Replacement note"
                          : "New note"}
                      </label>
                      <div className="relative mt-3">
                        <input
                          id={noteListId}
                          value={newNote}
                          onChange={(event) => {
                            setNewNote(event.target.value);
                            setNotePickerOpen(true);
                            setResult(null);
                          }}
                          onFocus={() => setNotePickerOpen(true)}
                          onBlur={() =>
                            window.setTimeout(
                              () => setNotePickerOpen(false),
                              120,
                            )
                          }
                          placeholder="Search notes…"
                          autoComplete="off"
                          className="h-12 w-full rounded-2xl border border-border bg-background px-4 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                        />
                        {notePickerOpen && noteSuggestions.length > 0 && (
                          <ul className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-2xl">
                            {noteSuggestions.map((note) => (
                              <li key={note}>
                                <button
                                  type="button"
                                  onMouseDown={(event) =>
                                    event.preventDefault()
                                  }
                                  onClick={() => {
                                    setNewNote(note);
                                    setNotePickerOpen(false);
                                  }}
                                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-card-hover"
                                >
                                  <NoteImage
                                    name={note}
                                    className="size-8 rounded-lg"
                                    imageClassName="h-[85%] w-[85%] object-contain"
                                  />
                                  {note}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {operation === "add" && duplicateNewNote && (
                        <p className="mt-2 text-xs font-semibold text-danger">
                          Already in this fragrance. Choose a different note.
                        </p>
                      )}
                      {invalidReplacement && (
                        <p className="mt-2 text-xs font-semibold text-danger">
                          Choose a note that is not already in this fragrance.
                        </p>
                      )}
                      <EditPreview
                        operation={operation}
                        selectedNote={selectedNote}
                        newNote={newNote}
                        tier={tier}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-7 flex flex-col items-start gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-xs leading-5 text-muted">
                  Match uses weighted note tiers and recalculated accords.
                  Results come from 5,000 well-rated, community-tested
                  fragrances.
                </p>
                <button
                  type="button"
                  disabled={!canMatch}
                  onClick={findMatches}
                  className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-6 font-bold text-[#17120a] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-45 sm:w-auto"
                >
                  {matching ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-[#17120a]/30 border-t-[#17120a]" />
                      Rebuilding profile…
                    </>
                  ) : (
                    <>
                      Find closest fragrances
                      <ArrowRight aria-hidden size={17} weight="bold" />
                    </>
                  )}
                </button>
              </div>
            </fieldset>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-danger/40 bg-danger-soft px-5 py-4 text-sm font-semibold text-danger"
        >
          {error}
        </div>
      )}

      {result && (
        <div ref={resultsRef} className="scroll-mt-28 space-y-8">
          <ProfileComparison result={result} />
          <RankedMatches result={result} />
        </div>
      )}
    </div>
  );
}

function StepNumber({
  value,
  complete,
}: {
  value: string;
  complete: boolean;
}) {
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
        complete
          ? "border-success bg-success-soft text-success"
          : "border-accent/60 text-accent"
      }`}
    >
      {complete ? <Check aria-hidden size={17} weight="bold" /> : value}
    </span>
  );
}

function SelectedFragrance({
  fragrance,
}: {
  fragrance: SwapNoteFragrance;
}) {
  return (
    <div className="mt-5 flex items-center gap-5 rounded-2xl border border-accent/30 bg-accent-soft/50 p-4">
      <div className="flex h-28 w-20 shrink-0 items-end justify-center">
        <FragranceBottleImage
          imageUrl={fragrance.imageUrl}
          alt={`${fragrance.name} bottle`}
          width={105}
          height={140}
          sizes="80px"
          className="max-h-28 w-auto max-w-20 object-contain"
          placeholderClassName="h-20 w-auto text-muted opacity-35"
        />
      </div>
      <div className="min-w-0">
        <p className="font-display text-xl font-semibold">{fragrance.name}</p>
        <p className="mt-1 text-sm text-muted">
          {fragrance.house}
          {fragrance.year > 0 ? ` · ${fragrance.year}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {fragrance.accords.slice(0, 5).map((accord) => (
            <span
              key={accord}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold capitalize"
            >
              {accord}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditPreview({
  operation,
  selectedNote,
  newNote,
  tier,
}: {
  operation: Operation;
  selectedNote: string;
  newNote: string;
  tier: NoteTier;
}) {
  const label = TIERS.find((item) => item.id === tier)?.label ?? tier;
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-border bg-background p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
        Edit preview
      </p>
      <div className="mt-3 flex items-center gap-3">
        {operation !== "add" && selectedNote ? (
          <span className="rounded-full bg-danger-soft px-3 py-1.5 text-sm font-bold text-danger line-through">
            {selectedNote}
          </span>
        ) : null}
        {operation === "replace" && (
          <ArrowRight aria-hidden size={16} className="text-muted" />
        )}
        {operation !== "remove" && (
          <span
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${
              newNote
                ? "bg-success-soft text-success"
                : "border border-border text-muted"
            }`}
          >
            {newNote || "Choose note"}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">{label}</p>
    </div>
  );
}

function ProfileComparison({ result }: { result: SwapNoteMatchResponse }) {
  return (
    <section aria-labelledby="profile-comparison-title">
      <div className="mb-5 flex items-start gap-4">
        <StepNumber value="3" complete />
        <div>
          <h2
            id="profile-comparison-title"
            className="font-display text-2xl font-semibold sm:text-3xl"
          >
            Original versus modified
          </h2>
          <p className="mt-1 text-sm text-muted">
            One note edit can reorder the surrounding accords.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileCard
          label="Original"
          fragrance={result.original}
          removedNotes={result.comparison.removedNotes}
          removedAccords={result.comparison.removedAccords}
        />
        <ProfileCard
          label="Modified"
          fragrance={result.modified}
          addedNotes={result.comparison.addedNotes}
          addedAccords={result.comparison.addedAccords}
          featured
        />
      </div>
    </section>
  );
}

function ProfileCard({
  label,
  fragrance,
  removedNotes = [],
  addedNotes = [],
  removedAccords = [],
  addedAccords = [],
  featured = false,
}: {
  label: string;
  fragrance: SwapNoteFragrance;
  removedNotes?: string[];
  addedNotes?: string[];
  removedAccords?: string[];
  addedAccords?: string[];
  featured?: boolean;
}) {
  const removedNoteKeys = new Set(removedNotes.map((note) => note.toLowerCase()));
  const addedNoteKeys = new Set(addedNotes.map((note) => note.toLowerCase()));
  const removedAccordKeys = new Set(
    removedAccords.map((accord) => accord.toLowerCase()),
  );
  const addedAccordKeys = new Set(
    addedAccords.map((accord) => accord.toLowerCase()),
  );

  return (
    <article
      className={`rounded-3xl border p-5 sm:p-6 ${
        featured
          ? "border-accent bg-accent-soft/35"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          {label}
        </p>
        {featured && (
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-[#17120a]">
            Recalculated
          </span>
        )}
      </div>
      <h3 className="mt-2 font-display text-xl font-semibold">
        {fragrance.name}
      </h3>
      <div className="mt-5 space-y-4">
        {TIERS.map((tier) => (
          <div key={tier.id}>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              {tier.label}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {notesForTier(fragrance, tier.id).map((note) => {
                const removed = removedNoteKeys.has(note.toLowerCase());
                const added = addedNoteKeys.has(note.toLowerCase());
                return (
                  <span
                    key={note}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      removed
                        ? "bg-danger-soft text-danger line-through"
                        : added
                          ? "bg-success-soft text-success"
                          : "border border-border bg-background"
                    }`}
                  >
                    {note}
                  </span>
                );
              })}
              {tier.id === "top" &&
                removedNotes.map((note) =>
                  !allProfileNotes(fragrance).includes(note) ? (
                    <span
                      key={note}
                      className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger line-through"
                    >
                      {note}
                    </span>
                  ) : null,
                )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">
          Accord profile
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {fragrance.accords.map((accord) => {
            const removed = removedAccordKeys.has(accord.toLowerCase());
            const added = addedAccordKeys.has(accord.toLowerCase());
            return (
              <span
                key={accord}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                  removed
                    ? "bg-danger-soft text-danger line-through"
                    : added
                      ? "bg-success-soft text-success"
                      : "border border-border bg-background"
                }`}
              >
                {accord}
              </span>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function RankedMatches({ result }: { result: SwapNoteMatchResponse }) {
  return (
    <section aria-labelledby="ranked-matches-title">
      <div className="mb-5 flex items-start gap-4">
        <StepNumber value="4" complete />
        <div>
          <h2
            id="ranked-matches-title"
            className="font-display text-2xl font-semibold sm:text-3xl"
          >
            Closest real fragrances
          </h2>
          <p className="mt-1 text-sm text-muted">
            Ranked against the edited profile, with every difference explained.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {result.matches.map((match, index) => (
          <article
            key={match.fragrance.id}
            className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card transition hover:-translate-y-0.5 hover:border-accent"
          >
            <div className="relative flex h-48 items-end justify-center border-b border-border bg-white p-4">
              <span className="absolute left-4 top-4 flex size-8 items-center justify-center rounded-full bg-[#17140f] text-xs font-bold text-white">
                {index + 1}
              </span>
              <span className="absolute right-4 top-4 rounded-full bg-accent px-3 py-1.5 text-sm font-black text-[#17120a]">
                {match.similarity}% match
              </span>
              <FragranceBottleImage
                imageUrl={match.fragrance.imageUrl}
                alt={`${match.fragrance.name} bottle`}
                width={150}
                height={200}
                sizes="150px"
                className="max-h-40 w-auto max-w-[9rem] object-contain"
                placeholderClassName="h-28 w-auto text-stone-400 opacity-40"
              />
            </div>

            <div className="flex flex-1 flex-col p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
                {match.fragrance.house}
              </p>
              <h3 className="mt-1 font-display text-xl font-semibold leading-tight">
                {match.fragrance.name}
              </h3>
              <p className="mt-1 text-xs text-muted">
                {match.fragrance.year > 0 ? match.fragrance.year : "Year unknown"}
                {match.fragrance.rating > 0
                  ? ` · ${match.fragrance.rating.toFixed(1)} ★`
                  : ""}
              </p>

              <p className="mt-4 text-sm leading-6 text-muted">
                {match.explanation}
              </p>

              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <DifferenceRow
                  label="Keeps"
                  values={match.sharedModifiedNotes}
                  tone="success"
                />
                <DifferenceRow
                  label="Adds"
                  values={match.newComparedWithOriginal}
                  tone="accent"
                />
                <DifferenceRow
                  label="Leaves out"
                  values={match.missingFromOriginal}
                  tone="muted"
                />
              </div>

              <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-wider text-muted">
                    Before edit
                  </p>
                  <p className="mt-0.5 font-mono text-sm">
                    {match.originalSimilarity}%
                    <span
                      className={`ml-2 font-sans text-xs font-bold ${
                        match.editGain > 0
                          ? "text-success"
                          : match.editGain < 0
                            ? "text-danger"
                            : "text-muted"
                      }`}
                    >
                      {match.editGain > 0 ? "+" : ""}
                      {match.editGain}
                    </span>
                  </p>
                </div>
                <Link
                  href={`/fragrance/${match.fragrance.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-bold transition hover:border-accent hover:text-accent"
                >
                  View bottle
                  <ArrowRight aria-hidden size={13} weight="bold" />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DifferenceRow({
  label,
  values,
  tone,
}: {
  label: string;
  values: string[];
  tone: "success" | "accent" | "muted";
}) {
  const colors = {
    success: "bg-success-soft text-success",
    accent: "bg-accent-soft text-accent",
    muted: "border border-border bg-background text-muted",
  };
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
      <p className="pt-1 text-[0.68rem] font-bold uppercase tracking-wider text-muted">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {values.length > 0 ? (
          values.slice(0, 4).map((value) => (
            <span
              key={value}
              className={`rounded-full px-2 py-1 text-[0.68rem] font-semibold ${colors[tone]}`}
            >
              {value}
            </span>
          ))
        ) : (
          <span className="pt-1 text-xs text-muted">None</span>
        )}
      </div>
    </div>
  );
}
