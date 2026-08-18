/**
 * ZÉLLA Yield API — Profit Summary
 * =================================
 *
 * GET /api/yield/profit-summary
 *
 * Retorna o total de lucro extra gerado pelo ZaosYieldEngine para o tenant atual
 * em uma janela temporal. Usado pelo Widget DDC "💰 Ganhos Extras com Precificação
 * Dinâmica".
 *
 * Query params (todos opcionais):
 *   startDate=2026-12-01  // default: hoje - 90 dias (YIELD_SEASON_WINDOW_DAYS)
 *   endDate=2027-01-31    // default: hoje
 *
 * Response:
 *   {
 *     "tenantId": "abc123",
 *     "startDate": "2026-11-15T00:00:00.000Z",
 *     "endDate": "2027-01-31T23:59:59.999Z",
 *     "totalExtraProfitBrl": 21450.00,
 *     "totalBonusShareBrl": 0,           // Fase 1 = 0
 *     "totalYieldNights": 30,
 *     "scarcityLockNights": 18,
 *     "demandSurgeNights": 12,
 *     "nominalNights": 0,
 *     "byHoliday": {
 *       "Réveillon": { "nights": 5, "extraProfitBrl": 7500 },
 *       "Natal": { "nights": 3, "extraProfitBrl": 3600 }
 *     },
 *     "formatted": {
 *       "totalExtra": "R$ 21.450,00",
 *       "message": "R$ 21.450,00 de lucro extra gerado em 30 diárias pela IA do Seu Zélla nesta temporada."
 *     }
 *   }
 *
 * Quando o banco está indisponível (build/demo mode), retorna zeros — nunca
 * lança 500 para não quebrar o Dashboard.
 */

import { NextResponse } from 'next/server';
import { isDatabaseAvailable } from '@/lib/db';
import { withApiGuard } from '@/lib/security/api-guard';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { YieldProfitTracker } from '@/lib/ai/tools/yield-profit-tracker';
import {
  formatBRL,
  formatProfitSummaryMessage,
  type YieldProfitSummary,
} from '@/lib/ai/tools/dynamic-yield-engine';

export const GET = withApiGuard(
  { routeLabel: 'yield-profit-summary' },
  async ({ req }) => {
    const sp = req.nextUrl.searchParams;

    // Default: últimos 90 dias como "temporada atual"
    const seasonDays = parseInt(process.env.YIELD_SEASON_WINDOW_DAYS ?? '90', 10);
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - seasonDays);

    const startDateStr = sp.get('startDate');
    const endDateStr = sp.get('endDate');
    const startDate = startDateStr ? new Date(startDateStr) : defaultStart;
    const endDate = endDateStr ? new Date(endDateStr) : now;

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Data inválida', code: 'INVALID_DATE' },
        { status: 400 },
      );
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized — tenantId não resolvido', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    // Database available?
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json(emptySummary(tenantId, startDate, endDate));
    }

    const summary = await YieldProfitTracker.getProfitSummary({ tenantId, startDate, endDate });

    return NextResponse.json({
      ...summary,
      formatted: {
        totalExtra: formatBRL(summary.totalExtraProfitBrl),
        bonusShare: formatBRL(summary.totalBonusShareBrl),
        message: formatProfitSummaryMessage(summary.totalExtraProfitBrl, summary.totalYieldNights),
      },
    });
  },
);

function emptySummary(tenantId: string, startDate: Date, endDate: Date) {
  return {
    tenantId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    totalExtraProfitBrl: 0,
    totalBonusShareBrl: 0,
    totalYieldNights: 0,
    scarcityLockNights: 0,
    demandSurgeNights: 0,
    nominalNights: 0,
    byHoliday: {},
    formatted: {
      totalExtra: formatBRL(0),
      bonusShare: formatBRL(0),
      message: formatProfitSummaryMessage(0, 0),
    },
    databaseAvailable: false,
  };
}
