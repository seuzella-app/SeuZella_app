import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const source = fs.readFileSync('src/lib/env.ts', 'utf8');

describe('production payment environment contract', () => {
  it('fails closed when a selected payment gateway lacks credentials', () => {
    expect(source).toContain("DEFAULT_PAYMENT_GATEWAY === 'asaas'");
    expect(source).toContain("DEFAULT_PAYMENT_GATEWAY === 'mercadopago'");
    expect(source).toContain("DEFAULT_PAYMENT_GATEWAY === 'stripe'");
  });

  it('requires webhook secrets alongside gateway credentials', () => {
    expect(source).toContain("requireProductionSecret('ASAAS_WEBHOOK_SECRET'");
    expect(source).toContain("requireProductionSecret('PAYMENT_WEBHOOK_SECRET'");
    expect(source).toContain("requireProductionSecret('STRIPE_WEBHOOK_SECRET'");
  });
});
