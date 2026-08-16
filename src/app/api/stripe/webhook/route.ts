/**
 * POST /api/stripe/webhook
 *
 * Recebe eventos do Stripe (payment_intent.succeeded, payment_intent.payment_failed, etc.)
 * e atualiza status dos UpsellRecords correspondentes.
 *
 * Header: stripe-signature
 * Body: raw JSON enviado pelo Stripe
 */

import { NextRequest, NextResponse } from 'next/server';
import { processarWebhookStripe } from '@/lib/payments/stripe-service';

async function postHandler(req: NextRequest) {
  try {
    const signature = req.headers.get('stripe-signature') || '';
    const payload = await req.text();

    const result = await processarWebhookStripe(payload, signature);

    if (!result.received) {
      return NextResponse.json(
        { error: 'WEBHOOK_PROCESSING_FAILED' },
        { status: 400 },
      );
    }

    return NextResponse.json({ received: true, type: result.type });
  } catch (err: any) {
    console.error('[STRIPE_WEBHOOK] erro:', err);
    return NextResponse.json(
      { error: 'WEBHOOK_ERROR', message: err.message },
      { status: 500 },
    );
  }
}

export const POST = postHandler;
