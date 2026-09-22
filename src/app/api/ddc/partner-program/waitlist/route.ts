import { NextRequest, NextResponse } from 'next/server';
import { PartnerProgramService } from '@/lib/partner-program/partner-service';
import { withSecurity } from '@/lib/security/api-shield';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

async function postHandler(request: NextRequest) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'ddc.partner-program.waitlist', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:ddc.partner-program.waitlist', what: 'ddc.partner-program.waitlist.entry', resource: 'api', result: 'ALLOW' });
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
