"use client";

import { useState } from "react";
import { noteIconUrl } from "@/lib/visuals/note-icons";

interface PerfumePyramidProps {
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
}

export function PerfumePyramid({
  topNotes,
  heartNotes,
  baseNotes,
}: PerfumePyramidProps) {
  const hasNotes =
    topNotes.length > 0 || heartNotes.length > 0 || baseNotes.length > 0;

  if (!hasNotes) {
    return (
      <p className="text-sm text-muted">No note pyramid is available.</p>
    );
  }

  return (
    <div className="flex flex-col">
      <header className="mb-5 flex items-center gap-2 border-b border-border pb-3">
        <FlaskIcon className="h-4 w-4 text-muted" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Perfume pyramid
        </h2>
      </header>

      <div className="flex flex-col divide-y divide-border">
        <PyramidTier label="Top notes" notes={topNotes} />
        <PyramidTier label="Middle notes" notes={heartNotes} />
        <PyramidTier label="Base notes" notes={baseNotes} />
      </div>
    </div>
  );
}

function PyramidTier({
  label,
  notes,
}: {
  label: string;
  notes: string[];
}) {
  if (notes.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-3 py-5 first:pt-1 last:pb-1">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
        {label}
      </h3>
      <ul className="flex flex-wrap items-start justify-center gap-5">
        {notes.map((note) => (
          <li key={note} className="flex w-24 flex-col items-center gap-2">
            <NoteIcon name={note} />
            <span className="text-center text-sm font-medium leading-snug">
              {note}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NoteIcon({ name }: { name: string }) {
  const src = noteIconUrl(name);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-border"
      aria-hidden
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt=""
          className="h-[85%] w-[85%] object-contain"
          onError={() => setFailed(true)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="text-lg font-bold text-stone-500">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function FlaskIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9 3h6" />
      <path d="M10 3v6.5L5.2 17a2.5 2.5 0 0 0 2.1 3.9h9.4a2.5 2.5 0 0 0 2.1-3.9L14 9.5V3" />
      <path d="M8.5 14h7" />
    </svg>
  );
}
