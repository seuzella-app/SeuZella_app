/**
 * P0-2: API — GESTÃO FINANCEIRA (DESPESAS)
 *
 * GET    /api/ddc/airb-pro/expenses          → lista despesas (com filtros)
 * POST   /api/ddc/airb-pro/expenses          → cria despesa
 *
 * Filtros suportados (query string):
 *   - category: fixed_cost|variable|maintenance|utilities|marketing|commission|tax|other
 *   - status: pending|paid|overdue|cancelled
 *   - startDate, endDate: filtro por data de vencimento
 *   - search: busca textual na descrição
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import { withApiGuard } from '@/lib/security/api-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  type ExpenseInput,
  type ExpenseCategory,
  type ExpenseStatus,
  EXPENSE_CATEGORY_LABELS,
  formatBRL,
} from '@/lib/airb-pro/types';

const VALID_CATEGORIES: ExpenseCategory[] = [
  'fixed_cost', 'variable', 'maintenance', 'utilities', 'marketing', 'commission', 'tax', 'other',
];

const VALID_STATUSES: ExpenseStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];

function validateExpenseInput(body: unknown): { input?: ExpenseInput; error?: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Body inválido' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.description !== 'string' || b.description.trim().length === 0) {
    return { error: 'description é obrigatório' };
  }
  if (typeof b.amount !== 'number' || b.amount < 0) {
    return { error: 'amount deve ser um número positivo' };
  }
  if (typeof b.category !== 'string' || !VALID_CATEGORIES.includes(b.category as ExpenseCategory)) {
    return { error: `category deve ser um de: ${VALID_CATEGORIES.join(', ')}` };
  }
  if (b.status && !VALID_STATUSES.includes(b.status as ExpenseStatus)) {
    return { error: `status deve ser um de: ${VALID_STATUSES.join(', ')}` };
  }

  const input: ExpenseInput = {
    category: b.category as ExpenseCategory,
    description: b.description as string,
    amount: b.amount as number,
    dueDate: b.dueDate ? new Date(b.dueDate as string) : undefined,
    paidAt: b.paidAt ? new Date(b.paidAt as string) : undefined,
    status: b.status as ExpenseStatus | undefined,
    recurrence: b.recurrence as ExpenseInput['recurrence'],
    document: b.document as string | undefined,
    metadata: b.metadata as Record<string, unknown> | undefined,
  };
  return { input };
}

function detectOverdueStatus(expense: { status: string; dueDate: Date | null }): string {
  if (expense.status !== 'pending') return expense.status;
  if (!expense.dueDate) return expense.status;
  if (new Date(expense.dueDate) < new Date()) return 'overdue';
  return expense.status;
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const limit = Math.min(500, parseInt(searchParams.get('limit') || '100', 10));

    const dbOk = await isDatabaseAvailable();
    if (!dbOk) {
      // Demo data
      const demoExpenses = [
        { id: 'demo-1', tenantId, category: 'fixed_cost', description: 'Aluguel do espaço', amount: 3500, status: 'paid', dueDate: new Date(), paidAt: new Date(), recurrence: 'monthly', document: null, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'demo-2', tenantId, category: 'utilities', description: 'Conta de luz', amount: 480, status: 'pending', dueDate: new Date(Date.now() + 86400000 * 5), paidAt: null, recurrence: 'monthly', document: null, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'demo-3', tenantId, category: 'maintenance', description: 'Conserto de ar-condicionado', amount: 350, status: 'paid', dueDate: null, paidAt: new Date(), recurrence: 'one_time', document: null, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'demo-4', tenantId, category: 'variable', description: 'Produtos de limpeza', amount: 220, status: 'pending', dueDate: new Date(Date.now() + 86400000 * 2), paidAt: null, recurrence: 'weekly', document: null, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
      ];
      return NextResponse.json({ success: true, data: demoExpenses, meta: { source: 'demo' } });
    }

    const where: Record<string, unknown> = { tenantId };
    if (category && VALID_CATEGORIES.includes(category as ExpenseCategory)) {
      where.category = category;
    }
    if (status && VALID_STATUSES.includes(status as ExpenseStatus)) {
      where.status = status;
    }
    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) (where.dueDate as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.dueDate as Record<string, unknown>).lte = new Date(endDate);
    }
    if (search) {
      where.description = { contains: search };
    }

    const expenses = await db.airbExpense.findMany({
      where: where as any,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });

    // Auto-detect overdue
    const withOverdue = expenses.map(e => ({
      ...e,
      status: detectOverdueStatus(e),
    }));

    return NextResponse.json({
      success: true,
      data: withOverdue,
      meta: { total: withOverdue.length, source: 'db' },
    });
  } catch (error) {
    console.error('[airb-pro/expenses GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao listar despesas' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const { input, error } = validateExpenseInput(body);
    if (error || !input) {
      return NextResponse.json({ success: false, error: error || 'Input inválido' }, { status: 400 });
    }

    const dbOk = await isDatabaseAvailable();
    if (!dbOk) {
      return NextResponse.json({
        success: true,
        data: {
          id: `demo-${Date.now()}`,
          tenantId,
          ...input,
          status: input.status || 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        meta: { source: 'demo' },
      });
    }

    const created = await db.airbExpense.create({
      data: {
        tenantId,
        category: input.category,
        description: input.description,
        amount: input.amount,
        dueDate: input.dueDate || null,
        paidAt: input.paidAt || null,
        status: input.status || 'pending',
        recurrence: input.recurrence || 'one_time',
        document: input.document || null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : '{}',
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error('[airb-pro/expenses POST] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao criar despesa' },
      { status: 500 },
    );
  }
}
