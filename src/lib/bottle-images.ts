const PROCESS_VERSION = "21";

/** Resolve ordered bottle image URLs for a catalog imageUrl. */
export function bottleCandidates(
  imageUrl: string | undefined,
  options: { preferOpaque?: boolean; process?: boolean } = {},
): string[] {
  if (!imageUrl || imageUrl.includes("cdn.fragella.com")) return [];

  const preferOpaque = options.preferOpaque ?? true;
  const process = options.process ?? true;
  const fragantyId =
    imageUrl.match(/img\.fraganty\.ai\/perfume(?:-nobg)?\/(\d+)\./i)?.[1] ??
    null;

  const opaque = fragantyId
    ? `https://img.fraganty.ai/perfume/${fragantyId}.jpg`
    : null;
  const cutout = fragantyId
    ? `https://img.fraganty.ai/perfume-nobg/${fragantyId}.webp`
    : null;

  const sources: string[] = [];
  if (fragantyId) {
    if (preferOpaque && opaque) sources.push(opaque);
    if (cutout) sources.push(cutout);
    if (!preferOpaque && opaque) sources.push(opaque);
  } else {
    sources.push(imageUrl);
  }

  if (!process) return sources;

  return sources.map(
    (src) =>
      `/api/fragrance-image?v=${PROCESS_VERSION}&src=${encodeURIComponent(src)}`,
  );
}

/** Primary bottle URL used for LCP preload / metadata (no ML processing). */
export function primaryBottleSrc(imageUrl: string | undefined): string | undefined {
  return bottleCandidates(imageUrl, { preferOpaque: true, process: false })[0];
}
