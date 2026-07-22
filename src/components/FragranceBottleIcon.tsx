import type { IconProps } from "@phosphor-icons/react";

/**
 * Generic perfume-bottle icon (cap + neck + body).
 * Matches Phosphor IconProps so it can sit next to Buildings / Heart.
 */
export function FragranceBottleIcon({
  size = 16,
  weight = "regular",
  className,
  color = "currentColor",
  ...props
}: IconProps) {
  const filled = weight === "fill";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={className}
      aria-hidden
      {...props}
    >
      {filled ? (
        <path
          fill={color}
          d="M100 16h56a12 12 0 0 1 12 12v32a12 12 0 0 1-12 12h-8v12h40a20 20 0 0 1 20 20v112a20 20 0 0 1-20 20H68a20 20 0 0 1-20-20V104a20 20 0 0 1 20-20h40V72h-8a12 12 0 0 1-12-12V28a12 12 0 0 1 12-12Z"
        />
      ) : (
        <g
          fill="none"
          stroke={color}
          strokeWidth={weight === "bold" ? 20 : weight === "thin" ? 10 : 16}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="100" y="24" width="56" height="40" rx="8" />
          <path d="M112 64v24h32V64" />
          <rect x="68" y="88" width="120" height="136" rx="16" />
        </g>
      )}
    </svg>
  );
}
