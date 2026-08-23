import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseAvailable, db } from '@/lib/db';
import { isPushEnabled, getVapidPublicKey } from '@/lib/push/push-service';
import { getActiveTransport } from '@/lib/realtime/tenant-pubsub';
import { isBullMQAvailable } from '@/lib/queue/queue-bridge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/health
 *
 * Returns operational status of all subsystems. Used by:
 *   - Vercel cron monitoring
 *   - Status page (if added later)
 *   - Debug panel in ZCC admin
 *
 * SECURITY: This endpoint returns NO sensitive data — only boolean flags
 * and version info. tenantId-specific data is never exposed.
 *
 * Response shape:
 *   {
 *     status: 'ok' | 'degraded' | 'down',
 *     timestamp: ISO string,
 *     version: { git: string, sw: string },
 *     services: {
 *       database: { available: boolean, latencyMs?: number },
 *       redis: { configured: boolean, transport: 'redis' | 'memory' },
 *       push: { enabled: boolean, vapidConfigured: boolean },
 *       bullmq: { available: boolean },
 *     },
 *     uptime: number (seconds)
 *   }
 */
export async function GET(_request: NextRequest) {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

  // Database check (with latency measurement)
  let databaseAvailable = false;
  let dbLatencyMs: number | undefined;
  try {
    const dbStart = Date.now();
    databaseAvailable = await isDatabaseAvailable();
    if (databaseAvailable) {
      // Quick probe — count tenants (cheap query)
      await db.tenant.count({ take: 1 }).catch(() => {});
      dbLatencyMs = Date.now() - dbStart;
    }
  } catch {
    databaseAvailable = false;
  }

  // Redis check
  const transport = getActiveTransport();
  const redisConfigured = transport === 'redis';

  // BullMQ check
  const bullmqAvailable = isBullMQAvailable();

  // Push check
  const pushEnabled = isPushEnabled();

  // Determine overall status
  let status: 'ok' | 'degraded' | 'down';
  if (databaseAvailable && redisConfigured && pushEnabled && bullmqAvailable) {
    status = 'ok';
  } else if (databaseAvailable) {
    // DB is the only critical service — if it's up, we're degraded but functional
    status = 'degraded';
  } else {
    status = 'down';
  }

  return NextResponse.json(
    {
      status,
      timestamp,
      version: {
        sw: 'seuzella-pwa-v4',
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'unknown',
      },
      services: {
        database: {
          available: databaseAvailable,
          latencyMs: dbLatencyMs,
        },
        redis: {
          configured: redisConfigured,
          transport,
        },
        push: {
          enabled: pushEnabled,
          vapidConfigured: pushEnabled,
        },
        bullmq: {
          available: bullmqAvailable,
        },
      },
      uptime: process.uptime(),
      responseTimeMs: Date.now() - startTime,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    },
  );
}
