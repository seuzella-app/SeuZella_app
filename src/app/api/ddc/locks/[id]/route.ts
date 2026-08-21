import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { getLockDevice, updateLockDevice, deleteLockDevice } from '@/lib/locks/orchestrator';

function safeErrorResponse(status = 500) {
  return NextResponse.json(
    { success: false, error: 'LOCK_DEVICE_OPERATION_FAILED' },
    { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await resolveTenantId())) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    const { id } = await params;
    if (!id || id.length > 128) return NextResponse.json({ success: false, error: 'INVALID_DEVICE_ID' }, { status: 400 });

    const device = await getLockDevice(id);
    if (!device) return NextResponse.json({ success: false, error: 'LOCK_DEVICE_NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ success: true, data: device }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[LOCKS] Error fetching device:', error);
    return safeErrorResponse(503);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await resolveTenantId())) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    const { id } = await params;
    if (!id || id.length > 128) return NextResponse.json({ success: false, error: 'INVALID_DEVICE_ID' }, { status: 400 });

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > 16 * 1024) return NextResponse.json({ success: false, error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ success: false, error: 'INVALID_JSON_BODY' }, { status: 400 }); }
    if (!body || typeof body !== 'object') return NextResponse.json({ success: false, error: 'INVALID_PAYLOAD' }, { status: 400 });

    const source = body as Record<string, unknown>;
    const updates: Record<string, string> = {};
    for (const field of ['nickname', 'location', 'notes', 'status', 'model'] as const) {
      const value = source[field];
      if (value !== undefined) {
        if (typeof value !== 'string' || value.length > 500) return NextResponse.json({ success: false, error: 'INVALID_FIELD_VALUE' }, { status: 400 });
        updates[field] = value;
      }
    }
    if (!Object.keys(updates).length) return NextResponse.json({ success: false, error: 'NO_FIELDS_TO_UPDATE' }, { status: 400 });

    const device = await updateLockDevice(id, updates);
    if (!device) return NextResponse.json({ success: false, error: 'LOCK_DEVICE_NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ success: true, data: device }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[LOCKS] Error updating device:', error);
    return safeErrorResponse(503);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await resolveTenantId())) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    const { id } = await params;
    if (!id || id.length > 128) return NextResponse.json({ success: false, error: 'INVALID_DEVICE_ID' }, { status: 400 });

    const ok = await deleteLockDevice(id);
    if (!ok) return NextResponse.json({ success: false, error: 'LOCK_DEVICE_NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[LOCKS] Error deleting device:', error);
    return safeErrorResponse(503);
  }
}
