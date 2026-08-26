export interface BudgetSnapshot {
  readonly dailySpendUsd: number;
  readonly dailyBudgetUsd: number;
  readonly monthlySpendUsd: number;
  readonly monthlyBudgetUsd: number;
}

export enum BudgetLevel {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING', // ≥ 80%
  CRITICAL = 'CRITICAL', // ≥ 95%
}

export class BudgetGuard {
  private readonly warningThreshold: number;
  private readonly criticalThreshold: number;
  private readonly costInflationFactor: number;

  constructor(params?: {
    warningThreshold?: number;
    criticalThreshold?: number;
    costInflationFactor?: number;
  }) {
    this.warningThreshold = params?.warningThreshold ?? 0.80;
    this.criticalThreshold = params?.criticalThreshold ?? 0.95;
    this.costInflationFactor = params?.costInflationFactor ?? 3.0;
  }

  assessLevel(snapshot: BudgetSnapshot): BudgetLevel {
    const dailyRatio = snapshot.dailySpendUsd / snapshot.dailyBudgetUsd;
    const monthlyRatio = snapshot.monthlySpendUsd / snapshot.monthlyBudgetUsd;
    const worstRatio = Math.max(dailyRatio, monthlyRatio);

    if (worstRatio >= this.criticalThreshold) return BudgetLevel.CRITICAL;
    if (worstRatio >= this.warningThreshold) return BudgetLevel.WARNING;
    return BudgetLevel.NORMAL;
  }

  getAdjustedCost(
    realCostUsd: number,
    tier: 1 | 2 | 3,
    budgetLevel: BudgetLevel,
  ): number {
    switch (budgetLevel) {
      case BudgetLevel.CRITICAL:
        return tier >= 2 ? Infinity : realCostUsd;
      case BudgetLevel.WARNING:
        return tier >= 2 ? realCostUsd * this.costInflationFactor : realCostUsd;
      default:
        return realCostUsd;
    }
  }

  getAllowedProviderNames(
    allProviders: ReadonlyArray<{ name: string; tier: 1 | 2 | 3 }>,
    budgetLevel: BudgetLevel,
  ): ReadonlyArray<string> {
    if (budgetLevel === BudgetLevel.CRITICAL) {
      return allProviders.filter(p => p.tier === 1).map(p => p.name);
    }
    return allProviders.map(p => p.name);
  }

  getBudgetStatus(snapshot: BudgetSnapshot): {
    dailyRatio: number;
    monthlyRatio: number;
    level: BudgetLevel;
  } {
    return {
      dailyRatio: Math.round((snapshot.dailySpendUsd / snapshot.dailyBudgetUsd) * 1000) / 1000,
      monthlyRatio: Math.round((snapshot.monthlySpendUsd / snapshot.monthlyBudgetUsd) * 1000) / 1000,
      level: this.assessLevel(snapshot),
    };
  }
}
