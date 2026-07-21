import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const maxDuration = 60;

const execFileAsync = promisify(execFile);

const FIMGS_PATH =
  /^\/mdimg\/perfume(?:-thumbs)?\/\d+x\d+\.\d+\.(?:jpe?g|png|webp)$/i;
const SCENTBASE_PATH =
  /^\/perfumes\/[a-z0-9][a-z0-9._-]{0,200}\.(?:jpe?g|png|webp)$/i;
const FRAGANTY_OPAQUE_PATH = /^\/perfume\/\d+\.(?:jpe?g|png|webp)$/i;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12_000;
const WORKER_TIMEOUT_MS = 45_000;
const CACHE_VERSION = "ml-v3";
const CACHE_DIR = path.join(process.cwd(), ".cache", "fragrance-images");
const WORKER = path.join(process.cwd(), "scripts", "cutout-worker.mjs");

const inFlight = new Map<string, Promise<Buffer>>();

export async function GET(request: Request) {
  const source = validSource(new URL(request.url).searchParams.get("src"));
  if (!source) {
    return new Response("Invalid fragrance image source", { status: 400 });
  }

  const cacheKey = hashKey(source);

  try {
    const cached = await readCache(cacheKey);
    if (cached) {
      return imageResponse(cached);
    }

    let work = inFlight.get(cacheKey);
    if (!work) {
      work = prepareCutout(source).finally(() => {
        inFlight.delete(cacheKey);
      });
      inFlight.set(cacheKey, work);
    }

    const output = await work;
    await writeCache(cacheKey, output).catch(() => undefined);
    return imageResponse(output);
  } catch {
    return new Response("Unable to prepare fragrance image", { status: 502 });
  }
}

async function prepareCutout(source: string): Promise<Buffer> {
  const upstream = await fetch(source, {
    headers: { "User-Agent": "This-or-That-Fragrance-Games/1.0" },
    cache: "force-cache",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!upstream.ok) {
    throw new Error(`upstream ${upstream.status}`);
  }

  const contentLength = Number(upstream.headers.get("content-length"));
  if (contentLength > MAX_SOURCE_BYTES) {
    throw new Error("too large");
  }

  const sourceBytes = Buffer.from(await upstream.arrayBuffer());
  if (sourceBytes.length > MAX_SOURCE_BYTES) {
    throw new Error("too large");
  }

  const stamp = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inputPath = path.join(tmpdir(), `frag-in-${stamp}.img`);
  const outputPath = path.join(tmpdir(), `frag-out-${stamp}.webp`);

  try {
    await fs.writeFile(inputPath, sourceBytes);
    await execFileAsync(process.execPath, [WORKER, inputPath, outputPath], {
      timeout: WORKER_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    return await fs.readFile(outputPath);
  } finally {
    await Promise.all([
      fs.unlink(inputPath).catch(() => undefined),
      fs.unlink(outputPath).catch(() => undefined),
    ]);
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

    if (url.hostname === "img.fraganty.ai") {
      // Always cut from opaque studio JPEGs — perfume-nobg is often chewed.
      const nobg = url.pathname.match(/^\/perfume-nobg\/(\d+)\./i);
      if (nobg) {
        return `https://img.fraganty.ai/perfume/${nobg[1]}.jpg`;
      }
      if (FRAGANTY_OPAQUE_PATH.test(url.pathname)) {
        return url.toString();
      }
    }

    return null;
  } catch {
    return null;
  }
}

function hashKey(source: string): string {
  return createHash("sha1")
    .update(`${CACHE_VERSION}:${source}`)
    .digest("hex");
}

async function readCache(key: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(CACHE_DIR, `${key}.webp`));
  } catch {
    return null;
  }
}

async function writeCache(key: string, bytes: Buffer): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const target = path.join(CACHE_DIR, `${key}.webp`);
  const temp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temp, bytes);
  await fs.rename(temp, target);
}

function imageResponse(bytes: Buffer): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
