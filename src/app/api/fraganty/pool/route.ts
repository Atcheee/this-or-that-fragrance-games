import { NextRequest, NextResponse } from "next/server";
import type { Fragrance } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";

const BASE = "https://fraganty.ai/api";
// Each request fans out to up to MAX_DETAIL_FETCHES + 1 upstream calls, so
// keep the per-IP budget tight to avoid abuse of the user's key or our host.
const LIMIT_PER_MINUTE = 10;
const WINDOW_MS = 60_000;
const MAX_DETAIL_FETCHES = 30;
const UPSTREAM_TIMEOUT_MS = 8_000;

const API_KEY_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,199}$/i;

/**
 * Proxies the Fraganty API (https://fraganty.ai/api-docs) so the browser never
 * calls the third party directly. Requires the user's free API key, passed
 * from the client via the x-api-key header.
 */
export async function GET(req: NextRequest) {
  const limit = rateLimit(`fraganty:${clientIp(req)}`, LIMIT_PER_MINUTE, WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests, slow down." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }
  if (!API_KEY_PATTERN.test(apiKey)) {
    return NextResponse.json({ error: "Malformed API key" }, { status: 400 });
  }
  const count = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("count")) || 16, 2),
    64,
  );

  try {
    // Draw from a random page of the catalog for variety. Overfetch because
    // some entries may lack the data the games need.
    const page = 1 + Math.floor(Math.random() * 20);
    const listRes = await fetch(
      `${BASE}/perfumes?limit=100&page=${page}`,
      {
        headers: { "X-API-Key": apiKey },
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
    );
    if (!listRes.ok) {
      return NextResponse.json(
        { error: `Fraganty list request failed (${listRes.status})` },
        { status: listRes.status === 401 ? 401 : 502 },
      );
    }
    const listData = await listRes.json();
    // Only accept well-formed slugs so upstream data can't steer requests
    // anywhere but the fixed perfume-detail path.
    const slugs = extractSlugs(listData).filter((s) => SLUG_PATTERN.test(s));
    if (slugs.length === 0) {
      return NextResponse.json({ error: "No perfumes returned" }, { status: 502 });
    }

    const picked = shuffle(slugs).slice(
      0,
      Math.min(count * 2, MAX_DETAIL_FETCHES),
    );
    const details = await Promise.all(
      picked.map(async (slug) => {
        try {
          const res = await fetch(
            `${BASE}/perfumes/${encodeURIComponent(slug)}`,
            {
              headers: { "X-API-Key": apiKey },
              cache: "no-store",
              signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
            },
          );
          if (!res.ok) return null;
          return mapPerfume(await res.json(), slug);
        } catch {
          return null;
        }
      }),
    );

    const fragrances = details
      .filter((f): f is Fragrance => f !== null)
      .slice(0, count);
    return NextResponse.json({ fragrances });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach Fraganty" },
      { status: 502 },
    );
  }
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function extractSlugs(data: unknown): string[] {
  const obj = data as { perfumes?: unknown; results?: unknown; data?: unknown };
  const list = obj?.perfumes ?? obj?.results ?? obj?.data;
  if (!Array.isArray(list)) return [];
  return list
    .map((p) => (p as { slug?: string })?.slug)
    .filter((s): s is string => typeof s === "string");
}

/** Tolerant mapping: Fraganty response shapes may evolve, so probe common field names. */
function mapPerfume(data: unknown, slug: string): Fragrance | null {
  const p = (data as { perfume?: Record<string, unknown> })?.perfume ??
    (data as Record<string, unknown>);
  if (!p || typeof p !== "object") return null;

  const name = str(p.name);
  const house = str(p.brand) || str((p.brand as Record<string, unknown>)?.name);
  if (!name || !house) return null;

  const notes = (p.notes ?? {}) as Record<string, unknown>;
  const top = names(notes.top ?? p.topNotes);
  const heart = names(notes.middle ?? notes.heart ?? p.middleNotes);
  const base = names(notes.base ?? p.baseNotes);
  const accords = names(p.accords ?? p.mainAccords);
  const rating = num(p.rating) ?? num(p.ratingValue) ?? 0;

  // Games built on this pool need at least notes or accords plus a rating.
  if (top.length + heart.length + base.length === 0 && accords.length === 0) {
    return null;
  }

  return {
    id: `fraganty-${slug}`,
    name,
    house,
    year: num(p.year) ?? 0,
    rating,
    price: 0,
    topNotes: top,
    heartNotes: heart,
    baseNotes: base,
    accords,
    description: str(p.description),
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function names(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) =>
      typeof item === "string" ? item : str((item as Record<string, unknown>)?.name),
    )
    .filter(Boolean);
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
