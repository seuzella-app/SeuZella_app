import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-guard';

/**
 * POST /api/leads/seed
 * Development-only fixture endpoint. Real production seeding must use the
 * controlled server-side seed workflow, never a public HTTP route.
 */
export async function POST(req: NextRequest) {
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
