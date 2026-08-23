/**
 * GET /api/airb-pro/yield-suggestion
 *
 * Sugere preço de diária para imóvel Airbnb com base em:
 *   - Sazonalidade (alta/baixa temporada)
 *   - Feriados brasileiros (Réveillon, Carnaval, Natal, etc)
 *   - Ocupação histórica do imóvel
 *   - Preço base cadastrado
 *
 * Query: ?basePrice=350&dates=2026-12-30,2026-12-31,2027-01-01&totalRooms=1&occupiedRooms=0
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { computeYieldCitationForStay } from '@/lib/cerebro/yield-citation-hook';

async function getHandler(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const basePrice = parseFloat(searchParams.get('basePrice') || '350');
  const datesStr = searchParams.get('dates') || '';
  const totalRooms = parseInt(searchParams.get('totalRooms') || '1', 10);
  const occupiedRooms = parseInt(searchParams.get('occupiedRooms') || '0', 10);

  if (!datesStr || basePrice <= 0) {
    return NextResponse.json(
      { error: 'MISSING_PARAMS', message: 'basePrice e dates são obrigatórios' },
      { status: 400 },
    );
  }

  const dates = datesStr.split(',').map(d => new Date(d.trim())).filter(d => !isNaN(d.getTime()));

  if (dates.length === 0) {
    return NextResponse.json({ error: 'INVALID_DATES' }, { status: 400 });
  }

  const yieldResponse = computeYieldCitationForStay({
    baseDailyRate: basePrice,
    totalRooms,
    occupiedRooms,
    dates,
    autoDetectHoliday: true,
  });

  return NextResponse.json({
    success: true,
    data: {
      totalPrice: yieldResponse.totalPriceBrl,
      baseTotal: yieldResponse.baseTotalBrl,
      extraProfit: yieldResponse.extraProfitBrl,
      hasSurge: yieldResponse.hasSurgeApplied,
      hasScarcity: yieldResponse.hasScarcityLock,
      citations: yieldResponse.citations,
      calculations: yieldResponse.calculations,
      engineEnabled: yieldResponse.engineEnabled,
    },
  });
}

export const GET = getHandler;
