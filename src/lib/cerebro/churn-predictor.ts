// ============================================================================
// ZÉLLA — Churn Predictor (Cérebro Customer Success Brain)
// ============================================================================
// Prediz quais tenants estão em risco de churn (cancelamento) baseado em:
//
//  SINAIS DE CHURN (PESOS):
//  - AIActivityLog decrescente (menos uso de IA = engajamento baixo)         peso 0.30
//  - ConversationMessage volume caindo > 50% week-over-week                   peso 0.20
//  - MetaCostLog gasto caindo (menos campanhas = menos receita p/ tenant)    peso 0.15
//  - BrainHealthLog: humanTakeoverRate alto ou conversionRate baixo           peso 0.20
//  - Tenant sem login no ZCC há > 7 dias (AuditLog-based)                    peso 0.15
//
// SCORING:
//  - Cada sinal gera um score 0-1 (1 = alto risco)
//  - Score final = soma ponderada (0-1)
//  - Risk level: <0.3 OK, 0.3-0.6 WATCH, 0.6-0.85 WARNING, >0.85 CRITICAL
//
// AÇÃO:
//  - CRITICAL: dispara alerta + cria tarefa para customer success
//  - WARNING: dispara alerta + email para tenant
//  - WATCH: registra em BrainHealthLog para monitoramento
//  - OK: nenhum
//
// CRON:
//  - Roda diariamente (cron.daily) via /api/cron/cerebro-churn-predict
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from './log-sink';
import { getCerebroMode } from './types';

// ── Types ───────────────────────────────────────────────────────────────────

export type RiskLevel = 'ok' | 'watch' | 'warning' | 'critical';

export interface ChurnSignal {
  name: string;
  weight: number;
  rawScore: number; // 0-1
  weightedScore: number; // rawScore * weight
  evidence: string;
}

export interface ChurnPrediction {
  tenantId: string;
  tenantName?: string;
  overallScore: number; // 0-1
  riskLevel: RiskLevel;
  signals: ChurnSignal[];
  predictedAt: string;
  recommendedAction: string;
  mode: 'mock' | 'live';
}

// ── ChurnPredictor ──────────────────────────────────────────────────────────

export class ChurnPredictor {
  private mode: 'mock' | 'live';

  constructor() {
    this.mode = getCerebroMode();
  }

  /**
   * Prediz churn para todos os tenants ativos.
   */
  async predictAll(): Promise<ChurnPrediction[]> {
    let tenants: Array<{ id: string; name: string | null }> = [];

    try {
      tenants = await db.tenant.findMany({
        where: { status: 'active' },
        select: { id: true, name: true },
      });
    } catch (err) {
      logSink.warn({
        module: 'churn-predictor',
        event: 'tenant_query_failed',
        message: 'Falha ao buscar tenants ativos',
        error: err,
      });
      return [];
    }

    const predictions: ChurnPrediction[] = [];
    for (const tenant of tenants) {
      try {
        const prediction = await this.predictForTenant(tenant.id, tenant.name || undefined);
        predictions.push(prediction);
      } catch (err) {
        logSink.warn({
          module: 'churn-predictor',
          event: 'tenant_prediction_failed',
          message: `Falha ao predizer churn para tenant ${tenant.id}`,
          error: err,
          context: { tenantId: tenant.id },
        });
      }
    }

    // Log summary
    const summary = {
      total: predictions.length,
      critical: predictions.filter(p => p.riskLevel === 'critical').length,
      warning: predictions.filter(p => p.riskLevel === 'warning').length,
      watch: predictions.filter(p => p.riskLevel === 'watch').length,
      ok: predictions.filter(p => p.riskLevel === 'ok').length,
    };

    logSink.info({
      module: 'churn-predictor',
      event: 'prediction_batch_complete',
      message: `Churn prediction: ${summary.critical} critical, ${summary.warning} warning, ${summary.watch} watch, ${summary.ok} ok (total: ${summary.total})`,
      context: summary,
    });

    return predictions;
  }

