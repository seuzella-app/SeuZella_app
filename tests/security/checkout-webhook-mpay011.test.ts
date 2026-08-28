import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoist mocks
const { mockDb, mockVerifyMercadoPagoWebhook } = vi.hoisted(() => ({
  mockDb: {
    paymentTransaction: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
  mockVerifyMercadoPagoWebhook: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: mockDb,
  isDatabaseAvailable: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/security/webhook-verify', () => ({
  verifyMercadoPagoWebhook: mockVerifyMercadoPagoWebhook,
}));

vi.mock('@/lib/notifications/bridges', () => ({
  bridgePaymentEvent: vi.fn(),
  bridgeSecurityAlert: vi.fn(),
}));

vi.mock('@/lib/payments/idempotency', () => ({
  executeWithBillingIdempotency: vi.fn().mockImplementation(async (vars, fn) => {
    return { success: true, processed: true, result: await fn() };
  }),
}));

import { POST as checkoutWebhookHandler } from '@/app/api/checkout/webhook/route';

describe('M-PAY-011 Security Hardening — Mercado Pago Checkout Webhook', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('1. production + MP_WEBHOOK_SECRET ausente → fail-closed HTTP 500', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.MP_WEBHOOK_SECRET;
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;

    const payload = JSON.stringify({ action: 'payment.updated', data: { id: 'mp_pay_123' } });
    const req = new NextRequest('http://localhost/api/checkout/webhook', {
      method: 'POST',
      body: payload,
      headers: {
        'content-type': 'application/json',
        'x-signature': 'ts=123,v1=abc',
      },
    });

    const res = await checkoutWebhookHandler(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('WEBHOOK_SECRET_NOT_CONFIGURED');
  });

  it('2. production + MP_WEBHOOK_SECRET configurado + assinatura ausente → rejeita HTTP 401', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.MP_WEBHOOK_SECRET = 'secret_mp_prod_123';

    const payload = JSON.stringify({ action: 'payment.updated', data: { id: 'mp_pay_123' } });
    const req = new NextRequest('http://localhost/api/checkout/webhook', {
      method: 'POST',
      body: payload,
      headers: {
        'content-type': 'application/json',
      },
    });

    const res = await checkoutWebhookHandler(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('SIGNATURE_REQUIRED');
  });

  it('3. production + assinatura inválida → rejeita HTTP 401 SIGNATURE_INVALID', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.MP_WEBHOOK_SECRET = 'secret_mp_prod_123';
    mockVerifyMercadoPagoWebhook.mockReturnValue({ valid: false, reason: 'HMAC_MISMATCH' });

    const payload = JSON.stringify({ action: 'payment.updated', data: { id: 'mp_pay_123' } });
    const req = new NextRequest('http://localhost/api/checkout/webhook', {
      method: 'POST',
      body: payload,
      headers: {
        'content-type': 'application/json',
        'x-signature': 'ts=123,v1=tampered_hash',
      },
    });

    const res = await checkoutWebhookHandler(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('SIGNATURE_INVALID');
  });

  it('4. production + assinatura válida → processa com idempotência', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.MP_WEBHOOK_SECRET = 'secret_mp_prod_123';
    mockVerifyMercadoPagoWebhook.mockReturnValue({ valid: true });

    mockDb.paymentTransaction.findFirst.mockResolvedValue({
      id: 'tx_123',
      externalId: 'mp_pay_123',
      subscriptionId: 'sub_123',
      status: 'pending',
    });

    const payload = JSON.stringify({ action: 'payment.updated', data: { id: 'mp_pay_123' } });
    const req = new NextRequest('http://localhost/api/checkout/webhook', {
      method: 'POST',
      body: payload,
      headers: {
        'content-type': 'application/json',
        'x-signature': 'ts=123,v1=valid_hash',
      },
    });

    const res = await checkoutWebhookHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
  });

  it('5. non-production + sem secret → permite fluxo de desenvolvimento local', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    delete process.env.MP_WEBHOOK_SECRET;
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;

    mockDb.paymentTransaction.findFirst.mockResolvedValue({
      id: 'tx_123',
      externalId: 'mp_pay_123',
      subscriptionId: 'sub_123',
      status: 'pending',
    });

    const payload = JSON.stringify({ action: 'payment.updated', data: { id: 'mp_pay_123' } });
    const req = new NextRequest('http://localhost/api/checkout/webhook', {
      method: 'POST',
      body: payload,
      headers: {
        'content-type': 'application/json',
      },
    });

    const res = await checkoutWebhookHandler(req);
    expect(res.status).toBe(200);
  });
});
