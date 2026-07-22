import { accordColor } from "@/lib/visuals/accord-colors";

function channelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

function contrastRatio(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseColor(hexOrHsl: string): { r: number; g: number; b: number } | null {
  if (hexOrHsl.startsWith("hsl")) {
    const match = hexOrHsl.match(
      /hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i,
    );
    if (!match) return null;
    const h = Number(match[1]) / 360;
    const s = Number(match[2]) / 100;
    const l = Number(match[3]) / 100;
    const hue2rgb = (p: number, q: number, t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    if (s === 0) {
      const v = Math.round(l * 255);
      return { r: v, g: v, b: v };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return {
      r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      g: Math.round(hue2rgb(p, q, h) * 255),
      b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    };
  }

  const hex = hexOrHsl.replace("#", "");
  if (hex.length !== 6) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function darkenRgb(
  rgb: { r: number; g: number; b: number },
  factor: number,
): { r: number; g: number; b: number } {
  return {
    r: Math.max(0, Math.round(rgb.r * factor)),
    g: Math.max(0, Math.round(rgb.g * factor)),
    b: Math.max(0, Math.round(rgb.b * factor)),
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Pick bar fill + label colors that meet WCAG AA (4.5:1) for normal text.
 * Mid-tone Fragrantica hues (fruity, woody, …) fail with light labels, so we
 * darken the fill until dark or light text clears the threshold.
 */
function accessibleBarColors(hexOrHsl: string): {
  background: string;
  foreground: string;
} {
  const parsed = parseColor(hexOrHsl);
  if (!parsed) {
    return { background: hexOrHsl, foreground: "#1a1a1a" };
  }

  const light = relativeLuminance(245, 245, 245); // #f5f5f5
  const dark = relativeLuminance(26, 26, 26); // #1a1a1a
  let fill = parsed;

  for (let i = 0; i < 8; i++) {
    const L = relativeLuminance(fill.r, fill.g, fill.b);
    const lightContrast = contrastRatio(light, L);
    const darkContrast = contrastRatio(L, dark);

    if (darkContrast >= 4.5 || lightContrast >= 4.5) {
      return {
        background: toHex(fill),
        foreground: darkContrast >= lightContrast ? "#1a1a1a" : "#f5f5f5",
      };
    }

    fill = darkenRgb(fill, 0.86);
  }

  return { background: toHex(fill), foreground: "#f5f5f5" };
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
        const { background, foreground } = accessibleBarColors(
          accordColor(accord),
        );
        return (
          <div
            key={`${accord}-${index}`}
            className="relative h-7 overflow-hidden rounded-r-md"
            style={{ width: `${width}%` }}
          >
            <div
              className="flex h-full w-full items-center justify-center px-3"
              style={{ backgroundColor: background }}
            >
              <span
                className="truncate text-sm font-medium capitalize tracking-wide"
                style={{ color: foreground }}
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
