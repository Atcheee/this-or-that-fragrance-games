"use client";

import { useEffect, useRef, useState } from "react";

const PROCESS_VERSION = "21";

interface FragranceBottleImageProps {
  imageUrl?: string;
  alt: string;
  eager?: boolean;
  /**
   * Soft studio plate behind the bottle. Off by default.
   */
  well?: boolean;
  /** Soft radial stage behind the bottle. Off by default. */
  stage?: boolean;
  /**
   * Route through /api/fragrance-image for ML cutouts. Off by default —
   * catalog uses opaque studio shots + dark-mode multiply blend instead.
   */
  process?: boolean;
  className?: string;
  placeholderClassName?: string;
  wellClassName?: string;
  stageClassName?: string;
}

export function bottleCandidates(
  imageUrl: string | undefined,
  options: { preferOpaque?: boolean; process?: boolean } = {},
): string[] {
  if (!imageUrl || imageUrl.includes("cdn.fragella.com")) return [];

  const preferOpaque = options.preferOpaque ?? true;
  const process = options.process ?? true;
  const fragantyId =
    imageUrl.match(/img\.fraganty\.ai\/perfume(?:-nobg)?\/(\d+)\./i)?.[1] ??
    null;

  const opaque = fragantyId
    ? `https://img.fraganty.ai/perfume/${fragantyId}.jpg`
    : null;
  const cutout = fragantyId
    ? `https://img.fraganty.ai/perfume-nobg/${fragantyId}.webp`
    : null;

  // ML cutouts need an opaque studio source. Prefer that, then remote cutout.
  const sources: string[] = [];
  if (fragantyId) {
    if (preferOpaque && opaque) sources.push(opaque);
    if (cutout) sources.push(cutout);
    if (!preferOpaque && opaque) sources.push(opaque);
  } else {
    sources.push(imageUrl);
  }

  if (!process) return sources;

  return sources.map(
    (src) =>
      `/api/fragrance-image?v=${PROCESS_VERSION}&src=${encodeURIComponent(src)}`,
  );
}

export function FragranceBottleImage({
  imageUrl,
  alt,
  eager = false,
  well = false,
  stage = false,
  process = false,
  className = "max-h-full w-auto max-w-full object-contain",
  placeholderClassName = "h-28 w-auto text-muted opacity-35",
  wellClassName = "",
  stageClassName = "",
}: FragranceBottleImageProps) {
  const candidates = bottleCandidates(imageUrl, {
    preferOpaque: true,
    process,
  });
  const [candidateIndex, setCandidateIndex] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const src = candidates[candidateIndex];

  useEffect(() => {
    setCandidateIndex(0);
  }, [imageUrl, process]);

  // Catch loads that failed before hydration attached onError (common with
  // hotlink 403s on above-the-fold images).
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !src) return;
    if (img.complete && img.naturalWidth === 0) {
      setCandidateIndex((index) => index + 1);
    }
  }, [src]);

  const media = !src ? (
    <BottlePlaceholder
      className={placeholderClassName}
      label={alt ? `No bottle image available for ${alt}` : undefined}
    />
  ) : (
    // Native img is intentional: onError walks processed → fallbacks.
    // no-referrer: media.thescentbase.com returns 403 when Referer is our site.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      ref={imgRef}
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setCandidateIndex((index) => index + 1)}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
    />
  );

  if (well) {
    return (
      <div
        className={`bottle-well flex h-full w-full justify-center ${wellClassName}`.trim()}
      >
        {media}
      </div>
    );
  }

  if (!stage) return media;

  return (
    <div
      className={`bottle-stage flex h-full w-full items-end justify-center ${stageClassName}`.trim()}
    >
      {media}
    </div>
  );
}

function BottlePlaceholder({
  className,
  label,
}: {
  className: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 80 120"
      className={className}
      fill="currentColor"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect x="32" y="4" width="16" height="14" rx="2" />
      <path d="M28 18h24l6 14v70a10 10 0 0 1-10 10H32a10 10 0 0 1-10-10V32l6-14z" />
    </svg>
  );
}
