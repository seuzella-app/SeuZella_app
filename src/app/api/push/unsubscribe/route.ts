import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { removePushSubscription } from '@/lib/push/push-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/push/unsubscribe
 * Body: { endpoint }
 *
 * Deactivates a browser push subscription (marks isActive=false).
 */
export async function POST(request: NextRequest) {
  const tenantId = await resolveTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body?.endpoint || typeof body.endpoint !== 'string') {
      return NextResponse.json({ error: 'MISSING_ENDPOINT' }, { status: 400 });
    }

    const result = await removePushSubscription(body.endpoint);
    if (!result.success) {
      return NextResponse.json({ error: 'DB_UNAVAILABLE' }, { status: 503 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
