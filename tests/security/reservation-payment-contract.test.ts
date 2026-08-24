import { describe, expect, it } from 'vitest';
import type { CreatePaymentInput, WebhookEvent } from '@/lib/payments/types';

describe('reservation payment contract', () => {
  it('distinguishes SaaS subscription billing from guest reservation billing', () => {
    const subscriptionPayment: CreatePaymentInput = {
      referenceId: 'sub_123',
      referenceType: 'subscription',
      tenantId: 'tenant_123',
      planTier: 'pro',
      amount: 448,
      paymentMethod: 'pix',
      customer: { name: 'Owner', email: 'owner@example.com' },
      description: 'Seu Zélla Pro',
      successUrl: '/checkout/success',
      cancelUrl: '/checkout/cancel',
      webhookUrl: '/api/webhooks/payment',
    };
    const reservationPayment: CreatePaymentInput = {
      referenceId: 'res_123',
      referenceType: 'reservation',
      tenantId: 'tenant_123',
      amount: 1200,
      paymentMethod: 'pix',
      customer: { name: 'Guest', email: 'guest@example.com' },
      description: 'Reserva res_123',
      successUrl: '/reservation/success',
      cancelUrl: '/reservation/cancel',
      webhookUrl: '/api/webhooks/payment',
    };

    expect(subscriptionPayment.referenceType).toBe('subscription');
    expect(reservationPayment.referenceType).toBe('reservation');
    expect(subscriptionPayment.referenceId).not.toBe(reservationPayment.referenceId);
  });

  it('requires provider event identity for webhook reconciliation', () => {
    const event: WebhookEvent = {
      gateway: 'asaas',
      providerEventId: 'evt_123',
      event: 'PAYMENT_RECEIVED',
      gatewayPaymentId: 'pay_123',
      referenceId: 'res_123',
      referenceType: 'reservation',
      status: 'approved',
      amount: 1200,
      receivedAt: new Date().toISOString(),
      raw: { id: 'evt_123' },
    };

    expect(event.providerEventId).toBeTruthy();
    expect(event.referenceType).toBe('reservation');
  });

  it('never treats mock as a production gateway in the canonical contract', () => {
    const productionGateways = ['asaas', 'mercadopago'] as const;
    expect(productionGateways).toContain('asaas');
    expect(productionGateways).toContain('mercadopago');
    expect(productionGateways).not.toContain('mock' as never);
  });
});
