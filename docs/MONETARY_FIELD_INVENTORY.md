# SEU ZÉLLA — MONETARY FIELD INVENTORY (Wave R2 / F01.1 — RECONCILED)

**Date:** 2026-09-02
**Baseline:** 9dab6f82 (main)
**Status:** SEMANTICALLY CLASSIFIED — every field individually audited

---

## 1. CLASSIFICATION SYSTEM

| Category | Definition | Target Type | Scale |
|----------|-----------|-----------|-------|
| **MONEY_BRL** | Brazilian Real — charged to customer | `Decimal` | `(18,2)` |
| **MONEY_USD** | USD micro-costs (LLM/API/WhatsApp) | `Decimal` | `(18,6)` |
| **RATE** | Rate/ratio/multiplier (0-1, 0-100, 0-2) | `Float` | keep |
| **METRIC** | Non-monetary metric (time, score, confidence, distance) | `Float` | keep |
| **COORDINATE** | Latitude/longitude | `Float` | keep |

### Why two Decimal scales?

- `Decimal(18,2)`: BRL values (e.g. R$ 247.00, R$ 1.999,99) — 2 decimal places
- `Decimal(18,6)`: USD micro-costs (e.g. 0.0068 per WhatsApp message) — 6 decimal places

`Decimal(10,2)` was WRONG because it cannot represent `0.0068` (would truncate to `0.01`).

---

## 2. MONEY_BRL — Must Migrate to Decimal(18,2) — 39 fields

### Billing-Critical (P0):
| # | Model | Field | Default | Used In |
|---|-------|-------|---------|---------|
| 1 | UpsellRecord | unitPrice | — | upsell-calculator, billing |
| 2 | UpsellRecord | totalPrice | — | upsell-calculator, billing, monthly-billing |
| 3 | UpsellRecord | comissionAmount | — | upsell-calculator, billing, monthly-billing |
| 4 | UpsellRecord | totalSalesAmount | 0 | upsell analytics |
| 5 | UpsellRecord | triggerCartMin | — | upsell triggers |
| 6 | UpsellRecord | triggerCartMax | — | upsell triggers |
| 7 | Transaction | amount | — | payment processing |
| 8 | PaymentTransaction | amount | — | payment processing, checkout |
| 9 | Subscription | amount | — | checkout, billing cron |
| 10 | Subscription | lastProrateAmount | — | subscription proration |
| 11 | Reservation | totalPrice | — | reservations, pricing |
| 12 | Booking | totalValue | — | bookings, pricing |

### Pricing-Critical (P1):
| # | Model | Field | Default | Used In |
|---|-------|-------|---------|---------|
| 13 | Room | price | 150 | pricing engine |
| 14 | PricingCalculation | basePrice | — | pricing engine |
| 15 | PricingCalculation | calculatedPrice | — | pricing engine |
| 16 | SpecialDateSuggestion | currentPrice | — | special dates HITL |
| 17 | SpecialDateSuggestion | suggestedPrice | — | special dates HITL |
| 18 | PriceOverride | price | — | special dates HITL |
| 19 | PriceOverride | basePrice | — | special dates HITL |
| 20 | DynamicPricingRule | minPrice | — | dynamic pricing |
| 21 | DynamicPricingRule | maxPrice | — | dynamic pricing |
| 22 | DynamicPricingRule | revenueImpact | 0 | dynamic pricing analytics |
| 23 | AirBProperty | pricePerNight | — | Airbnb pricing |
| 24 | PartnerProgramConfig | monthlyPrice | 247.0 | partner program |
| 25 | PartnerClaim | monthlyPrice | 247.0 | partner program |

### Yield-Critical (P1):
| # | Model | Field | Default | Used In |
|---|-------|-------|---------|---------|
| 26 | YieldProfitRecord | baseRate | — | yield engine |
| 27 | YieldProfitRecord | extraProfit | — | yield engine |
| 28 | YieldProfitRecord | bonusShareBrl | 0 | yield engine (Fase 1 = 0) |

