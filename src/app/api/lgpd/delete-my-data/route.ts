/**
 * POST /api/lgpd/delete-my-data
 *
 * Direito ao esquecimento (art. 18, VI LGPD).
 * Hóspede solicita exclusão dos seus dados — prazo 15 dias úteis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { solicitarExclusaoDados } from '@/lib/lgpd/lgpd-service';
import { enforceRateLimit, buildIdentifier } from '@/lib/security/rate-limit';
import { withApiGuard } from '@/lib/security/api-guard';

const schema = z.object({
  tenantId: z.string(),
  guestId: z.string().optional(),
  guestName: z.string().min(2).max(200),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  reason: z.string().max(500).default('Solicitação do titular'),
});

const postWrapped = withApiGuard(
  { schema, routeLabel: 'lgpd-delete', allowGlobalAccess: true },
  async ({ req, body }) => {
    // Rate limit: 3 pedidos/hora por IP (evita abuso)
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const limit = await enforceRateLimit('password-reset', ip); // reusa config 3/hora
    if (!limit.success) {
      return NextResponse.json(
        { error: 'RATE_LIMITED', message: 'Muitas solicitações. Tente em 1h.' },
        { status: 429 },
      );
    }

    const request = await solicitarExclusaoDados({
      tenantId: body.tenantId,
      guestId: body.guestId,
      guestName: body.guestName,
      guestEmail: body.guestEmail,
      guestPhone: body.guestPhone,
      reason: body.reason,
    });

    return NextResponse.json({
      success: true,
      data: request,
      message: 'Solicitação registrada. Prazo legal: 15 dias úteis (LGPD art. 18). Você receberá confirmação por email.',
    });
  }
);

export const POST = postWrapped;
