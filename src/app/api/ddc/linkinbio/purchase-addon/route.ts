// ============================================================================
// ZÉLLA — POST /api/ddc/linkinbio/purchase-addon
// ============================================================================
// Compra addon R$ 47 para estender Link-in-Bio por mais 60 dias.
// Disponível apenas para plano LITE.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireDDCTenantId } from '@/lib/ddc/auth-utils';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';
import {
  purchaseLinkInBioAddon,
  getLinkInBioStatus,
  LINK_IN_BIO_ADDON_PRICE_BRL,
} from '@/lib/notifications/linkinbio-addon';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(req, 'ddc.linkinbio.purchase-addon', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:ddc.linkinbio.purchase-addon', what: 'ddc.linkinbio.purchase-addon.entry', resource: 'api', result: 'ALLOW' });
  try {
    const tenantId = await requireDDCTenantId();

    // Verificar status atual
    const status = await getLinkInBioStatus(tenantId);
    if (status.status === 'included_unlimited') {
      return NextResponse.json(
        {
          success: false,
          error: 'Seu plano já inclui Link-in-Bio ilimitado. Não é necessário comprar o addon.',
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const paymentMethod = body?.paymentMethod === 'cartao' ? 'cartao' : 'pix';

    const result = await purchaseLinkInBioAddon(tenantId, paymentMethod);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      addonPriceBrl: LINK_IN_BIO_ADDON_PRICE_BRL,
      extensionDays: 60,
      newExpiryDate: result.newExpiryDate?.toISOString() ?? null,
      message: result.message,
      paymentMethod,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.message?.includes('DDC_AUTH_REQUIRED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('[POST /api/ddc/linkinbio/purchase-addon]', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
