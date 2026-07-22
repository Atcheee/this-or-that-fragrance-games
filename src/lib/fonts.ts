import localFont from "next/font/local";

/**
 * Geist variable with display:optional so text LCP is not held for the
 * ~70KB webfont on Slow 4G. Fallback metrics stay size-adjusted.
 */
export const geistSans = localFont({
  src: "../../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "optional",
  adjustFontFallback: "Arial",
  preload: false,
});
