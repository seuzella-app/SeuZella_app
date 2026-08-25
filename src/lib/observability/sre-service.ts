/**
 * Observability / SRE Service
 * ============================================================================
 * Collects operational metrics without an LLM. Metrics are fail-aware: a
 * failed collector is never represented as a healthy zero.
 */

import { db, isDatabaseAvailable } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getActiveTransport } from '@/lib/realtime/tenant-pubsub';
import { isBullMQAvailable } from '@/lib/queue/queue-bridge';
import { isPushEnabled } from '@/lib/push/push-service';

export interface ObservabilityMetrics {
  timestamp: string;
  uptime: {
    processUptimeSec: number;
    status: 'healthy' | 'degraded' | 'down';
  };
  dataQuality: {
    status: 'complete' | 'partial';
    collectorErrors: string[];
  };
  database: {
    available: boolean;
    activeTenants: number;
    totalTransactions: number;
    totalBookings: number;
    totalLockDevices: number;
    queryLatencyMs?: number;
  };
  realtime: {
    transport: 'redis' | 'memory';
    activeSubscribers: number;
  };
  queue: {
    bullmqAvailable: boolean;
    dlqCount: number;
  };
  push: {
    enabled: boolean;
    activeSubscriptions: number;
  };
  security: {
    openFindings: number;
    criticalFindings: number;
    highFindings: number;
    lastScanAt?: string;
  };
  errors: {
    cerebroAnalysisErrors: number;
    webhookFailures: number;
    cronFailures: number;
  };
  costs: {
    llmCostUsdThisMonth: number;
    estimatedMonthlyCost: number;
  };
  endpoints: {
    healthStatus: 'ok' | 'degraded' | 'down';
    readinessPassed: number;
    readinessFailed: number;
  };
}

export async function collectObservabilityMetrics(): Promise<ObservabilityMetrics> {
  const startTime = Date.now();
  const collectorErrors: string[] = [];
  const dbAvailable = await isDatabaseAvailable();

  if (!dbAvailable) collectorErrors.push('database.unavailable');

  let activeTenants = 0;
  let totalTransactions = 0;
  let totalBookings = 0;
  let totalLockDevices = 0;
  let queryLatencyMs: number | undefined;

  if (dbAvailable) {
    try {
      const dbStart = Date.now();
      const results = await Promise.all([
        db.tenant.count({ where: { status: 'active', isTestTenant: false } }),
        (db as any).transaction?.count?.(),
        (db as any).booking?.count?.(),
        (db as any).lockDevice?.count?.(),
      ]);
      if (typeof results[1] !== 'number' || typeof results[2] !== 'number' || typeof results[3] !== 'number') {
        throw new Error('one or more database metric models are unavailable');
      }
      activeTenants = results[0];
      totalTransactions = results[1];
      totalBookings = results[2];
      totalLockDevices = results[3];
      queryLatencyMs = Date.now() - dbStart;
    } catch (err) {
      collectorErrors.push('database.core_metrics');
      logger.error('[Observability] DB metrics failed', { error: err });
    }
  }

  let openFindings = 0;
  let criticalFindings = 0;
  let highFindings = 0;
  let lastScanAt: string | undefined;
  if (dbAvailable) {
    try {
      const securityFinding = (db as any).securityFinding;
      if (!securityFinding) throw new Error('SecurityFinding model unavailable');
      const [open, critical, high, lastScan] = await Promise.all([
        securityFinding.count({ where: { status: 'open' } }),
        securityFinding.count({ where: { status: 'open', severity: 'critical' } }),
        securityFinding.count({ where: { status: 'open', severity: 'high' } }),
        securityFinding.findFirst({ orderBy: { scannedAt: 'desc' }, select: { scannedAt: true } }),
      ]);
      openFindings = open;
      criticalFindings = critical;
      highFindings = high;
      lastScanAt = lastScan?.scannedAt?.toISOString();
    } catch (err) {
      collectorErrors.push('security.metrics');
      logger.error('[Observability] Security metrics failed', { error: err });
    }
  }

  let cerebroAnalysisErrors = 0;
  let webhookFailures = 0;
  let cronFailures = 0;
  if (dbAvailable) {
    try {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [cErrors, wErrors, crErrors] = await Promise.all([
        (db as any).cerebroTelemetryEvent?.count({ where: { severity: 'error', createdAt: { gte: last24h } } }),
        (db as any).auditLog?.count({ where: { action: 'WEBHOOK_FAILED', createdAt: { gte: last24h } } }),
        (db as any).cerebroTelemetryEvent?.count({ where: { type: 'cron', severity: 'error', createdAt: { gte: last24h } } }),
      ]);
      if (![cErrors, wErrors, crErrors].every(v => typeof v === 'number')) {
        throw new Error('one or more error telemetry sources are unavailable');
      }
      cerebroAnalysisErrors = cErrors;
      webhookFailures = wErrors;
      cronFailures = crErrors;
    } catch (err) {
      collectorErrors.push('error.telemetry');
      logger.error('[Observability] Error telemetry failed', { error: err });
    }
  }

  let llmCostUsdThisMonth = 0;
  if (dbAvailable) {
    try {
      const metaCostLog = (db as any).metaCostLog;
      if (!metaCostLog) throw new Error('MetaCostLog model unavailable');
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const result = await metaCostLog.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { costUsd: true },
      });
      llmCostUsdThisMonth = Number(result?._sum?.costUsd ?? 0);
      if (!Number.isFinite(llmCostUsdThisMonth)) throw new Error('invalid LLM cost value');
    } catch (err) {
      collectorErrors.push('costs.llm');
      logger.error('[Observability] LLM cost metrics failed', { error: err });
    }
  }

  let activeSubscriptions = 0;
  if (dbAvailable) {
    try {
      const pushSubscription = (db as any).pushSubscription;
      if (!pushSubscription) throw new Error('PushSubscription model unavailable');
      activeSubscriptions = await pushSubscription.count({ where: { isActive: true } });
    } catch (err) {
      collectorErrors.push('push.subscriptions');
      logger.error('[Observability] Push metrics failed', { error: err });
    }
  }

  const dataQuality = collectorErrors.length === 0 ? 'complete' : 'partial';
  let status: 'healthy' | 'degraded' | 'down' = 'healthy';
  if (!dbAvailable) status = 'down';
  else if (dataQuality === 'partial' || criticalFindings > 0 || cerebroAnalysisErrors > 10 || webhookFailures > 5) status = 'degraded';

  const now = new Date();
  const daysElapsed = Math.max(1, Math.ceil((now.getTime() - new Date(now.getFullYear(), now.getMonth(), 1).getTime()) / 86400000));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const estimatedMonthlyCost = llmCostUsdThisMonth * (daysInMonth / daysElapsed);

  const metrics: ObservabilityMetrics = {
    timestamp: now.toISOString(),
    uptime: { processUptimeSec: Math.floor(process.uptime()), status },
    dataQuality: { status: dataQuality, collectorErrors },
    database: { available: dbAvailable, activeTenants, totalTransactions, totalBookings, totalLockDevices, queryLatencyMs },
    realtime: { transport: getActiveTransport(), activeSubscribers: 0 },
    queue: { bullmqAvailable: isBullMQAvailable(), dlqCount: 0 },
    push: { enabled: isPushEnabled(), activeSubscriptions },
    security: { openFindings, criticalFindings, highFindings, lastScanAt },
    errors: { cerebroAnalysisErrors, webhookFailures, cronFailures },
    costs: { llmCostUsdThisMonth, estimatedMonthlyCost },
    endpoints: { healthStatus: dbAvailable ? (status === 'healthy' ? 'ok' : 'degraded') : 'down', readinessPassed: dbAvailable ? 1 : 0, readinessFailed: dbAvailable ? 0 : 1 },
  };

  logger.info('[Observability] Metrics collected', { durationMs: Date.now() - startTime, status, dataQuality, activeTenants, openFindings });
  return metrics;
}

