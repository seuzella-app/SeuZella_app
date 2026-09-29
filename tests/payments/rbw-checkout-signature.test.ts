/**
 * RBW Fase H — Assinatura de checkout (produtor corrigido, validação intacta).
 * Simulação local — nenhum gateway real envolvido.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'crypto';

vi.mock('@/lib/env', () => ({
  getNextAuthSecret: () => 'rbw-test-secret-0123456789abcdef0123456789abcdef',
}));

import {
  signCheckoutSubscription,
  verifyCheckoutSubscriptionSignature,
  buildCheckoutSuccessUrl,
} from '@/lib/payments/checkout-signature';

const SECRET = 'rbw-test-secret-0123456789abcdef0123456789abcdef';

describe('RBW-H · checkout-signature (fonte única sign/verify)', () => {
  it('E2E-H1 valid signature: verify aceita assinatura gerada pelo produtor', () => {
    const subId = 'sub_123abc';
    const sig = signCheckoutSubscription(subId);
    expect(sig).toBe(createHmac('sha256', SECRET).update(subId).digest('hex'));
    expect(verifyCheckoutSubscriptionSignature(subId, sig)).toBe(true);
  });

  it('E2E-H2 invalid signature: verify rejeita assinatura manipulada', () => {
    const subId = 'sub_123abc';
    const sig = signCheckoutSubscription(subId);
    const tampered = (sig[0] === '0' ? '1' : '0') + sig.slice(1);
    expect(verifyCheckoutSubscriptionSignature(subId, tampered)).toBe(false);
  });

  it('E2E-H3 missing signature: verify rejeita null/undefined/vazio', () => {
    const subId = 'sub_x';
    expect(verifyCheckoutSubscriptionSignature(subId, null)).toBe(false);
    expect(verifyCheckoutSubscriptionSignature(subId, undefined)).toBe(false);
    expect(verifyCheckoutSubscriptionSignature(subId, '')).toBe(false);
  });

  it('E2E-H4 cross-subscription: assinatura de outra assinatura não valida', () => {
    const sig = signCheckoutSubscription('sub_A');
    expect(verifyCheckoutSubscriptionSignature('sub_B', sig)).toBe(false);
  });

  it('E2E-H5 sig de tamanho diferente não lança (guard de comprimento)', () => {
    expect(verifyCheckoutSubscriptionSignature('sub_x', 'deadbeef')).toBe(false);
  });

  it('E2E-H6 buildCheckoutSuccessUrl produz subscription_id + sig válidos', () => {
    const url = buildCheckoutSuccessUrl('https://app.example.com', 'sub_42');
    expect(url).toContain('https://app.example.com/checkout/success?subscription_id=sub_42&sig=');
    const sig = new URL(url).searchParams.get('sig');
    expect(verifyCheckoutSubscriptionSignature('sub_42', sig)).toBe(true);
  });

  it('determinístico: mesma entrada → mesma assinatura (replay do link é seguro)', () => {
    expect(signCheckoutSubscription('sub_r')).toBe(signCheckoutSubscription('sub_r'));
  });
});
