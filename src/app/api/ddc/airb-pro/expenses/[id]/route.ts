/**
 * P0-2: API — DESPESA INDIVIDUAL (atualizar/deletar)
 *
 * PATCH  /api/ddc/airb-pro/expenses/[id]
 *   body: { status?, amount?, description?, category?, paidAt?, ... }
 *
 * DELETE /api/ddc/airb-pro/expenses/[id]
 *   → soft delete (status = cancelled)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import { type ExpenseStatus, type ExpenseCategory } from '@/lib/airb-pro/types';

const VALID_STATUSES: ExpenseStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];
const VALID_CATEGORIES: ExpenseCategory[] = [
  'fixed_cost', 'variable', 'maintenance', 'utilities', 'marketing', 'commission', 'tax', 'other',
];

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
    if (typeof body.category === 'string' && VALID_CATEGORIES.includes(body.category)) {
      updateData.category = body.category;
    }
    if (typeof body.description === 'string') updateData.description = body.description;
    if (typeof body.amount === 'number' && body.amount >= 0) updateData.amount = body.amount;
    if (body.dueDate) updateData.dueDate = new Date(body.dueDate);
    if (body.paidAt) updateData.paidAt = new Date(body.paidAt);
    if (typeof body.recurrence === 'string') updateData.recurrence = body.recurrence;
    if (typeof body.document === 'string') updateData.document = body.document;
    if (body.metadata) updateData.metadata = JSON.stringify(body.metadata);

    const updated = await db.airbExpense.update({
      where: { id, tenantId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[airb-pro/expenses PATCH] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao atualizar despesa' }, { status: 500 });
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

    await db.airbExpense.update({
      where: { id, tenantId },
      data: { status: 'cancelled' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[airb-pro/expenses DELETE] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao cancelar despesa' }, { status: 500 });
  }
}
