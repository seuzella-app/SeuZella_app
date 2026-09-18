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
  async ({ req, session, tenantId, body }) => {
    // RUN 4 — Wave 4F (fix de autoridade de tenant):
    // ANTES: body.tenantId era autoridade para gravar consentimento em
    // qualquer tenant (escrita cross-tenant por usuário autenticado).
    // AGORA: o tenant do principal autenticado é a autoridade; o tenantId do
    // cliente é aceito apenas se coincidir (consistency check). Principais
    // globais (sem tenant na sessão) precisam ser administradores para
    // registrar consentimento em nome de um tenant (workflow DPO).
    const sessionTenantId = tenantId;
    if (sessionTenantId && sessionTenantId !== body.tenantId) {
      return NextResponse.json(
        { error: 'TENANT_MISMATCH', message: 'Acesso negado: tenant informado não corresponde à sessão autenticada.' },
        { status: 403 }
      );
    }
    if (!sessionTenantId) {
      const role = String(((session as { user?: { role?: string } }).user?.role) || '');
      if (!['ADMIN', 'owner', 'system_admin'].includes(role)) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Apenas administradores podem registrar consentimento para outro tenant.' },
          { status: 403 }
        );
      }
    }

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