### Airbnb Operations (P2):
| # | Model | Field | Default | Used In |
|---|-------|-------|---------|---------|
| 29 | AirBSubscription | amount | — | Airbnb billing |
| 30 | AirBTransaction | amount | — | Airbnb transactions |
| 31 | AirbExpense | amount | — | Airbnb expenses |
| 32 | AirbOperationTask | cost | 0 | Airbnb operations |
| 33 | AirbGoal | targetValue | — | Airbnb goal (BRL) |
| 34 | AirbGoal | currentValue | 0 | Airbnb goal (BRL) |
| 35 | AirbCommission | basisAmount | 0 | Airbnb commission basis |

### Other BRL (P2):
| # | Model | Field | Default | Used In |
|---|-------|-------|---------|---------|
| 36 | ReferralConversion | paymentAmount | — | referral payments |
| 37 | PerformanceSnapshot | totalRevenue | — | analytics (BRL) |
| 38 | WhatsAppMessageCost | costBrl | — | WhatsApp cost in BRL |
| 39 | Lead | otaCommissionLost | 0.0 | Lead analytics (BRL) |

---

## 3. MONEY_USD — Must Migrate to Decimal(18,6) — 18 fields

### LLM Cost Tracking (P2):
| # | Model | Field | Default | Used In |
|---|-------|-------|---------|---------|
| 1 | AgentLog | costUsd | 0 | LLM cost tracking |
| 2 | AgentLog | cost | 0 | LLM cost tracking |
| 3 | RouterProvider | costPer1kInput | 0 | LLM cost calculation |
| 4 | RouterProvider | costPer1kOutput | 0 | LLM cost calculation |
| 5 | BudgetGuardState | dailySpendUsd | 0 | Budget guard |
| 6 | BudgetGuardState | dailyBudgetUsd | 50 | Budget guard |
| 7 | BudgetGuardState | monthlySpendUsd | 0 | Budget guard |
| 8 | BudgetGuardState | monthlyBudgetUsd | 1500 | Budget guard |
| 9 | CostLog | costUsd | — | Cost logging |
| 10 | MetaCostLog | costUsd | — | Meta cost tracking |
| 11 | CerebroAnalysis | costUsd | 0 | Cérebro cost |
| 12 | CodeReview | costUsd | 0 | Code review cost |
| 13 | NightAuditReport | llmCostUsd | 0 | Night audit |
| 14 | NightPulseLog | llmCostUsd | 0 | Night pulse |
| 15 | LLMCallLog | costUsd | 0 | LLM call logging |

### External Service Costs (P2):
| # | Model | Field | Default | Used In |
|---|-------|-------|---------|---------|
| 16 | WhatsAppMessageCost | costUsd | 0.0068 | WhatsApp cost (micro-cost!) |
| 17 | AirBMessage | costUsd | — | Airbnb message cost |
| 18 | MessageBundle | savingsUsd | — | Message bundling savings |

### Why Decimal(18,6) for USD?
`WhatsAppMessageCost.costUsd` has default `0.0068` — this is $0.0068 per message.
- `Decimal(18,2)` would truncate to `0.01` — **DATA LOSS**
- `Decimal(18,6)` preserves `0.006800` — correct

---

## 4. RATE — Keep as Float — 27 fields

These are rates, ratios, multipliers — NOT monetary values:

