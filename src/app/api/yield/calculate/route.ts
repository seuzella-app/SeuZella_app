/**
 * ZÉLLA Yield API — Calculate
 * ===========================
 *
 * POST /api/yield/calculate
 *
 * Calcula o preço dinâmico (yield) para uma ou mais datas, sem persistir no banco.
 * Usado pelo:
 *   - DDC frontend: pré-visualizar tarifa antes de criar reserva
 *   - Cérebro (GuestResponderBrain): citar valores no WhatsApp
 *
 * Body:
 *   {
 *     "baseDailyRate": 1200,
 *     "totalRooms": 10,
 *     "occupiedRooms": 9,
 *     "dates": ["2026-12-30", "2026-12-31", "2027-01-01"],
 *     "autoDetectHoliday": true  // default true
 *   }
 *
 * Response:
 *   {
 *     "engineEnabled": true,
 *     "calculations": [
 *       { "date": "2026-12-30", "calculatedDailyRate": 1500, "tierName": "DEMAND_SURGE", "extraProfitGenerated": 300 },
 *       { "date": "2026-12-31", "calculatedDailyRate": 1920, "tierName": "SCARCITY_LOCK", "extraProfitGenerated": 720 },
 *       { "date": "2027-01-01", "calculatedDailyRate": 1920, "tierName": "SCARCITY_LOCK", "extraProfitGenerated": 720 }
 *     ],
 *     "totalPriceBrl": 5340,
 *     "baseTotalBrl": 3600,
 *     "extraProfitBrl": 1740,
 *     "citations": [...],
 *     "summary": "Pacote 3 noites (30/12 a 01/01): R$ 5.340,00 — incluindo R$ 1.740,00 de ajuste dinâmico por escassez máxima."
 *   }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiGuard } from '@/lib/security/api-guard';
import {
  ZaosYieldEngine,
  isYieldEngineEnabled,
  formatCitationForWhatsApp,
  detectBrazilianHighSeasonHoliday,
  formatBRL,
} from '@/lib/ai/tools/dynamic-yield-engine';
import {
  computeYieldCitationForStay,
  summarizeCitationForWhatsApp,
} from '@/lib/cerebro/yield-citation-hook';

const CalculateSchema = z.object({
  baseDailyRate: z.number().positive({ message: 'baseDailyRate deve ser > 0' }),
  totalRooms: z.number().int().positive({ message: 'totalRooms deve ser inteiro > 0' }),
  occupiedRooms: z.number().int().min(0).default(0),
  dates: z.array(z.string()).min(1, { message: 'dates não pode ser vazio' }),
  autoDetectHoliday: z.boolean().default(true),
  forceIsHoliday: z.boolean().optional(),
  forceHolidayName: z.string().optional(),
});

export const POST = withApiGuard(
  { schema: CalculateSchema, routeLabel: 'yield-calculate' },
  async ({ body }) => {
    const { baseDailyRate, totalRooms, occupiedRooms, dates, autoDetectHoliday, forceIsHoliday, forceHolidayName } = body;

    const dateObjs = dates.map((s) => new Date(s));
    if (dateObjs.some((d) => Number.isNaN(d.getTime()))) {
      return NextResponse.json(
        { error: 'Data inválida em dates[]', code: 'INVALID_DATE' },
        { status: 400 },
      );
    }

    const response = computeYieldCitationForStay({
      baseDailyRate,
      totalRooms,
      occupiedRooms,
      dates: dateObjs,
      autoDetectHoliday,
      forceIsHoliday,
      forceHolidayName,
    });

    // Calculations detalhadas (uma por noite, com metadata)
    const calculationsDetailed = dateObjs.map((date, i) => {
      const calc = response.calculations[i];
      const holiday = detectBrazilianHighSeasonHoliday(date);
      return {
        date: date.toISOString().slice(0, 10),
        calculatedDailyRate: calc.calculatedDailyRate,
        surgeMultiplier: calc.surgeMultiplier,
        tierName: calc.tierName,
        extraProfitGenerated: calc.extraProfitGenerated,
        occupancyRate: calc.occupancyRate,
        daysToEvent: calc.daysToEvent,
        triggerReason: calc.triggerReason,
        isSpecialHoliday: holiday !== null || forceIsHoliday === true,
        holidayName: holiday ?? forceHolidayName ?? null,
      };
    });

    const summary = summarizeCitationForWhatsApp(dateObjs, response);

    return NextResponse.json({
      engineEnabled: response.engineEnabled,
      calculations: calculationsDetailed,
      citations: response.citations,
      hasSurgeApplied: response.hasSurgeApplied,
      hasScarcityLock: response.hasScarcityLock,
      totalPriceBrl: response.totalPriceBrl,
      baseTotalBrl: response.baseTotalBrl,
      extraProfitBrl: response.extraProfitBrl,
      formattedTotal: formatBRL(response.totalPriceBrl),
      formattedExtra: formatBRL(response.extraProfitBrl),
      summary,
    });
  },
);

/**
 * GET /api/yield/calculate
 * Versão simplificada para query-string (sem body), útil para chamadas inline.
 *
 * Query params:
 *   ?baseDailyRate=1200&totalRooms=10&occupiedRooms=9&date=2026-12-31
 */
export const GET = withApiGuard(
  { routeLabel: 'yield-calculate-quick' },
  async ({ req }) => {
    const sp = req.nextUrl.searchParams;
    const baseDailyRate = parseFloat(sp.get('baseDailyRate') ?? '0');
    const totalRooms = parseInt(sp.get('totalRooms') ?? '0', 10);
    const occupiedRooms = parseInt(sp.get('occupiedRooms') ?? '0', 10);
    const dateStr = sp.get('date');

    if (!baseDailyRate || !totalRooms || !dateStr) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: baseDailyRate, totalRooms, date', code: 'MISSING_PARAMS' },
        { status: 400 },
      );
    }

    const targetDate = new Date(dateStr);
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Data inválida', code: 'INVALID_DATE' }, { status: 400 });
    }

    const holiday = detectBrazilianHighSeasonHoliday(targetDate);
    const calc = ZaosYieldEngine.calculateYieldPrice({
      baseDailyRate,
      totalRooms,
      occupiedRooms,
      targetDate,
      isSpecialHoliday: holiday !== null,
      holidayName: holiday ?? undefined,
    });

    return NextResponse.json({
      engineEnabled: isYieldEngineEnabled(),
      date: targetDate.toISOString().slice(0, 10),
      calculatedDailyRate: calc.calculatedDailyRate,
      surgeMultiplier: calc.surgeMultiplier,
      tierName: calc.tierName,
      extraProfitGenerated: calc.extraProfitGenerated,
      occupancyRate: calc.occupancyRate,
      daysToEvent: calc.daysToEvent,
      triggerReason: calc.triggerReason,
      isSpecialHoliday: holiday !== null,
      holidayName: holiday,
      formattedRate: formatBRL(calc.calculatedDailyRate),
      formattedExtra: formatBRL(calc.extraProfitGenerated),
      citation: formatCitationForWhatsApp(calc),
    });
  },
);
