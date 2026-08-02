import { NextRequest, NextResponse } from 'next/server';
import {
  getLockDevice,
  updateLockDevice,
  deleteLockDevice,
} from '@/lib/locks/orchestrator';

// GET /api/ddc/locks/[id] — Detalhes de um dispositivo
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const device = await getLockDevice(id);
    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Dispositivo não encontrado' },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: device });
  } catch (error) {
    console.error('[LOCKS] Error fetching device:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lock device' },
      { status: 500 },
    );
  }
}

// PATCH /api/ddc/locks/[id] — Atualiza um dispositivo
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nickname, location, notes, status, model } = body;

    const updates: any = {};
    if (nickname !== undefined) updates.nickname = nickname;
    if (location !== undefined) updates.location = location;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) updates.status = status;
    if (model !== undefined) updates.model = model;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhum campo para atualizar' },
        { status: 400 },
      );
    }

    const device = await updateLockDevice(id, updates);
    return NextResponse.json({ success: true, data: device });
  } catch (error) {
    console.error('[LOCKS] Error updating device:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to update lock device' },
      { status: 500 },
    );
  }
}

// DELETE /api/ddc/locks/[id] — Remove um dispositivo (revoga todos os PINs)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ok = await deleteLockDevice(id);
    return NextResponse.json({ success: ok });
  } catch (error) {
    console.error('[LOCKS] Error deleting device:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to delete lock device' },
      { status: 500 },
    );
  }
}
