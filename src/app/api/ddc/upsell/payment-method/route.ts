/**
 * POST /api/ddc/upsell/payment-method
 *
 * Cria SetupIntent para o dono da pousada cadastrar cartão de crédito
 * (cobrança automática da comissão Zélla de 7% no fim de cada mês).
 *
 * Body: { }
 * Retorna: { client_secret, setup_intent_id }
 *
 * Frontend usa Stripe.js para montar o formulário de cartão.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { criarSetupIntent } from '@/lib/payments/stripe-service';

async function postHandler(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'TENANT_CONTEXT_MISSING' }, { status: 400 });
  }

  try {
    const result = await criarSetupIntent(tenantId);
    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[PAYMENT_METHOD] erro:', err);
    return NextResponse.json(
      { error: 'STRIPE_ERROR', message: err.message },
      { status: 500 },
    );
  }
}

export const POST = postHandler;
