// ============================================================================
// ZÉLLA — Telemetry DB Bridge (Passo 10 Hardening)
// ============================================================================
// Bridge entre o telemetry-store.ts (in-memory ring buffer) e a nova tabela
// CerebroTelemetryEvent (DB persistente).
//
// ESTRATÉGIA HÍBRIDA:
//  - In-memory ring buffer (10k eventos) continua para reads rápidos (dashboard)
//  - Em paralelo, persiste eventos críticos (error, critical) no DB
//  - Em live mode: persiste TODOS os eventos; em mock mode: só errors
//  - Query histórica (>1h atrás) busca do DB
//
// USO:
//  import { recordTelemetryEvent } from '@/lib/cerebro/telemetry-bridge';
//
//  recordTelemetryEvent({
//    type: 'request',
//    name: 'request.duration',
//    module: 'whatsapp-webhook',
//    severity: 'info',
//    message: 'POST /api/webhooks/whatsapp 200 OK',
//    context: { latencyMs: 245, tenantId: 'abc' },
//    tenantId: 'abc',
//  });
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from './log-sink';
import { getCerebroMode } from './types';

// ── Types ───────────────────────────────────────────────────────────────────

export type TelemetryType =
  | 'request'
  | 'error'
  | 'anomaly'
  | 'alert'
  | 'llm_call'
  | 'webhook'
  | 'cron'
  | 'landing_click'
  | 'landing_conversion';

export type TelemetrySeverity = 'info' | 'warn' | 'error' | 'critical';

export interface TelemetryEventInput {
  type: TelemetryType;
  name: string;
  module: string;
  severity?: TelemetrySeverity;
  message: string;
  context?: Record<string, unknown>;
  tenantId?: string;
}

// ── Persistência ────────────────────────────────────────────────────────────

/**
 * Registra evento de telemetria no DB (fire-and-forget).
 *
 * Em mock mode: apenas events com severity='error' ou 'critical' são persistidos
 * (para não sobrecarregar DB com info desnecessário em dev).
 * Em live mode: todos os eventos são persistidos.
 *
 * Sempre registra no LogSink (análise do Cérebro).
 */
export function recordTelemetryEvent(input: TelemetryEventInput): void {
  const severity = input.severity || 'info';
  const mode = getCerebroMode();

  // 1. LogSink (sempre — para análise do Cérebro)
  const logLevel = severity === 'error' || severity === 'critical' ? 'error' : 'info';
  logSink[logLevel === 'error' ? 'error' : 'info']({
    module: input.module,
    event: input.name,
    message: input.message,
    context: {
      ...input.context,
      telemetryType: input.type,
      severity,
      tenantId: input.tenantId,
    },
  });

  // 2. DB persistence (apenas se necessário)
  const shouldPersist = mode === 'live' || severity === 'error' || severity === 'critical';
  if (!shouldPersist) return;

  persistTelemetryEvent(input, severity).catch((err) => {
    console.error('[TelemetryBridge] DB persist failed (non-fatal):', err);
  });
}

async function persistTelemetryEvent(
  input: TelemetryEventInput,
  severity: TelemetrySeverity
): Promise<void> {
  try {
    await db.cerebroTelemetryEvent.create({
      data: {
        type: input.type,
        name: input.name,
        module: input.module,
        severity,
        message: input.message,
        context: JSON.stringify(input.context || {}),
        tenantId: input.tenantId || null,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) || null,
      },
    });
  } catch (err) {
    // Em dev sem DB disponível, apenas loga
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[TelemetryBridge] DB write failed (dev mode):', err);
    } else {
      throw err;
    }
  }
}

// ── Query helpers ───────────────────────────────────────────────────────────

export interface TelemetryQueryParams {
  type?: TelemetryType;
  module?: string;
  severity?: TelemetrySeverity;
  tenantId?: string;
  since?: Date;
  until?: Date;
  limit?: number;
}

export async function queryTelemetryEvents(params: TelemetryQueryParams = {}): Promise<
  Array<{
    id: string;
    type: string;
    name: string;
    module: string;
    severity: string;
    message: string;
    context: string;
    tenantId: string | null;
    timestamp: Date;
    deploymentId: string | null;
  }>
> {
  const where: Record<string, unknown> = {};

  if (params.type) where.type = params.type;
  if (params.module) where.module = params.module;
  if (params.severity) where.severity = params.severity;
  if (params.tenantId) where.tenantId = params.tenantId;

  if (params.since || params.until) {
    where.timestamp = {};
    if (params.since) (where.timestamp as { gte: Date }).gte = params.since;
    if (params.until) (where.timestamp as { lte: Date }).lte = params.until;
  }

  return db.cerebroTelemetryEvent.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: Math.min(params.limit || 50, 500),
  });
}

// ── Stats para dashboard ────────────────────────────────────────────────────

export async function getTelemetryStats(): Promise<{
  totalEvents: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byModule: Record<string, number>;
  recentErrors: number;
}> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalEvents, byTypeRaw, bySeverityRaw, byModuleRaw, recentErrors] = await Promise.all([
      db.cerebroTelemetryEvent.count(),
      db.cerebroTelemetryEvent.groupBy({
        by: ['type'],
        _count: true,
      }),
      db.cerebroTelemetryEvent.groupBy({
        by: ['severity'],
        _count: true,
      }),
      db.cerebroTelemetryEvent.groupBy({
        by: ['module'],
        _count: true,
        take: 10,
        orderBy: { _count: { id: 'desc' } },
      }),
      db.cerebroTelemetryEvent.count({
        where: {
          severity: { in: ['error', 'critical'] },
          timestamp: { gte: twentyFourHoursAgo },
        },
      }),
    ]);

    const byType: Record<string, number> = {};
    for (const t of byTypeRaw) byType[t.type] = t._count;

    const bySeverity: Record<string, number> = {};
    for (const s of bySeverityRaw) bySeverity[s.severity] = s._count;

    const byModule: Record<string, number> = {};
    for (const m of byModuleRaw) byModule[m.module] = m._count;

    return {
      totalEvents,
      byType,
      bySeverity,
      byModule,
      recentErrors,
    };
  } catch (err) {
    console.error('[TelemetryBridge] Stats query failed:', err);
    return {
      totalEvents: 0,
      byType: {},
      bySeverity: {},
      byModule: {},
      recentErrors: 0,
    };
  }
}

// ── Cleanup (chamado por cron) ──────────────────────────────────────────────

/**
 * Remove eventos de telemetria mais antigos que N dias.
 * Deve ser chamado por um cron diário (pode ser reaproveitado no budget-reset).
 *
 * @param olderThanDays Dias para manter (default 7)
 */
export async function cleanupOldTelemetryEvents(olderThanDays: number = 7): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  try {
    const result = await db.cerebroTelemetryEvent.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });
    return result.count;
  } catch (err) {
    console.error('[TelemetryBridge] Cleanup failed:', err);
    return 0;
  }
}

/**
 * Remove audit logs antigos (chamado por cron).
 */
export async function cleanupOldAuditLogs(olderThanDays: number = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  try {
    const result = await db.zccAuditLog.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });
    return result.count;
  } catch (err) {
    console.error('[TelemetryBridge] Audit log cleanup failed:', err);
    return 0;
  }
}
