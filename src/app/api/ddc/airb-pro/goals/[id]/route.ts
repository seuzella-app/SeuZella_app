/**
 * P1-2: API — META INDIVIDUAL
 *
 * PATCH  /api/ddc/airb-pro/goals/[id]
 *   body: { targetValue?, currentValue?, status?, notes?, endDate? }
 *
 * DELETE /api/ddc/airb-pro/goals/[id]
 *   → soft delete (status = paused)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import { type GoalStatus } from '@/lib/airb-pro/types';

const VALID_STATUSES: GoalStatus[] = ['active', 'achieved', 'missed', 'paused'];

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
    if (typeof body.targetValue === 'number' && body.targetValue >= 0) updateData.targetValue = body.targetValue;
    if (typeof body.currentValue === 'number' && body.currentValue >= 0) updateData.currentValue = body.currentValue;
    if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status)) updateData.status = body.status;
    if (typeof body.notes === 'string') updateData.notes = body.notes;
    if (body.endDate) updateData.endDate = new Date(body.endDate);
    if (body.startDate) updateData.startDate = new Date(body.startDate);

    const updated = await db.airbGoal.update({
      where: { id, tenantId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[airb-pro/goals PATCH] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao atualizar meta' }, { status: 500 });
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

    await db.airbGoal.update({
      where: { id, tenantId },
      data: { status: 'paused' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[airb-pro/goals DELETE] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao pausar meta' }, { status: 500 });
  }
}
