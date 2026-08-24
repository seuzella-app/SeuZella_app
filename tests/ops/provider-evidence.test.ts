import { describe, expect, it } from 'vitest';
import { isOperationalEvidence } from '@/lib/ops/provider-evidence';

describe('provider execution evidence', () => {
  it('accepts a fully passing provider evidence record', () => {
    expect(isOperationalEvidence({
      provider: 'asaas', capability: 'payment', status: 'pass', environment: 'sandbox',
      referenceId: 'evt_123', observedAt: new Date().toISOString(),
      checks: { signature: true, idempotency: true, reconciliation: true },
    })).toBe(true);
  });

  it('rejects evidence with any failed check', () => {
    expect(isOperationalEvidence({
      provider: 'mercadopago', capability: 'payment', status: 'pass', environment: 'sandbox',
      referenceId: 'evt_456', observedAt: new Date().toISOString(),
      checks: { signature: true, idempotency: false },
    })).toBe(false);
  });
});
