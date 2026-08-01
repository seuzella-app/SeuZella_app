// ============================================================================
// ZÉLLA — Cérebro Budget Guard (Self-financed intelligence)
// ============================================================================
// BudgetGuard específico do Cérebro, SEPARADO do BudgetGuard do ZaosNeuroRouter.
//
// Por que separar?
//  - ZaosNeuroRouter gerencia custo de LLM para RESPOSTAS a hóspedes (core business)
//  - Cérebro gerencia custo de LLM para AUTO-VIGILÂNCIA (análises, refatoração,
//    sumarização de anomalias, predição de churn) — operações internas
//  - Se o Cérebro ficar caro demais, NÃO podemos comprometer respostas a hóspedes
//  - Se o Cérebro estourar o orçamento interno, faz fallback para mock mode
//    (sem LLM, só detecção estatística) — hóspedes continuam atendidos
//
// TIERED BUDGET:
//  - SOFT (50% do monthly): alerta warning, mantém LLM ativo
//  - HARD (80% do monthly): alerta critical, throttling (skip 50% das análises)
//  - CRITICAL (95% do monthly): alerta emergency, fallback completo para mock
//
// RESET:
//  - Diário: reseta spend daily às 00:00 UTC
//  - Mensal: reseta spend monthly no dia 1 do mês
//
// PERSISTÊNCIA:
//  - Em live: estado salvo em DB (CerebroBudgetState table) para sobreviver cold start
//  - Em mock: estado em memória apenas (para dev/teste)
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from './log-sink';
import { getCerebroMode } from './types';

// ── Types ───────────────────────────────────────────────────────────────────

export type BudgetTier = 'soft' | 'hard' | 'critical' | 'ok';

export interface CerebroBudgetState {
  monthlyBudgetUsd: number;
  monthlySpendUsd: number;
  dailyBudgetUsd: number;
  dailySpendUsd: number;
  currentTier: BudgetTier;
  lastResetDaily: Date;
  lastResetMonthly: Date;
  totalAnalyses: number;
  totalRefactors: number;
  totalSavedByMock: number; // USD economizados por fallback para mock
}

interface CerebroBudgetConfig {
  monthlyBudgetUsd: number;
  dailyBudgetUsd: number;
  softThresholdPercent: number; // 50
  hardThresholdPercent: number; // 80
  criticalThresholdPercent: number; // 95
}

const DEFAULT_CONFIG: CerebroBudgetConfig = {
  monthlyBudgetUsd: parseFloat(process.env.CEREBRO_MONTHLY_BUDGET_USD || '20'),
  dailyBudgetUsd: parseFloat(process.env.CEREBRO_DAILY_BUDGET_USD || '1'),
  softThresholdPercent: 50,
  hardThresholdPercent: 80,
  criticalThresholdPercent: 95,
};

// ── In-memory state (dev mode) ──────────────────────────────────────────────

const memoryState: CerebroBudgetState = {
  monthlyBudgetUsd: DEFAULT_CONFIG.monthlyBudgetUsd,
  monthlySpendUsd: 0,
  dailyBudgetUsd: DEFAULT_CONFIG.dailyBudgetUsd,
  dailySpendUsd: 0,
  currentTier: 'ok',
  lastResetDaily: new Date(),
  lastResetMonthly: new Date(),
  totalAnalyses: 0,
  totalRefactors: 0,
  totalSavedByMock: 0,
};

// ── Tier computation ────────────────────────────────────────────────────────

function computeTier(monthlySpend: number, monthlyBudget: number): BudgetTier {
  if (monthlyBudget <= 0) return 'ok';
  const pct = (monthlySpend / monthlyBudget) * 100;
  if (pct >= DEFAULT_CONFIG.criticalThresholdPercent) return 'critical';
  if (pct >= DEFAULT_CONFIG.hardThresholdPercent) return 'hard';
  if (pct >= DEFAULT_CONFIG.softThresholdPercent) return 'soft';
  return 'ok';
}

// ── Daily/Monthly reset check ───────────────────────────────────────────────

