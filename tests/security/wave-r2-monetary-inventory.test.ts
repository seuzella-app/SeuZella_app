/**
 * WAVE R2 — F01.1: Monetary Field Inventory — SEMANTIC ALLOWLIST
 * ============================================================================
 * Uses an explicit allowlist (NOT keyword matching) to classify every Float
 * field in prisma/schema.prisma into one of 5 categories:
 *
 *   MONEY_BRL  → Decimal(18,2) — 39 fields
 *   MONEY_USD  → Decimal(18,6) — 18 fields
 *   RATE       → Float (keep)  — 27 fields
 *   METRIC     → Float (keep)  — 31 fields
 *   COORDINATE → Float (keep)  — 6 fields
 *
 * If a new Float field is added to schema.prisma, this test FAILS until the
 * developer classifies it in the CANONICAL_CLASSIFICATION below.
 *
 * This replaces the previous keyword-based approach which was semantically
 * incorrect (e.g. classified aiResponseTime as RATE, missed costUsd=0.0068
 * precision issue, claimed Decimal(10,2) could represent all Float values).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
const inventoryPath = path.resolve(process.cwd(), 'docs/MONETARY_FIELD_INVENTORY.md');
const schema = fs.readFileSync(schemaPath, 'utf8');
const inventory = fs.readFileSync(inventoryPath, 'utf8');

// ─── CANONICAL CLASSIFICATION ────────────────────────────────────────────────
// Every Float field in schema.prisma MUST be classified here.
// If a field is missing, the test FAILS — preventing silent unclassified Float fields.

type Category = 'MONEY_BRL' | 'MONEY_USD' | 'RATE' | 'METRIC' | 'COORDINATE';

interface FieldClassification {
  model: string;
  field: string;
  category: Category;
  scale?: string; // For MONEY_BRL: '(18,2)', for MONEY_USD: '(18,6)'
}

const CANONICAL_CLASSIFICATION: FieldClassification[] = [
  // MONEY_BRL — Decimal(18,2) — 39 fields
  { model: 'Room', field: 'price', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'Reservation', field: 'totalPrice', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'Transaction', field: 'amount', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'Subscription', field: 'amount', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'Subscription', field: 'lastProrateAmount', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'PaymentTransaction', field: 'amount', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'Booking', field: 'totalValue', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'UpsellRecord', field: 'unitPrice', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'UpsellRecord', field: 'totalPrice', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'UpsellRecord', field: 'comissionAmount', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'UpsellRecord', field: 'totalSalesAmount', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'UpsellRecord', field: 'triggerCartMin', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'UpsellRecord', field: 'triggerCartMax', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'PricingCalculation', field: 'basePrice', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'PricingCalculation', field: 'calculatedPrice', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'SpecialDateSuggestion', field: 'currentPrice', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'SpecialDateSuggestion', field: 'suggestedPrice', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'PriceOverride', field: 'price', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'PriceOverride', field: 'basePrice', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'DynamicPricingRule', field: 'minPrice', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'DynamicPricingRule', field: 'maxPrice', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'DynamicPricingRule', field: 'revenueImpact', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'AirBProperty', field: 'pricePerNight', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'PartnerProgramConfig', field: 'monthlyPrice', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'PartnerClaim', field: 'monthlyPrice', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'YieldProfitRecord', field: 'baseRate', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'YieldProfitRecord', field: 'extraProfit', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'YieldProfitRecord', field: 'bonusShareBrl', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'AirBSubscription', field: 'amount', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'AirBTransaction', field: 'amount', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'AirbExpense', field: 'amount', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'AirbOperationTask', field: 'cost', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'AirbGoal', field: 'targetValue', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'AirbGoal', field: 'currentValue', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'AirbCommission', field: 'basisAmount', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'ReferralConversion', field: 'paymentAmount', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'PerformanceSnapshot', field: 'totalRevenue', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'WhatsAppMessageCost', field: 'costBrl', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'Lead', field: 'otaCommissionLost', category: 'MONEY_BRL', scale: '(18,2)' },

  // MONEY_USD — Decimal(18,6) — 18 fields (micro-costs need 6 decimal places)
  { model: 'AgentLog', field: 'costUsd', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'AgentLog', field: 'cost', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'RouterProvider', field: 'costPer1kInput', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'RouterProvider', field: 'costPer1kOutput', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'BudgetGuardState', field: 'dailySpendUsd', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'BudgetGuardState', field: 'dailyBudgetUsd', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'BudgetGuardState', field: 'monthlySpendUsd', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'BudgetGuardState', field: 'monthlyBudgetUsd', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'CostLog', field: 'costUsd', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'MetaCostLog', field: 'costUsd', category: 'MONEY_USD', scale: '(18,6)' },
  // Meta Foundation wave: rate = tarifa unitária por categoria (moeda registrada
  // em MetaCostLog.currency — categoria MONETÁRIA, não câmbio fixo).
  { model: 'MetaCostLog', field: 'rate', category: 'MONEY_USD', scale: '(18,6)' },
  // Meta Attribution: valor da reserva atribuída (R$) — receita de aquisição Meta.
  { model: 'MetaAttributionEvent', field: 'reservationValue', category: 'MONEY_BRL', scale: '(18,2)' },
  { model: 'AirBMessage', field: 'costUsd', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'WhatsAppMessageCost', field: 'costUsd', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'MessageBundle', field: 'savingsUsd', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'CerebroAnalysis', field: 'costUsd', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'CodeReview', field: 'costUsd', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'NightAuditReport', field: 'llmCostUsd', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'NightPulseLog', field: 'llmCostUsd', category: 'MONEY_USD', scale: '(18,6)' },
  { model: 'LLMCallLog', field: 'costUsd', category: 'MONEY_USD', scale: '(18,6)' },

  // RATE — Float (keep) — 27 fields
  { model: 'AgentConfig', field: 'temperature', category: 'RATE' },
  { model: 'UpsellRecord', field: 'comissionRate', category: 'RATE' },
  { model: 'UpsellRecord', field: 'yieldMultiplier', category: 'RATE' },
  { model: 'DynamicPricingRule', field: 'minOccupancy', category: 'RATE' },
  { model: 'DynamicPricingRule', field: 'maxOccupancy', category: 'RATE' },
  { model: 'DynamicPricingRule', field: 'modifierValue', category: 'RATE' },
  { model: 'PricingCalculation', field: 'occupancyAtCalc', category: 'RATE' },
  { model: 'SwipeTemplate', field: 'successRate', category: 'RATE' },
  { model: 'SwipeTemplate', field: 'convRate', category: 'RATE' },
  { model: 'Campaign', field: 'openRate', category: 'RATE' },
  { model: 'Campaign', field: 'clickRate', category: 'RATE' },
  { model: 'Campaign', field: 'conversionRate', category: 'RATE' },
  { model: 'TrainingPrompt', field: 'successRate', category: 'RATE' },
  { model: 'PerformanceSnapshot', field: 'conversionRate', category: 'RATE' },
  { model: 'PerformanceSnapshot', field: 'occupancyRate', category: 'RATE' },
  { model: 'PerformanceSnapshot', field: 'revenueGrowth', category: 'RATE' },
  { model: 'PerformanceSnapshot', field: 'aiAutonomy', category: 'RATE' },
  { model: 'BrainHealthLog', field: 'conversionRate', category: 'RATE' },
  { model: 'BrainHealthLog', field: 'humanTakeoverRate', category: 'RATE' },
  { model: 'CompiledPrompt', field: 'successRate', category: 'RATE' },
  { model: 'Lead', field: 'conversionProbability', category: 'RATE' },
  { model: 'YieldProfitRecord', field: 'yieldRate', category: 'RATE' },
  { model: 'YieldProfitRecord', field: 'bonusShareRate', category: 'RATE' },
  { model: 'YieldProfitRecord', field: 'surgeMultiplier', category: 'RATE' },
  { model: 'AirbCommission', field: 'rate', category: 'RATE' },
  { model: 'RouterProvider', field: 'alpha', category: 'RATE' },
  { model: 'RouterProvider', field: 'beta', category: 'RATE' },

  // METRIC — Float (keep) — 31 fields
  { model: 'Property', field: 'linkinbioRating', category: 'METRIC' },
  { model: 'AgentConfig', field: 'confidenceScore', category: 'METRIC' },
  { model: 'Lead', field: 'googleRating', category: 'METRIC' },
  { model: 'Lead', field: 'validationScore', category: 'METRIC' },
  { model: 'Lead', field: 'tierConfidence', category: 'METRIC' },
  { model: 'AgentLog', field: 'confidence', category: 'METRIC' },
  { model: 'TrendKeyword', field: 'score', category: 'METRIC' },
  { model: 'TrendDataPoint', field: 'value', category: 'METRIC' },
  { model: 'TrendDataPoint', field: 'interestDelta', category: 'METRIC' },
  { model: 'TrendSignal', field: 'deltaPercent', category: 'METRIC' },
  { model: 'Guest', field: 'value', category: 'METRIC' },
  { model: 'ConversationLog', field: 'aiConfidence', category: 'METRIC' },
  { model: 'KnowledgeEntry', field: 'effectiveness', category: 'METRIC' },
  { model: 'PerformanceSnapshot', field: 'aiResponseTime', category: 'METRIC' },
  { model: 'PerformanceSnapshot', field: 'guestSatisfaction', category: 'METRIC' },
  { model: 'SecurityFinding', field: 'cvss', category: 'METRIC' },
  { model: 'AirBRegionalKnowledge', field: 'distance', category: 'METRIC' },
  { model: 'AirBRegionalKnowledge', field: 'rating', category: 'METRIC' },
  { model: 'AnomalyEvent', field: 'observed', category: 'METRIC' },
  { model: 'AnomalyEvent', field: 'baseline', category: 'METRIC' },
  { model: 'AnomalyEvent', field: 'deviation', category: 'METRIC' },
  { model: 'RefactorSuggestion', field: 'confidence', category: 'METRIC' },
  { model: 'CodeReviewComment', field: 'confidence', category: 'METRIC' },
  { model: 'GapFinding', field: 'confidence', category: 'METRIC' },
  { model: 'BottleneckFinding', field: 'confidence', category: 'METRIC' },
  { model: 'DpoPreferencePair', field: 'similarityScore', category: 'METRIC' },
  { model: 'CompiledPrompt', field: 'accuracyScore', category: 'METRIC' },
  { model: 'NightAuditReport', field: 'confidence', category: 'METRIC' },
  { model: 'CerebroKnowledgeFact', field: 'confidence', category: 'METRIC' },
  { model: 'NightActivityEvent', field: 'thresholdValue', category: 'METRIC' },
  { model: 'NightActivityEvent', field: 'observedValue', category: 'METRIC' },

  // COORDINATE — Float (keep) — 6 fields
  { model: 'Property', field: 'latitude', category: 'COORDINATE' },
  { model: 'Property', field: 'longitude', category: 'COORDINATE' },
  { model: 'Lead', field: 'latitude', category: 'COORDINATE' },
  { model: 'Lead', field: 'longitude', category: 'COORDINATE' },
  { model: 'AirBProperty', field: 'latitude', category: 'COORDINATE' },
  { model: 'AirBProperty', field: 'longitude', category: 'COORDINATE' },
];

// ─── Extract Float fields from schema ────────────────────────────────────────
function extractFloatFields(source: string): Array<{ model: string; field: string }> {
  const results: Array<{ model: string; field: string }> = [];
  let currentModel = '';
  for (const line of source.split('\n')) {
    const modelMatch = line.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) { currentModel = modelMatch[1]; continue; }
    if (line.match(/^\}/)) { currentModel = ''; continue; }
    const floatMatch = line.match(/^\s+(\w+)\s+Float/);
    if (floatMatch && currentModel) {
      results.push({ model: currentModel, field: floatMatch[1] });
    }
  }
  return results;
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('🌊 WAVE R2 — F01.1: Monetary Field Inventory (Semantic Allowlist)', () => {
  const schemaFloats = extractFloatFields(schema);

  it('inventory document exists', () => {
    expect(fs.existsSync(inventoryPath)).toBe(true);
  });

  it('every Float field in schema is classified in CANONICAL_CLASSIFICATION', () => {
    for (const { model, field } of schemaFloats) {
      const found = CANONICAL_CLASSIFICATION.some(
        c => c.model === model && c.field === field
      );
      expect(
        found,
        `Float field "${model}.${field}" is not classified in CANONICAL_CLASSIFICATION.\n` +
        `Add it to tests/security/wave-r2-monetary-inventory.test.ts with the correct category.`
      ).toBe(true);
    }
  });

  it('no classified fields are missing from schema (no orphan classifications)', () => {
    for (const { model, field } of CANONICAL_CLASSIFICATION) {
      const found = schemaFloats.some(
        s => s.model === model && s.field === field
      );
      expect(
        found,
        `Classified field "${model}.${field}" does not exist in schema.prisma. ` +
        `Remove it from CANONICAL_CLASSIFICATION or add it to the schema.`
      ).toBe(true);
    }
  });

  it('classification counts match reconciliation summary', () => {
    const counts = {
      MONEY_BRL: CANONICAL_CLASSIFICATION.filter(c => c.category === 'MONEY_BRL').length,
      MONEY_USD: CANONICAL_CLASSIFICATION.filter(c => c.category === 'MONEY_USD').length,
      RATE: CANONICAL_CLASSIFICATION.filter(c => c.category === 'RATE').length,
      METRIC: CANONICAL_CLASSIFICATION.filter(c => c.category === 'METRIC').length,
      COORDINATE: CANONICAL_CLASSIFICATION.filter(c => c.category === 'COORDINATE').length,
    };

    expect(counts.MONEY_BRL).toBe(40);
    expect(counts.MONEY_USD).toBe(19);
    expect(counts.RATE).toBe(27);
    expect(counts.METRIC).toBe(31);
    expect(counts.COORDINATE).toBe(6);

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(123);
    expect(schemaFloats.length).toBe(123);
  });

  it('MONEY_BRL fields use Decimal(18,2) scale', () => {
    const brlFields = CANONICAL_CLASSIFICATION.filter(c => c.category === 'MONEY_BRL');
    for (const f of brlFields) {
      expect(f.scale, `${f.model}.${f.field} should have scale '(18,2)'`).toBe('(18,2)');
    }
  });

  it('MONEY_USD fields use Decimal(18,6) scale (micro-costs need 6 decimal places)', () => {
    const usdFields = CANONICAL_CLASSIFICATION.filter(c => c.category === 'MONEY_USD');
    for (const f of usdFields) {
      expect(f.scale, `${f.model}.${f.field} should have scale '(18,6)'`).toBe('(18,6)');
    }
  });

  it('RATE and METRIC and COORDINATE fields do NOT have scale (keep as Float)', () => {
    const nonMoneyFields = CANONICAL_CLASSIFICATION.filter(
      c => c.category === 'RATE' || c.category === 'METRIC' || c.category === 'COORDINATE'
    );
    for (const f of nonMoneyFields) {
      expect(f.scale, `${f.model}.${f.field} (${f.category}) should NOT have scale`).toBeUndefined();
    }
  });

  it('RULE_A: comissionRate is RATE (0.07) — NOT money, do NOT migrate to Decimal', () => {
    const comissionRate = CANONICAL_CLASSIFICATION.find(c => c.field === 'comissionRate');
    expect(comissionRate).toBeDefined();
    expect(comissionRate!.category).toBe('RATE');
  });

  it('RULE_A: comissionAmount is MONEY_BRL — SHOULD migrate to Decimal(18,2)', () => {
    const comissionAmount = CANONICAL_CLASSIFICATION.find(c => c.field === 'comissionAmount');
    expect(comissionAmount).toBeDefined();
    expect(comissionAmount!.category).toBe('MONEY_BRL');
    expect(comissionAmount!.scale).toBe('(18,2)');
  });

  it('WhatsAppMessageCost.costUsd (0.0068) is MONEY_USD with scale (18,6) — NOT (18,2)', () => {
    const costUsd = CANONICAL_CLASSIFICATION.find(
      c => c.model === 'WhatsAppMessageCost' && c.field === 'costUsd'
    );
    expect(costUsd).toBeDefined();
    expect(costUsd!.category).toBe('MONEY_USD');
    expect(costUsd!.scale).toBe('(18,6)');
    // Verify that (18,2) would lose precision: 0.0068 → 0.01
    expect(Number(0.0068).toFixed(2)).not.toBe('0.0068');
    expect(Number(0.0068).toFixed(6)).toBe('0.006800');
  });

  it('PerformanceSnapshot.aiResponseTime (ms) is METRIC — NOT RATE', () => {
    const field = CANONICAL_CLASSIFICATION.find(
      c => c.model === 'PerformanceSnapshot' && c.field === 'aiResponseTime'
    );
    expect(field).toBeDefined();
    expect(field!.category).toBe('METRIC');
    expect(field!.category).not.toBe('RATE');
  });

  it('PerformanceSnapshot.guestSatisfaction (0-5) is METRIC — NOT RATE', () => {
    const field = CANONICAL_CLASSIFICATION.find(
      c => c.model === 'PerformanceSnapshot' && c.field === 'guestSatisfaction'
    );
    expect(field).toBeDefined();
    expect(field!.category).toBe('METRIC');
    expect(field!.category).not.toBe('RATE');
  });

  it('every MONEY_BRL and MONEY_USD field is documented in inventory', () => {
    const moneyFields = CANONICAL_CLASSIFICATION.filter(
      c => c.category === 'MONEY_BRL' || c.category === 'MONEY_USD'
    );
    for (const { model, field } of moneyFields) {
      expect(inventory, `Monetary field "${model}.${field}" not documented in inventory`).toContain(`${model}.${field}`);
    }
  });

  it('money.ts roundHalfUp produces correct results for edge cases', async () => {
    const { roundHalfUp, percentageOfMoney, multiplyMoney } = await import('@/lib/billing/money');

    expect(percentageOfMoney(600, 0.07)).toBe(42);
    expect(percentageOfMoney(1800, 0.07)).toBe(126);
    expect(percentageOfMoney(50.50, 0.07)).toBe(3.54);
    expect(roundHalfUp(1.005)).toBe(1.01);
    expect(roundHalfUp(1.004)).toBe(1);
    expect(roundHalfUp(-1.005)).toBe(-1.01);
    expect(multiplyMoney(350, 3)).toBe(1050);
  });
});