export interface SreAlert {
  level: 'info' | 'warning' | 'critical';
  metric: string;
  value: string;
  threshold: string;
  message: string;
  timestamp: string;
}

export function checkAlertThresholds(metrics: ObservabilityMetrics): SreAlert[] {
  const alerts: SreAlert[] = [];

  if (metrics.dataQuality.status === 'partial') {
    alerts.push({ level: 'critical', metric: 'dataQuality.status', value: 'partial', threshold: 'complete', message: `Observability collection is incomplete: ${metrics.dataQuality.collectorErrors.join(', ')}`, timestamp: metrics.timestamp });
  }
  if (!metrics.database.available) {
    alerts.push({ level: 'critical', metric: 'database.available', value: 'false', threshold: 'must be true', message: 'Database is unavailable', timestamp: metrics.timestamp });
  }
  if (metrics.security.criticalFindings > 0) {
    alerts.push({ level: 'critical', metric: 'security.criticalFindings', value: String(metrics.security.criticalFindings), threshold: '0', message: `${metrics.security.criticalFindings} critical security finding(s) open`, timestamp: metrics.timestamp });
  }
  if (metrics.security.highFindings > 0) {
    alerts.push({ level: 'warning', metric: 'security.highFindings', value: String(metrics.security.highFindings), threshold: '0', message: `${metrics.security.highFindings} high security finding(s) open`, timestamp: metrics.timestamp });
  }
  if (metrics.errors.webhookFailures > 5) {
    alerts.push({ level: 'warning', metric: 'errors.webhookFailures', value: String(metrics.errors.webhookFailures), threshold: '5 per 24h', message: `${metrics.errors.webhookFailures} webhook failures in last 24h`, timestamp: metrics.timestamp });
  }
  if (metrics.errors.cerebroAnalysisErrors > 10) {
    alerts.push({ level: 'warning', metric: 'errors.cerebroAnalysisErrors', value: String(metrics.errors.cerebroAnalysisErrors), threshold: '10 per 24h', message: `${metrics.errors.cerebroAnalysisErrors} Cérebro errors in last 24h`, timestamp: metrics.timestamp });
  }
  if (metrics.costs.llmCostUsdThisMonth > 15) {
    alerts.push({ level: 'warning', metric: 'costs.llmCostUsdThisMonth', value: `$${metrics.costs.llmCostUsdThisMonth.toFixed(2)}`, threshold: '$15.00', message: `LLM cost: $${metrics.costs.llmCostUsdThisMonth.toFixed(2)}`, timestamp: metrics.timestamp });
  }
  if (metrics.database.queryLatencyMs !== undefined && metrics.database.queryLatencyMs > 500) {
    alerts.push({ level: 'warning', metric: 'database.queryLatencyMs', value: `${metrics.database.queryLatencyMs}ms`, threshold: '500ms', message: `DB latency: ${metrics.database.queryLatencyMs}ms`, timestamp: metrics.timestamp });
  }
  if (metrics.realtime.transport === 'memory') {
    alerts.push({ level: 'info', metric: 'realtime.transport', value: 'memory', threshold: 'redis', message: 'Using in-memory — set REDIS_URL for multi-instance', timestamp: metrics.timestamp });
  }

  return alerts;
}
