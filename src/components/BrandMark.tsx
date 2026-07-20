type BrandMarkProps = {
  className?: string;
  color?: string;
  cutoutColor?: string;
  size?: number;
};

/** Faceted fragrance-bottle silhouette with an ornamental stopper. */
export function BrandMark({
  className,
  color = "currentColor",
  cutoutColor = "var(--background)",
  size = 24,
}: BrandMarkProps) {
  return (
    <svg
      aria-hidden
      className={className}
      height={size}
      viewBox="0 0 24 32"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7.8 1h8.4c1.6 1.05 2.65 2.45 2.75 3.75.1 1.2-1.25 2.8-3.25 4.55H8.3C6.3 7.55 4.95 5.95 5.05 4.75 5.15 3.45 6.2 2.05 7.8 1ZM8.75 8.65h6.5v2.25h-6.5zM6.25 11.25h11.5a.9.9 0 0 1 0 1.8H6.25a.9.9 0 0 1 0-1.8ZM6.9 13.4h10.2a.8.8 0 0 1 0 1.6H6.9a.8.8 0 0 1 0-1.6ZM8.2 15.45h7.6l4.9 3.05c.72.45 1.08 1.31.88 2.13L18.9 31H5.1L2.42 20.63c-.2-.82.16-1.68.88-2.13l4.9-3.05Z"
        fill={color}
      />
      <path
        d="M8.85 1.75C8 2.9 7.6 3.95 7.65 4.85c.05 1.05.63 2.27 1.77 3.62M15.15 1.75c.85 1.15 1.25 2.2 1.2 3.1-.05 1.05-.63 2.27-1.77 3.62"
        fill="none"
        stroke={cutoutColor}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeWidth="1.15"
      />
    </svg>
  );
}
