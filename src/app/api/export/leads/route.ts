import { NextRequest, NextResponse } from 'next/server';
import { generateSpreadsheet, generateCSV } from '@/lib/export-spreadsheet';
import { apiRatelimit } from '@/lib/rate-limit';
import { getAuthSession } from '@/lib/auth-guard';

export async function POST(request: NextRequest) {
  const { session, errorResponse } = await getAuthSession(request);
  if (errorResponse) return errorResponse;

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await apiRatelimit.limit(`api:${session!.tenantId}:${clientIp}:${new URL(request.url).pathname}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Muitas requisições.', retryAfter: Math.ceil((rl.reset - Date.now()) / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)), 'X-RateLimit-Remaining': '0' } }
    );
  }

  try {
    const body = await request.json();
    const leads = body.leads;

    if (!Array.isArray(leads) || leads.length === 0 || leads.length > 5000) {
      return NextResponse.json({ error: 'Quantidade de leads inválida' }, { status: 400 });
    }

    const foreignTenant = leads.some((lead: unknown) => {
      if (!lead || typeof lead !== 'object') return false;
      const candidate = lead as { tenantId?: unknown };
      return candidate.tenantId !== undefined && candidate.tenantId !== session!.tenantId;
    });
    if (foreignTenant) {
      return NextResponse.json({ error: 'TENANT_SCOPE_VIOLATION' }, { status: 403 });
    }

    const format = body.format || 'xlsx';
    const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Security-Shield': 'zero-trust-v3' };

    if (format === 'csv') {
      const csv = generateCSV(leads);
      return new NextResponse(csv, {
        headers: {
          ...headers,
          'Content-Type': 'text/tab-separated-values; charset=utf-8',
          'Content-Disposition': `attachment; filename="secretaria_leads_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    if (format !== 'xlsx') {
      return NextResponse.json({ error: 'FORMATO_NAO_PERMITIDO' }, { status: 400, headers });
    }

    const buffer = generateSpreadsheet(leads);
    return new NextResponse(buffer, {
      headers: {
        ...headers,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="secretaria_leads_${new Date().toISOString().slice(0, 10)}.xlsx"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erro ao gerar planilha' }, { status: 500 });
  }
}
