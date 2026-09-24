import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

export async function POST(request: NextRequest) {
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
