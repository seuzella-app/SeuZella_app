// ============================================================================
// POST /api/zcc/national-simulator/compare — compare multiple cities
// Body: { cities: string[], leadCount?, adsDays?, seed? }
// ============================================================================

import { NextResponse } from 'next/server';
import { nationalSimulator } from '@/simulation';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!Array.isArray(body.cities) || body.cities.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'cities[] required' },
        { status: 400 }
      );
    }
    const result = await nationalSimulator.compare(body.cities, {
      leadCount: body.leadCount,
      adsDays: body.adsDays,
      seed: body.seed,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
