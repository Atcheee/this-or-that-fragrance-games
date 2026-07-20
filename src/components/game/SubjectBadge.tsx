"use client";

import { useEffect, useState } from "react";
import {
  accordColor,
  accordSoftBackground,
} from "@/lib/visuals/accord-colors";
import { fetchNoteImageUrl } from "@/lib/visuals/note-images";

interface NoteBadgeProps {
  name: string;
}

/** Note name + Wikimedia thumbnail for the contains-note question. */
export function NoteBadge({ name }: NoteBadgeProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    fetchNoteImageUrl(name).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  const showImage = Boolean(src) && !failed;

  return (
    <span className="inline-flex items-center gap-2 rounded-xl bg-accent-soft py-1 pl-1 pr-3 align-middle text-accent">
      <span
        className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card text-sm font-bold text-muted"
        aria-hidden
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src!}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
            loading="lazy"
            decoding="async"
          />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </span>
      <span className="font-semibold">{name}</span>
    </span>
  );
}

interface AccordBadgeProps {
  name: string;
  /** Smaller chip for accord lists after reveal. */
  compact?: boolean;
}

/** Accord name + Fragrantica-style color chip for the has-accord question. */
export function AccordBadge({ name, compact = false }: AccordBadgeProps) {
  const color = accordColor(name);
  const soft = accordSoftBackground(color);

  return (
    <span
      className={`inline-flex items-center align-middle font-semibold capitalize ${
        compact
          ? "gap-1.5 rounded-lg px-2 py-0.5 text-xs"
          : "gap-2 rounded-xl py-1.5 pl-2 pr-3"
      }`}
      style={{ backgroundColor: soft, color }}
    >
      <span
        className={`shrink-0 rounded-full shadow-sm ring-1 ring-black/10 ${
          compact ? "h-2.5 w-5" : "h-3.5 w-8"
        }`}
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {name}
    </span>
  );
}
