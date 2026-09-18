import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSecurity } from '@/lib/security/api-shield';
import { verifyRobotToken } from '@/lib/auth';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

// RUN 6 — autoridade de escrita global: POST acumula custo no BudgetGuard
// (pode levar a criticalLevel 'critical' e travar o gasto de IA da PLATAFORMA
// inteira). Sem gate, qualquer chamador podia forjar o bloqueio. Escrita
// exige token de máquina (loop interno) OU administrador ZCC.

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function getHandler(_request: NextRequest, _ctx: any) {
  try {
    const todayStr = getTodayString();

    let state = await db.budgetGuardState.findUnique({
      where: { date: todayStr },
    });

    if (!state) {
      state = await db.budgetGuardState.create({
        data: {
          date: todayStr,
          dailySpendUsd: 0,
          dailyBudgetUsd: 50,
          monthlySpendUsd: 0,
          monthlyBudgetUsd: 1500,
          criticalLevel: 'nominal',
        },
      });
    }

    const dailyRatio = state.dailySpendUsd / state.dailyBudgetUsd;
    const monthlyRatio = state.monthlySpendUsd / state.monthlyBudgetUsd;

    let criticalLevel = 'nominal';
    if (dailyRatio > 0.9 || monthlyRatio > 0.95) {
      criticalLevel = 'critical';
    } else if (dailyRatio > 0.7 || monthlyRatio > 0.8) {
      criticalLevel = 'warning';
    }

    const finalState = { ...state, criticalLevel };

    return NextResponse.json({
      ...finalState,
      createdAt: finalState.createdAt.toISOString(),
      updatedAt: finalState.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('[BUDGET_GET]', error);
    return NextResponse.json(
      { error: 'Erro ao buscar estado do orçamento' },
      { status: 500 }
    );
  }
}

async function postHandler(request: NextRequest, _ctx: any) {
  try {
    const robotOk = await verifyRobotToken(request);
    if (!robotOk) {
      const zcc = await verifyZCCAccessOrReject(request);
      if (!zcc.allowed) return zcc.response!;
    }
    const body = await request.json();
    const { costUsd } = body;

    if (typeof costUsd !== 'number' || costUsd < 0) {
      return NextResponse.json(
        { error: 'O campo "costUsd" deve ser um número positivo' },
        { status: 400 }
      );
    }

    const todayStr = getTodayString();

    let state = await db.budgetGuardState.findUnique({
      where: { date: todayStr },
    });

    if (!state) {
      state = await db.budgetGuardState.create({
        data: {
          date: todayStr,
          dailySpendUsd: 0,
          dailyBudgetUsd: 50,
          monthlySpendUsd: 0,
          monthlyBudgetUsd: 1500,
          criticalLevel: 'nominal',
        },
      });
    }

    const newDailySpend = state.dailySpendUsd + costUsd;
    const dailyRatio = newDailySpend / state.dailyBudgetUsd;

    let criticalLevel = 'nominal';
    if (dailyRatio > 0.9) {
      criticalLevel = 'critical';
    } else if (dailyRatio > 0.7) {
      criticalLevel = 'warning';
    }

    const updated = await db.budgetGuardState.update({
      where: { date: todayStr },
      data: {
        dailySpendUsd: newDailySpend,
        monthlySpendUsd: state.monthlySpendUsd + costUsd,
        criticalLevel,
      },
    });

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('[BUDGET_POST]', error);
    return NextResponse.json(
      { error: 'Erro ao registrar gasto' },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(getHandler, { routeLabel: 'router-budget' });
export const POST = withSecurity(postHandler, { routeLabel: 'router-budget' });