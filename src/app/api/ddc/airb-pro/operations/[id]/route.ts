/**
 * P1-1: API — OPERAÇÃO INDIVIDUAL (atualizar status, iniciar, completar)
 *
 * PATCH  /api/ddc/airb-pro/operations/[id]
 *   body: { status?, priority?, assignedTo?, scheduledFor?, checklist?, actualMin? }
 *
 * DELETE /api/ddc/airb-pro/operations/[id]
 *   → soft delete (status = cancelled)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import { type OperationTaskStatus } from '@/lib/airb-pro/types';

const VALID_STATUSES: OperationTaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

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
      // Auto-set timestamps based on status transitions
      if (body.status === 'in_progress' && !body.startedAt) {
        updateData.startedAt = new Date();
      }
      if (body.status === 'completed' && !body.completedAt) {
        updateData.completedAt = new Date();
      }
    }
    if (typeof body.priority === 'string') updateData.priority = body.priority;
    if (typeof body.assignedTo === 'string') updateData.assignedTo = body.assignedTo || null;
    if (body.scheduledFor) updateData.scheduledFor = new Date(body.scheduledFor);
    if (typeof body.actualMin === 'number') updateData.actualMin = body.actualMin;
    if (Array.isArray(body.checklist)) updateData.checklist = JSON.stringify(body.checklist);
    if (typeof body.estimatedMin === 'number') updateData.estimatedMin = body.estimatedMin;
    if (typeof body.cost === 'number') updateData.cost = body.cost;
    if (typeof body.description === 'string') updateData.description = body.description;

    const updated = await db.airbOperationTask.update({
      where: { id, tenantId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        checklist: updated.checklist ? JSON.parse(updated.checklist) : [],
        metadata: updated.metadata ? JSON.parse(updated.metadata) : {},
      },
    });
  } catch (error) {
    console.error('[airb-pro/operations PATCH] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao atualizar tarefa' }, { status: 500 });
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

    // Soft delete → status = cancelled
    await db.airbOperationTask.update({
      where: { id, tenantId },
      data: { status: 'cancelled' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[airb-pro/operations DELETE] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao cancelar tarefa' }, { status: 500 });
  }
}
