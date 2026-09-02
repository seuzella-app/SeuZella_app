/**
 * WAVE R2 — F01: Monetary Field Inventory Regression Test
 * ============================================================================
 * Ensures that every Float field with monetary semantics in prisma/schema.prisma
 * is tracked in docs/MONETARY_FIELD_INVENTORY.md.
 *
 * If a developer adds a new Float money field without documenting it,
 * this test will FAIL — preventing silent monetary type debt.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
const inventoryPath = path.resolve(process.cwd(), 'docs/MONETARY_FIELD_INVENTORY.md');

const schema = fs.readFileSync(schemaPath, 'utf8');
const inventory = fs.readFileSync(inventoryPath, 'utf8');

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

const MONEY_KEYWORDS = ['price', 'amount', 'value', 'cost', 'fee', 'commission', 'balance', 'revenue', 'payment', 'total', 'salary', 'prorate', 'upsell', 'tariff', 'cartmin', 'cartmax'];
const RATE_KEYWORDS = ['rate', 'multiplier', 'occupancy', 'conversion', 'success', 'growth', 'satisfaction', 'autonomy', 'responsetime', 'modifiervalue'];
const NON_MONEY = ['trenddatapoint.value', 'guest.value', 'nightactivityevent.thresholdvalue', 'nightactivityevent.observedvalue'];

function isMonetaryField(model: string, field: string): boolean {
  const lower = field.toLowerCase();
  const fullKey = (model + '.' + field).toLowerCase();
  if (NON_MONEY.includes(fullKey)) return false;
  const isMoney = MONEY_KEYWORDS.some(kw => lower.includes(kw));
  const isRate = RATE_KEYWORDS.some(kw => lower.includes(kw));
  return isMoney && !isRate;
}

describe('🌊 WAVE R2 — F01: Monetary Field Inventory', () => {
  it('inventory document exists', () => {
    expect(fs.existsSync(inventoryPath)).toBe(true);
  });

  it('every Float field with monetary semantics is documented in inventory', () => {
    const floatFields = extractFloatFields(schema);
    const monetaryFields = floatFields.filter(f => isMonetaryField(f.model, f.field));

    for (const { model, field } of monetaryFields) {
      const entry = `${model}.${field}`;
      expect(inventory, `Monetary field "${entry}" is not documented in MONETARY_FIELD_INVENTORY.md`).toContain(entry);
    }
  });

  it('count of monetary Float fields is 48', () => {
    const floatFields = extractFloatFields(schema);
    const monetaryFields = floatFields.filter(f => isMonetaryField(f.model, f.field));
    expect(monetaryFields.length).toBe(48);
  });

  it('RULE_A: comissionRate is Float (rate, not money) — should NOT be migrated to Decimal', () => {
    const floatFields = extractFloatFields(schema);
    const comissionRate = floatFields.find(f => f.field === 'comissionRate');
    expect(comissionRate).toBeDefined();
  });

  it('RULE_A: comissionAmount is Float (money) — SHOULD be migrated to Decimal', () => {
    const floatFields = extractFloatFields(schema);
    const comissionAmount = floatFields.find(f => f.field === 'comissionAmount');
    expect(comissionAmount).toBeDefined();
    expect(isMonetaryField('UpsellRecord', 'comissionAmount')).toBe(true);
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
