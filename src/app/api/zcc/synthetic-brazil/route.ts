// ============================================================================
// GET /api/zcc/synthetic-brazil — list anchor cities
// POST /api/zcc/synthetic-brazil/generate — generate a Synthetic Brazil slice
// ============================================================================

import { NextResponse } from 'next/server';
import { ANCHOR_CITIES, BRAZILIAN_STATES, generateSyntheticBrazil } from '@/simulation';

export async function GET() {
  return NextResponse.json({
    states: BRAZILIAN_STATES,
    anchorCities: ANCHOR_CITIES,
    anchorCityCount: ANCHOR_CITIES.length,
    stateCount: BRAZILIAN_STATES.length,
  });
}
