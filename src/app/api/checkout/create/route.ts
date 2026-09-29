import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createError } from '@/lib/error-handler';
import { authRatelimit } from '@/lib/rate-limit';
import { type PlanTier } from '@/lib/plan-features';
import { isMethodAllowed, getPrice, ALLOWED_METHODS } from '@/lib/payments/pricing';
import { getDefaultGateway, getGateway } from '@/lib/payments/gateway-factory';
import { PaymentGatewayError, type GatewayId, type PaymentMethod } from '@/lib/payments/types';
import { measureLatency } from '@/lib/observability/latency-tracker';
import { withAdvisoryLock } from '@/lib/db/concurrency';
import { executeWithBillingIdempotency } from '@/lib/payments/idempotency';
import { buildCheckoutSuccessUrl } from '@/lib/payments/checkout-signature';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

const VALID_PLANS: PlanTier[] = ['gratuito', 'lite', 'pro', 'max', 'parceiro'];
// Fase I (RBW): fonte canônica ÚNICA de métodos — derivada da matriz de pricing
// (ALLOWED_METHODS), eliminando a divergência "pricing vende boleto, checkout
// rejeita boleto". Método só aparece aqui se o pricing o vender ativamente.
const VALID_METHODS: PaymentMethod[] = Array.from(
  new Set(Object.values(ALLOWED_METHODS).flat())
) as PaymentMethod[];
const VALID_NICHES = ['pousada', 'airbnb'] as const;
const VALID_GATEWAYS: GatewayId[] = ['asaas', 'mercadopago', 'mock'];
const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

