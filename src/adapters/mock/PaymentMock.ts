// ============================================================================
// PaymentMock — Digital Twin for Asaas + Mercado Pago
// ----------------------------------------------------------------------------
// Generates synthetic payment intents and webhook events for development and
// certification only. It never represents a live payment provider.
// ============================================================================

import type {
  IPaymentGatewayAdapter,
  PaymentIntentInput,
  PaymentIntent,
  WebhookEvent,
  PaymentProvider,
} from '../interfaces';
import { mulberry32, seedFromString } from './_stats';

class PaymentMock implements IPaymentGatewayAdapter {
  private intents = new Map<string, PaymentIntent>();
  private webhookLog: WebhookEvent[] = [];

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    const existing = Array.from(this.intents.values()).find(
      (i) => i.amountBRL === input.amountBRL &&
        i.method === input.method &&
        this.intentKeyMatches(i.intentId, input.idempotencyKey)
    );
    if (existing) return existing;

    const intentId = `pi_${input.provider}_${input.idempotencyKey}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const intent: PaymentIntent = {
      intentId,
      provider: input.provider,
      status: 'pending',
      amountBRL: input.amountBRL,
      method: input.method,
      createdAt: now,
    };

    if (input.method === 'pix') {
      intent.pix = {
        qrCodePayload: this.generatePixPayload(intentId, input.amountBRL),
        copyPasteKey: this.generatePixPayload(intentId, input.amountBRL),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
    } else if (input.method === 'credit_card') {
      intent.clientSecret = `${intentId}_secret_${Math.random().toString(36).slice(2, 12)}`;
    }

    this.intents.set(intentId, intent);

    if (input.method !== 'boleto') {
      const seed = seedFromString(intentId);
      const rng = mulberry32(seed);
      const willSucceed = rng() < 0.95;
      const delayMs = 500 + Math.floor(rng() * 1500);
      setTimeout(() => {
        const finalStatus: PaymentIntent['status'] = willSucceed ? 'succeeded' : 'failed';
        this.intents.set(intentId, { ...intent, status: finalStatus });
        this.webhookLog.push({
          eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          intentId,
          type: willSucceed ? 'payment.succeeded' : 'payment.failed',
          occurredAt: new Date().toISOString(),
          signatureVerified: true,
          raw: { intentId, amountBRL: input.amountBRL, method: input.method },
        });
      }, delayMs);
    }

    return intent;
  }

  async retrieveIntent(intentId: string): Promise<PaymentIntent> {
    const i = this.intents.get(intentId);
    if (!i) throw new Error(`Intent ${intentId} not found`);
    return i;
  }

  async refund(intentId: string, amountBRL?: number): Promise<PaymentIntent> {
    const i = this.intents.get(intentId);
    if (!i) throw new Error(`Intent ${intentId} not found`);
    const refunded = { ...i, status: 'refunded' as const, amountBRL: amountBRL ?? i.amountBRL };
    this.intents.set(intentId, refunded);
    return refunded;
  }

  async parseWebhook(rawPayload: unknown, _signature: string): Promise<WebhookEvent> {
    const evt = rawPayload as WebhookEvent;
    if (!evt.eventId || !evt.intentId || !evt.type) throw new Error('Invalid Digital Twin webhook payload');
    this.webhookLog.push({ ...evt, signatureVerified: true });
    return { ...evt, signatureVerified: true };
  }

  injectWebhook(intentId: string, type: WebhookEvent['type']): WebhookEvent {
    const i = this.intents.get(intentId);
    if (!i) throw new Error(`Intent ${intentId} not found`);
    const newStatus: PaymentIntent['status'] = type === 'payment.succeeded' ? 'succeeded' : type === 'payment.failed' ? 'failed' : 'refunded';
    this.intents.set(intentId, { ...i, status: newStatus });
    const evt: WebhookEvent = {
      eventId: `evt_inj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      intentId,
      type,
      occurredAt: new Date().toISOString(),
      signatureVerified: true,
      raw: { injected: true, intentId },
    };
    this.webhookLog.push(evt);
    return evt;
  }

  isDigitalTwin(): boolean { return true; }

  private intentKeyMatches(intentId: string, key: string): boolean { return intentId.includes(key); }

  private generatePixPayload(intentId: string, _amountBRL: number): string {
    const merchant = 'SEU ZELLA';
    const city = 'SAO PAULO';
    const txid = intentId.replace(/[^A-Z0-9]/gi, '').slice(0, 25).padEnd(25, '0');
    return [
      '00020126',
      `0014BR.GOV.BCB.PIX01${txid}`,
      `5204000053039865802BR59${merchant.length.toString().padStart(2, '0')}${merchant}60${city.length.toString().padStart(2, '0')}${city}`,
      `62${(5 + txid.length).toString().padStart(2, '0')}05${txid}`,
      `6304ABCD`,
    ].join('');
  }

  listWebhooks(): WebhookEvent[] { return [...this.webhookLog]; }
}

export const paymentMock = new PaymentMock();

export function makePaymentMock(provider: PaymentProvider): IPaymentGatewayAdapter {
  const base = paymentMock;
  return {
    createIntent: (input) => base.createIntent({ ...input, provider }),
    retrieveIntent: (id) => base.retrieveIntent(id),
    refund: (id, amt) => base.refund(id, amt),
    parseWebhook: (raw, sig) => base.parseWebhook(raw, sig),
    isDigitalTwin: () => true,
  };
}
