export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  cachePer1M: number;
  contextTokens: number;
  providerId: string;
  tier: number;
}

export interface BucketRecommendation {
  cheapest: string;
  bestValue: string;
  premium: string;
  maxCostPerMsgUsd: number;
}

export class CostKnowledge {
  private pricing: Map<string, ModelPricing>;
  private bucketMap: Map<string, BucketRecommendation>;
  private bucketTierMap: Map<string, number>;

  constructor() {
    this.pricing = new Map();
    this.bucketMap = new Map();
    this.bucketTierMap = new Map();
    this.initPricing();
    this.initBucketRecommendations();
    this.initBucketTiers();
  }

  /* ---------------------------------------------------------- */
  /* Master Pricing Table — 12 modelos com preços reais Jun/2026 */
  /* ---------------------------------------------------------- */
  private initPricing(): void {
    const models: ModelPricing[] = [
      { providerId: 'ollama-llama3', inputPer1M: 0, outputPer1M: 0, cachePer1M: 0, contextTokens: 8192, tier: 1 },
      { providerId: 'ollama-gemma3', inputPer1M: 0, outputPer1M: 0, cachePer1M: 0, contextTokens: 8192, tier: 1 },
      { providerId: 'groq-llama3-70b', inputPer1M: 0.59, outputPer1M: 0.79, cachePer1M: 0, contextTokens: 32768, tier: 2 },
      { providerId: 'gemini-flash', inputPer1M: 1.50, outputPer1M: 9.00, cachePer1M: 0.15, contextTokens: 1_048_576, tier: 3 },
      { providerId: 'deepseek-v4-flash', inputPer1M: 0.14, outputPer1M: 0.28, cachePer1M: 0.0028, contextTokens: 1_048_576, tier: 1 },
      { providerId: 'zhipu-glm5', inputPer1M: 1.40, outputPer1M: 4.40, cachePer1M: 0.26, contextTokens: 1_048_576, tier: 2 },
      { providerId: 'moonshot-kimi-k2-6', inputPer1M: 0.95, outputPer1M: 4.00, cachePer1M: 0.16, contextTokens: 262_144, tier: 2 },
      { providerId: 'openrouter-gpt4o', inputPer1M: 2.50, outputPer1M: 10.00, cachePer1M: 0, contextTokens: 128000, tier: 3 },
    ];
    for (const m of models) {
      this.pricing.set(m.providerId, m);
    }
  }