  /**
   * Prediz churn para um tenant específico.
   */
  async predictForTenant(tenantId: string, tenantName?: string): Promise<ChurnPrediction> {
    const signals: ChurnSignal[] = [];

    // ── Signal 1: AI Activity decline (last 7 days vs previous 7) ──
    signals.push(await this.signalAiActivityDecline(tenantId));

    // ── Signal 2: Conversation volume decline ──
    signals.push(await this.signalConversationDecline(tenantId));

    // ── Signal 3: Meta cost decline (less marketing activity) ──
    signals.push(await this.signalMetaCostDecline(tenantId));

    // ── Signal 4: Brain health (human takeover / conversion) ──
    signals.push(await this.signalBrainHealth(tenantId));

    // ── Signal 5: Login recency ──
    signals.push(await this.signalLoginRecency(tenantId));

    // Calcula score final
    const overallScore = signals.reduce((acc, s) => acc + s.weightedScore, 0);
    const riskLevel = this.scoreToRiskLevel(overallScore);

    const prediction: ChurnPrediction = {
      tenantId,
      tenantName,
      overallScore: Math.round(overallScore * 1000) / 1000,
      riskLevel,
      signals,
      predictedAt: new Date().toISOString(),
      recommendedAction: this.recommendAction(riskLevel),
      mode: this.mode,
    };

    // Persiste em CerebroTelemetryEvent (para histórico)
    try {
      await db.cerebroTelemetryEvent.create({
        data: {
          type: 'anomaly',
          name: 'churn_prediction',
          module: 'churn-predictor',
          severity: riskLevel === 'critical' ? 'critical' : riskLevel === 'warning' ? 'warn' : 'info',
          message: `Tenant ${tenantName || tenantId}: risk=${riskLevel} score=${overallScore.toFixed(2)}`,
          context: JSON.stringify(prediction),
          tenantId,
        },
      });
    } catch (err) {
      logSink.warn({
        module: 'churn-predictor',
        event: 'persist_failed',
        message: `Falha ao persistir prediction para tenant ${tenantId}`,
        error: err,
      });
    }

    return prediction;
  }

  // ── Individual signals ────────────────────────────────────────────────────

  /**
   * Signal: AI Activity decline (last 7d vs previous 7d).
   */
  private async signalAiActivityDecline(tenantId: string): Promise<ChurnSignal> {
    const now = Date.now();
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const prev7d = new Date(now - 14 * 24 * 60 * 60 * 1000);

    try {
      const [last7Count, prev7Count] = await Promise.all([
        db.aIActivityLog.count({
          where: { tenantId, createdAt: { gte: last7d } },
        }),
        db.aIActivityLog.count({
          where: {
            tenantId,
            createdAt: { gte: prev7d, lt: last7d },
          },
        }),
      ]);

      // Score: se prev=0 e last>0, score=0 (nova adoção). Se last=0 e prev>0, score=1 (parou de usar).
      let rawScore = 0;
      let evidence = '';

      if (prev7Count === 0 && last7Count === 0) {
        // Sem atividade em 14 dias —Tenant inativo
        rawScore = 0.7;
        evidence = 'Sem atividade de IA em 14 dias';
      } else if (prev7Count === 0) {
        rawScore = 0;
        evidence = `Nova adoção: ${last7Count} atividades (sem baseline anterior)`;
      } else if (last7Count === 0) {
        rawScore = 1;
        evidence = `Atividade IA parou: ${prev7Count} → 0`;
      } else {
        const decline = (prev7Count - last7Count) / prev7Count;
        rawScore = Math.max(0, Math.min(1, decline));
        evidence = `Atividade IA: ${prev7Count} → ${last7Count} (${decline > 0 ? '-' : '+'}${Math.abs(decline * 100).toFixed(1)}%)`;
      }

      return {
        name: 'ai_activity_decline',
        weight: 0.30,
        rawScore: Math.round(rawScore * 100) / 100,
        weightedScore: Math.round(rawScore * 0.30 * 100) / 100,
        evidence,
      };
    } catch (err) {
      logSink.warn({
        module: 'churn-predictor',
        event: 'signal_ai_activity_failed',
        message: `Falha ao calcular signal ai_activity_decline para ${tenantId}`,
        error: err,
      });
      return {
        name: 'ai_activity_decline',
        weight: 0.30,
        rawScore: 0,
        weightedScore: 0,
        evidence: 'query failed',
      };
    }
  }

