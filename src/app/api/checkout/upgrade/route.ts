import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createError } from '@/lib/error-handler';
import { authRatelimit } from '@/lib/rate-limit';
import { migratePlanLegacy, type PlanTier } from '@/lib/plan-features';
import { getPrice } from '@/lib/payments/pricing';

const PLAN_ORDER: PlanTier[] = ['gratuito', 'lite', 'pro', 'max', 'parceiro'];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) return createError(401, 'UNAUTHORIZED', 'Faça login primeiro');
    const { success: allowed } = await authRatelimit.limit(session.user.tenantId);
    if (!allowed) return createError(429, 'RATE_LIMITED', 'Muitas requisições');

    const body = await request.json();
    const { tenantId, newPlanType, paymentMethod } = body as {
      tenantId?: string;
      newPlanType?: string;
      paymentMethod?: string;
    };

    if (!tenantId || !newPlanType) {
      return createError(400, 'MISSING_FIELDS', 'Missing tenantId or newPlanType');
    }

    if (tenantId !== session.user.tenantId) {
      return createError(403, 'FORBIDDEN', 'Cannot perform upgrade for another tenant');
    }

    if (!PLAN_ORDER.includes(newPlanType as PlanTier)) {
      return createError(400, 'INVALID_PLAN', `Invalid plan: ${newPlanType}. Valid: ${PLAN_ORDER.join(', ')}`);
    }

    const method = paymentMethod || (newPlanType === 'pro' || newPlanType === 'max' || newPlanType === 'parceiro' ? 'cartao' : 'pix');

    if ((newPlanType === 'pro' || newPlanType === 'max' || newPlanType === 'parceiro') && method === 'pix') {
      return createError(400, 'INVALID_PAYMENT_METHOD', 'Os planos PRO, MAX e PARCEIRO só aceitam pagamento via Cartão de Crédito.');
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

    if (newIdx <= currentIdx) {
      return createError(400, 'CANNOT_DOWNGRADE', `Cannot downgrade via upgrade endpoint. Current: ${currentPlan}, Requested: ${newPlanType}. Use /api/checkout/downgrade instead.`);
    }

    // Cálculo pró-rata com base no método de pagamento
    // Pro-rata calculation uses canonical PIX price as the base monthly amount.
    // Card/boleto premiums are not prorated — they are charged in full at
    // the next billing cycle via the checkout/create flow.
    const newPrice = getPrice(newPlanType as PlanTier, 'pix').amount;
    const currentPrice = getPrice(currentPlan as PlanTier, 'pix').amount;

    const now = new Date();
    const periodEnd = subscription.currentPeriodEnd || new Date();
    const remainingDays = Math.max(
      0,
      Math.ceil((periodEnd.getTime() - now.getTime()) / 86400000),
    );

    const creditPerDay = currentPrice / 30;
    const totalCredit = Math.round(creditPerDay * remainingDays * 100) / 100;

    const costPerDay = newPrice / 30;
    const proratedCost = Math.round(costPerDay * remainingDays * 100) / 100;

    const amountToPay = Math.max(0, proratedCost - totalCredit);

    // Upgrade gratuito
    if (amountToPay === 0 && newPrice === 0) {
      await db.subscription.update({
        where: { id: subscription.id },
        data: {
          planType: newPlanType,
          status: 'active',
          paymentStatus: 'approved',
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 30 * 86400000),
        },
      });

      await db.tenant.update({
        where: { id: tenantId },
        data: { plan: newPlanType },
      });

      return NextResponse.json({ success: true, message: `Upgrade para ${newPlanType} ativado (sem custo)`, newPlanType, proratedCost: 0, creditApplied: totalCredit, amountPaid: 0, remainingDays });
    }

    // Criar transação de pagamento
    const transaction = await db.paymentTransaction.create({
      data: {
        subscriptionId: subscription.id,
        amount: amountToPay,
        status: 'pending',
        paymentMethod: method,
        metadata: JSON.stringify({
          type: 'upgrade',
          fromPlan: currentPlan,
          toPlan: newPlanType,
          proratedCost,
          totalCredit,
          remainingDays,
        }),
      },
    });

    // Integrar com Mercado Pago
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    const mpToken = process.env.MP_ACCESS_TOKEN;

    if (mpToken && amountToPay > 0) {
      try {
        const { createPixPayment } = await import('@/lib/mercadopago');

        const mpResult = await createPixPayment({
          amount: amountToPay,
          email: tenant?.email || '',
          firstName: tenant?.name?.split(' ')[0] || 'ZEHLA',
          lastName: tenant?.name?.split(' ').slice(1).join(' ') || '',
          description: `ZEHLA Upgrade: ${currentPlan} → ${newPlanType}`,
          externalRef: transaction.id,
        });

        await db.paymentTransaction.update({
          where: { id: transaction.id },
          data: { externalId: String(mpResult.id) },
        });

        const pixData = mpResult.point_of_interaction?.transaction_data;

        return NextResponse.json({ success: true, transactionId: transaction.id, newPlanType, amountToPay, proratedCost, creditApplied: totalCredit, remainingDays, pix: pixData ? { qrCode: pixData.qr_code, qrCodeBase64: pixData.qr_code_base64, ticketUrl: pixData.ticket_url } : null, message: `Upgrade de R$${currentPrice} para R$${newPrice}/mês. Pró-rata: R$${amountToPay.toFixed(2)}` });
      } catch (mpError) {
        console.error('MP upgrade error, falling back to mock:', mpError);
      }
    }

    // Fallback mock
    await db.subscription.update({
      where: { id: subscription.id },
      data: {
        planType: newPlanType,
        status: 'active',
        paymentStatus: amountToPay === 0 ? 'approved' : 'pending',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86400000),
      },
    });

    await db.tenant.update({
      where: { id: tenantId },
      data: { plan: newPlanType },
    });

    await db.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: amountToPay === 0 ? 'approved' : 'pending' },
    });

    return NextResponse.json({ success: true, transactionId: transaction.id, newPlanType, amountToPay, proratedCost, creditApplied: totalCredit, remainingDays, message: amountToPay === 0 ? `Upgrade para ${newPlanType} ativado (sem custo)` : `Upgrade criado (modo mock). R$${amountToPay.toFixed(2)} pró-rata.` });
  } catch (error) {
    console.error('[Checkout Upgrade] Error:', error);
    return createError(500, 'UPGRADE_FAILED', 'Failed to process upgrade', error instanceof Error ? error.message : 'Unknown error');
  }
}
