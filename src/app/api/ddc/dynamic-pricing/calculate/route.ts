/**
 * ZÉLLA DDC — Dynamic Pricing Calculate API
 *
 * POST: Calculate dynamic prices for a given date range.
 *
 * Request body:
 *   - startDate (string YYYY-MM-DD): Start of the range
 *   - endDate (string YYYY-MM-DD): End of the range (inclusive)
 *   - roomId (string, optional): Specific room to calculate for
 *   - airbPropertyId (string, optional): Specific AirBProperty to calculate for
 *   - basePrice (number, optional): Override base price
 *   - occupancyRate (number, optional): Override occupancy rate
 *   - mode (string, optional): 'single' for one date, 'batch' for range
 *   - date (string YYYY-MM-DD, optional): Single date for mode='single'
 *
 * Uses withSecurity from @/lib/security/api-shield
 */

import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { withSecurity, SecurityContext } from '@/lib/security/api-shield';
import {
  calculateDynamicPrice,
  batchCalculatePrices,
  getBrazilianHolidays,
  PricingCalculationResult,
} from '@/lib/dynamic-pricing-engine';

// ── POST: Calculate prices ─────────────────────────────────────────────

async function handlePost(request: NextRequest, ctx: SecurityContext): Promise<NextResponse> {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      // Return calculated holidays even when DB is down
      const body = ctx.sanitizedBody ?? await request.json().catch(() => null);
      if (body && typeof body === 'object') {
        const year = (body as Record<string, unknown>).year as number ?? new Date().getFullYear();
        return NextResponse.json({
          success: true,
          data: {
            holidays: getBrazilianHolidays(year),
            note: 'DB unavailable — only holidays returned. Price calculation requires DB.',
          },
        });
      }
      return NextResponse.json({
        success: true,
        data: { holidays: getBrazilianHolidays(new Date().getFullYear()) },
      });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Autenticação requerida.' }, { status: 401 });
    }

    // Get body — prefer sanitized, fallback to raw
    let body: Record<string, unknown>;
    if (ctx.sanitizedBody) {
      body = ctx.sanitizedBody as Record<string, unknown>;
    } else {
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'INVALID_BODY', message: 'Body JSON inválido.' }, { status: 400 });
      }
    }

    const mode = (body.mode as string) || 'single';

    // ── Single date calculation ──
    if (mode === 'single') {
      const dateStr = body.date as string;
      if (!dateStr) {
        return NextResponse.json({ error: 'VALIDATION', message: 'date é obrigatório para mode=single.' }, { status: 400 });
      }

      const date = new Date(`${dateStr }T12:00:00`);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ error: 'VALIDATION', message: 'date inválido. Use YYYY-MM-DD.' }, { status: 400 });
      }

      const result = await calculateDynamicPrice(
        tenantId,
        (body.roomId as string) ?? null,
        (body.airbPropertyId as string) ?? null,
        date,
        (body.basePrice as number) ?? null,
        (body.occupancyRate as number) ?? null,
      );

      return NextResponse.json({
        success: true,
        data: {
          date: dateStr,
          basePrice: result.basePrice,
          calculatedPrice: result.calculatedPrice,
          modifierBreakdown: result.modifierBreakdown,
          appliedRulesCount: result.appliedRulesCount,
          occupancyAtCalc: result.occupancyAtCalc,
          daysBeforeCheckIn: result.daysBeforeCheckIn,
          isHoliday: result.isHoliday,
          holidayName: result.holidayName,
          seasonLabel: result.seasonLabel,
          dayOfWeekLabel: result.dayOfWeekLabel,
        },
      });
    }

    // ── Batch calculation (date range) ──
    if (mode === 'batch') {
      const startDateStr = body.startDate as string;
      const endDateStr = body.endDate as string;

      if (!startDateStr || !endDateStr) {
        return NextResponse.json({ error: 'VALIDATION', message: 'startDate e endDate são obrigatórios para mode=batch.' }, { status: 400 });
      }

      const startDate = new Date(`${startDateStr }T12:00:00`);
      const endDate = new Date(`${endDateStr }T12:00:00`);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'VALIDATION', message: 'Datas inválidas. Use YYYY-MM-DD.' }, { status: 400 });
      }

      if (startDate > endDate) {
        return NextResponse.json({ error: 'VALIDATION', message: 'startDate deve ser anterior a endDate.' }, { status: 400 });
      }

      // Limit range to 90 days to prevent excessive calculations
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 90) {
        return NextResponse.json({ error: 'VALIDATION', message: 'Range máximo é 90 dias.' }, { status: 400 });
      }

      const results = await batchCalculatePrices(tenantId, startDate, endDate);

      // Flatten results for easier consumption
      const flatResults: Array<{
        roomId: string;
        date: string;
        basePrice: number;
        calculatedPrice: number;
        modifierBreakdown: PricingCalculationResult['modifierBreakdown'];
        appliedRulesCount: number;
        occupancyAtCalc: number;
        daysBeforeCheckIn: number;
        isHoliday: boolean;
        holidayName?: string;
        seasonLabel: string;
        dayOfWeekLabel: string;
      }> = [];

      for (const [roomId, dateMap] of Object.entries(results)) {
        for (const [date, calculation] of Object.entries(dateMap)) {
          flatResults.push({
            roomId,
            date,
            ...calculation,
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          startDate: startDateStr,
          endDate: endDateStr,
          totalDays: daysDiff + 1,
          totalRooms: Object.keys(results).length,
          calculations: flatResults,
        },
      });
    }

    // ── Holidays mode ──
    if (mode === 'holidays') {
      const year = (body.year as number) ?? new Date().getFullYear();
      const holidays = getBrazilianHolidays(year);

      return NextResponse.json({
        success: true,
        data: {
          year,
          holidays,
          totalHolidays: holidays.length,
        },
      });
    }

    return NextResponse.json({ error: 'VALIDATION', message: 'mode inválido. Use: single, batch, holidays.' }, { status: 400 });
  } catch (error) {
    console.error('[DynamicPricing Calculate POST] Error:', error);
    return NextResponse.json({
      success: false,
      error: { code: '500', message: 'Erro ao calcular precificação dinâmica.' },
    }, { status: 500 });
  }
}

// ── Export with Security ───────────────────────────────────────────────

export const POST = withSecurity(handlePost, { routeLabel: 'dynamic-pricing-calculate' });
