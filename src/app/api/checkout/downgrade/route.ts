import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createError } from '@/lib/error-handler';
import { authRatelimit } from '@/lib/rate-limit';
import { migratePlanLegacy, type PlanTier } from '@/lib/plan-features';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

const PLAN_ORDER: PlanTier[] = ['gratuito', 'lite', 'pro', 'max', 'parceiro'];

export async function POST(request: NextRequest) {
  // RUN13-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'checkout.downgrade', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN13-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:checkout.downgrade', what: 'checkout.downgrade.entry', resource: 'api', result: 'ALLOW' });
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) return createError(401, 'UNAUTHORIZED', 'Faça login primeiro');
    const { success: allowed } = await authRatelimit.limit(session.user.tenantId);
    if (!allowed) return createError(429, 'RATE_LIMITED', 'Muitas requisições');

    const body = await request.json();
    const { tenantId, newPlanType } = body as {
      tenantId?: string;
      newPlanType?: string;
    };

    if (!tenantId || !newPlanType) {
      return createError(400, 'MISSING_FIELDS', 'Missing tenantId or newPlanType');
    }

    if (tenantId !== session.user.tenantId) {
      return createError(403, 'FORBIDDEN', 'Cannot perform downgrade for another tenant');
    }

    if (!PLAN_ORDER.includes(newPlanType as PlanTier)) {
      return createError(400, 'INVALID_PLAN', `Invalid plan: ${newPlanType}. Valid: ${PLAN_ORDER.join(', ')}`);
    }

    const subscription = await db.subscription.findFirst({
      where: { tenantId },
    });

    if (!subscription) {
      return createError(404, 'SUBSCRIPTION_NOT_FOUND', 'No active subscription found for this tenant');
    }

    const currentPlan = migratePlanLegacy(subscription.planType || '');
    const currentIdx = PLAN_ORDER.indexOf(currentPlan);
    const newIdx = PLAN_ORDER.indexOf(newPlanType as PlanTier);

    if (newIdx >= currentIdx) {
      return createError(400, 'CANNOT_UPGRADE', `Cannot upgrade via downgrade endpoint. Current: ${currentPlan}, Requested: ${newPlanType}. Use /api/checkout/upgrade instead.`);
    }

    const effectiveDate =
      subscription.currentPeriodEnd ||
      new Date(Date.now() + 30 * 86400000);

    await db.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
        metadata: JSON.stringify({
          ...JSON.parse(subscription.metadata || '{}'),
          pendingDowngrade: {
            toPlan: newPlanType,
            effectiveDate: effectiveDate.toISOString(),
            requestedAt: new Date().toISOString(),
          },
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Downgrade agendado: ${currentPlan} → ${newPlanType}`,
      currentPlan,
      newPlanType,
      effectiveDate: effectiveDate.toISOString(),
      details: {
        currentPlan,
        newPlanType,
        effectiveDate,
        reason: `O novo plano entra na próxima renovação. Você mantém todos os benefícios atuais até ${effectiveDate.toLocaleDateString('pt-BR')}`,
      },
    });
  } catch (error) {
    console.error('[Checkout Downgrade] Error:', error);
    return createError(500, 'DOWNGRADE_FAILED', 'Failed to process downgrade', error instanceof Error ? error.message : 'Unknown error');
  }
}
