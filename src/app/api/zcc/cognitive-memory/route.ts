// ============================================================================
// GET /api/zcc/cognitive-memory — query the Shared Cognitive Memory
// Query: ?type=&publisher=&status=&minConfidence=&validAt=&limit=
// ============================================================================

import { NextResponse } from 'next/server';
import { sharedMemory } from '@/domain/zcc';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? undefined;
  const publisher = url.searchParams.get('publisher') as any;
  const status = url.searchParams.get('status') as any;
  const minConfidence = url.searchParams.get('minConfidence')
    ? parseFloat(url.searchParams.get('minConfidence')!)
    : undefined;
  const validAt = url.searchParams.get('validAt') ?? undefined;
  const limit = url.searchParams.get('limit')
    ? parseInt(url.searchParams.get('limit')!)
    : 1000;
  const entries = sharedMemory.query({
    type,
    publisher,
    status,
    minConfidence,
    validAt,
    limit,
  });
  return NextResponse.json({
    totalEntries: sharedMemory.size(),
    returned: entries.length,
    entries,
  });
}
