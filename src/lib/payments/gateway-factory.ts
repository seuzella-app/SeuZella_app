// ==============================================================================
// SEUZÉLLA — Payment Gateway Factory
// ==============================================================================
// Production payment scope: Asaas + Mercado Pago.
// Mock remains available for development/testing only.
// ==============================================================================

import type { GatewayId, IPaymentGateway } from './types';
import { PaymentGatewayError } from './types';
import { MercadoPagoGateway } from './providers/mercadopago';
import { AsaasGateway } from './providers/asaas';

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
    case 'mock':
      instance = new MockGateway();
      break;
    default:
      throw new PaymentGatewayError(`Unknown gateway: ${id}`, id, 'UNKNOWN_GATEWAY');
  }
  gatewayInstances[id] = instance;
  return instance;
}

export function getGateway(id: GatewayId): IPaymentGateway {
  return getGatewayInstance(id);
}

const PREFERENCE_ORDER: GatewayId[] = ['asaas', 'mercadopago'];

export function getDefaultGateway(): IPaymentGateway {
  const envGateway = process.env.DEFAULT_PAYMENT_GATEWAY as GatewayId | undefined;
  if (envGateway && ['asaas', 'mercadopago'].includes(envGateway)) {
    const g = getGatewayInstance(envGateway);
    if (g.isConfigured()) return g;
  }

  for (const id of PREFERENCE_ORDER) {
    const g = getGatewayInstance(id);
    if (g.isConfigured()) return g;
  }

  return getGatewayInstance('mock');
}

class MockGateway implements IPaymentGateway {
  readonly id = 'mock' as const;

  isConfigured(): boolean { return true; }

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

  async getPaymentStatus(): Promise<PaymentStatusStub> { return 'approved'; }
  async verifyWebhook(): Promise<boolean> { return true; }

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

export function listConfiguredGateways(): GatewayId[] {
  const configured: GatewayId[] = [];
  for (const id of PREFERENCE_ORDER) {
    if (getGatewayInstance(id).isConfigured()) configured.push(id);
  }
  return configured;
}

export function getGatewayHealth(): Record<GatewayId, { configured: boolean; isDefault: boolean }> {
  const def = getDefaultGateway();
  const result: Record<string, { configured: boolean; isDefault: boolean }> = {};
  for (const id of PREFERENCE_ORDER) {
    const g = getGatewayInstance(id);
    result[id] = { configured: g.isConfigured(), isDefault: g.id === def.id };
  }
  result.mock = { configured: true, isDefault: def.id === 'mock' };
  return result as Record<GatewayId, { configured: boolean; isDefault: boolean }>;
}
