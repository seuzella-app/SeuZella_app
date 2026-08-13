import { NextRequest, NextResponse } from 'next/server';
import { detectUpsellIntent, createUpsellOrder, confirmUpsellPayment, generateUpsellMessage, DEFAULT_UPSELL_ITEMS } from '@/lib/billing/upsell';
import { withApiGuard } from '@/lib/security/api-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/ddc/upsell — Lista itens disponíveis
 * POST /api/ddc/upsell — Cria pedido ou detecta intenção
 * PATCH /api/ddc/upsell — Confirma pagamento
 */
export async function GET() {
  return NextResponse.json({ success: true, data: DEFAULT_UPSELL_ITEMS });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Se tem mensagem, detecta intenção de upsell
    if (body.message) {
      const item = detectUpsellIntent(body.message);
      if (item) {
        const message = generateUpsellMessage(item, body.pixKey || 'não configurado', body.pixKeyType || 'cpf');
        return NextResponse.json({ success: true, data: { detected: true, item, message } });
      }
      return NextResponse.json({ success: true, data: { detected: false } });
    }

    // Cria pedido
    const order = await createUpsellOrder({
      tenantId: body.tenantId,
      guestId: body.guestId,
      guestName: body.guestName,
      guestPhone: body.guestPhone,
      items: body.items,
      pixKey: body.pixKey,
      pixKeyType: body.pixKeyType,
    });
    return NextResponse.json({ success: true, data: order });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await confirmUpsellPayment(body.orderId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
