/**
 * P1-2: API — METAS (GOALS DASHBOARD)
 *
 * GET    /api/ddc/airb-pro/goals          → lista metas com progresso calculado
 * POST   /api/ddc/airb-pro/goals          → cria nova meta
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import {
  type GoalInput,
  type GoalType,
  type GoalPeriod,
  type GoalUnit,
  type GoalProgress,
  type GoalsDashboard,
  GOAL_TYPE_LABELS,
} from '@/lib/airb-pro/types';

const VALID_TYPES: GoalType[] = ['revenue', 'occupancy', 'bookings', 'adr', 'revpar', 'guests', 'reviews'];
const VALID_PERIODS: GoalPeriod[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
const VALID_UNITS: GoalUnit[] = ['BRL', 'percent', 'count'];

function validateInput(body: unknown): { input?: GoalInput; error?: string } {
  if (!body || typeof body !== 'object') return { error: 'Body inválido' };
  const b = body as Record<string, unknown>;
  if (typeof b.type !== 'string' || !VALID_TYPES.includes(b.type as GoalType)) {
    return { error: `type deve ser um de: ${VALID_TYPES.join(', ')}` };
  }
  if (typeof b.period !== 'string' || !VALID_PERIODS.includes(b.period as GoalPeriod)) {
    return { error: `period deve ser um de: ${VALID_PERIODS.join(', ')}` };
  }
  if (typeof b.targetValue !== 'number' || b.targetValue < 0) {
    return { error: 'targetValue deve ser um número positivo' };
  }
  if (!b.startDate || !b.endDate) {
    return { error: 'startDate e endDate são obrigatórios' };
  }
  const startDate = new Date(b.startDate as string);
  const endDate = new Date(b.endDate as string);
  if (startDate >= endDate) {
    return { error: 'endDate deve ser posterior a startDate' };
  }

  const input: GoalInput = {
    type: b.type as GoalType,
    period: b.period as GoalPeriod,
    targetValue: b.targetValue as number,
    currentValue: typeof b.currentValue === 'number' ? b.currentValue : 0,
    unit: (b.unit as GoalUnit) || (b.type === 'revenue' || b.type === 'adr' || b.type === 'revpar' ? 'BRL' : 'count'),
    startDate,
    endDate,
    notes: (b.notes as string) || '',
  };
  return { input };
}

/** Calcula progresso de uma meta individual */
function calcProgress(goal: {
  id: string; tenantId: string; type: string; period: string; targetValue: number; currentValue: number; unit: string;
  startDate: Date; endDate: Date; status: string; notes: string;
  createdAt: Date; updatedAt: Date;
}): GoalProgress {
  const now = new Date();
  const {targetValue} = goal;
  const {currentValue} = goal;
  const progressPercent = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
  const remaining = Math.max(0, targetValue - currentValue);
  const daysRemaining = Math.max(0, Math.ceil((new Date(goal.endDate).getTime() - now.getTime()) / 86400000));
  const totalDays = Math.max(1, Math.ceil((new Date(goal.endDate).getTime() - new Date(goal.startDate).getTime()) / 86400000));
  const elapsedDays = Math.max(0, totalDays - daysRemaining);
  const projectedValue = elapsedDays > 0 ? (currentValue / elapsedDays) * totalDays : currentValue;
  const projectedStatus = goal.status === 'achieved' ? 'achieved' as const
    : goal.status === 'missed' ? 'missed' as const
    : projectedValue >= targetValue ? 'achieved' as const : 'missed' as const;
  const trend: 'up' | 'down' | 'flat' = progressPercent >= 75 ? 'up' : progressPercent < 30 ? 'down' : 'flat';
  return {
    goal: {
      ...goal,
      type: goal.type as GoalType,
      period: goal.period as GoalPeriod,
      unit: goal.unit as GoalUnit,
      status: goal.status as GoalProgress['goal']['status'],
      startDate: new Date(goal.startDate),
      endDate: new Date(goal.endDate),
      createdAt: new Date(goal.createdAt),
      updatedAt: new Date(goal.updatedAt),
    },
    progressPercent,
    remaining,
    daysRemaining,
    projectedValue,
    projectedStatus,
    trend,
  };
}

