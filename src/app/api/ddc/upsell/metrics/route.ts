/**
 * GET /api/ddc/upsell/metrics
 *
 * Retorna métricas mensais de UPSELL para o DDC.
 * Inclui: total de UPSELLs aceitos, receita extra, comissão Zélla (7%),
 * breakdown por tipo, por status, média por reserva.
 *
 * Query params:
 *   - startDate (ISO)
 *   - endDate (ISO)
 *   - month (1-12) + year (YYYY) — alternativa para período mensal
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calcularMetricasUpsell } from '@/lib/upsell/upsell-engine';

async function getHandler(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const {tenantId} = (session.user as any);
  if (!tenantId) {
    return NextResponse.json({ error: 'TENANT_CONTEXT_MISSING' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');
  const month = searchParams.get('month');
  const year = searchParams.get('year');

  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (month && year) {
    // Período mensal
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (m >= 1 && m <= 12 && y >= 2020 && y <= 2100) {
      startDate = new Date(y, m - 1, 1);
      endDate = new Date(y, m, 0, 23, 59, 59);
    }
  } else if (startDateParam && endDateParam) {
    startDate = new Date(startDateParam);
    endDate = new Date(endDateParam);
  } else {
    // Default: mês atual
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  const metrics = await calcularMetricasUpsell({ tenantId, startDate, endDate });

  return NextResponse.json({
    success: true,
    data: metrics,
    period: {
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
    },
  });
}

export const GET = getHandler;
