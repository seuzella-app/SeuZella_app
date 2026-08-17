import { db } from '@/lib/db';

/**
 * Budget Guard for ZaosNeuroRouter
 *
 * Tracks daily and monthly LLM spending and enforces tier restrictions
 * based on budget consumption levels:
 *
 *   NOMINAL  (< 60%)  — all tiers available
 *   WARNING  (60-85%) — prefer Tier 1, Tier 2 allowed with cost check, Tier 3 blocked
 *   CRITICAL (> 85%)  — only Tier 1 (budget/local) allowed
 *
 * Budget thresholds are evaluated against the more restrictive of
 * daily and monthly ratios.
 */

export enum BudgetLevel {
  NOMINAL = 'nominal',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum ProviderTier {
  BUDGET = 1,   // Local Ollama, free/cheap models
  MID = 2,      // Groq, Gemini Flash
  PREMIUM = 3,  // GPT-4o, Claude
}

export interface BudgetGuardConfig {
  /** Daily budget in USD (default: 50.00) */
  dailyBudgetUsd: number;
  /** Monthly budget in USD (default: 1500.00) */
  monthlyBudgetUsd: number;
  /** Threshold ratio for WARNING level (default: 0.60) */
  warningThreshold: number;
  /** Threshold ratio for CRITICAL level (default: 0.85) */
  criticalThreshold: number;
}

export interface BudgetGuardSnapshot {
  level: BudgetLevel;
  dailySpendUsd: number;
  dailyBudgetUsd: number;
  dailyRatio: number;
  monthlySpendUsd: number;
  monthlyBudgetUsd: number;
  monthlyRatio: number;
  canUseTier1: boolean;
  canUseTier2: boolean;
  canUseTier3: boolean;
}

const DEFAULT_CONFIG: BudgetGuardConfig = {
  dailyBudgetUsd: 50.00,
  monthlyBudgetUsd: 1500.00,
  warningThreshold: 0.60,
  criticalThreshold: 0.85,
};

export class BudgetGuard {
  private dailySpendUsd = 0;
  private monthlySpendUsd = 0;
  private dailyResetDate: string;
  private monthlyResetYear: number;
  private monthlyResetMonth: number;
  private readonly config: BudgetGuardConfig;

  constructor(config: Partial<BudgetGuardConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const now = new Date();
    this.dailyResetDate = this.formatDate(now);
    this.monthlyResetYear = now.getFullYear();
    this.monthlyResetMonth = now.getMonth(); // 0-indexed
  }

  /**
   * Check whether a given provider tier is currently allowed.
   *
   * @param tier - ProviderTier (1 = Budget, 2 = Mid, 3 = Premium)
   * @param estimatedCost - Optional estimated cost in USD for Tier 2 at WARNING level
   * @returns `true` if the tier can be used
   */
  canUseTier(tier: number, estimatedCost?: number): boolean {
    this.checkResets();
    const level = this.getLevel();

    switch (tier) {
      case ProviderTier.BUDGET:
        // Tier 1 is always available (free/cheap)
        return true;

      case ProviderTier.MID:
        if (level === BudgetLevel.NOMINAL) return true;
        if (level === BudgetLevel.WARNING) {
          // At WARNING, Tier 2 is allowed only if the estimated cost
          // won't push daily spending above the critical threshold
          if (estimatedCost !== undefined) {
            const projectedDaily = this.dailySpendUsd + estimatedCost;
            const projectedDailyRatio = projectedDaily / this.config.dailyBudgetUsd;
            return projectedDailyRatio <= this.config.criticalThreshold;
          }
          // If no cost estimate provided, allow but with deposit
          return true;
        }
        // CRITICAL: block Tier 2
        return false;

      case ProviderTier.PREMIUM:
        if (level === BudgetLevel.NOMINAL) return true;
        // WARNING and CRITICAL: block Tier 3
        return false;

      default:
        return false;
    }
  }

