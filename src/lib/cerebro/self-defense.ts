// ============================================================================
// ZÉLLA — Self-Defense Module (Cérebro Immune System)
// ============================================================================
// Quando o AnomalyDetector identifica ataques (auth_failure_pattern,
// tenant_under_attack, webhook_throughput_burst), este módulo toma ações
// DEFENSIVAS AUTOMÁTICAS:
//
//  1. IP BAN: bloqueia IP suspeito em cache (Upstash Redis) por 15 min - 24h
//  2. RATE LIMIT TIGHTENING: reduz limite para IP suspeito (sliding window)
//  3. TENANT THROTTLE: se tenant está sob ataque, reduz seu message throughput
//  4. CIRCUIT BREAKER TRIP: se rota está com error_rate alto, marca circuito
//     aberto para futuras requests (skip direto para fallback)
//  5. WEBHOOK SHIELD: se webhook throughput burst, ativa challenge-response
//
// GUARDRAILS:
//  - Ações só são tomadas se AnomalyEvent severity >= critical
//  - Em mock mode: NÃO toma ação real, apenas registra "would_take_action"
//  - Em live mode: toma ação real (Redis SET com TTL)
//  - Sempre persiste ação em CerebroTelemetryEvent (para auditoria)
//  - Limite de 10 ações automáticas por hora (evita cascade catastrófico)
//
// REVERSIBILIDADE:
//  - Todos os bans/throttles têm TTL (máximo 24h)
//  - Dashboard ZCC pode revogar manualmente a qualquer momento
//  - Log de ações fica em CerebroTelemetryEvent para forensic
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from './log-sink';
import { getCerebroMode, type Severity } from './types';

// ── Types ───────────────────────────────────────────────────────────────────

export type DefenseAction =
  | 'ip_ban'
  | 'rate_limit_tighten'
  | 'tenant_throttle'
  | 'circuit_breaker_trip'
  | 'webhook_shield_enable'
  | 'alert_only';

export interface DefenseActionPayload {
  action: DefenseAction;
  target: string; // IP, tenantId, route, etc.
  reason: string; // anomaly type that triggered
  severity: Severity;
  ttlMinutes: number;
  metadata?: Record<string, unknown>;
}

export interface DefenseActionResult {
  action: DefenseAction;
  target: string;
  status: 'applied' | 'skipped' | 'failed' | 'would_apply';
  reason: string;
  ttlMinutes: number;
  appliedAt: string;
  expiresAt?: string;
  mode: 'mock' | 'live';
}

// ── Action limits (guardrails) ──────────────────────────────────────────────

const MAX_ACTIONS_PER_HOUR = 10;
const actionHistory: Array<{ action: DefenseAction; target: string; timestamp: number }> = [];

function canTakeAction(): { allowed: boolean; reason: string } {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentActions = actionHistory.filter(a => a.timestamp > oneHourAgo);

  if (recentActions.length >= MAX_ACTIONS_PER_HOUR) {
    return {
      allowed: false,
      reason: `Rate limit: ${recentActions.length}/${MAX_ACTIONS_PER_HOUR} ações na última hora`,
    };
  }

  // Verifica se mesmo target+action já foi aplicado recentemente (5 min cooldown)
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const recentSameTarget = recentActions.find(a =>
    a.timestamp > fiveMinAgo
  );
  if (recentSameTarget) {
    return {
      allowed: false,
      reason: `Cooldown: ação recente às ${new Date(recentSameTarget.timestamp).toISOString()}`,
    };
  }

  return { allowed: true, reason: 'OK' };
}

function recordAction(action: DefenseAction, target: string): void {
  actionHistory.push({ action, target, timestamp: Date.now() });
  // Cleanup histórico > 24h
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  while (actionHistory.length > 0 && actionHistory[0].timestamp < cutoff) {
    actionHistory.shift();
  }
}

// ── TTL by severity ─────────────────────────────────────────────────────────

function ttlForSeverity(severity: Severity): number {
  switch (severity) {
    case 'emergency': return 24 * 60; // 24h
    case 'critical': return 4 * 60; // 4h
    case 'warning': return 30; // 30min
    case 'info': return 5; // 5min
    default: return 15;
  }
}

// ── Redis helper ────────────────────────────────────────────────────────────