  /* ---------------------------------------------------------- */
  /* Bucket → Model Recommendations                             */
  /* Baseado na Estratégia de Roteamento Otimizada para Brasil   */
  /* ---------------------------------------------------------- */
  private initBucketRecommendations(): void {
    const buckets: Record<string, BucketRecommendation> = {
      // Tier 1 — perguntas simples, modelo mais barato
      checkin_assistance:   { cheapest: 'deepseek-v4-flash', bestValue: 'deepseek-v4-flash', premium: 'groq-llama3-70b', maxCostPerMsgUsd: 0.000084 },
      checkout_assistance:  { cheapest: 'deepseek-v4-flash', bestValue: 'deepseek-v4-flash', premium: 'groq-llama3-70b', maxCostPerMsgUsd: 0.000084 },
      weather_info:         { cheapest: 'deepseek-v4-flash', bestValue: 'deepseek-v4-flash', premium: 'groq-llama3-70b', maxCostPerMsgUsd: 0.000084 },
      amenity_info:         { cheapest: 'deepseek-v4-flash', bestValue: 'deepseek-v4-flash', premium: 'groq-llama3-70b', maxCostPerMsgUsd: 0.000084 },
      local_recommendation: { cheapest: 'deepseek-v4-flash', bestValue: 'deepseek-v4-flash', premium: 'groq-llama3-70b', maxCostPerMsgUsd: 0.000084 },
      pet_policy:           { cheapest: 'deepseek-v4-flash', bestValue: 'deepseek-v4-flash', premium: 'groq-llama3-70b', maxCostPerMsgUsd: 0.000084 },
      accessibility:        { cheapest: 'deepseek-v4-flash', bestValue: 'deepseek-v4-flash', premium: 'groq-llama3-70b', maxCostPerMsgUsd: 0.000084 },
      transportation:       { cheapest: 'deepseek-v4-flash', bestValue: 'deepseek-v4-flash', premium: 'groq-llama3-70b', maxCostPerMsgUsd: 0.000084 },
      dietary_request:      { cheapest: 'deepseek-v4-flash', bestValue: 'deepseek-v4-flash', premium: 'groq-llama3-70b', maxCostPerMsgUsd: 0.000084 },
      availability_check:   { cheapest: 'deepseek-v4-flash', bestValue: 'deepseek-v4-flash', premium: 'groq-llama3-70b', maxCostPerMsgUsd: 0.000084 },
      housekeeping_request: { cheapest: 'deepseek-v4-flash', bestValue: 'deepseek-v4-flash', premium: 'groq-llama3-70b', maxCostPerMsgUsd: 0.000084 },
      maintenance_request:  { cheapest: 'deepseek-v4-flash', bestValue: 'deepseek-v4-flash', premium: 'groq-llama3-70b', maxCostPerMsgUsd: 0.000084 },
      booking_cancellation: { cheapest: 'deepseek-v4-flash', bestValue: 'deepseek-v4-flash', premium: 'groq-llama3-70b', maxCostPerMsgUsd: 0.000084 },

      // Tier 2 — operações padrão, qualidade média
      reservation_query:    { cheapest: 'groq-llama3-70b', bestValue: 'groq-llama3-70b', premium: 'moonshot-kimi-k2-6', maxCostPerMsgUsd: 0.000296 },
      guest_communication:  { cheapest: 'groq-llama3-70b', bestValue: 'groq-llama3-70b', premium: 'moonshot-kimi-k2-6', maxCostPerMsgUsd: 0.000296 },
      review_analysis:      { cheapest: 'groq-llama3-70b', bestValue: 'groq-llama3-70b', premium: 'moonshot-kimi-k2-6', maxCostPerMsgUsd: 0.000296 },
      competitor_monitoring:{ cheapest: 'groq-llama3-70b', bestValue: 'moonshot-kimi-k2-6', premium: 'gemini-flash', maxCostPerMsgUsd: 0.000463 },
      lead_prospection:     { cheapest: 'groq-llama3-70b', bestValue: 'moonshot-kimi-k2-6', premium: 'gemini-flash', maxCostPerMsgUsd: 0.000463 },
      email_composition:    { cheapest: 'groq-llama3-70b', bestValue: 'moonshot-kimi-k2-6', premium: 'zhipu-glm5', maxCostPerMsgUsd: 0.000463 },
      whatsapp_template:    { cheapest: 'groq-llama3-70b', bestValue: 'groq-llama3-70b', premium: 'moonshot-kimi-k2-6', maxCostPerMsgUsd: 0.000296 },
      upselling:            { cheapest: 'groq-llama3-70b', bestValue: 'moonshot-kimi-k2-6', premium: 'zhipu-glm5', maxCostPerMsgUsd: 0.000463 },
      payment_processing:   { cheapest: 'groq-llama3-70b', bestValue: 'moonshot-kimi-k2-6', premium: 'gemini-flash', maxCostPerMsgUsd: 0.000463 },
      group_booking:        { cheapest: 'groq-llama3-70b', bestValue: 'moonshot-kimi-k2-6', premium: 'zhipu-glm5', maxCostPerMsgUsd: 0.000463 },
      long_stay:            { cheapest: 'groq-llama3-70b', bestValue: 'moonshot-kimi-k2-6', premium: 'zhipu-glm5', maxCostPerMsgUsd: 0.000463 },
      corporate_booking:    { cheapest: 'groq-llama3-70b', bestValue: 'moonshot-kimi-k2-6', premium: 'gemini-flash', maxCostPerMsgUsd: 0.000463 },
      ota_management:       { cheapest: 'groq-llama3-70b', bestValue: 'moonshot-kimi-k2-6', premium: 'zhipu-glm5', maxCostPerMsgUsd: 0.000463 },
      channel_management:   { cheapest: 'groq-llama3-70b', bestValue: 'moonshot-kimi-k2-6', premium: 'zhipu-glm5', maxCostPerMsgUsd: 0.000463 },

      // Tier 3 — análise complexa, qualidade premium
      pricing_optimization: { cheapest: 'moonshot-kimi-k2-6', bestValue: 'zhipu-glm5', premium: 'gemini-flash', maxCostPerMsgUsd: 0.000885 },
      revenue_diagnosis:    { cheapest: 'moonshot-kimi-k2-6', bestValue: 'zhipu-glm5', premium: 'gemini-flash', maxCostPerMsgUsd: 0.000885 },
      complaint_handling:   { cheapest: 'moonshot-kimi-k2-6', bestValue: 'zhipu-glm5', premium: 'gemini-flash', maxCostPerMsgUsd: 0.000885 },
      event_planning:       { cheapest: 'moonshot-kimi-k2-6', bestValue: 'zhipu-glm5', premium: 'gemini-flash', maxCostPerMsgUsd: 0.000885 },
      financial_reporting:  { cheapest: 'moonshot-kimi-k2-6', bestValue: 'zhipu-glm5', premium: 'openrouter-gpt4o', maxCostPerMsgUsd: 0.000885 },
    };

    for (const [bucket, rec] of Object.entries(buckets)) {
      this.bucketMap.set(bucket, rec);
    }
  }

