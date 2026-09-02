import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseAvailable, db } from '@/lib/db';
import { isPushEnabled } from '@/lib/push/push-service';
import { getActiveTransport } from '@/lib/realtime/tenant-pubsub';
import { isBullMQAvailable } from '@/lib/queue/queue-bridge';
import { resolveTraceId, withTraceHeaders } from '@/lib/observability/trace-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Operational liveness endpoint. HTTP 503 is reserved for DB-down state.
 *  F07: Now also returns X-Request-Id response header for correlation. */
export async function GET(request: NextRequest) {
  const traceId = resolveTraceId(request);
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();

  let databaseAvailable = false;
  let dbLatencyMs: number | undefined;
  try {
    const dbStartedAt = Date.now();
    databaseAvailable = await isDatabaseAvailable();
    if (databaseAvailable) {
      await db.tenant.count({ take: 1 });
      dbLatencyMs = Date.now() - dbStartedAt;
    }
  } catch {
    databaseAvailable = false;
  }

  const transport = getActiveTransport();
  const redisConfigured = transport === 'redis';
  const bullmqAvailable = isBullMQAvailable();
  const pushEnabled = isPushEnabled();

  // Database is the critical dependency for request processing. Redis/BullMQ
  // and push can degrade functionality but must not make the app unreachable.
  const status: 'ok' | 'degraded' | 'down' = !databaseAvailable
    ? 'down'
    : redisConfigured && bullmqAvailable && pushEnabled
      ? 'ok'
      : 'degraded';

  const httpStatus = status === 'down' ? 503 : 200;
  const response = NextResponse.json({
    status,
    timestamp,
    requestId: traceId,
    version: {
      sw: 'seuzella-pwa-v4',
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'unknown',
    },
    services: {
      database: { available: databaseAvailable, latencyMs: dbLatencyMs },
      redis: { configured: redisConfigured, transport },
      push: { enabled: pushEnabled, vapidConfigured: pushEnabled },
      bullmq: { available: bullmqAvailable },
    },
    uptime: process.uptime(),
    responseTimeMs: Date.now() - startedAt,
  }, {
    status: httpStatus,
    headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
  });

  return withTraceHeaders(response, traceId);
}
