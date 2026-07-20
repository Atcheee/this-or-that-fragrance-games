import { accordColor } from "@/lib/visuals/accord-colors";

/** Contrast-aware label color for a solid accord bar fill. */
function labelColor(hexOrHsl: string): string {
  if (hexOrHsl.startsWith("hsl")) {
    const match = hexOrHsl.match(/hsl\(\d+\s+\d+%\s+(\d+)%\)/);
    const l = match ? Number(match[1]) : 50;
    return l >= 55 ? "#1a1a1a" : "#f5f5f5";
  }
  const hex = hexOrHsl.replace("#", "");
  if (hex.length !== 6) return "#1a1a1a";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#1a1a1a" : "#f5f5f5";
}

export function AccordBars({
  accords,
  label = "Main accords",
}: {
  accords: string[];
  label?: string;
}) {
  if (accords.length === 0) {
    return <p className="text-sm text-muted">No accord data available.</p>;
  }

  const visibleAccords = accords.slice(0, 9);

  return (
    <div aria-label={label} className="space-y-1.5">
      {visibleAccords.map((accord, index) => {
        const width = Math.max(28, 100 - index * 8);
        const color = accordColor(accord);
        return (
          <div
            key={`${accord}-${index}`}
            className="relative h-7 overflow-hidden rounded-r-md"
            style={{ width: `${width}%` }}
          >
            <div
              className="flex h-full w-full items-center justify-center px-3"
              style={{ backgroundColor: color }}
            >
              <span
                className="truncate text-sm font-medium capitalize tracking-wide"
                style={{ color: labelColor(color) }}
              >
                {accord}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