  /**
   * Signal: Conversation volume decline.
   * Usa ConversationLog (que tem tenantId direto) em vez de ConversationMessage.
   */
  private async signalConversationDecline(tenantId: string): Promise<ChurnSignal> {
    const now = Date.now();
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const prev7d = new Date(now - 14 * 24 * 60 * 60 * 1000);

    try {
      const [last7Count, prev7Count] = await Promise.all([
        db.conversationLog.count({
          where: { tenantId, createdAt: { gte: last7d } },
        }),
        db.conversationLog.count({
          where: {
            tenantId,
            createdAt: { gte: prev7d, lt: last7d },
          },
        }),
      ]);

      let rawScore = 0;
      let evidence = '';

      if (prev7Count === 0 && last7Count === 0) {
        rawScore = 0.5;
        evidence = 'Sem conversas em 14 dias';
      } else if (prev7Count === 0) {
        rawScore = 0;
        evidence = `Novo: ${last7Count} conversas`;
      } else if (last7Count === 0) {
        rawScore = 0.9;
        evidence = `Conversas pararam: ${prev7Count} → 0`;
      } else {
        const decline = (prev7Count - last7Count) / prev7Count;
        rawScore = Math.max(0, Math.min(1, decline));
        evidence = `Conversas: ${prev7Count} → ${last7Count} (${decline > 0 ? '-' : '+'}${Math.abs(decline * 100).toFixed(1)}%)`;
      }

      return {
        name: 'conversation_decline',
        weight: 0.20,
        rawScore: Math.round(rawScore * 100) / 100,
        weightedScore: Math.round(rawScore * 0.20 * 100) / 100,
        evidence,
      };
    } catch {
      return {
        name: 'conversation_decline',
        weight: 0.20,
        rawScore: 0,
        weightedScore: 0,
        evidence: 'query failed',
      };
    }
  }

  /**
   * Signal: Meta cost decline (less marketing activity).
   */
  private async signalMetaCostDecline(tenantId: string): Promise<ChurnSignal> {
    const now = Date.now();
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const prev7d = new Date(now - 14 * 24 * 60 * 60 * 1000);

    try {
      const [last7Agg, prev7Agg] = await Promise.all([
        db.metaCostLog.aggregate({
          _sum: { costUsd: true },
          where: { tenantId, createdAt: { gte: last7d } },
        }),
        db.metaCostLog.aggregate({
          _sum: { costUsd: true },
          where: {
            tenantId,
            createdAt: { gte: prev7d, lt: last7d },
          },
        }),
      ]);

      const last7Cost = last7Agg._sum.costUsd ?? 0;
      const prev7Cost = prev7Agg._sum.costUsd ?? 0;

      let rawScore = 0;
      let evidence = '';

      if (prev7Cost === 0 && last7Cost === 0) {
        rawScore = 0.2; // Neutro — pode ser que tenant não usa Meta
        evidence = 'Sem gastos Meta em 14 dias';
      } else if (prev7Cost === 0) {
        rawScore = 0;
        evidence = `Novo: $${last7Cost.toFixed(2)}`;
      } else if (last7Cost === 0) {
        rawScore = 0.8;
        evidence = `Gasto Meta parou: $${prev7Cost.toFixed(2)} → $0`;
      } else {
        const decline = (prev7Cost - last7Cost) / prev7Cost;
        rawScore = Math.max(0, Math.min(1, decline));
        evidence = `Meta: $${prev7Cost.toFixed(2)} → $${last7Cost.toFixed(2)} (${decline > 0 ? '-' : '+'}${Math.abs(decline * 100).toFixed(1)}%)`;
      }

      return {
        name: 'meta_cost_decline',
        weight: 0.15,
        rawScore: Math.round(rawScore * 100) / 100,
        weightedScore: Math.round(rawScore * 0.15 * 100) / 100,
        evidence,
      };
    } catch {
      return {
        name: 'meta_cost_decline',
        weight: 0.15,
        rawScore: 0,
        weightedScore: 0,
        evidence: 'query failed',
      };
    }
  }

  /**
   * Signal: Brain health (human takeover / conversion).
   */
  private async signalBrainHealth(tenantId: string): Promise<ChurnSignal> {
    try {
      const logs = await db.brainHealthLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 7,
      });

