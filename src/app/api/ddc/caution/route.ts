import { NextRequest, NextResponse } from 'next/server';
import { createCaution, confirmCautionCollected, reportIncident, generateCautionMessage } from '@/lib/payments/caution';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.action === 'report_incident') {
      await reportIncident(body.cautionId, body.description);
      return NextResponse.json({ success: true, message: 'Sinistro registrado. Caução retida.' });
    }

    if (body.action === 'confirm_collected') {
      await confirmCautionCollected(body.cautionId);
      return NextResponse.json({ success: true, message: 'Caução confirmada como recebida.' });
    }

    // Criar nova caução
    const caution = await createCaution({
      tenantId: body.tenantId,
      guestId: body.guestId,
      reservationId: body.reservationId,
      amount: body.amount || 200,
      pixKey: body.pixKey,
      pixKeyType: body.pixKeyType || 'cpf',
      checkoutDate: body.checkoutDate ? new Date(body.checkoutDate) : undefined,
    });
    
    const message = generateCautionMessage(caution.amount, caution.pixKey, caution.pixKeyType);
    return NextResponse.json({ success: true, data: { caution, message } });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