function checkAndReset(state: CerebroBudgetState): CerebroBudgetState {
  const now = new Date();
  const updated = { ...state };

  // Daily reset: 00:00 UTC
  if (now.getUTCDate() !== updated.lastResetDaily.getUTCDate() ||
      now.getUTCMonth() !== updated.lastResetDaily.getUTCMonth()) {
    updated.dailySpendUsd = 0;
    updated.lastResetDaily = now;
    logSink.info({
      module: 'cerebro-budget-guard',
      event: 'daily_reset',
      message: `Daily spend reset (was ${state.dailySpendUsd.toFixed(4)} USD)`,
    });
  }

  // Monthly reset: 1st of month
  if (now.getUTCMonth() !== updated.lastResetMonthly.getUTCMonth()) {
    updated.monthlySpendUsd = 0;
    updated.lastResetMonthly = now;
    logSink.info({
      module: 'cerebro-budget-guard',
      event: 'monthly_reset',
      message: `Monthly spend reset (was ${state.monthlySpendUsd.toFixed(4)} USD)`,
    });
  }

  return updated;
}

// ── Public API ──────────────────────────────────────────────────────────────

export class CerebroBudgetGuard {
  private config: CerebroBudgetConfig;
  private mode: 'mock' | 'live';

  constructor(config: Partial<CerebroBudgetConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.mode = getCerebroMode();

    // Sync config com memoryState (para que custom budgets funcionem)
    if (config.monthlyBudgetUsd !== undefined) {
      memoryState.monthlyBudgetUsd = config.monthlyBudgetUsd;
    }
    if (config.dailyBudgetUsd !== undefined) {
      memoryState.dailyBudgetUsd = config.dailyBudgetUsd;
    }
  }

  /**
   * Verifica se uma operação de LLM do Cérebro pode ser executada.
   * Retorna true se pode (com LLM real), false se deve usar fallback mock.
   *
   * Regras:
   *  - Tier OK/SOFT: pode
   *  - Tier HARD: pode apenas 50% das vezes (random)
   *  - Tier CRITICAL: nunca (sempre fallback mock)
   */
  canSpend(potentialCostUsd: number = 0.005): { allowed: boolean; tier: BudgetTier; reason: string } {
    const state = this.getState();
    const tier = computeTier(state.monthlySpendUsd, state.monthlyBudgetUsd);

    if (tier === 'critical') {
      return {
        allowed: false,
        tier,
        reason: `CRITICAL budget tier: ${state.monthlySpendUsd.toFixed(2)}/${state.monthlyBudgetUsd.toFixed(2)} USD — fallback para mock`,
      };
    }

    if (tier === 'hard') {
      // 50% chance de permitir (throttling)
      const allow = Math.random() < 0.5;
      return {
        allowed: allow,
        tier,
        reason: allow
          ? 'HARD tier throttling: permitido (50% chance)'
          : 'HARD tier throttling: skip (50% chance) — fallback mock',
      };
    }

    // Verifica se a operação cabe no orçamento mensal
    const projectedSpend = state.monthlySpendUsd + potentialCostUsd;
    if (projectedSpend > state.monthlyBudgetUsd) {
      return {
        allowed: false,
        tier,
        reason: `Operação estouraria orçamento: ${projectedSpend.toFixed(4)} > ${state.monthlyBudgetUsd.toFixed(2)}`,
      };
    }

    return { allowed: true, tier, reason: 'OK' };
  }

