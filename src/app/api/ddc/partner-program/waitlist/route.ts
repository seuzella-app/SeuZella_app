import { NextRequest, NextResponse } from 'next/server';
import { PartnerProgramService } from '@/lib/partner-program/partner-service';
import { withSecurity } from '@/lib/security/api-shield';

async function postHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const { pousadaName, contactName, email, phone, city, state, roomCount, notes, tenantId } = body;

    if (!pousadaName || !contactName || !email || !phone) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes (pousadaName, contactName, email, phone)' },
        { status: 400 }
      );
    }

    const result = await PartnerProgramService.joinWaitlist({
      tenantId,
      pousadaName,
      contactName,
      email,
      phone,
      city,
      state,
      roomCount: roomCount ? Number(roomCount) : undefined,
      notes,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Falha ao registrar na lista de espera' }, { status: 500 });
  }
}

export const POST = withSecurity(postHandler, { routeLabel: 'partner-program-waitlist' });
