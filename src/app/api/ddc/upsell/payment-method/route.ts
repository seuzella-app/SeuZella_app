/**
 * POST /api/ddc/upsell/payment-method
 *
 * Cria Customer no Mercado Pago + anexa cartão (token gerado pelo SDK MP no frontend).
 * O dono da pousada cadastra o cartão uma única vez — depois a cobrança é automática.
 *
 * Body: { cardToken }  (token gerado pelo SDK MercadoPago.js no browser)
 * Retorna: { success, card }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { attachCard } from '@/lib/payments/mercadopago-service';
import { withApiGuard } from '@/lib/security/api-guard';

const schema = z.object({
  cardToken: z.string().min(10),
});

const postWrapped = withApiGuard(
  { schema, routeLabel: 'upsell-payment-method' },
  async ({ tenantId, body }) => {
    if (!tenantId) {
      return NextResponse.json({ error: 'TENANT_CONTEXT_MISSING' }, { status: 400 });
    }

    const result = await attachCard(tenantId, body.cardToken);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'MP_CARD_ERROR', message: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, data: result.card });
  }
);

export const POST = postWrapped;
