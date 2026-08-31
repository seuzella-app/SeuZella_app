import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { withSecurity } from '@/lib/security/api-shield';
import { PartnerProgramService } from '@/lib/partner-program/partner-service';

async function postHandler(request: NextRequest) {
  try {
    const tenantId = await requireTenant();
    const body = await request.json();
    const { pousadaName, ownerName, email, phone, propertyId } = body;

    if (!pousadaName || !ownerName || !email || !phone) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes (pousadaName, ownerName, email, phone)' },
        { status: 400 }
      );
    }

    const result = await PartnerProgramService.claimSlot({
      tenantId,
      pousadaName,
      ownerName,
      email,
      phone,
      propertyId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error.message === 'PARTNER_PROGRAM_FULL') {
      return NextResponse.json(
        { error: 'As vagas do Programa Parceiro Zélla estão esgotadas. Entre na lista de espera.', code: 'PROGRAM_FULL' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Falha ao contratar vaga do Programa Parceiro Zélla' }, { status: 500 });
  }
}

export const POST = withSecurity(postHandler, { routeLabel: 'partner-program-claim' });
