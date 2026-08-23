import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { savePushSubscription, type PushSubscriptionPayload } from '@/lib/push/push-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/push/subscribe
 * Body: { endpoint, keys: { p256dh, auth }, userAgent? }
 *
 * Persists a browser push subscription for the authenticated tenant.
 */
export async function POST(request: NextRequest) {
  const tenantId = await resolveTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      return NextResponse.json(
        { error: 'INVALID_SUBSCRIPTION_PAYLOAD' },
        { status: 400 },
      );
    }

    const payload: PushSubscriptionPayload = {
      endpoint: body.endpoint,
      keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
      userAgent: body.userAgent || request.headers.get('user-agent') || undefined,
    };

    const result = await savePushSubscription(tenantId, payload);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'PERSIST_FAILED' },
        { status: 503 },
      );
    }

    return NextResponse.json({ success: true, subscriptionId: result.subscriptionId });
  } catch (err) {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
