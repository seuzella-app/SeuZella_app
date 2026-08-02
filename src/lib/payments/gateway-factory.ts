// ==============================================================================
// SEUZÉLLA — Payment Gateway Factory
// ==============================================================================
// Single entry point for the rest of the app to get a configured gateway.
// Selection priority:
//   1. Explicit provider hint from caller (e.g. "use asaas for this subscription")
//   2. Env var DEFAULT_PAYMENT_GATEWAY (set per-deployment)
//   3. First configured gateway in order: asaas > mercadopago > stripe
//   4. Mock gateway (returns success without charging — used in MODO MOCK)
//
// Sprint 1, Day 1-2: Factory + gateway selection logic
// ==============================================================================

import type { GatewayId, IPaymentGateway } from './types';
import { PaymentGatewayError } from './types';
import { MercadoPagoGateway } from './providers/mercadopago';
import { AsaasGateway } from './providers/asaas';
import { StripeGateway } from './providers/stripe';

// ── Singleton gateway instances (initialized lazily) ──────────────────────────
const gatewayInstances: Partial<Record<GatewayId, IPaymentGateway>> = {};

function getGatewayInstance(id: GatewayId): IPaymentGateway {
  if (gatewayInstances[id]) return gatewayInstances[id]!;
  let instance: IPaymentGateway;
  switch (id) {
    case 'mercadopago':
      instance = new MercadoPagoGateway();
      break;
    case 'asaas':
      instance = new AsaasGateway();
      break;
    case 'stripe':
      instance = new StripeGateway();
      break;
    case 'mock':
      instance = new MockGateway();
      break;
    default:
      throw new PaymentGatewayError(
        `Unknown gateway: ${id}`,
        id,
        'UNKNOWN_GATEWAY',
      );
  }
  gatewayInstances[id] = instance;
  return instance;
}

// ── Public API: get a gateway by explicit ID ──────────────────────────────────
export function getGateway(id: GatewayId): IPaymentGateway {
  return getGatewayInstance(id);
}

// ── Public API: get the default configured gateway ────────────────────────────
//
// Selection priority:
//   1. DEFAULT_PAYMENT_GATEWAY env var if it's configured AND that gateway's
//      isConfigured() returns true
//   2. Iterate through PREFERENCE_ORDER and return first configured gateway
//   3. Fall back to MockGateway (always returns success)
//
// PREFERENCE_ORDER rationale:
//   - Asaas first: lowest fees for sub-R$500 transactions, native recurring
//   - MercadoPago second: most popular in Brazil, broad payment method support
//   - Stripe third: international fallback
const PREFERENCE_ORDER: GatewayId[] = ['asaas', 'mercadopago', 'stripe'];

export function getDefaultGateway(): IPaymentGateway {
  // 1. Explicit env override
  const envGateway = process.env.DEFAULT_PAYMENT_GATEWAY as GatewayId | undefined;
  if (envGateway && ['asaas', 'mercadopago', 'stripe'].includes(envGateway)) {
    const g = getGatewayInstance(envGateway);
    if (g.isConfigured()) return g;
  }

  // 2. First configured in preference order
  for (const id of PREFERENCE_ORDER) {
    const g = getGatewayInstance(id);
    if (g.isConfigured()) return g;
  }

  // 3. Mock fallback (MODO MOCK)
  return getGatewayInstance('mock');
}

// ── Mock Gateway — used when MODO MOCK is active ───────────────────────────────
// Always returns success without charging. This is the safe default that keeps
// the system functional during the internal testing phase.
class MockGateway implements IPaymentGateway {
  readonly id = 'mock' as const;

  isConfigured(): boolean {
    return true;
  }

  async createPayment(input: CreatePaymentInputStub): Promise<CreatePaymentResultStub> {
    console.log(`[MockGateway] createPayment — subscriptionId=${input.subscriptionId}, amount=${input.amount}, method=${input.paymentMethod}`);
    return {
      gateway: 'mock',
      gatewayPaymentId: `mock_${input.subscriptionId}_${Date.now()}`,
      status: 'approved',
      checkoutUrl: `${input.successUrl}?mock=1`,
      raw: { mock: true, input },
    };
  }

  async getPaymentStatus(): Promise<PaymentStatusStub> {
    return 'approved';
  }

  async verifyWebhook(): Promise<boolean> {
    return true;
  }

  async parseWebhookEvent(payload: string | Buffer): Promise<WebhookEventStub> {
    const body = JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8'));
    return {
      gateway: 'mock',
      event: body?.event ?? 'mock.event',
      gatewayPaymentId: body?.paymentId ?? `mock_${Date.now()}`,
      subscriptionId: body?.subscriptionId ?? '',
      status: 'approved',
      amount: body?.amount,
      receivedAt: new Date().toISOString(),
      raw: body,
    };
  }
}

// ── Stub types for MockGateway (avoiding circular import) ─────────────────────
type CreatePaymentInputStub = {
  subscriptionId: string;
  tenantId: string;
  amount: number;
  paymentMethod: 'pix' | 'cartao' | 'boleto';
  successUrl: string;
  customer: { name: string; email: string; phone?: string; document?: string };
  description: string;
  planTier: string;
  cancelUrl: string;
  webhookUrl: string;
};
type CreatePaymentResultStub = {
  gateway: 'mock';
  gatewayPaymentId: string;
  status: 'approved';
  checkoutUrl: string;
  raw: unknown;
};
type PaymentStatusStub = 'pending' | 'approved' | 'authorized' | 'in_progress' | 'rejected' | 'cancelled' | 'refunded' | 'unknown';
type WebhookEventStub = {
  gateway: 'mock';
  event: string;
  gatewayPaymentId: string;
  subscriptionId: string;
  status: PaymentStatusStub;
  amount?: number;
  receivedAt: string;
  raw: unknown;
};

// ── List all configured gateways (for admin UI) ───────────────────────────────
export function listConfiguredGateways(): GatewayId[] {
  const configured: GatewayId[] = [];
  for (const id of PREFERENCE_ORDER) {
    if (getGatewayInstance(id).isConfigured()) configured.push(id);
  }
  return configured;
}

// ── Health check: returns the configured status of each gateway ───────────────
export function getGatewayHealth(): Record<GatewayId, { configured: boolean; isDefault: boolean }> {
  const def = getDefaultGateway();
  const result: Record<string, { configured: boolean; isDefault: boolean }> = {};
  for (const id of PREFERENCE_ORDER) {
    const g = getGatewayInstance(id);
    result[id] = { configured: g.isConfigured(), isDefault: g.id === def.id };
  }
  result['mock'] = { configured: true, isDefault: def.id === 'mock' };
  return result as Record<GatewayId, { configured: boolean; isDefault: boolean }>;
}
