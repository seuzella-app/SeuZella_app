// ============================================================================
// ZÉLLA — POST /api/ddc/linkinbio/activate-standalone
// ============================================================================
// Ativa Link-in-Bio Standalone R$ 47/mês (sem IA).
// Usado quando cliente cancelou o Seu Zélla mas quer manter Link-in-Bio.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireDDCTenantId } from '@/lib/ddc/auth-utils';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';
import {
  activateLinkInBioStandalone,
  LINK_IN_BIO_STANDALONE_PRICE_BRL,
} from '@/lib/notifications/linkinbio-addon';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(req, 'ddc.linkinbio.activate-standalone', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:ddc.linkinbio.activate-standalone', what: 'ddc.linkinbio.activate-standalone.entry', resource: 'api', result: 'ALLOW' });
  try {
    const tenantId = await requireDDCTenantId();
    const body = await req.json().catch(() => ({}));
    const paymentMethod = body?.paymentMethod === 'cartao' ? 'cartao' : 'pix';

    const result = await activateLinkInBioStandalone(tenantId, paymentMethod);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      standalonePriceBrl: LINK_IN_BIO_STANDALONE_PRICE_BRL,
      billingCycle: 'monthly',
      message: result.message,
      paymentMethod,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.message?.includes('DDC_AUTH_REQUIRED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('[POST /api/ddc/linkinbio/activate-standalone]', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