  private initBucketTiers(): void {
    const tier1 = [
      'checkin_assistance', 'checkout_assistance', 'weather_info', 'amenity_info',
      'local_recommendation', 'pet_policy', 'accessibility', 'transportation',
      'dietary_request', 'availability_check', 'housekeeping_request',
      'maintenance_request', 'booking_cancellation',
    ];
    const tier2 = [
      'reservation_query', 'guest_communication', 'review_analysis',
      'competitor_monitoring', 'lead_prospection', 'email_composition',
      'whatsapp_template', 'upselling', 'payment_processing',
      'group_booking', 'long_stay', 'corporate_booking',
      'ota_management', 'channel_management',
    ];
    const tier3 = [
      'pricing_optimization', 'revenue_diagnosis', 'complaint_handling',
      'event_planning', 'financial_reporting',
    ];

    for (const b of tier1) this.bucketTierMap.set(b, 1);
    for (const b of tier2) this.bucketTierMap.set(b, 2);
    for (const b of tier3) this.bucketTierMap.set(b, 3);
  }

  /* ---------------------------------------------------------- */
  /* Public API                                                  */
  /* ---------------------------------------------------------- */

  getPricing(providerId: string): ModelPricing | undefined {
    return this.pricing.get(providerId);
  }

  getBucketRecommendation(bucket: string): BucketRecommendation {
    return this.bucketMap.get(bucket) ?? {
      cheapest: 'deepseek-v4-flash',
      bestValue: 'deepseek-v4-flash',
      premium: 'groq-llama3-70b',
      maxCostPerMsgUsd: 0.000084,
    };
  }

  getBucketTier(bucket: string): number {
    return this.bucketTierMap.get(bucket) ?? 1;
  }

  estimateCost(providerId: string, inputTokens: number, outputTokens: number): number {
    const price = this.pricing.get(providerId);
    if (!price) return 0;
    const inputCost = (inputTokens / 1_000_000) * price.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * price.outputPer1M;
    const cacheDiscount = outputCost * (price.cachePer1M / price.outputPer1M);
    return inputCost + outputCost - cacheDiscount;
  }

  isOverpriced(providerId: string, bucket: string): boolean {
    const rec = this.getBucketRecommendation(bucket);
    const recPrice = this.pricing.get(rec.bestValue);
    const provPrice = this.pricing.get(providerId);
    if (!recPrice || !provPrice) return false;
    const recAvg = (recPrice.inputPer1M + recPrice.outputPer1M) / 2;
    const provAvg = (provPrice.inputPer1M + provPrice.outputPer1M) / 2;
    return provAvg > recAvg * 3;
  }

  getCostModifier(providerId: string, bucket: string, budgetLevel: string): number {
    const rec = this.getBucketRecommendation(bucket);
    const base: Record<string, number> = {
      nominal: 1.0,
      warning: 1.5,
      critical: 2.5,
    };
    const budgetFactor = base[budgetLevel] ?? 1.0;

    // Cheapest model for this bucket gets a strong discount
    if (providerId === rec.cheapest) return 0.3 * budgetFactor;
    // Best value gets standard
    if (providerId === rec.bestValue) return 0.7 * budgetFactor;
    // Premium or unknown gets penalized
    if (providerId === rec.premium) return 1.2 * budgetFactor;
    // Not recommended — strong penalty
    return 2.0 * budgetFactor;
  }

  getEstimatedMsgCost(providerId: string, inputTokens: number = 300, outputTokens: number = 150): number {
    return this.estimateCost(providerId, inputTokens, outputTokens);
  }

  getCheapestProvider(tier: number): string {
    const tier1Cheapest = 'deepseek-v4-flash';
    const tier2Cheapest = 'groq-llama3-70b';
    const tier3Cheapest = 'moonshot-kimi-k2-6';
    if (tier <= 1) return tier1Cheapest;
    if (tier === 2) return tier2Cheapest;
    return tier3Cheapest;
  }

  getAllPricing(): Map<string, ModelPricing> {
    return new Map(this.pricing);
  }
}

export const costKnowledge = new CostKnowledge();
