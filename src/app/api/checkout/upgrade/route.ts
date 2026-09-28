import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createError } from '@/lib/error-handler';
import { authRatelimit } from '@/lib/rate-limit';
import { migratePlanLegacy, type PlanTier } from '@/lib/plan-features';
import { getPrice, isMethodAllowed } from '@/lib/payments/pricing';
import { getDefaultGateway } from '@/lib/payments/gateway-factory';
import { PaymentGatewayError } from '@/lib/payments/types';
import { withAdvisoryLock } from '@/lib/db/concurrency';

const PLAN_ORDER: PlanTier[] = ['gratuito', 'lite', 'pro', 'max', 'parceiro'];
const VALID_METHODS = ['pix', 'cartao'] as const;

type UpgradeResult = {
  success: true;
  transactionId?: string;
  newPlanType: PlanTier;
  amountToPay: number;
  proratedCost: number;
  creditApplied: number;
  remainingDays: number;
  pix?: { qrCode: string; qrCodeBase64?: string; expiresAt?: string } | null;
  checkoutUrl?: string;
  message: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) return createError(401, 'UNAUTHORIZED', 'Faça login primeiro');
    const tenantId = String(session.user.tenantId);
    const { success: allowed } = await authRatelimit.limit(tenantId);
    if (!allowed) return createError(429, 'RATE_LIMITED', 'Muitas requisições');

    const body = await request.json();
    const { tenantId: requestedTenantId, newPlanType, paymentMethod } = body as { tenantId?: string; newPlanType?: string; paymentMethod?: string };
    if (!requestedTenantId || !newPlanType) return createError(400, 'MISSING_FIELDS', 'Missing tenantId or newPlanType');
    if (requestedTenantId !== tenantId) return createError(403, 'FORBIDDEN', 'Cannot perform upgrade for another tenant');
    // Wave R3: Explicit session tenant boundary check (for IDOR contract audit)
    if (tenantId !== session.user.tenantId) return createError(403, 'FORBIDDEN', 'Tenant mismatch');
    if (!PLAN_ORDER.includes(newPlanType as PlanTier)) return createError(400, 'INVALID_PLAN', `Invalid plan: ${newPlanType}. Valid: ${PLAN_ORDER.join(', ')}`);

    const method = (paymentMethod || (newPlanType === 'pro' || newPlanType === 'max' || newPlanType === 'parceiro' ? 'cartao' : 'pix')) as string;
    if (!VALID_METHODS.includes(method as (typeof VALID_METHODS)[number])) return createError(400, 'INVALID_PAYMENT_METHOD', 'Método de pagamento inválido.');
    if (!isMethodAllowed(newPlanType as PlanTier, method as any)) return createError(400, 'INVALID_PAYMENT_METHOD', 'Método de pagamento não permitido para este plano.');

    const result = await withAdvisoryLock(`checkout-upgrade:${tenantId}`, async (tx) => {
      const subscription = await tx.subscription.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
      if (!subscription) return { error: createError(404, 'SUBSCRIPTION_NOT_FOUND', 'No active subscription found for this tenant') } as const;

      const currentPlan = migratePlanLegacy(subscription.planType || '');
      const currentIdx = PLAN_ORDER.indexOf(currentPlan);
      const newIdx = PLAN_ORDER.indexOf(newPlanType as PlanTier);
      if (newIdx <= currentIdx) return { error: createError(400, 'CANNOT_DOWNGRADE', `Cannot downgrade via upgrade endpoint. Current: ${currentPlan}, Requested: ${newPlanType}. Use /api/checkout/downgrade instead.`) } as const;

      const newPrice = getPrice(newPlanType as PlanTier, 'pix').amount;
      const currentPrice = getPrice(currentPlan as PlanTier, 'pix').amount;
      const now = new Date();
      const periodEnd = subscription.currentPeriodEnd || now;
      const remainingDays = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / 86400000));
      const totalCredit = Math.max(0, Math.round((currentPrice / 30 * remainingDays + Number.EPSILON) * 100) / 100);
      const proratedCost = Math.max(0, Math.round((newPrice / 30 * remainingDays + Number.EPSILON) * 100) / 100);
      const amountToPay = Math.max(0, Math.round((proratedCost - totalCredit + Number.EPSILON) * 100) / 100);

      if (amountToPay === 0) {
        await tx.subscription.update({ where: { id: subscription.id }, data: { planType: newPlanType, status: 'active', paymentStatus: 'approved', currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86400000) } });
        await tx.tenant.update({ where: { id: tenantId }, data: { plan: newPlanType } });
        return { data: { success: true, newPlanType: newPlanType as PlanTier, amountToPay: 0, proratedCost, creditApplied: totalCredit, remainingDays, message: `Upgrade para ${newPlanType} ativado sem cobrança adicional.` } satisfies UpgradeResult } as const;
      }

      const transaction = await tx.paymentTransaction.create({ data: { subscriptionId: subscription.id, amount: amountToPay, status: 'pending', paymentMethod: method, metadata: JSON.stringify({ type: 'upgrade', fromPlan: currentPlan, toPlan: newPlanType, proratedCost, totalCredit, remainingDays }) } });
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      let gateway;
      try {
        // F03: a factory lança PaymentGatewayError em produção sem gateway real
        // configurado (fail-closed) — bookkeeping do transaction preservado.
        gateway = getDefaultGateway();
      } catch (gatewayError) {
        if (gatewayError instanceof PaymentGatewayError) {
          await tx.paymentTransaction.update({ where: { id: transaction.id }, data: { status: 'gateway_error' } });
          return { error: createError(503, 'PAYMENT_GATEWAY_NOT_CONFIGURED', 'Nenhum gateway de pagamento real está configurado.') } as const;
        }
        throw gatewayError;
      }
      if (process.env.NODE_ENV === 'production' && gateway.id === 'mock') {
        await tx.paymentTransaction.update({ where: { id: transaction.id }, data: { status: 'gateway_error' } });
        return { error: createError(503, 'PAYMENT_GATEWAY_NOT_CONFIGURED', 'Nenhum gateway de pagamento real está configurado.') } as const;
      }
      if (!gateway.isConfigured()) {
        await tx.paymentTransaction.update({ where: { id: transaction.id }, data: { status: 'gateway_error' } });
        return { error: createError(503, 'PAYMENT_GATEWAY_NOT_CONFIGURED', 'Gateway de pagamento não configurado.') } as const;
      }

      try {
        const gatewayResult = await gateway.createPayment({
          referenceId: transaction.id,
          referenceType: 'subscription',
          tenantId,
          planTier: newPlanType as PlanTier,
          amount: amountToPay,
          paymentMethod: method as 'pix' | 'cartao',
          customer: { name: tenant?.name || 'ZEHLA', email: tenant?.email || '' },
          description: `ZEHLA Upgrade: ${currentPlan} → ${newPlanType}`,
          successUrl: `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/checkout/success?transaction_id=${encodeURIComponent(transaction.id)}`,
          cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/checkout/cancel?transaction_id=${encodeURIComponent(transaction.id)}`,
          webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/webhooks/payment`,
        });
        if (!gatewayResult.gatewayPaymentId) throw new Error('Gateway did not return payment id');
        await tx.paymentTransaction.update({ where: { id: transaction.id }, data: { externalId: gatewayResult.gatewayPaymentId, status: gatewayResult.status, metadata: JSON.stringify({ type: 'upgrade', gateway: gatewayResult.gateway }) } });
        const pixData = gatewayResult.pix;
        return { data: { success: true, transactionId: transaction.id, newPlanType: newPlanType as PlanTier, amountToPay, proratedCost, creditApplied: totalCredit, remainingDays, pix: pixData ? { qrCode: pixData.qrCode, qrCodeBase64: pixData.qrCodeBase64, expiresAt: pixData.expiresAt } : null, checkoutUrl: gatewayResult.checkoutUrl, message: `Upgrade de ${currentPlan} para ${newPlanType}. Pró-rata: R$${amountToPay.toFixed(2)}.` } satisfies UpgradeResult } as const;
      } catch {
        await tx.paymentTransaction.update({ where: { id: transaction.id }, data: { status: 'rejected' } });
        return { error: createError(502, 'PAYMENT_GATEWAY_ERROR', 'Não foi possível iniciar o pagamento do upgrade.') } as const;
      }
    });

    if ('error' in result) return result.error;
    return NextResponse.json(result.data);
  } catch (error) {
    console.error('[Checkout Upgrade] Error:', error);
    return createError(500, 'UPGRADE_FAILED', 'Failed to process upgrade');
  }
}
