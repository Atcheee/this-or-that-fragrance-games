"use client";

import { useState } from "react";

interface FragranceBottleImageProps {
  imageUrl?: string;
  alt: string;
  eager?: boolean;
  className?: string;
  placeholderClassName?: string;
}

export function bottleCandidates(imageUrl: string | undefined): string[] {
  if (!imageUrl || imageUrl.includes("cdn.fragella.com")) return [];

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

export function FragranceBottleImage({
  imageUrl,
  alt,
  eager = false,
  className = "max-h-full w-auto max-w-full object-contain drop-shadow-md",
  placeholderClassName = "h-28 w-auto text-muted opacity-35",
}: FragranceBottleImageProps) {
  const candidates = bottleCandidates(imageUrl);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const src = candidates[candidateIndex];

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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
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