  /**
   * Registra um gasto real de LLM.
   * Atualiza estado em memória (e DB se live mode).
   */
  async recordSpend(costUsd: number, operation: 'analysis' | 'refactor' | 'summarize' | 'embed'): Promise<void> {
    if (costUsd <= 0) return;

    const state = this.getState();
    state.monthlySpendUsd += costUsd;
    state.dailySpendUsd += costUsd;

    if (operation === 'analysis') state.totalAnalyses++;
    if (operation === 'refactor') state.totalRefactors++;

    state.currentTier = computeTier(state.monthlySpendUsd, state.monthlyBudgetUsd);

    // Persiste em DB (live mode)
    if (this.mode === 'live') {
      try {
        // Usamos CerebroTelemetryEvent para persistir gastos (já existe no schema)
        await db.cerebroTelemetryEvent.create({
          data: {
            type: 'llm_call',
            name: `budget_spend.${operation}`,
            module: 'cerebro-budget-guard',
            severity: state.currentTier === 'critical' ? 'critical' : 'info',
            message: `Cérebro ${operation} spend: $${costUsd.toFixed(4)} (monthly total: $${state.monthlySpendUsd.toFixed(4)})`,
            context: JSON.stringify({
              costUsd,
              operation,
              monthlySpend: state.monthlySpendUsd,
              dailySpend: state.dailySpendUsd,
              tier: state.currentTier,
              timestamp: new Date().toISOString(),
            }),
          },
        });
      } catch (err) {
        logSink.warn({
          module: 'cerebro-budget-guard',
          event: 'persist_failed',
          message: 'Falha ao persistir spend no DB (non-fatal)',
          error: err,
        });
      }
    }

    // Alerta se cruzou threshold
    const prevTier = computeTier(state.monthlySpendUsd - costUsd, state.monthlyBudgetUsd);
    if (state.currentTier !== prevTier && state.currentTier !== 'ok') {
      logSink.warn({
        module: 'cerebro-budget-guard',
        event: 'tier_escalation',
        message: `Cérebro budget tier: ${prevTier} → ${state.currentTier} (${state.monthlySpendUsd.toFixed(2)}/${state.monthlyBudgetUsd.toFixed(2)} USD)`,
        context: {
          prevTier,
          newTier: state.currentTier,
          monthlySpend: state.monthlySpendUsd,
          monthlyBudget: state.monthlyBudgetUsd,
          dailySpend: state.dailySpendUsd,
          dailyBudget: state.dailyBudgetUsd,
        },
      });
    }
  }

  /**
   * Registra economia ao usar fallback mock em vez de LLM.
   */
  recordSavings(savedUsd: number): void {
    if (savedUsd <= 0) return;
    memoryState.totalSavedByMock += savedUsd;
  }

  /**
   * Retorna snapshot do estado atual (com reset automático se necessário).
   */
  getState(): CerebroBudgetState {
    const reset = checkAndReset(memoryState);
    Object.assign(memoryState, reset);
    return memoryState;
  }

  /**
   * Estatísticas para dashboard ZCC.
   */
  getStats() {
    const state = this.getState();
    return {
      mode: this.mode,
      config: this.config,
      state: {
        monthlyBudgetUsd: state.monthlyBudgetUsd,
        monthlySpendUsd: Math.round(state.monthlySpendUsd * 10000) / 10000,
        monthlyUsagePercent: state.monthlyBudgetUsd > 0
          ? Math.round((state.monthlySpendUsd / state.monthlyBudgetUsd) * 10000) / 100
          : 0,
        dailyBudgetUsd: state.dailyBudgetUsd,
        dailySpendUsd: Math.round(state.dailySpendUsd * 10000) / 10000,
        dailyUsagePercent: state.dailyBudgetUsd > 0
          ? Math.round((state.dailySpendUsd / state.dailyBudgetUsd) * 10000) / 100
          : 0,
        currentTier: state.currentTier,
        totalAnalyses: state.totalAnalyses,
        totalRefactors: state.totalRefactors,
        totalSavedByMock: Math.round(state.totalSavedByMock * 10000) / 10000,
      },
    };
  }

  /**
   * Reset manual (para testes ou dashboard button).
   */
  reset(): void {
    memoryState.monthlySpendUsd = 0;
    memoryState.dailySpendUsd = 0;
    memoryState.totalAnalyses = 0;
    memoryState.totalRefactors = 0;
    memoryState.totalSavedByMock = 0;
    memoryState.currentTier = 'ok';
    memoryState.lastResetDaily = new Date();
    memoryState.lastResetMonthly = new Date();
    logSink.info({
      module: 'cerebro-budget-guard',
      event: 'manual_reset',
      message: 'Cérebro budget guard manualmente resetado',
    });
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let singleton: CerebroBudgetGuard | null = null;

export function getCerebroBudgetGuard(): CerebroBudgetGuard {
  if (!singleton) {
    singleton = new CerebroBudgetGuard();
  }
  return singleton;
}