/** Atualiza currentValue das metas ativas baseado em dados reais do período */
async function refreshGoalCurrentValues(tenantId: string): Promise<void> {
  const dbOk = await isDatabaseAvailable();
  if (!dbOk) return;

  const activeGoals = await db.airbGoal.findMany({
    where: { tenantId, status: 'active' },
  });

  const now = new Date();
  for (const goal of activeGoals) {
    if (now < new Date(goal.startDate)) continue;

    let {currentValue} = goal;

    try {
      switch (goal.type) {
        case 'revenue': {
          const result = await db.booking.aggregate({
            where: {
              tenantId,
              paymentStatus: 'paid',
              createdAt: { gte: new Date(goal.startDate), lte: now },
            },
            _sum: { totalValue: true },
          });
          currentValue = result._sum.totalValue || 0;
          break;
        }
        case 'bookings': {
          const count = await db.booking.count({
            where: {
              tenantId,
              createdAt: { gte: new Date(goal.startDate), lte: now },
              status: { not: 'cancelled' },
            },
          });
          currentValue = count;
          break;
        }
        case 'guests': {
          const count = await db.guest.count({
            where: {
              tenantId,
              createdAt: { gte: new Date(goal.startDate), lte: now },
            },
          });
          currentValue = count;
          break;
        }
        // Para occupancy, adr, revpar, reviews — cálculo exigiria mais dados;
        // mantemos o valor manual até implementar coleta específica.
      }

      if (currentValue !== goal.currentValue) {
        // Auto-marcas: achieved se bater ≥100%, missed se período acabou e não bateu
        let newStatus = goal.status;
        if (currentValue >= goal.targetValue) {
          newStatus = 'achieved';
        } else if (now > new Date(goal.endDate)) {
          newStatus = 'missed';
        }
        await db.airbGoal.update({
          where: { id: goal.id },
          data: { currentValue, status: newStatus },
        });
      }
    } catch (e) {
      console.warn(`[goals] Falha ao atualizar meta ${goal.id}:`, e);
    }
  }
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
    const status = searchParams.get('status');
    const includeHistory = searchParams.get('history') === 'true';

    const dbOk = await isDatabaseAvailable();
    if (!dbOk) {
      const demoGoal: GoalProgress = {
        goal: {
          id: 'demo-1',
          tenantId,
          type: 'revenue',
          period: 'monthly',
          targetValue: 20000,
          currentValue: 13500,
          unit: 'BRL',
          startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
          status: 'active',
          notes: 'Meta de receita do mês',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        progressPercent: 67.5,
        remaining: 6500,
        daysRemaining: 12,
        projectedValue: 22000,
        projectedStatus: 'achieved',
        trend: 'up',
      };
      const dashboard: GoalsDashboard = {
        active: [demoGoal],
        achievedThisPeriod: [],
        missedThisPeriod: [],
        summary: { totalGoals: 1, onTrack: 1, atRisk: 0, achieved: 0, missed: 0 },
      };
      return NextResponse.json({ success: true, data: dashboard, meta: { source: 'demo' } });
    }

    // Atualiza valores atuais antes de listar
    await refreshGoalCurrentValues(tenantId);

    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    else if (!includeHistory) where.status = { in: ['active', 'achieved'] };

    const goals = await db.airbGoal.findMany({
      where: where as any,
      orderBy: [
        { status: 'asc' },
        { endDate: 'asc' },
      ],
    });

    const progressList = goals.map(g => calcProgress({
      id: g.id, tenantId: g.tenantId, type: g.type, period: g.period,
      targetValue: g.targetValue, currentValue: g.currentValue,
      unit: g.unit, startDate: new Date(g.startDate), endDate: new Date(g.endDate),
      status: g.status, notes: g.notes || '',
      createdAt: new Date(g.createdAt), updatedAt: new Date(g.updatedAt),
    }));

    const now = new Date();
    const dashboard: GoalsDashboard = {
      active: progressList.filter(p => p.goal.status === 'active'),
      achievedThisPeriod: progressList
        .filter(p => p.goal.status === 'achieved' && new Date(p.goal.endDate) >= new Date(now.getFullYear(), now.getMonth() - 3, 1))
        .map(p => p.goal),
      missedThisPeriod: progressList
        .filter(p => p.goal.status === 'missed' && new Date(p.goal.endDate) >= new Date(now.getFullYear(), now.getMonth() - 3, 1))
        .map(p => p.goal),
      summary: {
        totalGoals: goals.length,
        onTrack: progressList.filter(p => p.goal.status === 'active' && p.progressPercent >= 50).length,
        atRisk: progressList.filter(p => p.goal.status === 'active' && p.progressPercent < 50).length,
        achieved: progressList.filter(p => p.goal.status === 'achieved').length,
        missed: progressList.filter(p => p.goal.status === 'missed').length,
      },
    };

    return NextResponse.json({
      success: true,
      data: dashboard,
      meta: { source: 'db' },
    });
  } catch (error) {
    console.error('[airb-pro/goals GET] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao listar metas' }, { status: 500 });
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
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        meta: { source: 'demo' },
      });
    }

    const created = await db.airbGoal.create({
      data: {
        tenantId,
        type: input.type,
        period: input.period,
        targetValue: input.targetValue,
        currentValue: input.currentValue || 0,
        unit: input.unit || 'BRL',
        startDate: input.startDate,
        endDate: input.endDate,
        status: 'active',
        notes: input.notes || '',
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error('[airb-pro/goals POST] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao criar meta' }, { status: 500 });
  }
}
