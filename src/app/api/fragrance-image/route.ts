import sharp from "sharp";

export const runtime = "nodejs";

const SOURCE_PATH =
  /^\/mdimg\/perfume(?:-thumbs)?\/\d+x\d+\.\d+\.(?:jpe?g|png|webp)$/i;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

export async function GET(request: Request) {
  const source = validSource(new URL(request.url).searchParams.get("src"));
  if (!source) {
    return new Response("Invalid fragrance image source", { status: 400 });
  }

  try {
    const upstream = await fetch(source, {
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
    if (
      url.protocol !== "https:" ||
      url.hostname !== "fimgs.net" ||
      !SOURCE_PATH.test(url.pathname)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Remove only near-white pixels connected to an outside edge. Interior white
 * lettering and highlights stay intact, while a one-pixel matte pass softens
 * the pale JPEG fringe around the bottle.
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

  const isWhite = (index: number) => {
    const offset = index * 4;
    const red = pixels[offset]!;
    const green = pixels[offset + 1]!;
    const blue = pixels[offset + 2]!;
    return (
      Math.min(red, green, blue) >= 242 &&
      Math.max(red, green, blue) - Math.min(red, green, blue) <= 18
    );
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

  removeEnclosedBackgroundHoles(outside, width, height, isWhite);

  for (let index = 0; index < pixelCount; index++) {
    if (!outside[index]) continue;
    const offset = index * 4;
    pixels[offset] = 0;
    pixels[offset + 1] = 0;
    pixels[offset + 2] = 0;
    pixels[offset + 3] = 0;
  }

  const fringe = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index++) {
    if (outside[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    const touchesOutside =
      (x > 0 && outside[index - 1]) ||
      (x + 1 < width && outside[index + 1]) ||
      (y > 0 && outside[index - width]) ||
      (y + 1 < height && outside[index + width]);
    if (!touchesOutside) continue;

    const offset = index * 4;
    const red = pixels[offset]!;
    const green = pixels[offset + 1]!;
    const blue = pixels[offset + 2]!;
    const lightestDarkChannel = Math.min(red, green, blue);
    const chroma = Math.max(red, green, blue) - lightestDarkChannel;
    if (lightestDarkChannel < 205 || chroma > 32) continue;

    const alpha = Math.max(
      0,
      Math.min(255, Math.round(((242 - lightestDarkChannel) / 37) * 255)),
    );
    pixels[offset + 3] = Math.min(pixels[offset + 3]!, alpha);
    fringe[index] = 1;
  }

  // Clear the RGB value of fully transparent fringe pixels to prevent a
  // white halo when browsers composite the WebP on a dark card.
  for (let index = 0; index < pixelCount; index++) {
    if (!fringe[index] || pixels[index * 4 + 3] !== 0) continue;
    const offset = index * 4;
    pixels[offset] = 0;
    pixels[offset + 1] = 0;
    pixels[offset + 2] = 0;
  }
}

function removeEnclosedBackgroundHoles(
  outside: Uint8Array,
  width: number,
  height: number,
  isWhite: (index: number) => boolean,
) {
  let subjectTop = height;
  let subjectBottom = -1;
  for (let index = 0; index < width * height; index++) {
    if (outside[index] || isWhite(index)) continue;
    const y = Math.floor(index / width);
    subjectTop = Math.min(subjectTop, y);
    subjectBottom = Math.max(subjectBottom, y);
  }
  if (subjectBottom < subjectTop) return;

  const upperSubjectLimit =
    subjectTop + Math.round((subjectBottom - subjectTop + 1) * 0.55);
  const visited = new Uint8Array(width * height);
  const componentQueue = new Int32Array(width * height);

  for (let start = 0; start < width * height; start++) {
    if (outside[start] || visited[start] || !isWhite(start)) continue;

    let read = 0;
    let write = 0;
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    visited[start] = 1;
    componentQueue[write++] = start;

    while (read < write) {
      const index = componentQueue[read++]!;
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      const add = (next: number) => {
        if (outside[next] || visited[next] || !isWhite(next)) return;
        visited[next] = 1;
        componentQueue[write++] = next;
      };
      if (x > 0) add(index - 1);
      if (x + 1 < width) add(index + 1);
      if (y > 0) add(index - width);
      if (y + 1 < height) add(index + width);
    }

    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    const aspect = componentWidth / componentHeight;
    const fillRatio = write / (componentWidth * componentHeight);
    const isBackgroundHole =
      write >= 48 &&
      componentWidth >= 8 &&
      componentHeight >= 8 &&
      aspect >= 0.45 &&
      aspect <= 2.2 &&
      fillRatio >= 0.45 &&
      maxY <= upperSubjectLimit;

    if (!isBackgroundHole) continue;
    for (let i = 0; i < write; i++) {
      outside[componentQueue[i]!] = 1;
    }
  }

}
