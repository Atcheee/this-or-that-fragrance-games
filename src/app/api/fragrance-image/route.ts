import sharp from "sharp";

export const runtime = "nodejs";

const FIMGS_PATH =
  /^\/mdimg\/perfume(?:-thumbs)?\/\d+x\d+\.\d+\.(?:jpe?g|png|webp)$/i;
const SCENTBASE_PATH = /^\/perfumes\/[a-z0-9][a-z0-9._-]{0,200}\.(?:jpe?g|png|webp)$/i;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

export async function GET(request: Request) {
  const source = validSource(new URL(request.url).searchParams.get("src"));
  if (!source) {
    return new Response("Invalid fragrance image source", { status: 400 });
  }

  try {
    const upstream = await fetch(source, {
      // No Referer: media.thescentbase.com 403s hotlinks from our origin.
      headers: { "User-Agent": "This-or-That-Fragrance-Games/1.0" },
      cache: "force-cache",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!upstream.ok) {
      return new Response("Fragrance image unavailable", { status: 502 });
    }

    const contentLength = Number(upstream.headers.get("content-length"));
    if (contentLength > MAX_SOURCE_BYTES) {
      return new Response("Fragrance image is too large", { status: 413 });
    }

    const sourceBytes = Buffer.from(await upstream.arrayBuffer());
    if (sourceBytes.length > MAX_SOURCE_BYTES) {
      return new Response("Fragrance image is too large", { status: 413 });
    }

    const image = sharp(sourceBytes, {
      failOn: "error",
      limitInputPixels: 12_000_000,
    })
      .rotate()
      .ensureAlpha();
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    removeConnectedWhiteBackground(data, info.width, info.height);

    const output = await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    })
      .webp({ quality: 92, alphaQuality: 100 })
      .toBuffer();

    return new Response(new Uint8Array(output), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Unable to prepare fragrance image", { status: 502 });
  }
}

function validSource(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;

    if (url.hostname === "fimgs.net" && FIMGS_PATH.test(url.pathname)) {
      return url.toString();
    }

    if (
      url.hostname === "media.thescentbase.com" &&
      SCENTBASE_PATH.test(url.pathname)
    ) {
      return url.toString();
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Remove only near-white pixels connected to an outside edge. Interior white
 * lettering and highlights stay intact, while a fringe matte softens the pale
 * JPEG edge around the bottle (critical on dark UI cards).
 */
function removeConnectedWhiteBackground(
  pixels: Buffer,
  width: number,
  height: number,
) {
  const pixelCount = width * height;
  const outside = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let read = 0;
  let write = 0;

  // Slightly below pure white so JPEG-quantized studio backdrops still flood.
  const isWhite = (index: number) => {
    const offset = index * 4;
    const red = pixels[offset]!;
    const green = pixels[offset + 1]!;
    const blue = pixels[offset + 2]!;
    const darkest = Math.min(red, green, blue);
    const chroma = Math.max(red, green, blue) - darkest;
    return darkest >= 228 && chroma <= 22;
  };

  const enqueue = (index: number) => {
    if (outside[index] || !isWhite(index)) return;
    outside[index] = 1;
    queue[write++] = index;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (read < write) {
    const index = queue[read++]!;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  // Skip enclosed-hole cleanup: it punches through intentional white bottle
  // graphics (stripes, labels) that look like background islands.

  for (let index = 0; index < pixelCount; index++) {
    if (!outside[index]) continue;
    const offset = index * 4;
    pixels[offset] = 0;
    pixels[offset + 1] = 0;
    pixels[offset + 2] = 0;
    pixels[offset + 3] = 0;
  }

  // Two-ring fringe: kill pale JPEG edge glow that otherwise reads as a white
  // halo on dark cards.
  const fringe = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index++) {
    if (outside[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);

    let nearOutside = false;
    let ring = 2;
    for (let dy = -2; dy <= 2 && !nearOutside; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (!outside[ny * width + nx]) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        ring = Math.min(ring, dist);
        nearOutside = true;
      }
    }
    if (!nearOutside) continue;

    const offset = index * 4;
    const red = pixels[offset]!;
    const green = pixels[offset + 1]!;
    const blue = pixels[offset + 2]!;
    const darkest = Math.min(red, green, blue);
    const chroma = Math.max(red, green, blue) - darkest;
    if (darkest < 185 || chroma > 40) continue;

    // Outer ring fades harder; inner ring keeps a little subject edge.
    const fadeStart = ring === 1 ? 228 : 210;
    const span = fadeStart - 185;
    const alpha = Math.max(
      0,
      Math.min(255, Math.round(((fadeStart - darkest) / span) * 255)),
    );
    pixels[offset + 3] = Math.min(pixels[offset + 3]!, alpha);
    fringe[index] = 1;

    // Desaturate remaining pale RGB so partial alpha does not glow white.
    if (alpha < 255 && darkest >= 200) {
      const keep = alpha / 255;
      pixels[offset] = Math.round(red * keep);
      pixels[offset + 1] = Math.round(green * keep);
      pixels[offset + 2] = Math.round(blue * keep);
    }
  }

  for (let index = 0; index < pixelCount; index++) {
    if (!fringe[index] || pixels[index * 4 + 3] !== 0) continue;
    const offset = index * 4;
    pixels[offset] = 0;
    pixels[offset + 1] = 0;
    pixels[offset + 2] = 0;
  }

  // Final pass: kill leftover near-white glow hugging transparency
  // (common around chrome caps / JPEG ringing). Interior white artwork
  // is untouched because it does not neighbor transparent pixels.
  for (let index = 0; index < pixelCount; index++) {
    if (pixels[index * 4 + 3] === 0) continue;
    const offset = index * 4;
    const red = pixels[offset]!;
    const green = pixels[offset + 1]!;
    const blue = pixels[offset + 2]!;
    const darkest = Math.min(red, green, blue);
    const chroma = Math.max(red, green, blue) - darkest;
    if (darkest < 210 || chroma > 28) continue;

    const x = index % width;
    const y = Math.floor(index / width);
    let touchesTransparent = false;
    for (let dy = -3; dy <= 3 && !touchesTransparent; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (pixels[(ny * width + nx) * 4 + 3] === 0) touchesTransparent = true;
      }
    }
    if (!touchesTransparent) continue;

    // Hard-clear very pale edge glow; soft-fade mid tones.
    if (darkest >= 235 && chroma <= 16) {
      pixels[offset] = 0;
      pixels[offset + 1] = 0;
      pixels[offset + 2] = 0;
      pixels[offset + 3] = 0;
      continue;
    }

    const alpha = Math.max(
      0,
      Math.min(pixels[offset + 3]!, Math.round(((235 - darkest) / 25) * 255)),
    );
    pixels[offset + 3] = alpha;
    const keep = alpha / 255;
    pixels[offset] = Math.round(red * keep);
    pixels[offset + 1] = Math.round(green * keep);
    pixels[offset + 2] = Math.round(blue * keep);
  }
}
