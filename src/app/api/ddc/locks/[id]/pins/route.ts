import { NextRequest, NextResponse } from 'next/server';
import { generatePin, listPins } from '@/lib/locks/orchestrator';
import { calculatePinValidityWindow } from '@/lib/locks/pin-generator';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { publishTenantEvent } from '@/lib/realtime/tenant-pubsub';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_ID_LENGTH = 128;

// GET /api/ddc/locks/[id]/pins — Lista PINs do dispositivo
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id || id.length > MAX_ID_LENGTH) {
      return NextResponse.json({ error: 'Invalid lock device' }, { status: 400 });
    }

    // listPins/orchestrator is responsible for resolving the device inside
    // the authenticated tenant boundary. Never accept a tenantId from the client.
    const pins = await listPins(id);
    return NextResponse.json(
      { success: true, data: pins },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('[LOCKS] Error listing pins:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list lock pins' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

// POST /api/ddc/locks/[id]/pins — Gera um novo PIN
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id || id.length > MAX_ID_LENGTH) {
      return NextResponse.json({ success: false, error: 'Invalid lock device' }, { status: 400 });
    }

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ success: false, error: 'INVALID_JSON_BODY' }, { status: 400 });
    }

    const stringField = (name: string, max: number) => {
      const value = body[name];
      if (value === undefined || value === null) return undefined;
      if (typeof value !== 'string' || value.trim().length > max) throw new Error(`INVALID_${name.toUpperCase()}`);
      return value.trim();
    };

    const guestName = stringField('guestName', 160);
    const guestPhone = stringField('guestPhone', 40);
    const bookingId = stringField('bookingId', 128);
    const manualPin = stringField('manualPin', 16);
    const note = stringField('note', 500);
    const validFrom = stringField('validFrom', 64);
    const validTo = stringField('validTo', 64);
    const checkInDate = stringField('checkInDate', 32);
    const checkOutDate = stringField('checkOutDate', 32);
    const checkInTime = stringField('checkInTime', 16) ?? '14:00';
    const checkOutTime = stringField('checkOutTime', 16) ?? '11:00';

    if (manualPin && !/^\d{4,12}$/.test(manualPin)) {
      return NextResponse.json({ success: false, error: 'INVALID_PIN_FORMAT' }, { status: 400 });
    }

    let from: Date;
    let to: Date;

    if (validFrom && validTo) {
      from = new Date(validFrom);
      to = new Date(validTo);
    } else if (checkInDate && checkOutDate) {
      const window = calculatePinValidityWindow(checkInDate, checkOutDate, checkInTime, checkOutTime);
      from = window.validFrom;
      to = window.validTo;
    } else {
      return NextResponse.json(
        { success: false, error: 'Forneça validFrom+validTo OU checkInDate+checkOutDate' },
        { status: 400 },
      );
    }

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return NextResponse.json({ success: false, error: 'INVALID_VALIDITY_WINDOW' }, { status: 400 });
    }

    const result = await generatePin({
      deviceId: id,
      guestName,
      guestPhone,
      bookingId,
      validFrom: from,
      validTo: to,
      manualPin,
      autoGenerate: body.autoGenerate === true,
      note,
    });

    // Publish realtime event AFTER DB write succeeds — Desktop DDC and
    // Mobile DDC subscribed to this tenant receive the new PIN instantly.
    // Payload excludes the raw PIN value for defense-in-depth (clients
    // already have it via the response; the realtime event is for UI sync).
    publishTenantEvent(tenantId, 'pin:created', {
      deviceId: id,
      pinId: result.code?.id,
      guestName,
      guestPhone,
      validFrom: from.toISOString(),
      validTo: to.toISOString(),
      bookingId,
    });

    return NextResponse.json(
      { success: true, data: result },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('INVALID_')) {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    if (message === 'PIN_RATE_LIMIT_EXCEEDED') {
      return NextResponse.json(
        { success: false, error: 'PIN_RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '3600' } },
      );
    }
    console.error('[LOCKS] Error generating pin:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate lock pin' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