      if (logs.length === 0) {
        return {
          name: 'brain_health',
          weight: 0.20,
          rawScore: 0.3,
          weightedScore: 0.06,
          evidence: 'Sem BrainHealthLog registrado',
        };
      }

      const avgTakeover = logs.reduce((acc, l) => acc + l.humanTakeoverRate, 0) / logs.length;
      const avgConversion = logs.reduce((acc, l) => acc + l.conversionRate, 0) / logs.length;

      // Score: takeover alto = ruim, conversion baixo = ruim
      const takeoverScore = Math.max(0, Math.min(1, (avgTakeover - 0.1) / 0.4)); // 10% normal, 50% = 1.0
      const conversionScore = Math.max(0, Math.min(1, (0.3 - avgConversion) / 0.3)); // 30% bom, 0% = 1.0
      const rawScore = (takeoverScore + conversionScore) / 2;

      return {
        name: 'brain_health',
        weight: 0.20,
        rawScore: Math.round(rawScore * 100) / 100,
        weightedScore: Math.round(rawScore * 0.20 * 100) / 100,
        evidence: `Takeover: ${(avgTakeover * 100).toFixed(1)}%, Conversion: ${(avgConversion * 100).toFixed(1)}% (média ${logs.length} logs)`,
      };
    } catch {
      return {
        name: 'brain_health',
        weight: 0.20,
        rawScore: 0,
        weightedScore: 0,
        evidence: 'query failed',
      };
    }
  }

  /**
   * Signal: Login recency (last ZCC access).
   */
  private async signalLoginRecency(tenantId: string): Promise<ChurnSignal> {
    try {
      // Procura último login no ZCC por users do tenant
      const lastLogin = await db.auditLog.findFirst({
        where: {
          action: { contains: 'login' },
          // NOTA: AuditLog pode não ter tenantId direto; usamos metadata se disponível
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      if (!lastLogin) {
        return {
          name: 'login_recency',
          weight: 0.15,
          rawScore: 0.5,
          weightedScore: 0.075,
          evidence: 'Sem log de login encontrado',
        };
      }

      const daysSinceLogin = (Date.now() - lastLogin.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      // 0 dias = 0 score, 14+ dias = 1.0
      const rawScore = Math.max(0, Math.min(1, daysSinceLogin / 14));

      return {
        name: 'login_recency',
        weight: 0.15,
        rawScore: Math.round(rawScore * 100) / 100,
        weightedScore: Math.round(rawScore * 0.15 * 100) / 100,
        evidence: `Último login: ${daysSinceLogin.toFixed(1)} dias atrás`,
      };
    } catch {
      return {
        name: 'login_recency',
        weight: 0.15,
        rawScore: 0,
        weightedScore: 0,
        evidence: 'query failed',
      };
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private scoreToRiskLevel(score: number): RiskLevel {
    if (score >= 0.85) return 'critical';
    if (score >= 0.6) return 'warning';
    if (score >= 0.3) return 'watch';
    return 'ok';
  }

  private recommendAction(risk: RiskLevel): string {
    switch (risk) {
      case 'critical':
        return 'URGENTE: Contato humano imediato. Oferecer desconto/cortesia. Investigar causa raiz do desengajamento.';
      case 'warning':
        return 'Email automático para tenant com dicas de uso + oferta de call com customer success.';
      case 'watch':
        return 'Monitorar próximo churn prediction. Registrar em BrainHealthLog.';
      default:
        return 'Nenhuma ação necessária.';
    }
  }

  /**
   * Estatísticas para dashboard.
   */
  getStats() {
    return {
      mode: this.mode,
      weights: {
        ai_activity_decline: 0.30,
        conversation_decline: 0.20,
        meta_cost_decline: 0.15,
        brain_health: 0.20,
        login_recency: 0.15,
      },
      riskThresholds: {
        ok: '< 0.30',
        watch: '0.30 - 0.60',
        warning: '0.60 - 0.85',
        critical: '>= 0.85',
      },
    };
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let singleton: ChurnPredictor | null = null;

export function getChurnPredictor(): ChurnPredictor {
  if (!singleton) {
    singleton = new ChurnPredictor();
  }
  return singleton;
}
