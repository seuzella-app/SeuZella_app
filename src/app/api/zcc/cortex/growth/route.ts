// ============================================================================
// GET /api/zcc/cortex/growth — Growth Cortex snapshot
// ============================================================================

import { NextResponse } from 'next/server';
import { GrowthCortex } from '@/domain/cortex';
import { getAdapters } from '@/adapters';

// Singleton Growth Cortex instance for the API.
let _instance: GrowthCortex | undefined;
function getInstance(): GrowthCortex {
  if (!_instance) _instance = new GrowthCortex(getAdapters());
  return _instance;
}

export async function GET() {
  const c = getInstance();
  return NextResponse.json({
    id: c.id,
    running: c.isRunning(),
    snapshot: c.snapshot(),
  });
}
