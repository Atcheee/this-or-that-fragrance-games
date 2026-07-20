"use client";

import { useState } from "react";
import { houseInitials, houseLogoUrl } from "@/lib/visuals/house-logos";

interface HouseMarkProps {
  name: string;
  className?: string;
}

/** Brand logo (favicon CDN) with monogram fallback — used above house names. */
export function HouseMark({ name, className = "" }: HouseMarkProps) {
  const logo = houseLogoUrl(name);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const failed = failedFor === name;
  const showLogo = Boolean(logo) && !failed;

  return (
    <span
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background/60 ring-1 ring-border ${className}`}
      aria-hidden
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={logo!}
          src={logo!}
          alt=""
          className="h-7 w-7 object-contain"
          onError={() => setFailedFor(name)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="text-xs font-bold tracking-wide text-muted">
          {houseInitials(name)}
        </span>
      )}
    </span>
  );
}
