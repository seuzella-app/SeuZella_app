/**
 * P1-1: API — OPERAÇÕES (LIMPEZA, MANUTENÇÃO, CHECKLIST)
 *
 * GET    /api/ddc/airb-pro/operations          → lista tarefas (com filtros)
 * POST   /api/ddc/airb-pro/operations          → cria tarefa
 *
 * Filtros:
 *   - type: cleaning|maintenance|inspection|restock|other
 *   - status: pending|in_progress|completed|cancelled
 *   - priority: low|normal|high|urgent
 *   - propertyId: filtra por imóvel
 *   - upcoming=true: apenas tarefas agendadas para hoje/futuro
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import {
  type OperationTaskInput,
  type OperationTaskType,
  type OperationTaskStatus,
  type OperationTaskPriority,
  type ChecklistItem,
  DEFAULT_CLEANING_CHECKLIST,
  DEFAULT_MAINTENANCE_CHECKLIST,
} from '@/lib/airb-pro/types';

const VALID_TYPES: OperationTaskType[] = ['cleaning', 'maintenance', 'inspection', 'restock', 'other'];
const VALID_STATUSES: OperationTaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];
const VALID_PRIORITIES: OperationTaskPriority[] = ['low', 'normal', 'high', 'urgent'];

function validateInput(body: unknown): { input?: OperationTaskInput; error?: string } {
  if (!body || typeof body !== 'object') return { error: 'Body inválido' };
  const b = body as Record<string, unknown>;
  if (typeof b.title !== 'string' || b.title.trim().length === 0) {
    return { error: 'title é obrigatório' };
  }
  if (typeof b.type !== 'string' || !VALID_TYPES.includes(b.type as OperationTaskType)) {
    return { error: `type deve ser um de: ${VALID_TYPES.join(', ')}` };
  }
  if (b.priority && !VALID_PRIORITIES.includes(b.priority as OperationTaskPriority)) {
    return { error: `priority deve ser um de: ${VALID_PRIORITIES.join(', ')}` };
  }

  const input: OperationTaskInput = {
    propertyId: b.propertyId as string | undefined,
    type: b.type as OperationTaskType,
    priority: (b.priority as OperationTaskPriority) || 'normal',
    title: b.title as string,
    description: (b.description as string) || '',
    assignedTo: b.assignedTo as string | undefined,
    scheduledFor: b.scheduledFor ? new Date(b.scheduledFor as string) : undefined,
    estimatedMin: typeof b.estimatedMin === 'number' ? b.estimatedMin : 60,
    checklist: b.checklist as ChecklistItem[] | undefined,
    cost: typeof b.cost === 'number' ? b.cost : 0,
    metadata: b.metadata as Record<string, unknown> | undefined,
  };

  // Aplica checklist default se não fornecido
  if (!input.checklist || input.checklist.length === 0) {
    if (input.type === 'cleaning') {
      input.checklist = [...DEFAULT_CLEANING_CHECKLIST.map(c => ({ ...c }))];
    } else if (input.type === 'maintenance') {
      input.checklist = [...DEFAULT_MAINTENANCE_CHECKLIST.map(c => ({ ...c }))];
    } else {
      input.checklist = [];
    }
  }

  return { input };
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
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const propertyId = searchParams.get('propertyId');
    const upcoming = searchParams.get('upcoming') === 'true';
    const limit = Math.min(500, parseInt(searchParams.get('limit') || '100', 10));

    const dbOk = await isDatabaseAvailable();
    if (!dbOk) {
      const demoTasks = [
        { id: 'demo-1', tenantId, propertyId: null, type: 'cleaning', status: 'pending', priority: 'high', title: 'Limpeza pós-checkout — Suíte Master', description: '', assignedTo: 'Maria (camareira)', scheduledFor: new Date(Date.now() + 3600000), startedAt: null, completedAt: null, estimatedMin: 90, actualMin: null, checklist: DEFAULT_CLEANING_CHECKLIST, cost: 50, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'demo-2', tenantId, propertyId: null, type: 'maintenance', status: 'in_progress', priority: 'urgent', title: 'Reparo de vazamento — Banheiro Chalé', description: 'Vazamento na torneira do banheiro', assignedTo: 'João (zelador)', scheduledFor: new Date(), startedAt: new Date(), completedAt: null, estimatedMin: 120, actualMin: null, checklist: DEFAULT_MAINTENANCE_CHECKLIST, cost: 150, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'demo-3', tenantId, propertyId: null, type: 'inspection', status: 'completed', priority: 'normal', title: 'Inspeção mensal — Extintores', description: '', assignedTo: 'Pedro (encarregado)', scheduledFor: new Date(Date.now() - 86400000), startedAt: new Date(Date.now() - 86400000), completedAt: new Date(Date.now() - 86400000 + 3600000), estimatedMin: 60, actualMin: 45, checklist: [], cost: 0, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
      ];
      return NextResponse.json({ success: true, data: demoTasks, meta: { source: 'demo' } });
    }

    const where: Record<string, unknown> = { tenantId };
    if (type && VALID_TYPES.includes(type as OperationTaskType)) where.type = type;
    if (status && VALID_STATUSES.includes(status as OperationTaskStatus)) where.status = status;
    if (priority && VALID_PRIORITIES.includes(priority as OperationTaskPriority)) where.priority = priority;
    if (propertyId) where.propertyId = propertyId;
    if (upcoming) {
      where.scheduledFor = { gte: new Date() };
    }

    const tasks = await db.airbOperationTask.findMany({
      where: where as any,
      orderBy: [
        { priority: 'desc' },
        { scheduledFor: 'asc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: tasks.map(t => ({
        ...t,
        checklist: t.checklist ? JSON.parse(t.checklist) : [],
        metadata: t.metadata ? JSON.parse(t.metadata) : {},
      })),
      meta: { total: tasks.length, source: 'db' },
    });
  } catch (error) {
    console.error('[airb-pro/operations GET] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao listar tarefas' }, { status: 500 });
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
    const { input, error } = validateInput(body);
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
          status: 'pending',
          startedAt: null,
          completedAt: null,
          actualMin: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        meta: { source: 'demo' },
      });
    }

    const created = await db.airbOperationTask.create({
      data: {
        tenantId,
        propertyId: input.propertyId || null,
        type: input.type,
        status: 'pending',
        priority: input.priority || 'normal',
        title: input.title,
        description: input.description || '',
        assignedTo: input.assignedTo || null,
        scheduledFor: input.scheduledFor || null,
        estimatedMin: input.estimatedMin || 60,
        checklist: JSON.stringify(input.checklist || []),
        cost: input.cost || 0,
        metadata: input.metadata ? JSON.stringify(input.metadata) : '{}',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...created,
        checklist: JSON.parse(created.checklist),
        metadata: JSON.parse(created.metadata),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[airb-pro/operations POST] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao criar tarefa' }, { status: 500 });
  }
}
