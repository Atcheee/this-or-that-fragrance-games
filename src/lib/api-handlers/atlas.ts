import "server-only";

import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Pathname inside the private Blob store (override with ATLAS_BLOB_PATH). */
const DEFAULT_ATLAS_PATH = "data/fragrance-atlas.json";

const CACHE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  // Browsers may recheck hourly. Vercel's CDN keeps the immutable, manually
  // uploaded atlas for a year so a cold request does not repeatedly invoke
  // this function and pull the private Blob.
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
  "Vercel-CDN-Cache-Control":
    "public, s-maxage=31536000, stale-while-revalidate=31536000",
  // Keep the 44 MB source below Vercel's 20 MB streaming-response cache limit;
  // otherwise every atlas visit misses CDN cache and retransmits the full Blob.
  "Content-Encoding": "gzip",
  "X-Content-Type-Options": "nosniff",
} as const;

/**
 * Serve fragrance atlas JSON from the private Vercel Blob store.
 * Falls back to the local gitignored file for offline/dev.
 *
 * Production requires the Blob store to be connected to the Vercel project
 * (`BLOB_STORE_ID` + OIDC) and/or `BLOB_READ_WRITE_TOKEN`. Upload with
 * `npm run upload:atlas` after `npm run generate:atlas`.
 */
export async function GET() {
  const pathname =
    process.env.ATLAS_BLOB_PATH?.trim() || DEFAULT_ATLAS_PATH;
  const candidates = atlasBlobCandidates(pathname);

  for (const candidate of candidates) {
    try {
      const fromBlob = await readAtlasFromBlob(candidate);
      if (fromBlob) return fromBlob;
    } catch (error) {
      console.error("[atlas] blob fetch failed:", candidate, error);
    }
  }

  try {
    const fromDisk = await readAtlasFromDisk();
    if (fromDisk) return fromDisk;
  } catch (error) {
    console.error("[atlas] local fallback failed:", error);
  }

  console.error("[atlas] unavailable", {
    hasToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    hasOidc: Boolean(process.env.VERCEL_OIDC_TOKEN),
    hasStoreId: Boolean(process.env.BLOB_STORE_ID),
    candidates,
  });

  return NextResponse.json(
    { error: "Atlas data unavailable" },
    { status: 404 },
  );
}

function atlasBlobCandidates(pathname: string): string[] {
  const values = [
    process.env.ATLAS_BLOB_URL?.trim(),
    process.env.BLOB_ATLAS_BASE_URL
      ? `${process.env.BLOB_ATLAS_BASE_URL.replace(/\/$/, "")}/${pathname}`
      : undefined,
    blobUrlFromStoreId(pathname),
    pathname,
  ];
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function blobUrlFromStoreId(pathname: string): string | undefined {
  const raw = process.env.BLOB_STORE_ID?.trim();
  if (!raw) return undefined;
  const storeId = raw.replace(/^store_/i, "");
  return `https://${storeId}.private.blob.vercel-storage.com/${pathname}`;
}

async function readAtlasFromBlob(urlOrPathname: string) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (!token && !process.env.VERCEL_OIDC_TOKEN) {
    return null;
  }

  const result = await get(urlOrPathname, {
    access: "private",
    ...(token ? { token } : {}),
    ...(storeId ? { storeId } : {}),
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  return new NextResponse(gzipStream(result.stream), {
    status: 200,
    headers: CACHE_HEADERS,
  });
}

async function readAtlasFromDisk() {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "fragrance-atlas.json",
  );
  const body = await readFile(filePath);
  return new NextResponse(gzipStream(new Uint8Array(body)), {
    status: 200,
    headers: {
      ...CACHE_HEADERS,
      "Cache-Control": "public, max-age=60",
    },
  });
}

function gzipStream(
  source: ReadableStream<Uint8Array> | Uint8Array,
): ReadableStream<Uint8Array> {
  let stream: ReadableStream;
  if (source instanceof Uint8Array) {
    const copy = new Uint8Array(source.byteLength);
    copy.set(source);
    stream = new Blob([copy.buffer]).stream();
  } else {
    stream = source;
  }
  return stream.pipeThrough(new CompressionStream("gzip"));
}
