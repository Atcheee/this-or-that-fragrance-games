import { Fraunces, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";

/**
 * UI sans — higher stroke weight than Geist so small/muted text stays
 * crisp on dark backgrounds instead of thinning into blur.
 */
export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

/**
 * Soft editorial serif for brand + page titles — fragrance-catalog vibe
 * without the stiff high-contrast Bodoni/Playfair look.
 */
export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "opsz"],
});

/** Tabular/timer mono used on play routes. */
export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
  weight: ["500", "600", "700"],
});
