/**
 * P1-3: API — COMISSÃO INDIVIDUAL
 *
 * PATCH  /api/ddc/airb-pro/commissions/[id]
 *   body: { status?, rate?, basisAmount?, dueDate?, paidAt?, notes? }
 *
 * DELETE /api/ddc/airb-pro/commissions/[id]
 *   → soft delete (status = cancelled)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import { type CommissionStatus } from '@/lib/airb-pro/types';

const VALID_STATUSES: CommissionStatus[] = ['pending', 'payable', 'paid', 'cancelled'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 });
    }

    const dbOk = await isDatabaseAvailable();
    if (!dbOk) {
      return NextResponse.json({
        success: true,
        data: { id, ...body, updatedAt: new Date() },
        meta: { source: 'demo' },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status)) {
      updateData.status = body.status;
      if (body.status === 'paid' && !body.paidAt) {
        updateData.paidAt = new Date();
      }
    }
    if (typeof body.rate === 'number' && body.rate >= 0) updateData.rate = body.rate;
    if (typeof body.basisAmount === 'number' && body.basisAmount >= 0) updateData.basisAmount = body.basisAmount;
    if (body.dueDate) updateData.dueDate = new Date(body.dueDate);
    if (body.paidAt) updateData.paidAt = new Date(body.paidAt);
    if (typeof body.notes === 'string') updateData.notes = body.notes;
    if (typeof body.partnerName === 'string') updateData.partnerName = body.partnerName;
    if (typeof body.partnerEmail === 'string') updateData.partnerEmail = body.partnerEmail || null;
    if (typeof body.partnerPhone === 'string') updateData.partnerPhone = body.partnerPhone || null;

    const updated = await db.airbCommission.update({
      where: { id, tenantId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[airb-pro/commissions PATCH] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao atualizar comissão' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }
    const { id } = await params;

    const dbOk = await isDatabaseAvailable();
    if (!dbOk) {
      return NextResponse.json({ success: true, meta: { source: 'demo' } });
    }

    await db.airbCommission.update({
      where: { id, tenantId },
      data: { status: 'cancelled' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[airb-pro/commissions DELETE] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao cancelar comissão' }, { status: 500 });
  }
}
