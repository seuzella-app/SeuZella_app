// ============================================================================
// ZÉLLA — POST /api/ddc/linkinbio/activate-standalone
// ============================================================================
// Ativa Link-in-Bio Standalone R$ 47/mês (sem IA).
// Usado quando cliente cancelou o Seu Zélla mas quer manter Link-in-Bio.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireDDCTenantId } from '@/lib/ddc/auth-utils';
import {
  activateLinkInBioStandalone,
  LINK_IN_BIO_STANDALONE_PRICE_BRL,
} from '@/lib/notifications/linkinbio-addon';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
