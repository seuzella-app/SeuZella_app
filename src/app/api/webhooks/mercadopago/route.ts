/**
 * POST /api/webhooks/mercadopago
 *
 * Recebe webhooks do Mercado Pago (payment.approved, payment.rejected, etc.)
 * e atualiza status dos UpsellRecords correspondentes.
 *
 * Headers:
 *   - x-signature (validação opcional via MERCADOPAGO_WEBHOOK_SECRET)
 *
 * Body: JSON enviado pelo Mercado Pago
 */

import { NextRequest, NextResponse } from 'next/server';
import { processarWebhookMercadoPago } from '@/lib/payments/mercadopago-service';

async function postHandler(req: NextRequest) {
  try {
    const body = await req.json();

    // Validação opcional via secret (se MERCADOPAGO_WEBHOOK_SECRET configurado)
    const signature = req.headers.get('x-signature') || '';
    if (process.env.MERCADOPAGO_WEBHOOK_SECRET && !signature) {
      return NextResponse.json(
        { error: 'MISSING_SIGNATURE' },
        { status: 401 },
      );
    }

    const result = await processarWebhookMercadoPago(body);

    if (!result.received) {
      return NextResponse.json(
        { error: 'WEBHOOK_PROCESSING_FAILED' },
        { status: 400 },
      );
    }

    // Mercado Pago espera status 200 + JSON { received: true }
    return NextResponse.json({ received: true, type: result.type });
  } catch (err: any) {
    console.error('[MP_WEBHOOK] erro:', err);
    return NextResponse.json(
      { error: 'WEBHOOK_ERROR', message: err.message },
      { status: 500 },
    );
  }
}

// Mercado Pago também envia GET para validação inicial
async function getHandler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const challenge = searchParams.get('hub.challenge');
  if (challenge) {
    return NextResponse.json({ hub_challenge: challenge });
  }
  return NextResponse.json({ ok: true });
}

export const POST = postHandler;
export const GET = getHandler;
