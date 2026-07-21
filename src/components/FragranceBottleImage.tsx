"use client";

import { useEffect, useRef, useState } from "react";

interface FragranceBottleImageProps {
  imageUrl?: string;
  alt: string;
  eager?: boolean;
  className?: string;
  placeholderClassName?: string;
}

export function bottleCandidates(imageUrl: string | undefined): string[] {
  if (!imageUrl || imageUrl.includes("cdn.fragella.com")) return [];

  const backgroundRemoved = backgroundRemovedCandidate(imageUrl);
  if (backgroundRemoved) return [backgroundRemoved, imageUrl];

  const fragantyId =
    imageUrl.match(/img\.fraganty\.ai\/perfume(?:-nobg)?\/(\d+)\./i)?.[1] ??
    null;

  if (fragantyId) {
    return [
      `https://img.fraganty.ai/perfume-nobg/${fragantyId}.webp`,
      `https://img.fraganty.ai/perfume/${fragantyId}.jpg`,
    ];
  }

  return [imageUrl];
}

function backgroundRemovedCandidate(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    if (url.protocol !== "https:") return null;

    const isFimgs =
      url.hostname === "fimgs.net" &&
      /^\/mdimg\/perfume(?:-thumbs)?\/\d+x\d+\.\d+\.(?:jpe?g|png|webp)$/i.test(
        url.pathname,
      );
    const isScentBase =
      url.hostname === "media.thescentbase.com" &&
      /^\/perfumes\/[a-z0-9][a-z0-9._-]{0,200}\.(?:jpe?g|png|webp)$/i.test(
        url.pathname,
      );

    return isFimgs || isScentBase
      ? `/api/fragrance-image?v=6&src=${encodeURIComponent(url.toString())}`
      : null;
  } catch {
    return null;
  }
}

export function FragranceBottleImage({
  imageUrl,
  alt,
  eager = false,
  className = "max-h-full w-auto max-w-full object-contain drop-shadow-md",
  placeholderClassName = "h-28 w-auto text-muted opacity-35",
}: FragranceBottleImageProps) {
  const candidates = bottleCandidates(imageUrl);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const src = candidates[candidateIndex];

  useEffect(() => {
    setCandidateIndex(0);
  }, [imageUrl]);

  // Catch loads that failed before hydration attached onError (common with
  // hotlink 403s on above-the-fold images).
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !src) return;
    if (img.complete && img.naturalWidth === 0) {
      setCandidateIndex((index) => index + 1);
    }
  }, [src]);

  if (!src) {
    return (
      <BottlePlaceholder
        className={placeholderClassName}
        label={alt ? `No bottle image available for ${alt}` : undefined}
      />
    );
  }

  return (
    // Native img is intentional: onError walks transparent → opaque fallbacks.
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