  /**
   * Record spending in USD. Updates daily and monthly totals.
   * Handles day and month rollovers automatically.
   */
  addSpend(amountUsd: number): void {
    if (amountUsd <= 0) return;

    this.checkResets();

    this.dailySpendUsd += amountUsd;
    this.monthlySpendUsd += amountUsd;
  }

  /**
   * Get the current budget consumption level.
   * Uses the more restrictive of daily and monthly ratios.
   */
  getLevel(): BudgetLevel {
    this.checkResets();

    const dailyRatio = this.dailySpendUsd / this.config.dailyBudgetUsd;
    const monthlyRatio = this.monthlySpendUsd / this.config.monthlyBudgetUsd;
    const maxRatio = Math.max(dailyRatio, monthlyRatio);

    if (maxRatio >= this.config.criticalThreshold) {
      return BudgetLevel.CRITICAL;
    }
    if (maxRatio >= this.config.warningThreshold) {
      return BudgetLevel.WARNING;
    }
    return BudgetLevel.NOMINAL;
  }

  /**
   * Get the maximum tier that can currently be used based on budget level.
   */
  getMaxAllowedTier(): number {
    const level = this.getLevel();
    switch (level) {
      case BudgetLevel.NOMINAL:
        return ProviderTier.PREMIUM;
      case BudgetLevel.WARNING:
        return ProviderTier.MID;
      case BudgetLevel.CRITICAL:
        return ProviderTier.BUDGET;
    }
  }

  /**
   * Get a full snapshot of the budget state for observability.
   */
  getSnapshot(): BudgetGuardSnapshot {
    this.checkResets();

    const dailyRatio = this.dailySpendUsd / this.config.dailyBudgetUsd;
    const monthlyRatio = this.monthlySpendUsd / this.config.monthlyBudgetUsd;
    const level = this.getLevel();

    return {
      level,
      dailySpendUsd: Math.round(this.dailySpendUsd * 1_000_000) / 1_000_000,
      dailyBudgetUsd: this.config.dailyBudgetUsd,
      dailyRatio: Math.round(dailyRatio * 10_000) / 10_000,
      monthlySpendUsd: Math.round(this.monthlySpendUsd * 1_000_000) / 1_000_000,
      monthlyBudgetUsd: this.config.monthlyBudgetUsd,
      monthlyRatio: Math.round(monthlyRatio * 10_000) / 10_000,
      canUseTier1: this.canUseTier(ProviderTier.BUDGET),
      canUseTier2: this.canUseTier(ProviderTier.MID),
      canUseTier3: this.canUseTier(ProviderTier.PREMIUM),
    };
  }

  /**
   * Manually set spending values. Useful for initialization from DB state.
   */
  setSpend(dailyUsd: number, monthlyUsd: number): void {
    this.dailySpendUsd = Math.max(0, dailyUsd);
    this.monthlySpendUsd = Math.max(0, monthlyUsd);
  }

  /**
   * Reset daily spending (called automatically at midnight).
   */
  resetDaily(): void {
    this.dailySpendUsd = 0;
    this.dailyResetDate = this.formatDate(new Date());
  }

  /**
   * Reset monthly spending (called automatically at month boundary).
   */
  resetMonthly(): void {
    this.monthlySpendUsd = 0;
    const now = new Date();
    this.monthlyResetYear = now.getFullYear();
    this.monthlyResetMonth = now.getMonth();
  }

  /** Get remaining daily budget in USD */
  getRemainingDailyBudget(): number {
    this.checkResets();
    return Math.max(0, this.config.dailyBudgetUsd - this.dailySpendUsd);
  }

  /** Get remaining monthly budget in USD */
  getRemainingMonthlyBudget(): number {
    this.checkResets();
    return Math.max(0, this.config.monthlyBudgetUsd - this.monthlySpendUsd);
  }

  /* ------------------------------------------------------------------ */
  /* Private helpers                                                     */
  /* ------------------------------------------------------------------ */

