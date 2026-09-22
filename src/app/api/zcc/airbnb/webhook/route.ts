import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function POST(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 120 req/1min.
  const rlDeny = guardRequest(request, 'zcc.airbnb.webhook', { points: 120, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.airbnb.webhook', what: 'zcc.airbnb.webhook.entry', resource: 'api', result: 'ALLOW' });
  // [RUN9-W2 9C] fail-closed webhook token guard (patch RUN9_W2 V2)
  {
    const __wbToken = request.headers.get('x-airbnb-webhook-token');
    const __wbSecret = process.env.AIRBNB_WEBHOOK_SECRET;
    if (!__wbSecret || !__wbToken || __wbToken !== __wbSecret) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED_WEBHOOK' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }
  }

  // ── Security Gate V3 — 6-Layer Protection ──
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {

    const body = await request.json();
    const { tenantId, eventType, payload } = body as {
      tenantId: string;
      eventType: string;
      payload?: object;
    };

    if (!tenantId || !eventType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tenantId, eventType' },
        { status: 400 }
      );
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Create AirbnbWebhookEvent record
    const webhookEvent = await db.airbnbWebhookEvent.create({
      data: {
        tenantId,
        eventType,
        payload: JSON.stringify(payload ?? {}),
        processed: false,
        mockTriggered: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: webhookEvent,
    });
  } catch (error) {
    console.error('[ZCC Airbnb Webhook] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
