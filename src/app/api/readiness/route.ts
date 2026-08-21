/**
 * GET /api/readiness
 * Public orchestration probe. Detailed dependency diagnostics remain internal.
 */

import { NextResponse } from 'next/server';
import { checkSystemHealth } from '@/lib/monitoring/health';

export async function GET() {
  try {
    const health = await checkSystemHealth();
    const ready = health.status !== 'down';

    return NextResponse.json(
      { ready, status: health.status },
      {
        status: ready ? 200 : 503,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      }
    );
  } catch (error) {
    console.error('[Readiness] check failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json(
      { ready: false, status: 'down' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      }
    );
  }
}
