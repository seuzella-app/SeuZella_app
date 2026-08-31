import { NextRequest, NextResponse } from 'next/server';
import { PartnerProgramService } from '@/lib/partner-program/partner-service';
import { withSecurity } from '@/lib/security/api-shield';

async function getHandler(_request: NextRequest) {
  try {
    const status = await PartnerProgramService.getProgramStatus();
    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Falha ao buscar status do programa Parceiro Zélla' }, { status: 500 });
  }
}

export const GET = withSecurity(getHandler, { routeLabel: 'partner-program-status' });