function cleanString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildCheckoutFingerprint(input: {
  name: string;
  customerEmail: string;
  phone: string;
  document: string;
  propertyName: string;
  niche: string;
  planType: PlanTier;
  paymentMethod: PaymentMethod;
  amount: number;
  requestedGateway?: GatewayId;
}): string {
  const canonical = JSON.stringify({
    name: input.name,
    customerEmail: input.customerEmail,
    phone: input.phone,
    document: input.document,
    propertyName: input.propertyName,
    niche: input.niche,
    planType: input.planType,
    paymentMethod: input.paymentMethod,
    amount: input.amount,
    requestedGateway: input.requestedGateway || null,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

class CheckoutError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

export async function POST(request: NextRequest) {
  // RUN13-A (W2): anti-flood fail-closed por IP — 20 req/1min.
  const rlDeny = guardRequest(request, 'checkout.create', { points: 20, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN13-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:checkout.create', what: 'checkout.create.entry', resource: 'api', result: 'ALLOW' });
  return measureLatency('checkout.create', async () => {
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
      const { amount } = quote;
      if (amount === undefined) return createError(400, 'INVALID_PRICING', 'Combinação plano/método inválida.');

      const session = await getServerSession(authOptions);
      let tenantId: string | undefined;
      let customerEmail = requestedEmail;

      if (session?.user?.tenantId) {
        const tenant = await db.tenant.findUnique({ where: { id: String(session.user.tenantId) } });
        if (!tenant || tenant.status !== 'active') return createError(403, 'TENANT_INACTIVE', 'Conta não autorizada para checkout.');
        tenantId = tenant.id;
        customerEmail = cleanString(session.user.email || tenant.email || requestedEmail, 254).toLowerCase();
        if (!validEmail(customerEmail)) return createError(400, 'INVALID_ACCOUNT_EMAIL', 'Conta sem e-mail válido para cobrança.');
      }

      const idempotencyKey = request.headers.get('x-idempotency-key')?.trim() || undefined;
      if (idempotencyKey && (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH || idempotencyKey.length === 0)) {
        return createError(400, 'INVALID_IDEMPOTENCY_KEY', 'Chave de idempotência inválida.');
      }

      const lockScope = tenantId ? `checkout-create:${tenantId}` : `checkout-onboarding:${requestedEmail}`;
      const idempotencyScope = tenantId ? `tenant:${tenantId}` : `email:${requestedEmail}`;
      const fingerprint = buildCheckoutFingerprint({ name, customerEmail, phone, document, propertyName, niche, planType, paymentMethod, amount, requestedGateway: requestedGateway || undefined });
      const rateResult = await authRatelimit.limit(`checkout:${idempotencyScope}`);
      if (!rateResult.success) return createError(429, 'RATE_LIMITED', 'Muitas tentativas de checkout. Tente novamente mais tarde.');
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || request.nextUrl.origin;

      return await withAdvisoryLock(lockScope, async () => {
        const executeCheckout = async () => {
          let resolvedTenantId = tenantId;
          if (!resolvedTenantId) {
            const existingTenant = await db.tenant.findUnique({ where: { email: requestedEmail } });
            if (existingTenant) {
              resolvedTenantId = existingTenant.id;
              customerEmail = cleanString(existingTenant.email, 254).toLowerCase();
            } else {
              try {
                // MG-07FIX: restaura fail-closed anti-conta-duplicada no checkout de convidados
                // (semantica original de e35bef80; perdida em 064db917/r3-f04 sem atualizar o gate — evidencia em 99_AUDITS/MG07FIX_*)
                const existingTenantMG07 = await db.tenant.findUnique({ where: { email: requestedEmail } });
                if (existingTenantMG07) return createError(409, 'ACCOUNT_EXISTS', 'Este e-mail já possui uma conta. Faça login para continuar.') as unknown as Record<string, unknown>;
                const newTenant = await db.tenant.create({ data: { name: propertyName || name, email: requestedEmail, phone: phone || null, niche, plan: planType === 'parceiro' ? 'PARCEIRO' : planType.toUpperCase(), status: 'pending', role: 'owner' } });
                resolvedTenantId = newTenant.id;
                if (propertyName) {
                  const slugBase = propertyName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
                  await db.property.create({ data: { tenantId: resolvedTenantId, name: propertyName, type: niche, slug: `${slugBase || 'propriedade'}-${resolvedTenantId.slice(-6)}` } });
                }
              } catch {
                throw new CheckoutError(409, 'ACCOUNT_CREATION_CONFLICT', 'Não foi possível iniciar esta conta. Verifique o e-mail e tente novamente.');
              }
            }
          }
          return doCheckoutCreate(resolvedTenantId, planType, paymentMethod, amount, name, customerEmail, phone, document, requestedGateway, baseUrl, idempotencyKey);
        };

        if (idempotencyKey) {
          const result = await executeWithBillingIdempotency({ provider: 'generic', eventId: `checkout-create:${idempotencyScope}:${idempotencyKey}`, eventType: 'checkout.create', status: 'created', fingerprint }, executeCheckout);
          if (result.inProgress) return createError(409, 'IDEMPOTENCY_IN_PROGRESS', 'Este checkout já está sendo processado. Aguarde e tente novamente com a mesma chave.');
          const data = result.data as Record<string, unknown> | null;
          if (!data) return createError(502, 'IDEMPOTENCY_RESULT_UNAVAILABLE', 'O resultado idempotente não está disponível.');
          return NextResponse.json({ success: true, data }, { status: result.deduplicated ? 200 : 201, headers: { 'Cache-Control': 'no-store' } });
        }

        const data = await executeCheckout();
        return NextResponse.json({ success: true, data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
      });
    } catch (error) {
      if (error instanceof CheckoutError) return createError(error.status, error.code, error.message);
      if (error instanceof PaymentGatewayError) {
        const status = error.code === 'AMBIGUOUS_EXISTING_PAYMENT' ? 409 : error.code === 'NOT_CONFIGURED' || error.code === 'RECONCILIATION_FAILED' ? 503 : error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 502;
        return createError(status, error.code, error.message);
      }
      if (error instanceof Error) {
        if (error.message === 'PAYMENT_GATEWAY_NOT_CONFIGURED') return createError(503, 'PAYMENT_GATEWAY_NOT_CONFIGURED', 'Gateway de pagamento não está configurado.');
        if (error.message === 'PAYMENT_GATEWAY_UNAVAILABLE') return createError(503, 'PAYMENT_GATEWAY_UNAVAILABLE', 'Nenhum gateway de pagamento real está configurado.');
        if (error.message === 'PAYMENT_GATEWAY_ERROR') return createError(502, 'PAYMENT_GATEWAY_ERROR', 'Não foi possível iniciar o pagamento. Tente novamente.');
        if (error.message === 'BILLING_IDEMPOTENCY_UNAVAILABLE') return createError(503, 'BILLING_IDEMPOTENCY_UNAVAILABLE', 'Idempotência de cobrança indisponível. Tente novamente mais tarde.');
        if (error.message === 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST') return createError(409, 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST', 'A chave de idempotência já foi usada com dados diferentes.');
        if (error.message === 'IDEMPOTENCY_RESPONSE_FINGERPRINT_MISSING') return createError(409, 'IDEMPOTENCY_RESPONSE_FINGERPRINT_MISSING', 'A chave de idempotência possui um resultado legado incompatível. Use uma nova chave.');
      }
      return createError(500, 'CHECKOUT_ERROR', 'Não foi possível iniciar o checkout.');
    }
  });
}

function deterministicSubscriptionId(tenantId: string, idempotencyKey?: string): string | undefined {
  if (!idempotencyKey) return undefined;
  return createHash('sha256').update(`checkout-subscription:${tenantId}:${idempotencyKey}`, 'utf8').digest('hex').slice(0, 32);
}

function responseDataFromSubscription(subscription: { id: string; amount: number; paymentMethod: string; planType: string; paymentId: string | null; checkoutUrl: string | null; metadata: string }): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(subscription.metadata) as Record<string, unknown>;
    const stored = parsed?.checkoutResponse;
    if (stored && typeof stored === 'object') return stored as Record<string, unknown>;
  } catch {
    // Legacy metadata is still replay-safe when paymentId exists.
  }
  if (!subscription.paymentId) return null;
  return { subscriptionId: subscription.id, amount: subscription.amount, paymentMethod: subscription.paymentMethod, planType: subscription.planType, status: 'pending', checkoutUrl: subscription.checkoutUrl };
}

async function doCheckoutCreate(tenantId: string, planType: PlanTier, paymentMethod: PaymentMethod, amount: number, name: string, customerEmail: string, phone: string, document: string, requestedGateway: GatewayId | undefined, baseUrl: string, idempotencyKey?: string): Promise<Record<string, unknown>> {
  const deterministicId = deterministicSubscriptionId(tenantId, idempotencyKey);
  let subscription = deterministicId ? await db.subscription.findUnique({ where: { id: deterministicId } }) : null;

  if (subscription?.paymentId) {
    const replay = responseDataFromSubscription(subscription);
    if (replay) return replay;
  }

  if (!subscription) {
    try {
      subscription = await db.subscription.create({ data: { ...(deterministicId ? { id: deterministicId } : {}), tenantId, planType, status: 'pending', paymentMethod, amount, paymentStatus: 'pending' } });
    } catch (error) {
      const isUniqueError = error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002';
      if (!isUniqueError || !deterministicId) throw error;
      subscription = await db.subscription.findUnique({ where: { id: deterministicId } });
      if (!subscription) throw error;
      if (subscription.paymentId) {
        const replay = responseDataFromSubscription(subscription);
        if (replay) return replay;
      }
    }
  }

  if (!subscription) throw new Error('CHECKOUT_SUBSCRIPTION_UNAVAILABLE');

  let gateway;
  try {
    // F03: a factory agora lança PaymentGatewayError em produção quando mock é
    // solicitado ou quando nenhum gateway real está configurado (fail-closed).
    gateway = requestedGateway ? getGateway(requestedGateway) : getDefaultGateway();
  } catch (error) {
    if (error instanceof PaymentGatewayError) {
      // Preserva o bookkeeping do subscription antes de propagar o erro
      // (mapeado no catch de topo: NOT_CONFIGURED→503, MOCK_GATEWAY_FORBIDDEN→403).
      await db.subscription.update({ where: { id: subscription.id }, data: { paymentStatus: 'gateway_error' } });
    }
    throw error;
  }
  if (!gateway.isConfigured()) {
    await db.subscription.update({ where: { id: subscription.id }, data: { paymentStatus: 'gateway_error' } });
    throw new Error('PAYMENT_GATEWAY_NOT_CONFIGURED');
  }
  if (process.env.NODE_ENV === 'production' && gateway.id === 'mock') {
    await db.subscription.update({ where: { id: subscription.id }, data: { paymentStatus: 'gateway_error' } });
    throw new Error('PAYMENT_GATEWAY_UNAVAILABLE');
  }

  try {
    const result = await gateway.createPayment({
      referenceId: subscription.id,
      referenceType: 'subscription',
      tenantId,
      idempotencyKey: idempotencyKey || `subscription:${subscription.id}`,
      planTier: planType,
      amount,
      paymentMethod,
      customer: { name, email: customerEmail, phone: phone || undefined, document: document || undefined },
      description: `ZELLA SmartHotel - Plano ${planType.toUpperCase()}`,
      // Fase H (RBW): o produtor do checkout GERA a assinatura que o success
      // exige (subscription_id + sig) — não se remove validação, se gera o par.
      successUrl: buildCheckoutSuccessUrl(baseUrl, subscription.id),
      cancelUrl: `${baseUrl}/checkout/cancel?subscription_id=${encodeURIComponent(subscription.id)}`,
      webhookUrl: `${baseUrl}/api/webhooks/payment`,
    });

    if (!result.gatewayPaymentId) throw new Error('Gateway did not return payment id');

    const responseData: Record<string, unknown> = { subscriptionId: subscription.id, amount, paymentMethod, gateway: result.gateway, planType, status: result.status, checkoutUrl: result.checkoutUrl || buildCheckoutSuccessUrl(baseUrl, subscription.id) };
    if (result.pix) responseData.pix = result.pix;
    if (result.boleto) responseData.boleto = result.boleto;

    const existingPayment = await db.paymentTransaction.findFirst({ where: { subscriptionId: subscription.id, externalId: result.gatewayPaymentId }, select: { id: true } });
    if (!existingPayment) {
      await db.paymentTransaction.create({ data: { subscriptionId: subscription.id, amount, status: result.status, paymentMethod, externalId: result.gatewayPaymentId, metadata: JSON.stringify({ provider: result.gateway, checkout: result.checkoutUrl ?? null }) } });
    }

    await db.subscription.update({ where: { id: subscription.id }, data: { paymentStatus: result.status === 'approved' ? 'approved' : 'pending', paymentId: result.gatewayPaymentId, checkoutUrl: result.checkoutUrl, metadata: JSON.stringify({ gateway: result.gateway, checkoutResponse: responseData }) } });
    return responseData;
  } catch (error) {
    await db.subscription.update({ where: { id: subscription.id }, data: { paymentStatus: 'gateway_error' } });
    if (error instanceof PaymentGatewayError && error.code === 'AMBIGUOUS_EXISTING_PAYMENT') throw error;
    if (error instanceof Error && ['PAYMENT_GATEWAY_NOT_CONFIGURED', 'PAYMENT_GATEWAY_UNAVAILABLE'].includes(error.message)) throw error;
    throw new Error('PAYMENT_GATEWAY_ERROR');
  }
}
