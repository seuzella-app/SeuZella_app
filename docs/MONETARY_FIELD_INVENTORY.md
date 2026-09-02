# SEU ZÉLLA — MONETARY FIELD INVENTORY (Wave R2 / F01)

**Date:** 2026-09-02
**Baseline:** c19cf1fe (wave/r2-database-hardening-f01-f04)

---

## 1. CLASSIFICATION RULES

| Category | Definition | Action |
|----------|-----------|--------|
| **MONEY_DECIMAL** | Actual monetary value (price, amount, cost, fee, commission) | Migrate to `Decimal(10,2)` |
| **RATE_FLOAT** | Rate/ratio (0-1, percentage, multiplier) — NOT money | Keep as `Float` |
| **NON_MONETARY** | Generic metric (time, count, score) — NOT money | Keep as `Float` |

---

## 2. MONEY_DECIMAL — Must Migrate to Decimal (33 fields)

### Billing-Critical (P0 — migrate first):
| # | Model | Field | Current | Default | Used In |
|---|-------|-------|---------|---------|---------|
| 1 | UpsellRecord | unitPrice | Float | — | upsell-calculator, billing |
| 2 | UpsellRecord | totalPrice | Float | — | upsell-calculator, billing, monthly-billing |
| 3 | UpsellRecord | comissionAmount | Float | — | upsell-calculator, billing, monthly-billing |
| 4 | UpsellRecord | totalSalesAmount | Float | 0 | upsell analytics |
| 5 | UpsellRecord | triggerCartMin | Float? | — | upsell triggers |
| 6 | UpsellRecord | triggerCartMax | Float? | — | upsell triggers |
| 7 | Transaction | amount | Float | — | payment processing |
| 8 | PaymentTransaction | amount | Float | — | payment processing, checkout |
| 9 | Subscription | amount | Float | — | checkout, billing cron |
| 10 | Subscription | lastProrateAmount | Float? | — | subscription proration |
| 11 | Reservation | totalPrice | Float | — | reservations, pricing |
| 12 | Booking | totalValue | Float | — | bookings, pricing |

### Pricing-Critical (P1):
| # | Model | Field | Current | Default | Used In |
|---|-------|-------|---------|---------|---------|
| 13 | Room | price | Float | 150 | pricing engine |
| 14 | PricingCalculation | basePrice | Float | — | pricing engine |
| 15 | PricingCalculation | calculatedPrice | Float | — | pricing engine |
| 16 | SpecialDateSuggestion | currentPrice | Float | — | special dates HITL |
| 17 | SpecialDateSuggestion | suggestedPrice | Float | — | special dates HITL |
| 18 | DynamicPricingRule | minPrice | Float? | — | dynamic pricing |
| 19 | DynamicPricingRule | maxPrice | Float? | — | dynamic pricing |
| 20 | DynamicPricingRule | revenueImpact | Float | 0 | dynamic pricing analytics |
| 21 | AirBProperty | pricePerNight | Float? | — | Airbnb pricing |

### Cost Tracking (P2):
| # | Model | Field | Current | Default | Used In |
|---|-------|-------|---------|---------|---------|
| 22 | AgentLog | costUsd | Float | 0 | LLM cost tracking |
| 23 | AgentLog | cost | Float | 0 | LLM cost tracking |
| 24 | MetaCostLog | costUsd | Float | — | Meta cost tracking |
| 25 | WhatsAppMessageCost | costUsd | Float | 0.0068 | WhatsApp cost tracking |
| 26 | WhatsAppMessageCost | costBrl | Float? | — | WhatsApp cost tracking |
| 27 | RouterProvider | costPer1kInput | Float | 0 | LLM cost calculation |
| 28 | RouterProvider | costPer1kOutput | Float | 0 | LLM cost calculation |
| 29 | AirBMessage | costUsd | Float? | — | Airbnb cost tracking |
| 30 | AirBSubscription | amount | Float | — | Airbnb billing |
| 31 | AirBTransaction | amount | Float | — | Airbnb transactions |
| 32 | Lead | otaCommissionLost | Float | 0.0 | Lead analytics |
| 33 | PerformanceSnapshot | totalRevenue | Float | — | Performance analytics |

---

## 3. RATE_FLOAT — Keep as Float (18 fields)

These are rates, ratios, multipliers — NOT monetary values:

