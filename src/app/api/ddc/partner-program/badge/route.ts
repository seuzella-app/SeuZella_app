import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { withSecurity } from '@/lib/security/api-shield';
import { PartnerProgramService } from '@/lib/partner-program/partner-service';

async function getHandler(request: NextRequest) {
  // RUN 4 — Wave 4F (IDOR fix):
  // ANTES: tenantId vinha de searchParams e a sessão era apenas fallback —
  // qualquer chamada com ?tenantId=X lia o status de parceiro de qualquer
  // tenant, inclusive SEM sessão (leitura cross-tenant e não autenticada).
  // AGORA: a autoridade do tenant é EXCLUSIVAMENTE a sessão (requireTenant);
  // o parâmetro de query é aceito apenas como consistency check e qualquer
  // mismatch é rejeitado com 403.
  const sessionTenantId = await requireTenant();

  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get('tenantId');

    if (requestedTenantId && requestedTenantId !== sessionTenantId) {
      return NextResponse.json(
        { error: 'TENANT_MISMATCH', message: 'Acesso negado: tenant informado não corresponde à sessão autenticada.' },
        { status: 403 }
      );
    }

    const badgeStatus = await PartnerProgramService.getBadgeStatus(sessionTenantId);
    return NextResponse.json(badgeStatus, { status: 200 });
  } catch (error) {
    return NextResponse.json({ isPartner: false, badge: null, label: null }, { status: 200 });
  }
}

export const GET = withSecurity(getHandler, { routeLabel: 'partner-program-badge' });
