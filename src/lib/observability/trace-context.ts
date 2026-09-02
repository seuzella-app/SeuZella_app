/**
 * TRACE CONTEXT — Wave 15 / F07 — Observability Canonical Helper
 * ============================================================================
 * Provides a single, unified API for end-to-end request correlation across:
 *   - HTTP responses (X-Request-Id header)
 *   - Structured logs (logger.withRequest)
 *   - Webhook processing (event/trace ID)
 *   - Reservation / Payment / Tenant context propagation
 *
 * CANONICAL RULES:
 *   1. Every HTTP response MUST include `X-Request-Id` so external callers and
 *      operators can correlate logs with requests.
 *   2. The trace ID is sourced from (in priority order):
 *        a) `X-Request-Id` request header (if present and valid)
 *        b) `X-Vercel-Id` request header (Vercel platform)
 *        c) Generated `req-<uuid>` (deterministic format, prefixed for grep)
 *   3. The trace ID MUST NOT include secrets, tokens, or PII.
 *   4. tenantId MAY be included in log context but MUST NOT be exposed in
 *      response headers (avoid cross-tenant leakage in shared CDNs).
 *   5. For webhooks, `webhookEventId` and `traceId` MUST be persisted together
 *      to allow cross-referencing during incident investigation.
 *
 * USAGE:
 *   ```ts
 *   import { resolveTraceId, withTraceHeaders } from '@/lib/observability/trace-context';
 *
 *   const traceId = resolveTraceId(request);
 *   const logger_ = logger.withRequest(traceId);
 *   logger_.info('Processing reservation', { tenantId, reservationId });
 *   return withTraceHeaders(NextResponse.json({ ok: true }), traceId);
 *   ```
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

const TRACE_HEADER = 'x-request-id';
const VERCEL_HEADER = 'x-vercel-id';
const TRACE_ID_REGEX = /^[a-zA-Z0-9_-]{8,128}$/;
const TRACE_PREFIX = 'req-';

/**
 * Resolves the canonical trace ID for an incoming request.
 *
 * Priority:
 *   1. Caller-supplied `X-Request-Id` (validated for shape, no secrets)
 *   2. Vercel platform `X-Vercel-Id`
 *   3. Generated `req-<uuid>`
 */
export function resolveTraceId(request: NextRequest | Request | { headers: Headers }): string {
  const headers = request.headers as Headers;
  const incoming = headers.get(TRACE_HEADER) || headers.get(VERCEL_HEADER);
  if (incoming && TRACE_ID_REGEX.test(incoming) && !incoming.toLowerCase().includes('bearer')) {
    return incoming;
  }
  return `${TRACE_PREFIX}${randomUUID()}`;
}

/**
 * Validates that a trace ID is well-formed and does not contain suspicious content.
 * Used when persisting externally-supplied IDs (e.g., webhook event IDs) to prevent
 * log injection attacks.
 */
export function isValidTraceId(id: string | undefined | null): id is string {
  if (!id) return false;
  if (id.length < 8 || id.length > 128) return false;
  if (!TRACE_ID_REGEX.test(id)) return false;
  const lower = id.toLowerCase();
  if (lower.includes('bearer') || lower.includes('token') || lower.includes('secret')) {
    return false;
  }
  return true;
}

/**
 * Sanitizes an externally-supplied trace ID, returning a safe fallback if invalid.
 * Use this when persisting webhook event IDs or reservation external references
 * that will later be used as log correlation keys.
 */
export function sanitizeTraceId(id: string | undefined | null, fallback?: string): string {
  if (isValidTraceId(id)) return id as string;
  return fallback || `${TRACE_PREFIX}${randomUUID()}`;
}

/**
 * Attaches the canonical `X-Request-Id` header to a response so external callers
 * and operators can correlate logs with requests.
 *
 * This is the F07 contract: every HTTP response from /api/* MUST include X-Request-Id.
 */
export function withTraceHeaders<T extends NextResponse>(response: T, traceId: string): T {
  // Never overwrite if the route already set a trace header explicitly.
  if (!response.headers.has(TRACE_HEADER)) {
    response.headers.set(TRACE_HEADER, traceId);
  }
  return response;
}

/**
 * Wraps a handler with automatic trace ID resolution and response header injection.
 * Use this on any API route that does not already use `withSecurity` (which
 * handles its own tracing internally).
 *
 * Example:
 *   export const GET = withTrace(async (req, traceId) => {
 *     const log = logger.withRequest(traceId);
 *     log.info('Health check');
 *     return NextResponse.json({ ok: true });
 *   });
 */
export function withTrace<TArgs extends unknown[]>(
  handler: (request: NextRequest, traceId: string, ...args: TArgs) => Promise<NextResponse> | NextResponse
): (request: NextRequest, ...args: TArgs) => Promise<NextResponse> {
  return async (request: NextRequest, ...args: TArgs): Promise<NextResponse> => {
    const traceId = resolveTraceId(request);
    try {
      const response = await handler(request, traceId, ...args);
      return withTraceHeaders(response, traceId);
    } catch (err) {
      // Fallback: return 500 with requestId — do NOT leak error details.
      // Use console.error directly to avoid circular dependency with logger.
      console.error(`[${traceId}] Unhandled error in withTrace handler:`, err);
      const fallback = withTraceHeaders(
        NextResponse.json(
          { error: 'INTERNAL_ERROR', requestId: traceId },
          { status: 500 }
        ),
        traceId
      );
      return fallback;
    }
  };
}

/**
 * Builds a structured log context with trace + tenant + optional business IDs.
 * Returns a plain object safe to pass to `logger.info(message, context, traceId)`.
 *
 * The context NEVER includes secrets, tokens, or sensitive PII. The logger's
 * own sanitizer provides defense-in-depth.
 */
export function buildTraceContext(params: {
  tenantId?: string;
  reservationId?: string;
  paymentId?: string;
  webhookEventId?: string;
  userId?: string;
  [key: string]: unknown;
}): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};
  if (params.tenantId) ctx.tenantId = params.tenantId;
  if (params.reservationId) ctx.reservationId = params.reservationId;
  if (params.paymentId) ctx.paymentId = params.paymentId;
  if (params.webhookEventId) ctx.webhookEventId = params.webhookEventId;
  if (params.userId) ctx.userId = params.userId;
  // Allow additional non-sensitive context keys.
  for (const [k, v] of Object.entries(params)) {
    if (
      !['tenantId', 'reservationId', 'paymentId', 'webhookEventId', 'userId'].includes(k) &&
      v !== undefined
    ) {
      ctx[k] = v;
    }
  }
  return ctx;
}