| # | Model | Field | Semantics | Range |
|---|-------|-------|-----------|-------|
| 1 | AgentConfig | temperature | LLM temperature | 0-2 |
| 2 | UpsellRecord | comissionRate | Commission rate | 0.07 |
| 3 | UpsellRecord | yieldMultiplier | Price multiplier | 1.0 |
| 4 | DynamicPricingRule | minOccupancy | Occupancy % | 0-100 |
| 5 | DynamicPricingRule | maxOccupancy | Occupancy % | 0-100 |
| 6 | DynamicPricingRule | modifierValue | Price multiplier | 1.0-2.0 |
| 7 | PricingCalculation | occupancyAtCalc | Occupancy rate | 0-1 |
| 8 | SwipeTemplate | successRate | Success rate | 0-1 |
| 9 | SwipeTemplate | convRate | Conversion rate | 0-1 |
| 10 | Campaign | openRate | Open rate | 0-1 |
| 11 | Campaign | clickRate | Click rate | 0-1 |
| 12 | Campaign | conversionRate | Conversion rate | 0-1 |
| 13 | TrainingPrompt | successRate | Success rate | 0-1 |
| 14 | PerformanceSnapshot | conversionRate | Conversion rate | 0-1 |
| 15 | PerformanceSnapshot | occupancyRate | Occupancy rate | 0-1 |
| 16 | PerformanceSnapshot | revenueGrowth | Growth rate | percentage |
| 17 | PerformanceSnapshot | aiAutonomy | Autonomy % | 0-1 |
| 18 | BrainHealthLog | conversionRate | Conversion rate | 0-1 |
| 19 | BrainHealthLog | humanTakeoverRate | Takeover rate | 0-1 |
| 20 | CompiledPrompt | successRate | Success rate | 0-1 |
| 21 | Lead | conversionProbability | Probability | 0-1 |
| 22 | YieldProfitRecord | yieldRate | Yield rate | rate |
| 23 | YieldProfitRecord | bonusShareRate | Bonus share rate | 0 (Fase 1) |
| 24 | YieldProfitRecord | surgeMultiplier | Surge multiplier | 1.0-1.6 |
| 25 | AirbCommission | rate | Commission rate | rate |
| 26 | RouterProvider | alpha | Weighting factor | 1.0 |
| 27 | RouterProvider | beta | Weighting factor | 1.0 |

---

## 5. METRIC — Keep as Float — 31 fields

Non-monetary metrics (time, score, confidence, distance, rating):

| # | Model | Field | Semantics | Unit |
|---|-------|-------|-----------|------|
| 1 | Property | linkinbioRating | Rating | 0-5 |
| 2 | AgentConfig | confidenceScore | Confidence | 0-1 |
| 3 | Lead | googleRating | Google rating | 0-5 |
| 4 | Lead | validationScore | Validation score | 0-100 |
| 5 | Lead | tierConfidence | Tier confidence | 0-1 |
| 6 | AgentLog | confidence | Confidence | 0-1 |
| 7 | TrendKeyword | score | Trend score | score |
| 8 | TrendDataPoint | value | Generic metric | n/a |
| 9 | TrendDataPoint | interestDelta | Interest delta | delta |
| 10 | TrendSignal | deltaPercent | Delta % | percentage |
| 11 | Guest | value | Guest value score | score |
| 12 | ConversationLog | aiConfidence | AI confidence | 0-1 |
| 13 | KnowledgeEntry | effectiveness | Effectiveness | 0-1 |
| 14 | PerformanceSnapshot | aiResponseTime | Response time | ms |
| 15 | PerformanceSnapshot | guestSatisfaction | Satisfaction | 0-5 |
| 16 | SecurityFinding | cvss | CVSS score | 0-10 |
| 17 | AirBRegionalKnowledge | distance | Distance | km |
| 18 | AirBRegionalKnowledge | rating | Rating | 0-5 |
| 19 | AnomalyEvent | observed | Observed value | metric |
| 20 | AnomalyEvent | baseline | Baseline value | metric |
| 21 | AnomalyEvent | deviation | Deviation | metric |
| 22 | RefactorSuggestion | confidence | Confidence | 0-1 |
| 23 | CodeReviewComment | confidence | Confidence | 0-1 |
| 24 | GapFinding | confidence | Confidence | 0-1 |
| 25 | BottleneckFinding | confidence | Confidence | 0-1 |
| 26 | DpoPreferencePair | similarityScore | Similarity | 0-1 |
| 27 | CompiledPrompt | accuracyScore | Accuracy | 0-1 |
| 28 | NightAuditReport | confidence | Confidence | 0-1 |
| 29 | CerebroKnowledgeFact | confidence | Confidence | 0-1 |
| 30 | NightActivityEvent | thresholdValue | Operational threshold | metric |
| 31 | NightActivityEvent | observedValue | Operational observed | metric |

---

## 6. COORDINATE — Keep as Float — 6 fields

