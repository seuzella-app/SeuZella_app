/**
 * POST /api/lgpd/consent
 *
 * Registra consentimento explícito do hóspede (LGPD art. 8º).
 * Tipos: whatsapp_contact, marketing, data_sharing, cookies
 *
 * Body: { tenantId, guestId?, guestPhone, consentType, granted }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { registrarConsentimento } from '@/lib/lgpd/lgpd-service';
import { withApiGuard } from '@/lib/security/api-guard';

const schema = z.object({
  tenantId: z.string(),
  guestId: z.string().optional(),
  guestPhone: z.string().min(10),
  consentType: z.enum(['whatsapp_contact', 'marketing', 'data_sharing', 'cookies']),
  granted: z.boolean(),
});

const postWrapped = withApiGuard(
  { schema, routeLabel: 'lgpd-consent', allowGlobalAccess: true },
  async ({ req, body }) => {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || '';

    const consent = await registrarConsentimento({
      tenantId: body.tenantId,
      guestId: body.guestId,
      guestPhone: body.guestPhone,
      consentType: body.consentType,
      granted: body.granted,
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, data: consent });
  }
);

export const POST = postWrapped;
