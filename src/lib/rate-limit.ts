/**
 * Fixed-window in-memory rate limiter. Suitable for a single-instance
 * deployment; on multi-instance/serverless platforms each instance gets its
 * own window, so treat the limit as approximate (or swap for a shared store
 * like Upstash/Redis if stricter guarantees are needed).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (only meaningful when ok is false) */
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
      }
      // Under sustained abuse from many unique keys, drop oldest entries
      // rather than growing without bound.
      if (buckets.size >= MAX_BUCKETS) {
        for (const k of buckets.keys()) {
          if (buckets.size < MAX_BUCKETS / 2) break;
          buckets.delete(k);
        }
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { ok: true, retryAfterSeconds: 0 };
}
