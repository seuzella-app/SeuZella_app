// [RUN10-W2 10B] Rate limit in-memory fail-closed (patch RUN10_W2)
// RUN11: store pode migrar para Redis opcional via REDIS_URL (fallback in-memory preservado).
type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
function maxFromEnv(): number {
  const raw = process.env.AI_RATE_LIMIT_MAX;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 60;
}
export type RateLimitResult = { ok: boolean; retryAfterSec: number; remaining: number };
function ipOf(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) { const first = xff.split(',')[0]; if (first) return first.trim(); }
  const rip = req.headers.get('x-real-ip');
  return rip ? rip.trim() : 'unknown';
}
export function checkRateLimit(req: Request, routeKey: string, max?: number, windowMs?: number): RateLimitResult {
  const m = typeof max === 'number' && max > 0 ? Math.floor(max) : maxFromEnv();
  const w = typeof windowMs === 'number' && windowMs > 0 ? windowMs : WINDOW_MS;
  const key = routeKey + '@' + ipOf(req);
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.updatedAt >= w) {
    buckets.set(key, { tokens: m - 1, updatedAt: now });
    return { ok: true, retryAfterSec: 0, remaining: m - 1 };
  }
  if (b.tokens <= 0) {
    return { ok: false, retryAfterSec: Math.ceil((w - (now - b.updatedAt)) / 1000), remaining: 0 };
  }
  b.tokens -= 1;
  b.updatedAt = now;
  return { ok: true, retryAfterSec: 0, remaining: b.tokens };
}
export function rateLimitResponse(r: RateLimitResult): Response {
  const body = JSON.stringify({ error: 'RATE_LIMITED', retryAfterSec: r.retryAfterSec });
  return new Response(body, { status: 429, headers: { 'content-type': 'application/json', 'retry-after': String(r.retryAfterSec || 60) } });
}
