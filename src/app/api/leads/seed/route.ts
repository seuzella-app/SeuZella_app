import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-guard';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';
import { requireInternalSecret } from '@/lib/infra/internal-secret';

/**
 * POST /api/leads/seed
 * Development-only fixture endpoint. Real production seeding must use the
 * controlled server-side seed workflow, never a public HTTP route.
 */
export async function POST(req: NextRequest) {
  // RUN19-A (HYGIENE): segredo interno em modo sombra — defina INTERNAL_SECRET e SZ_ENFORCE_INTERNAL=1 para cobrar.
  const internalDeny = requireInternalSecret(req);
  if (internalDeny) return internalDeny;
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(req, 'leads.seed', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:leads.seed', what: 'leads.seed.entry', resource: 'api', result: 'ALLOW' });
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'NOT_AVAILABLE_IN_PRODUCTION' }, { status: 404 });
  }

  const { errorResponse } = await getAuthSession(req);
  if (errorResponse) return errorResponse;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || !Array.isArray((body as { leads?: unknown }).leads)) {
    return NextResponse.json({ error: 'Body deve conter { leads: [...] }' }, { status: 400 });
  }

  const {leads} = (body as { leads: unknown[] });
  if (leads.length === 0 || leads.length > 100) {
    return NextResponse.json({ error: 'Quantidade de leads deve estar entre 1 e 100' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    seeded: leads.length,
    message: `Fixture recebido em ambiente não produtivo: ${leads.length} leads.`,
  });
}
