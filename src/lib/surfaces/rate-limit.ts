/**
 * Minimal per-surface IP rate limiter for public /s/[slug] routes.
 *
 * ⚠️  IN-MEMORY — fine for Phase 4 (bot-mitigation on analytics endpoints),
 *     but per-instance: each Vercel Function container has its own Map. A
 *     durable limiter (Upstash Redis / Vercel KV) is a known Phase 5 follow-up
 *     once Knowledge Surfaces get real public traffic.
 *
 * Sliding window: we track a deque of request timestamps per key and trim
 * on each check. No background cleanup — stale entries are dropped when
 * their key is next hit. Footprint stays bounded under normal load; under
 * pathological abuse, the per-instance ceiling is naturally capped by
 * container memory.
 */
import { NextResponse } from "next/server";

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;

interface BucketEntry {
  // FIFO deque of request timestamps (ms since epoch) within the active window.
  timestamps: number[];
}

// Module-level store. In Node.js serverless, this persists for the life of
// the container; cold starts reset it — acceptable for the stated scope.
const buckets = new Map<string, BucketEntry>();

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  resetAt: number; // ms since epoch
  limit: number;
}

export interface RateLimitInput {
  surfaceId: string;
  ip: string;
  limit?: number;
  windowMs?: number;
}

function trim(entry: BucketEntry, cutoff: number): void {
  while (entry.timestamps.length > 0 && entry.timestamps[0] < cutoff) {
    entry.timestamps.shift();
  }
}

export function checkRateLimit(input: RateLimitInput): RateLimitCheck {
  const limit = input.limit && input.limit > 0 ? input.limit : DEFAULT_LIMIT;
  const windowMs =
    input.windowMs && input.windowMs > 0 ? input.windowMs : DEFAULT_WINDOW_MS;
  const now = Date.now();
  const cutoff = now - windowMs;
  const key = `${input.surfaceId}:${input.ip}`;

  let entry = buckets.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    buckets.set(key, entry);
  }
  trim(entry, cutoff);

  if (entry.timestamps.length >= limit) {
    // Reset is when the earliest entry in the window ages out.
    const oldest = entry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldest + windowMs,
      limit,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: Math.max(0, limit - entry.timestamps.length),
    resetAt: now + windowMs,
    limit,
  };
}

/**
 * Extract the client IP from a Next.js Request. Honours x-forwarded-for
 * (first hop), then x-real-ip, then falls back to a bucketing placeholder.
 */
export function extractIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

function buildHeaders(result: RateLimitCheck): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

/**
 * Next.js API-route helper: short-circuit with 429 if over limit, otherwise
 * run the handler and merge rate-limit headers onto its response.
 */
export async function withSurfaceRateLimit(
  req: Request,
  surfaceId: string,
  handler: () => Promise<Response>,
  opts: { limit?: number; windowMs?: number } = {},
): Promise<Response> {
  const ip = extractIp(req);
  const check = checkRateLimit({
    surfaceId,
    ip,
    limit: opts.limit,
    windowMs: opts.windowMs,
  });

  const rlHeaders = buildHeaders(check);

  if (!check.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((check.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: retryAfterSec },
      {
        status: 429,
        headers: { ...rlHeaders, "Retry-After": String(retryAfterSec) },
      },
    );
  }

  const response = await handler();
  for (const [k, v] of Object.entries(rlHeaders)) {
    response.headers.set(k, v);
  }
  return response;
}

// Testing / ops hook — purge all state (not exported from a barrel; direct import only).
export function __resetRateLimiter(): void {
  buckets.clear();
}