| Model | Field | Semantics | Range |
|-------|-------|-----------|-------|
| UpsellRecord | comissionRate | Commission rate | 0.07 |
| UpsellRecord | yieldMultiplier | Price multiplier | 1.0 |
| SwipeTemplate | successRate | Success rate | 0-1 |
| SwipeTemplate | convRate | Conversion rate | 0-1 |
| Campaign | openRate | Open rate | 0-1 |
| Campaign | clickRate | Click rate | 0-1 |
| Campaign | conversionRate | Conversion rate | 0-1 |
| TrainingPrompt | successRate | Success rate | 0-1 |
| PerformanceSnapshot | conversionRate | Conversion rate | 0-1 |
| PerformanceSnapshot | occupancyRate | Occupancy rate | 0-1 |
| PerformanceSnapshot | revenueGrowth | Growth rate | percentage |
| PerformanceSnapshot | aiResponseTime | Response time | ms |
| PerformanceSnapshot | guestSatisfaction | Satisfaction | 0-5 |
| PerformanceSnapshot | aiAutonomy | Autonomy % | 0-1 |
| PricingCalculation | occupancyAtCalc | Occupancy rate | 0-1 |
| DynamicPricingRule | minOccupancy | Occupancy % | 0-100 |
| DynamicPricingRule | maxOccupancy | Occupancy % | 0-100 |
| DynamicPricingRule | modifierValue | Price multiplier | 1.0-2.0 |

---

## 4. NON_MONETARY — Keep as Float (3 fields)

| Model | Field | Semantics |
|-------|-------|-----------|
| TrendDataPoint | value | Generic metric value |
| Guest | value | Guest value score |
| AirBProperty | (none monetary) | — |

---

## 5. MIGRATION STRATEGY

### Phase 1: Schema Migration (ADDITIVE — safe)
- Add `DECIMAL(10,2)` columns alongside existing `Float` columns
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
2. **P1 (pricing-critical)**: Room, PricingCalculation, SpecialDateSuggestion, DynamicPricingRule, AirBProperty
3. **P2 (cost tracking)**: AgentLog, MetaCostLog, WhatsAppMessageCost, RouterProvider, AirB*, Lead, PerformanceSnapshot

---

## 6. RISK ASSESSMENT

| Risk | Mitigation |
|------|-----------|
| `Prisma.Decimal` breaks arithmetic code | Use `money.ts` functions everywhere |
| Migration locks table | Run during maintenance window |
| Data loss in Float→Decimal conversion | `DECIMAL(10,2)` can represent all values that Float can for monetary amounts |
| Test failures from type changes | Migrate P0 first, test, then P1, P2 |
| Production rollback | Keep Float columns until code fully migrated |

---

## 7. COMPLETE MONEY_DECIMAL FIELD LIST (48 fields — auto-generated)

This list is auto-verified by tests/security/wave-r2-monetary-inventory.test.ts.
Any new Float field with monetary keywords MUST be added here or the test will FAIL.

```
Room.price
Lead.otaCommissionLost
AgentLog.costUsd
AgentLog.cost
Reservation.totalPrice
Transaction.amount
RouterProvider.costPer1kInput
RouterProvider.costPer1kOutput
CostLog.costUsd
Subscription.amount
PaymentTransaction.amount
Booking.totalValue
PerformanceSnapshot.totalRevenue
MetaCostLog.costUsd
AirBProperty.pricePerNight
AirBMessage.costUsd
AirBSubscription.amount
AirBTransaction.amount
WhatsAppMessageCost.costUsd
WhatsAppMessageCost.costBrl
DynamicPricingRule.minPrice
DynamicPricingRule.maxPrice
DynamicPricingRule.revenueImpact
PricingCalculation.basePrice
PricingCalculation.calculatedPrice
SpecialDateSuggestion.currentPrice
SpecialDateSuggestion.suggestedPrice
PriceOverride.price
PriceOverride.basePrice
PartnerProgramConfig.monthlyPrice
PartnerClaim.monthlyPrice
CerebroAnalysis.costUsd
CodeReview.costUsd
ReferralConversion.paymentAmount
UpsellRecord.unitPrice
UpsellRecord.totalPrice
UpsellRecord.comissionAmount
UpsellRecord.totalSalesAmount
UpsellRecord.triggerCartMin
UpsellRecord.triggerCartMax
AirbExpense.amount
AirbOperationTask.cost
AirbGoal.targetValue
AirbGoal.currentValue
AirbCommission.basisAmount
NightAuditReport.llmCostUsd
NightPulseLog.llmCostUsd
LLMCallLog.costUsd
```

### NON_MONETARY Float fields (excluded from migration):
```
TrendDataPoint.value (generic metric)
Guest.value (guest value score)
NightActivityEvent.thresholdValue (operational threshold)
NightActivityEvent.observedValue (operational observed value)
```
