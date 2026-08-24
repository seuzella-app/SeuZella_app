import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createError } from '@/lib/error-handler';
import { authRatelimit } from '@/lib/rate-limit';
import { type PlanTier } from '@/lib/plan-features';
import { isMethodAllowed, getPrice } from '@/lib/payments/pricing';
import { getDefaultGateway, getGateway } from '@/lib/payments/gateway-factory';
import type { GatewayId, PaymentMethod } from '@/lib/payments/types';

const VALID_PLANS: PlanTier[] = ['gratuito', 'lite', 'pro', 'max', 'parceiro'];
const VALID_METHODS: PaymentMethod[] = ['pix', 'cartao'];
const VALID_NICHES = ['pousada', 'airbnb'] as const;
const VALID_GATEWAYS: GatewayId[] = ['asaas', 'mercadopago', 'mock'];

function cleanString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > 64 * 1024) return createError(413, 'PAYLOAD_TOO_LARGE', 'Payload excede o limite permitido.');

    const body = await request.json();
    const name = cleanString(body?.name, 120);
    const requestedEmail = cleanString(body?.email, 254).toLowerCase();
    const phone = cleanString(body?.phone, 32);
    const document = cleanString(body?.document, 32);
    const propertyName = cleanString(body?.propertyName, 120);
    const niche = cleanString(body?.niche, 20) as (typeof VALID_NICHES)[number];
    const planType = cleanString(body?.planType, 20) as PlanTier;
    const paymentMethod = cleanString(body?.paymentMethod, 20) as PaymentMethod;
    const requestedGateway = cleanString(body?.gateway, 20) as GatewayId;

    if (!name || !requestedEmail || !planType || !paymentMethod || !niche) return createError(400, 'MISSING_FIELDS', 'Campos obrigatórios ausentes.');
    if (!validEmail(requestedEmail)) return createError(400, 'INVALID_EMAIL', 'E-mail inválido.');
    if (!VALID_PLANS.includes(planType)) return createError(400, 'INVALID_PLAN', 'Plano inválido.');
    if (!VALID_METHODS.includes(paymentMethod)) return createError(400, 'INVALID_PAYMENT_METHOD', 'Método de pagamento inválido.');
    if (!VALID_NICHES.includes(niche)) return createError(400, 'INVALID_NICHE', 'Nicho inválido.');
    if (!isMethodAllowed(planType, paymentMethod)) return createError(400, 'INVALID_PAYMENT_METHOD', 'Combinação plano/método não permitida.');
    if (requestedGateway && !VALID_GATEWAYS.includes(requestedGateway)) return createError(400, 'INVALID_GATEWAY', 'Gateway de pagamento inválido.');
    if (requestedGateway === 'mock' && process.env.NODE_ENV === 'production') return createError(400, 'INVALID_GATEWAY', 'Gateway mock não é permitido em produção.');

    const quote = getPrice(planType, paymentMethod);
    const amount = quote.amount;
    if (amount === undefined) return createError(400, 'INVALID_PRICING', 'Combinação plano/método inválida.');

    const session = await getServerSession(authOptions);
    let tenantId: string;
    let customerEmail = requestedEmail;

    if (session?.user?.tenantId) {
      const tenant = await db.tenant.findUnique({ where: { id: String(session.user.tenantId) } });
      if (!tenant || tenant.status !== 'active') return createError(403, 'TENANT_INACTIVE', 'Conta não autorizada para checkout.');
      tenantId = tenant.id;
      customerEmail = cleanString(session.user.email || tenant.email || requestedEmail, 254).toLowerCase();
      if (!validEmail(customerEmail)) return createError(400, 'INVALID_ACCOUNT_EMAIL', 'Conta sem e-mail válido para cobrança.');
    } else {
      const existingTenant = await db.tenant.findUnique({ where: { email: requestedEmail } });
      if (existingTenant) return createError(409, 'ACCOUNT_EXISTS', 'Este e-mail já possui uma conta. Faça login para continuar.');
      try {
        const newTenant = await db.tenant.create({
          data: {
            name: propertyName || name, email: requestedEmail, phone: phone || null, niche,
            plan: planType === 'parceiro' ? 'PARCEIRO' : planType.toUpperCase(), status: 'pending', role: 'owner',
          },
        });
        tenantId = newTenant.id;
        if (propertyName) {
          const slugBase = propertyName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
          await db.property.create({ data: { tenantId, name: propertyName, type: niche, slug: `${slugBase || 'propriedade'}-${tenantId.slice(-6)}` } });
        }
      } catch {
        return createError(409, 'ACCOUNT_CREATION_CONFLICT', 'Não foi possível iniciar esta conta. Verifique o e-mail e tente novamente.');
      }
    }

    const rateResult = await authRatelimit.limit(`checkout:${tenantId}:${customerEmail}`);
    if (!rateResult.success) return createError(429, 'RATE_LIMITED', 'Muitas tentativas de checkout. Tente novamente mais tarde.');

    const subscription = await db.subscription.create({ data: { tenantId, planType, status: 'pending', paymentMethod, amount, paymentStatus: 'pending' } });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || request.nextUrl.origin;
    const gateway = requestedGateway ? getGateway(requestedGateway) : getDefaultGateway();
    if (!gateway.isConfigured()) {
      await db.subscription.update({ where: { id: subscription.id }, data: { paymentStatus: 'gateway_error' } });
      return createError(503, 'PAYMENT_GATEWAY_NOT_CONFIGURED', `Gateway ${gateway.id} não está configurado.`);
    }
    if (process.env.NODE_ENV === 'production' && gateway.id === 'mock') {
      await db.subscription.update({ where: { id: subscription.id }, data: { paymentStatus: 'gateway_error' } });
      return createError(503, 'PAYMENT_GATEWAY_UNAVAILABLE', 'Nenhum gateway de pagamento real está configurado.');
    }

    try {
      const result = await gateway.createPayment({
        referenceId: subscription.id,
        referenceType: 'subscription',
        tenantId,
        planTier: planType,
        amount,
        paymentMethod,
        customer: { name, email: customerEmail, phone: phone || undefined, document: document || undefined },
        description: `ZEHLA SmartHotel - Plano ${planType.toUpperCase()}`,
        successUrl: `${baseUrl}/checkout/success?subscription_id=${encodeURIComponent(subscription.id)}`,
        cancelUrl: `${baseUrl}/checkout/cancel?subscription_id=${encodeURIComponent(subscription.id)}`,
        webhookUrl: `${baseUrl}/api/webhooks/payment`,
      });

      if (!result.gatewayPaymentId) throw new Error('Gateway did not return payment id');

      await db.paymentTransaction.create({
        data: {
          subscriptionId: subscription.id,
          amount,
          status: result.status,
          paymentMethod,
          externalId: result.gatewayPaymentId,
          metadata: JSON.stringify({ provider: result.gateway, checkout: result.checkoutUrl ?? null }),
        },
      });

      await db.subscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: result.status === 'approved' ? 'approved' : 'pending',
          paymentId: result.gatewayPaymentId,
          checkoutUrl: result.checkoutUrl,
          metadata: JSON.stringify({ gateway: result.gateway }),
        },
      });

      const responseData: Record<string, unknown> = {
        subscriptionId: subscription.id, amount, paymentMethod, gateway: result.gateway, planType,
        status: result.status,
        checkoutUrl: result.checkoutUrl || `${baseUrl}/checkout/success?subscription_id=${encodeURIComponent(subscription.id)}`,
      };
      if (result.pix) responseData.pix = result.pix;
      if (result.boleto) responseData.boleto = result.boleto;

      return NextResponse.json({ success: true, data: responseData }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    } catch {
      await db.subscription.update({ where: { id: subscription.id }, data: { paymentStatus: 'gateway_error' } });
      return createError(502, 'PAYMENT_GATEWAY_ERROR', 'Não foi possível iniciar o pagamento. Tente novamente.');
    }
  } catch {
    return createError(500, 'CHECKOUT_ERROR', 'Não foi possível iniciar o checkout.');
  }
}
