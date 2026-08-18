/**
 * POST /api/ddc/upsell/charge
 *
 * Dispara cobrança via cartão de crédito (Mercado Pago) da comissão Zélla (7%)
 * dos UPSELLs confirmados no período especificado.
 *
 * Em produção, é chamada automaticamente por um cron job no fim de cada mês.
 * Pode ser chamada manualmente pelo dono da pousada.
 *
 * Body: { month, year } (default mês atual)
 * Retorna: { success, payment_id?, status?, amount_charged, upsell_ids }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cobrarComissaoMensal } from '@/lib/payments/mercadopago-service';
import { withApiGuard } from '@/lib/security/api-guard';

const chargeSchema = z.object({
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
});

const postWrapped = withApiGuard(
  { schema: chargeSchema, routeLabel: 'upsell-charge' },
  async ({ tenantId, body }) => {
    if (!tenantId) {
      return NextResponse.json({ error: 'TENANT_CONTEXT_MISSING' }, { status: 400 });
    }

    const now = new Date();
    const mes = body.month ?? now.getMonth() + 1;
    const ano = body.year ?? now.getFullYear();

    const result = await cobrarComissaoMensal(tenantId, mes, ano);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'CHARGE_FAILED', message: result.error, status: result.status },
        { status: 402 },
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      period: { mes, ano },
    });
  }
);

export const POST = postWrapped;
