import { NextRequest, NextResponse } from 'next/server';
import { drainDeadLetterQueue } from '@/lib/queue/queue-bridge';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON — Drain BullMQ Dead Letter Queue
 * Schedule: every 5 minutes (configured in vercel.json)
 *
 * Logs and removes failed jobs from the DLQ. Production alerting should
 * subscribe to the [QUEUE_BRIDGE] DLQ job drained log entries.
 */
export async function GET(request: NextRequest) {
  const authOk = await verifyCronAuth(request, 'admin:all');
  if (!authOk.ok) {
    return authOk.response ?? NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const result = await drainDeadLetterQueue();
    return NextResponse.json({
      success: true,
      drained: result.drained,
      failed: result.failed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'DLQ_DRAIN_FAILED', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
