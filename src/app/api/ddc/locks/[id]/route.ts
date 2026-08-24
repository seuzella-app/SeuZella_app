import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { getLockDevice, updateLockDevice, deleteLockDevice } from '@/lib/locks/orchestrator';
import { assignLockToRoom } from '@/lib/locks/room-assignment';

function safeErrorResponse(status = 500) {
  return NextResponse.json({ success: false, error: 'LOCK_DEVICE_OPERATION_FAILED' }, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await resolveTenantId())) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    const { id } = await params;
    if (!id || id.length > 128) return NextResponse.json({ success: false, error: 'INVALID_DEVICE_ID' }, { status: 400 });
    const device = await getLockDevice(id);
    if (!device) return NextResponse.json({ success: false, error: 'LOCK_DEVICE_NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ success: true, data: device }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { console.error('[LOCKS] Error fetching device:', error); return safeErrorResponse(503); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    const { id } = await params;
    if (!id || id.length > 128) return NextResponse.json({ success: false, error: 'INVALID_DEVICE_ID' }, { status: 400 });
    const owned = await getLockDevice(id);
    if (!owned) return NextResponse.json({ success: false, error: 'LOCK_DEVICE_NOT_FOUND' }, { status: 404 });
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > 16 * 1024) return NextResponse.json({ success: false, error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ success: false, error: 'INVALID_JSON_BODY' }, { status: 400 }); }
    if (!body || typeof body !== 'object') return NextResponse.json({ success: false, error: 'INVALID_PAYLOAD' }, { status: 400 });
    const source = body as Record<string, unknown>;

    if (source.roomId !== undefined) {
      if (source.roomId !== null && (typeof source.roomId !== 'string' || source.roomId.trim().length > 128)) {
        return NextResponse.json({ success: false, error: 'INVALID_ROOM_ID' }, { status: 400 });
      }
      try {
        await assignLockToRoom({ tenantId, deviceId: id, roomId: source.roomId === null ? null : String(source.roomId).trim() });
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'ROOM_NOT_FOUND') return NextResponse.json({ success: false, error: 'ROOM_NOT_FOUND' }, { status: 404 });
        if (message === 'LOCK_DEVICE_NOT_FOUND') return NextResponse.json({ success: false, error: 'LOCK_DEVICE_NOT_FOUND' }, { status: 404 });
        throw error;
      }
    }

    const limits: Record<string, number> = { nickname: 120, location: 200, notes: 500, status: 32, model: 120 };
    const updates: Record<string, string> = {};
    for (const field of Object.keys(limits)) {
      const value = source[field];
      if (value !== undefined) {
        if (typeof value !== 'string' || value.trim().length > limits[field]) return NextResponse.json({ success: false, error: 'INVALID_FIELD_VALUE' }, { status: 400 });
        updates[field] = value.trim();
      }
    }
    if (updates.status && !['active', 'inactive', 'offline', 'error'].includes(updates.status)) return NextResponse.json({ success: false, error: 'INVALID_DEVICE_STATUS' }, { status: 400 });
    if (Object.keys(updates).length) {
      const device = await updateLockDevice(id, updates);
      if (!device) return NextResponse.json({ success: false, error: 'LOCK_DEVICE_NOT_FOUND' }, { status: 404 });
      return NextResponse.json({ success: true, data: device, roomAssignmentUpdated: source.roomId !== undefined }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    return NextResponse.json({ success: true, data: await getLockDevice(id), roomAssignmentUpdated: source.roomId !== undefined }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { console.error('[LOCKS] Error updating device:', error); return safeErrorResponse(503); }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await resolveTenantId())) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    const { id } = await params;
    if (!id || id.length > 128) return NextResponse.json({ success: false, error: 'INVALID_DEVICE_ID' }, { status: 400 });
    const owned = await getLockDevice(id);
    if (!owned) return NextResponse.json({ success: false, error: 'LOCK_DEVICE_NOT_FOUND' }, { status: 404 });
    const ok = await deleteLockDevice(id);
    return NextResponse.json({ success: ok }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.error('[LOCKS] Error deleting device:', error); return safeErrorResponse(503); }
}
