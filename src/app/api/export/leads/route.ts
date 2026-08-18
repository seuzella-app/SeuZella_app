import { NextRequest, NextResponse } from 'next/server';
import { generateSpreadsheet, generateCSV } from '@/lib/export-spreadsheet';
import { apiRatelimit } from '@/lib/rate-limit';
import { withApiGuard } from '@/lib/security/api-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await apiRatelimit.limit(`api:${clientIp}:${new URL(request.url).pathname}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Muitas requisições.', retryAfter: Math.ceil((rl.reset - Date.now()) / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)), 'X-RateLimit-Remaining': '0' } }
    );
  }

  try {
    const body = await request.json();
    const leads = body.leads;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum lead fornecido para exportação' },
        { status: 400, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    const format = body.format || 'xlsx';

    if (format === 'csv') {
      const csv = generateCSV(leads);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/tab-separated-values; charset=utf-8',
          'Content-Disposition':
            'attachment; filename="secretaria_leads_' +
            new Date().toISOString().slice(0, 10) +
            '.csv"',
          'X-Security-Shield': 'zero-trust-v2',
        },
      });
    }

    /* Default: xlsx */
    const buffer = generateSpreadsheet(leads);
    const filename =
      'secretaria_leads_' + new Date().toISOString().slice(0, 10) + '.xlsx';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
        'X-Security-Shield': 'zero-trust-v2',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Erro ao gerar planilha' },
      { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
    );
  }
}