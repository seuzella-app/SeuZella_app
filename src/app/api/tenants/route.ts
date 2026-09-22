import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSecurity } from '@/lib/security/api-shield';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

async function getHandler(request: NextRequest, _ctx: any) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'tenants', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:tenants', what: 'tenants.entry', resource: 'api', result: 'ALLOW' });
  try {
    // RUN 6B (R6B-04): listagem de TODOS os tenants é dado do plano
    // plataforma. Antes: role 'admin' (role de TENANT, lowercase) passava e
    // listava todos os tenants da plataforma (id/name/email/plan/status) —
    // leak cross-tenant. Gate canônico do plano ZCC agora é obrigatório
    // (ZCC_ADMIN_EMAILS + role owner/admin/system_admin; 404 em rejeição).
    const zcc = await verifyZCCAccessOrReject(request);
    if (!zcc.allowed) return zcc.response!;

    const tenants = await db.tenant.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        status: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ success: true, tenants });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch tenants' }, { status: 500 });
  }
}

export const GET = withSecurity(getHandler, { routeLabel: 'tenants' });