  /** Check if day or month has rolled over and reset counters accordingly */
  private checkResets(): void {
    const now = new Date();
    const today = this.formatDate(now);

    // Day rollover
    if (today !== this.dailyResetDate) {
      this.resetDaily();
    }

    // Month rollover
    if (now.getFullYear() !== this.monthlyResetYear || now.getMonth() !== this.monthlyResetMonth) {
      this.resetMonthly();
    }
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

/**
 * Per-tenant BudgetGuard wrapper.
 *
 * Isola o orçamento de cada pousada/tenant, garantindo que
 * o consumo de uma não afete a disponibilidade de outra.
 *
 * Cada tenant tem seu próprio BudgetGuard com budgets definidos
 * pelo plano contratado:
 *   Lite  → $10/dia, $300/mês
 *   Pro   → $25/dia, $750/mês
 *   Max   → $50/dia, $1500/mês
 */
export class TenantBudgetGuard {
  private tenants: Map<string, BudgetGuard> = new Map();

  private readonly PLAN_BUDGETS: Record<string, { daily: number; monthly: number }> = {
    lite: { daily: 10, monthly: 300 },
    pro: { daily: 25, monthly: 750 },
    max: { daily: 50, monthly: 1500 },
  };

  getGuard(tenantId: string, plan?: string): BudgetGuard {
    let guard = this.tenants.get(tenantId);
    if (!guard) {
      const budgets = this.PLAN_BUDGETS[plan?.toLowerCase() ?? 'lite'] ?? this.PLAN_BUDGETS.lite;
      guard = new BudgetGuard({
        dailyBudgetUsd: budgets.daily,
        monthlyBudgetUsd: budgets.monthly,
      });
      this.tenants.set(tenantId, guard);
    }
    return guard;
  }

  addSpend(tenantId: string, amountUsd: number, plan?: string): void {
    const guard = this.getGuard(tenantId, plan);
    guard.addSpend(amountUsd);
  }

  getSnapshot(tenantId: string, plan?: string): BudgetGuardSnapshot {
    const guard = this.getGuard(tenantId, plan);
    return guard.getSnapshot();
  }

  canUseTier(tenantId: string, tier: number, estimatedCost?: number, plan?: string): boolean {
    const guard = this.getGuard(tenantId, plan);
    return guard.canUseTier(tier, estimatedCost);
  }

  getMaxAllowedTier(tenantId: string, plan?: string): number {
    const guard = this.getGuard(tenantId, plan);
    return guard.getMaxAllowedTier();
  }

  getLevel(tenantId: string, plan?: string): BudgetLevel {
    const guard = this.getGuard(tenantId, plan);
    return guard.getLevel();
  }

  removeTenant(tenantId: string): void {
    this.tenants.delete(tenantId);
  }

  getActiveTenantCount(): number {
    return this.tenants.size;
  }

  getAllSnapshots(): Record<string, BudgetGuardSnapshot> {
    const result: Record<string, BudgetGuardSnapshot> = {};
    for (const [id, guard] of this.tenants) {
      result[id] = guard.getSnapshot();
    }
    return result;
  }
}

export const tenantBudgetGuard = new TenantBudgetGuard();

export async function getTotalSpendReport(tenantId: string) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const llmState = await db.budgetGuardState.findUnique({
      where: { date: today },
    });

    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    const metaLogs = await db.metaCostLog.aggregate({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
      },
      _sum: { costUsd: true },
      _count: true,
    });

    return {
      llmDailyUsd: llmState?.dailySpendUsd || 0,
      llmMonthlyUsd: llmState?.monthlySpendUsd || 0,
      metaMonthlyUsd: metaLogs._sum.costUsd || 0,
      metaMessageCount: metaLogs._count || 0,
      totalMonthlyUsd:
        (llmState?.monthlySpendUsd || 0) + (metaLogs._sum.costUsd || 0),
    };
  } catch (error) {
    console.error("Failed to get total spend report:", error);
    return {
      llmDailyUsd: 0,
      llmMonthlyUsd: 0,
      metaMonthlyUsd: 0,
      metaMessageCount: 0,
      totalMonthlyUsd: 0,
    };
  }
}