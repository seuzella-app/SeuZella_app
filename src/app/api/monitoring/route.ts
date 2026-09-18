import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSystemMetrics, getCounters, getTimers, getRequestStats, getHealthChecks } from '@/lib/monitoring';
import { withSecurity } from '@/lib/security/api-shield';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

async function getHandler(request: NextRequest, _ctx: any) {
  const startTime = Date.now();
  const reqLogger = logger.withRequest();

  // RUN 6B (R6B-03): telemetria operacional GLOBAL (métricas de sistema,
  // request stats, timers, logBuffer) é dado do plano plataforma. Antes:
  // qualquer request com cookie presente lia telemetria global (o shield
  // não impõe auth por padrão). Gate canônico do plano ZCC obrigatório.
  const zcc = await verifyZCCAccessOrReject(request);
  if (!zcc.allowed) return zcc.response!;

  if (process.env.NODE_ENV === 'production') {
    reqLogger.info('Monitoring endpoint accessed', { environment: 'production' });
  }

  try {
    const system = getSystemMetrics();
    const counters = getCounters();
    const timerList = getTimers();
    const requestStats = getRequestStats();
    const healthChecks = getHealthChecks();
    const logBufferStats = logger.getBufferStats();

    let dbStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let dbLatencyMs = 0;
    let dbMessage: string | undefined;

    try {
      const dbStart = Date.now();
      const { db } = await import('@/lib/db');
      await db.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
      dbMessage = `SQLite responsive in ${dbLatencyMs}ms`;
    } catch (dbError) {
      dbStatus = 'unhealthy';
      dbLatencyMs = Date.now() - startTime;
      dbMessage = dbError instanceof Error ? dbError.message : 'Database check failed';
      reqLogger.error('Database health check failed', dbError);
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      ok: true,
      service: 'zehla-smarthotel',
      version: '2.4.1',
      timestamp: new Date().toISOString(),
      durationMs: duration,
      system: {
        ...system,
        uptimeFormatted: system.uptimeHuman,
        memoryFormatted: {
          rss: `${(system.memory.rss / 1024 / 1024).toFixed(1)}MB`,
          heapUsed: `${(system.memory.heapUsed / 1024 / 1024).toFixed(1)}MB`,
          heapTotal: `${(system.memory.heapTotal / 1024 / 1024).toFixed(1)}MB`,
        },
      },
      health: {
        status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
        checks: [
          { name: 'database', status: dbStatus, latencyMs: dbLatencyMs, message: dbMessage },
          ...healthChecks,
        ],
      },
      requestStats: requestStats.slice(0, 20),
      counters: counters.slice(0, 50),
      timers: timerList.slice(0, 20).map((t) => ({
        name: t.name, count: t.count, avgMs: t.avgMs, minMs: t.minMs, maxMs: t.maxMs, lastMs: t.lastMs,
      })),
      logBuffer: logBufferStats,
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'mock',
    });
  } catch (error) {
    reqLogger.error('Monitoring endpoint error', error);
    return NextResponse.json({ ok: false, error: 'Failed to collect metrics', mode: 'error' }, { status: 500 });
  }
}

export const GET = withSecurity(getHandler, { routeLabel: 'monitoring' });