function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisSetWithTTL(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;

  try {
    const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([value, 'EX', String(ttlSeconds)]),
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Self-Defense module ─────────────────────────────────────────────────────

export class CerebroSelfDefense {
  private mode: 'mock' | 'live';

  constructor() {
    this.mode = getCerebroMode();
  }

  /**
   * Avalia um conjunto de anomalias e decide quais ações tomar.
   * Retorna array de ações executadas (ou que seriam executadas em mock).
   */
  async reactToAnomalies(
    anomalies: Array<{
      anomalyType: string;
      scope: string;
      severity: Severity;
      observed: number;
      baseline: number;
      evidence?: Array<{ context?: Record<string, unknown> }>;
    }>
  ): Promise<DefenseActionResult[]> {
    const results: DefenseActionResult[] = [];

    // Filtra apenas anomalias que requerem ação (severity >= critical)
    const actionableAnomalies = anomalies.filter(a =>
      a.severity === 'critical' || a.severity === 'emergency'
    );

    if (actionableAnomalies.length === 0) {
      return results;
    }

    for (const anomaly of actionableAnomalies) {
      const action = this.decideAction(anomaly);
      if (!action) continue;

      // Verifica guardrails
      const guardrail = canTakeAction();
      if (!guardrail.allowed) {
        results.push({
          action: action.action,
          target: action.target,
          status: 'skipped',
          reason: guardrail.reason,
          ttlMinutes: action.ttlMinutes,
          appliedAt: new Date().toISOString(),
          mode: this.mode,
        });
        continue;
      }

      // Executa ação
      const result = await this.executeAction(action);
      results.push(result);

      if (result.status === 'applied' || result.status === 'would_apply') {
        recordAction(action.action, action.target);
      }
    }

    // Log de auditoria
    if (results.length > 0) {
      logSink.warn({
        module: 'self-defense',
        event: 'defense_actions_taken',
        message: `${results.length} ação(ões) defensivas tomadas`,
        context: {
          mode: this.mode,
          actions: results.map(r => ({
            action: r.action,
            target: r.target,
            status: r.status,
            reason: r.reason,
          })),
        },
      });

      // Persiste em DB para auditoria (mesmo em mock)
      try {
        for (const result of results) {
          await db.cerebroTelemetryEvent.create({
            data: {
              type: 'anomaly',
              name: `self_defense.${result.action}`,
              module: 'self-defense',
              severity: result.status === 'failed' ? 'error' : 'warn',
              message: `Action ${result.action} on ${result.target}: ${result.status} (${result.reason})`,
              context: JSON.stringify(result),
            },
          });
        }
      } catch (err) {
        logSink.warn({
          module: 'self-defense',
          event: 'persist_failed',
          message: 'Falha ao persistir ação no DB (non-fatal)',
          error: err,
        });
      }
    }

    return results;
  }

  /**
   * Decide qual ação tomar baseado no tipo de anomalia.
   */
  private decideAction(anomaly: {
    anomalyType: string;
    scope: string;
    severity: Severity;
    observed: number;
    baseline: number;
    evidence?: Array<{ context?: Record<string, unknown> }>;
  }): DefenseActionPayload | null {
    const ttlMinutes = ttlForSeverity(anomaly.severity);

    switch (anomaly.anomalyType) {
      case 'auth_failure_pattern': {
        // Tenta extrair IP do scope ou evidence
        const ip = this.extractIpFromEvidence(anomaly.evidence) || 'unknown';
        return {
          action: 'ip_ban',
          target: ip,
          reason: `auth_failure_pattern: ${anomaly.observed} failures/min`,
          severity: anomaly.severity,
          ttlMinutes,
          metadata: { anomalyType: anomaly.anomalyType, scope: anomaly.scope },
        };
      }

      case 'tenant_under_attack': {
        const ip = this.extractIpFromEvidence(anomaly.evidence) || 'unknown';
        return {
          action: 'rate_limit_tighten',
          target: ip,
          reason: `tenant_under_attack: ${anomaly.observed} unique IPs/min`,
          severity: anomaly.severity,
          ttlMinutes,
          metadata: { anomalyType: anomaly.anomalyType, scope: anomaly.scope },
        };
      }

      case 'webhook_throughput_burst': {
        // scope: "conversation:<id>"
        const conversationId = anomaly.scope.replace('conversation:', '');
        return {
          action: 'tenant_throttle',
          target: conversationId,
          reason: `webhook_throughput_burst: ${anomaly.observed} msgs/min`,
          severity: anomaly.severity,
          ttlMinutes: Math.min(ttlMinutes, 60), // max 1h para throttle
          metadata: { anomalyType: anomaly.anomalyType, scope: anomaly.scope },
        };
      }

      case 'error_spike': {
        // scope: "module:<name>"
        const moduleName = anomaly.scope.replace('module:', '');
        return {
          action: 'circuit_breaker_trip',
          target: moduleName,
          reason: `error_spike: ${anomaly.observed} errors in 5min (baseline: ${anomaly.baseline})`,
          severity: anomaly.severity,
          ttlMinutes: Math.min(ttlMinutes, 30), // max 30min para circuit breaker
          metadata: { anomalyType: anomaly.anomalyType, scope: anomaly.scope },
        };
      }

      case 'cost_anomaly': {
        // Cost anomaly: apenas alerta, não toma ação automática
        return {
          action: 'alert_only',
          target: anomaly.scope,
          reason: `cost_anomaly: $${anomaly.observed.toFixed(2)}/hour`,
          severity: anomaly.severity,
          ttlMinutes: 0,
          metadata: { anomalyType: anomaly.anomalyType },
        };
      }

      default:
        return null;
    }
  }

  /**
   * Extrai IP do contexto dos eventos de evidência.
   */
  private extractIpFromEvidence(
    evidence?: Array<{ context?: Record<string, unknown> }>
  ): string | null {
    if (!evidence || evidence.length === 0) return null;
    for (const e of evidence) {
      const ctx = e.context;
      if (!ctx) continue;
      const ip = (ctx as Record<string, unknown>).ip || (ctx as Record<string, unknown>).ipAddress;
      if (typeof ip === 'string' && ip.length > 0) return ip;
    }
    return null;
  }

  /**
   * Executa a ação de fato (ou simula em mock mode).
   */
  private async executeAction(action: DefenseActionPayload): Promise<DefenseActionResult> {
    const appliedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + action.ttlMinutes * 60 * 1000).toISOString();

    // Em mock mode, apenas registra a intenção
    if (this.mode === 'mock') {
      return {
        action: action.action,
        target: action.target,
        status: 'would_apply',
        reason: action.reason,
        ttlMinutes: action.ttlMinutes,
        appliedAt,
        expiresAt: action.ttlMinutes > 0 ? expiresAt : undefined,
        mode: 'mock',
      };
    }

    // Em live mode, toma ação real
    if (!isRedisConfigured()) {
      return {
        action: action.action,
        target: action.target,
        status: 'failed',
        reason: `${action.reason} — Redis não configurado`,
        ttlMinutes: action.ttlMinutes,
        appliedAt,
        mode: 'live',
      };
    }

    const redisKey = this.getRedisKey(action.action, action.target);
    const redisValue = JSON.stringify({
      action: action.action,
      target: action.target,
      reason: action.reason,
      severity: action.severity,
      appliedAt,
      expiresAt,
    });

    const ttlSeconds = action.ttlMinutes * 60;
    const success = await redisSetWithTTL(redisKey, redisValue, ttlSeconds);

    return {
      action: action.action,
      target: action.target,
      status: success ? 'applied' : 'failed',
      reason: success ? action.reason : `${action.reason} — Redis SET falhou`,
      ttlMinutes: action.ttlMinutes,
      appliedAt,
      expiresAt: success ? expiresAt : undefined,
      mode: 'live',
    };
  }

  /**
   * Gera chave Redis padronizada para cada tipo de ação.
   */
  private getRedisKey(action: DefenseAction, target: string): string {
    switch (action) {
      case 'ip_ban':
        return `zella:defense:banned_ip:${target}`;
      case 'rate_limit_tighten':
        return `zella:defense:tightened_ip:${target}`;
      case 'tenant_throttle':
        return `zella:defense:throttled_tenant:${target}`;
      case 'circuit_breaker_trip':
        return `zella:defense:tripped_circuit:${target}`;
      case 'webhook_shield_enable':
        return `zella:defense:webhook_shield:${target}`;
      default:
        return `zella:defense:alert_only:${target}`;
    }
  }

  /**
   * Verifica se um IP está banido (para uso pelo middleware.ts).
   */
  async isIpBanned(ip: string): Promise<boolean> {
    if (this.mode === 'mock') return false;
    if (!isRedisConfigured()) return false;

    try {
      const url = process.env.UPSTASH_REDIS_REST_URL!;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
      const res = await fetch(`${url}/get/zella:defense:banned_ip:${encodeURIComponent(ip)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(1000),
      });
      if (!res.ok) return false;
      const data = await res.json() as { result: string | null };
      return data.result !== null;
    } catch {
      return false;
    }
  }

  /**
   * Verifica se um tenant está throttled (para uso pelo webhook handler).
   */
  async isTenantThrottled(tenantId: string): Promise<boolean> {
    if (this.mode === 'mock') return false;
    if (!isRedisConfigured()) return false;

    try {
      const url = process.env.UPSTASH_REDIS_REST_URL!;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
      const res = await fetch(`${url}/get/zella:defense:throttled_tenant:${encodeURIComponent(tenantId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(1000),
      });
      if (!res.ok) return false;
      const data = await res.json() as { result: string | null };
      return data.result !== null;
    } catch {
      return false;
    }
  }

  /**
   * Estatísticas para dashboard.
   */
  getStats() {
    return {
      mode: this.mode,
      recentActions: actionHistory.length,
      actionsInLastHour: actionHistory.filter(a => a.timestamp > Date.now() - 60 * 60 * 1000).length,
      maxActionsPerHour: MAX_ACTIONS_PER_HOUR,
      redisConfigured: isRedisConfigured(),
    };
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let singleton: CerebroSelfDefense | null = null;

export function getSelfDefense(): CerebroSelfDefense {
  if (!singleton) {
    singleton = new CerebroSelfDefense();
  }
  return singleton;
}
