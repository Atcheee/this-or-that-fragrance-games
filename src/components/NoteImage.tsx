"use client";

import { useEffect, useState } from "react";
import { fetchNoteImageUrl } from "@/lib/visuals/note-images";
import { noteIconUrl } from "@/lib/visuals/note-icons";

interface NoteImageProps {
  name: string;
  className?: string;
  imageClassName?: string;
}

/** Perfume-note artwork with Fragrantica icon, Wikimedia, then monogram fallbacks. */
export function NoteImage({
  name,
  className = "h-12 w-12 rounded-xl",
  imageClassName = "h-[88%] w-[88%] object-contain",
}: NoteImageProps) {
  const primarySrc = noteIconUrl(name);
  const [fallback, setFallback] = useState<{
    name: string;
    url: string | null;
  } | null>(null);
  const [primaryFailedFor, setPrimaryFailedFor] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const fallbackSrc = fallback?.name === name ? fallback.url : null;
  const primaryFailed = primaryFailedFor === name;
  const src = primaryFailed ? fallbackSrc : (primarySrc ?? fallbackSrc);
  const failed = failedFor === name;

  useEffect(() => {
    let cancelled = false;
    if (!primarySrc) {
      fetchNoteImageUrl(name).then((url) => {
        if (!cancelled) setFallback({ name, url });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [name, primarySrc]);

  async function handleImageError() {
    if (src === primarySrc && !primaryFailed) {
      setPrimaryFailedFor(name);
      const fallback = await fetchNoteImageUrl(name);
      if (fallback && fallback !== src) {
        setFallback({ name, url: fallback });
        return;
      }
    }
    setFailedFor(name);
  }

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-white text-stone-500 ring-1 ring-border ${className}`}
      aria-hidden="true"
    >
      {src && !failed ? (
        // Native img lets the component fall back across independent image hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={imageClassName}
          onError={handleImageError}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="text-sm font-bold">{name.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}