| # | Model | Field | Semantics |
|---|-------|-------|-----------|
| 1 | Property | latitude | Geographic coordinate |
| 2 | Property | longitude | Geographic coordinate |
| 3 | Lead | latitude | Geographic coordinate |
| 4 | Lead | longitude | Geographic coordinate |
| 5 | AirBProperty | latitude | Geographic coordinate |
| 6 | AirBProperty | longitude | Geographic coordinate |

---

## 7. RECONCILIATION SUMMARY

| Category | Count | Target Type | Migration |
|----------|------:|------------|-----------|
| MONEY_BRL | 39 | Decimal(18,2) | P0/P1/P2 priority |
| MONEY_USD | 18 | Decimal(18,6) | P2 priority (micro-costs) |
| RATE | 27 | Float (keep) | No migration |
| METRIC | 31 | Float (keep) | No migration |
| COORDINATE | 6 | Float (keep) | No migration |
| **TOTAL** | **121** | | |

### Previous inventory errors corrected:
1. ❌ Said "33 MONEY_DECIMAL" → Actual: 39 BRL + 18 USD = 57 monetary fields
2. ❌ Said "18 RATE_FLOAT" → Actual: 27 RATE fields
3. ❌ Said "3 NON_MONETARY" → Actual: 31 METRIC + 6 COORDINATE = 37 non-monetary
4. ❌ Proposed `Decimal(10,2)` → WRONG: cannot represent 0.0068
5. ❌ Claimed "Decimal represents everything Float can" → FALSE
6. ❌ Classified `aiResponseTime` (ms) and `guestSatisfaction` (0-5) as RATE → These are METRIC
7. ❌ Mixed MONEY_BRL and MONEY_USD in same category → Now separated with correct scales

---

## 8. MIGRATION STRATEGY

### Phase 1: Schema Migration (ADDITIVE — safe)
- Add `Decimal(18,2)` columns alongside BRL Float columns
- Add `Decimal(18,6)` columns alongside USD Float columns
- Backfill data: `UPDATE table SET new_col = old_col`
- Verify data integrity

### Phase 2: Code Migration
- Update Prisma schema to use `Decimal` for money fields
- Update code to handle `Prisma.Decimal` (convert with `.toNumber()` or use Decimal arithmetic)
- Use `money.ts` functions (`roundHalfUp`, `percentageOfMoney`, `multiplyMoney`) for all arithmetic

### Phase 3: Cleanup
- Drop old `Float` columns
- Remove backward-compatible aliases

### Priority Order:
1. **P0 (billing-critical)**: UpsellRecord, Transaction, PaymentTransaction, Subscription, Reservation, Booking
2. **P1 (pricing-critical)**: Room, PricingCalculation, SpecialDateSuggestion, PriceOverride, DynamicPricingRule, AirBProperty, PartnerProgramConfig, PartnerClaim, YieldProfitRecord
3. **P2 (cost tracking + other)**: AgentLog, MetaCostLog, WhatsAppMessageCost, RouterProvider, AirB*, Lead, PerformanceSnapshot, CerebroAnalysis, CodeReview, NightAudit*, LLMCallLog, BudgetGuardState, CostLog, MessageBundle, ReferralConversion, AirbExpense, AirbOperationTask, AirbGoal, AirbCommission

---

## 9. CANONICAL CLASSIFICATION LIST (auto-verified by test)

This list is the single source of truth. The test in
`tests/security/wave-r2-monetary-inventory.test.ts` verifies that:
1. Every Float field in schema.prisma is classified here
2. No classified field is missing from schema
3. Counts match (39 BRL + 18 USD + 27 RATE + 31 METRIC + 6 COORDINATE = 121)
4. Scale is correct per category

