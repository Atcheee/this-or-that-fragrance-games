"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { bottleCandidates } from "@/lib/bottle-images";

export { bottleCandidates, primaryBottleSrc } from "@/lib/bottle-images";

const OPTIMIZABLE_HOSTS = new Set([
  "img.fraganty.ai",
  "media.thescentbase.com",
  "cdn.fragella.com",
  "fimgs.net",
]);

function canOptimizeSrc(src: string): boolean {
  if (src.startsWith("/")) return true;
  try {
    return OPTIMIZABLE_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

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
  /** Intrinsic ratio for next/image; bottles are typically ~3:4. */
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  placeholderClassName?: string;
  wellClassName?: string;
  stageClassName?: string;
}

export function FragranceBottleImage({
  imageUrl,
  alt,
  eager = false,
  well = false,
  stage = false,
  process = false,
  width = 375,
  height = 500,
  sizes = "(max-width: 640px) 45vw, 140px",
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
  const src = candidates[candidateIndex];

  useEffect(() => {
    setCandidateIndex(0);
  }, [imageUrl, process]);

  const advance = () => setCandidateIndex((index) => index + 1);

  let media: React.ReactNode;
  if (!src) {
    media = (
      <BottlePlaceholder
        className={placeholderClassName}
        label={alt ? `No bottle image available for ${alt}` : undefined}
      />
    );
  } else if (canOptimizeSrc(src)) {
    media = (
      <Image
        key={src}
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        className={className}
        referrerPolicy="no-referrer"
        onError={advance}
        priority={eager}
        {...(eager ? {} : { loading: "lazy" as const })}
        decoding="async"
      />
    );
  } else {
    media = (
      // Native img for hosts outside next/image remotePatterns.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={src}
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        referrerPolicy="no-referrer"
        onError={advance}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
      />
    );
  }

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
