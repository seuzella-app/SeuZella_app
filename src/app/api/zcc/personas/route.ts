// ============================================================================
// GET /api/zcc/personas — list available Behavioral Engine personas
// ============================================================================

import { NextResponse } from 'next/server';
import { PERSONAS } from '@/simulation';

export async function GET() {
  return NextResponse.json({
    personas: PERSONAS,
    count: PERSONAS.length,
  });
}
