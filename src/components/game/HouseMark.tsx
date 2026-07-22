"use client";

import { useState } from "react";
import { houseInitials, houseLogoUrl } from "@/lib/visuals/house-logos";

interface HouseMarkProps {
  name: string;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  xs: {
    frame: "h-5 w-5 rounded-md",
    image: "max-h-[85%] max-w-[85%]",
    text: "text-[0.5rem]",
  },
  sm: {
    frame: "h-8 w-8 rounded-lg",
    image: "max-h-[85%] max-w-[85%]",
    text: "text-[0.65rem]",
  },
  md: {
    frame: "h-10 w-10 rounded-xl",
    image: "max-h-[85%] max-w-[85%]",
    text: "text-xs",
  },
  lg: {
    frame: "h-16 w-16 rounded-2xl",
    image: "max-h-[85%] max-w-[85%]",
    text: "text-sm",
  },
} as const;

/** Brand logo with monogram fallback — used beside house names. */
export function HouseMark({ name, className = "", size = "md" }: HouseMarkProps) {
  const logo = houseLogoUrl(name);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const failed = failedFor === name;
  const showLogo = Boolean(logo) && !failed;
  const sizing = SIZE_CLASSES[size];

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-border ${sizing.frame} ${className}`}
      aria-hidden
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={logo!}
          src={logo!}
          alt=""
          className={`${sizing.image} object-contain`}
          referrerPolicy="no-referrer"
          onError={() => setFailedFor(name)}
          onLoad={(event) => {
            const img = event.currentTarget;
            // Reject tiny / placeholder icons (generic globe, 16px upscales, etc.)
            if (img.naturalWidth > 0 && img.naturalWidth < 24) {
              setFailedFor(name);
            }
          }}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span
          className={`flex size-full items-center justify-center bg-accent-soft font-bold tracking-wide text-accent ${sizing.text}`}
        >
          {houseInitials(name)}
        </span>
      )}
    </span>
  );
}