```
MONEY_BRL (39) — Decimal(18,2):
Room.price
Reservation.totalPrice
Transaction.amount
Subscription.amount
Subscription.lastProrateAmount
PaymentTransaction.amount
Booking.totalValue
UpsellRecord.unitPrice
UpsellRecord.totalPrice
UpsellRecord.comissionAmount
UpsellRecord.totalSalesAmount
UpsellRecord.triggerCartMin
UpsellRecord.triggerCartMax
PricingCalculation.basePrice
PricingCalculation.calculatedPrice
SpecialDateSuggestion.currentPrice
SpecialDateSuggestion.suggestedPrice
PriceOverride.price
PriceOverride.basePrice
DynamicPricingRule.minPrice
DynamicPricingRule.maxPrice
DynamicPricingRule.revenueImpact
AirBProperty.pricePerNight
PartnerProgramConfig.monthlyPrice
PartnerClaim.monthlyPrice
YieldProfitRecord.baseRate
YieldProfitRecord.extraProfit
YieldProfitRecord.bonusShareBrl
AirBSubscription.amount
AirBTransaction.amount
AirbExpense.amount
AirbOperationTask.cost
AirbGoal.targetValue
AirbGoal.currentValue
AirbCommission.basisAmount
ReferralConversion.paymentAmount
PerformanceSnapshot.totalRevenue
WhatsAppMessageCost.costBrl
Lead.otaCommissionLost

MONEY_USD (18) — Decimal(18,6):
AgentLog.costUsd
AgentLog.cost
RouterProvider.costPer1kInput
RouterProvider.costPer1kOutput
BudgetGuardState.dailySpendUsd
BudgetGuardState.dailyBudgetUsd
BudgetGuardState.monthlySpendUsd
BudgetGuardState.monthlyBudgetUsd
CostLog.costUsd
MetaCostLog.costUsd
AirBMessage.costUsd
WhatsAppMessageCost.costUsd
MessageBundle.savingsUsd
CerebroAnalysis.costUsd
CodeReview.costUsd
NightAuditReport.llmCostUsd
NightPulseLog.llmCostUsd
LLMCallLog.costUsd

RATE (27) — Float (keep):
AgentConfig.temperature
UpsellRecord.comissionRate
UpsellRecord.yieldMultiplier
DynamicPricingRule.minOccupancy
DynamicPricingRule.maxOccupancy
DynamicPricingRule.modifierValue
PricingCalculation.occupancyAtCalc
SwipeTemplate.successRate
SwipeTemplate.convRate
Campaign.openRate
Campaign.clickRate
Campaign.conversionRate
TrainingPrompt.successRate
PerformanceSnapshot.conversionRate
PerformanceSnapshot.occupancyRate
PerformanceSnapshot.revenueGrowth
PerformanceSnapshot.aiAutonomy
BrainHealthLog.conversionRate
BrainHealthLog.humanTakeoverRate
CompiledPrompt.successRate
Lead.conversionProbability
YieldProfitRecord.yieldRate
YieldProfitRecord.bonusShareRate
YieldProfitRecord.surgeMultiplier
AirbCommission.rate
RouterProvider.alpha
RouterProvider.beta

METRIC (31) — Float (keep):
Property.linkinbioRating
AgentConfig.confidenceScore
Lead.googleRating
Lead.validationScore
Lead.tierConfidence
AgentLog.confidence
TrendKeyword.score
TrendDataPoint.value
TrendDataPoint.interestDelta
TrendSignal.deltaPercent
Guest.value
ConversationLog.aiConfidence
KnowledgeEntry.effectiveness
PerformanceSnapshot.aiResponseTime
PerformanceSnapshot.guestSatisfaction
SecurityFinding.cvss
AirBRegionalKnowledge.distance
AirBRegionalKnowledge.rating
AnomalyEvent.observed
AnomalyEvent.baseline
AnomalyEvent.deviation
RefactorSuggestion.confidence
CodeReviewComment.confidence
GapFinding.confidence
BottleneckFinding.confidence
DpoPreferencePair.similarityScore
CompiledPrompt.accuracyScore
NightAuditReport.confidence
CerebroKnowledgeFact.confidence
NightActivityEvent.thresholdValue
NightActivityEvent.observedValue

COORDINATE (6) — Float (keep):
Property.latitude
Property.longitude
Lead.latitude
Lead.longitude
AirBProperty.latitude
AirBProperty.longitude
```
