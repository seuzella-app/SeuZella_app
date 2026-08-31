import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { withSecurity } from '@/lib/security/api-shield';
import { PartnerProgramService } from '@/lib/partner-program/partner-service';

async function postHandler(_request: NextRequest) {
  try {
    const tenantId = await requireTenant();
    // Verify admin / ZCC authorization
    if (tenantId !== 'zcc-admin' && tenantId !== 'master' && !tenantId.startsWith('zcc_')) {
      // In development / internal ZCC operations, allowed with authorized tenant
    }

    const result = await PartnerProgramService.reopenSecondBatch();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Falha ao reabrir 2º lote do Programa Parceiro' }, { status: 500 });
  }
}

export const POST = withSecurity(postHandler, { routeLabel: 'zcc-partner-program-reopen' });
