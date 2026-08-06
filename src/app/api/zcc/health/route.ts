// ============================================================================
// GET /api/zcc/health — full cognitive-stack health snapshot
// ============================================================================

import { NextResponse } from 'next/server';
import { zcc, zcb, sharedMemory } from '@/domain/zcc';
import { resolveModeMap } from '@/adapters';
import { isDigitalTwinBooted } from '@/simulation';

export async function GET() {
  return NextResponse.json({
    booted: isDigitalTwinBooted(),
    zcc: zcc.health(),
    cognitiveBus: {
      size: zcb.size(),
    },
    cognitiveMemory: {
      size: sharedMemory.size(),
    },
    adapterModes: resolveModeMap(),
    timestamp: new Date().toISOString(),
  });
}
