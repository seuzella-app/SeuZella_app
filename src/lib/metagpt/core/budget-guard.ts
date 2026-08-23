// =============================================================================
// SEU ZÉLLA METAGPT ENGINE — TOKEN BUDGET & COST GUARDRAIL
// =============================================================================

export interface BudgetConfig {
  maxTokensPerSOP: number;
  maxCostUsdPerSOP: number;
  maxDurationMs: number;
}

export const DEFAULT_SOP_BUDGET: BudgetConfig = {
  maxTokensPerSOP: 8000,
  maxCostUsdPerSOP: 0.005, // Máximo de meio centavo de dólar por execução completa
  maxDurationMs: 15000,    // 15 segundos timeout
};

export class BudgetGuard {
  private tokensUsed = 0;
  private startTime = Date.now();
  private config: BudgetConfig;

  constructor(config: Partial<BudgetConfig> = {}) {
    this.config = { ...DEFAULT_SOP_BUDGET, ...config };
  }

  public recordUsage(tokens: number, costEstimateUsd = 0) {
    this.tokensUsed += tokens;
    const currentCost = this.estimateCostUsd();

    if (this.tokensUsed > this.config.maxTokensPerSOP) {
      throw new Error(`[BudgetGuard] Limite de tokens excedido no SOP (${this.tokensUsed} > ${this.config.maxTokensPerSOP})`);
    }

    if (currentCost > this.config.maxCostUsdPerSOP) {
      throw new Error(`[BudgetGuard] Limite de custo excedido no SOP ($${currentCost.toFixed(5)} > $${this.config.maxCostUsdPerSOP})`);
    }

    const elapsed = Date.now() - this.startTime;
    if (elapsed > this.config.maxDurationMs) {
      throw new Error(`[BudgetGuard] Timeout de execução do SOP excedido (${elapsed}ms > ${this.config.maxDurationMs}ms)`);
    }
  }

  public getTokensUsed(): number {
    return this.tokensUsed;
  }

  public estimateCostUsd(): number {
    // Estimativa ponderada média: ~ $0.0003 por 1K tokens (DeepSeek Flash / GLM-5.2)
    return (this.tokensUsed / 1000) * 0.0003;
  }

  public getElapsedMs(): number {
    return Date.now() - this.startTime;
  }
}
