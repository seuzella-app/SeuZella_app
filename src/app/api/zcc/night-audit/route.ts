/**
 * ZCC — Night Audit API
 * =======================
 *
 * GET /api/zcc/night-audit
 *   Retorna o último relatório noturno completo (com vulnerabilidades,
 *   métricas do dia, análise do GLM 5.2).
 *
 * GET /api/zcc/night-audit?date=2026-08-15
 *   Retorna report de uma data específica.
 *
 * POST /api/zcc/night-audit
 *   Body: { force: true }
 *   Executa o audit agora (útil para testar fora do horário do cron).
 *   Requer CEREBRO_LIVE_MODE=true para usar GLM 5.2 real.
 *
 * Auth: ZCC admin (verifyZCCAccessOrReject — 6 camadas)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseAvailable } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { NightAuditService } from '@/lib/cerebro/night-audit-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // ── ZCC admin auth ──
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const sp = request.nextUrl.searchParams;
  const date = sp.get('date');

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    return NextResponse.json({
      report: null,
      databaseAvailable: false,
      message: 'Banco indisponível — Night Audit ainda não foi executado.',
    });
  }

  try {
    const report = date
      ? await NightAuditService.getByDate(date)
      : await NightAuditService.getLatest();

    return NextResponse.json({
      report,
      databaseAvailable: true,
    });
  } catch (error) {
    console.error('[ZCC_NIGHT_AUDIT] Erro:', error);
    return NextResponse.json(
      { report: null, error: 'Falha ao buscar relatório' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  // ── ZCC admin auth ──
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    return NextResponse.json(
      { error: 'Banco indisponível — não é possível executar audit' },
      { status: 503 },
    );
  }

  let force = false;
  try {
    const body = await request.clone().json().catch(() => ({}));
    force = Boolean(body?.force);
  } catch {}

  try {
    const result = await NightAuditService.run({ force });

    return NextResponse.json({
      ok: true,
      report: result,
    });
  } catch (error: any) {
    console.error('[ZCC_NIGHT_AUDIT] Erro ao executar:', error);
    return NextResponse.json(
      { ok: false, error: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
