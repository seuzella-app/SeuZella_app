import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createError } from '@/lib/error-handler';
import { authRatelimit } from '@/lib/rate-limit';
import { type PlanTier } from '@/lib/plan-features';
import { PRICING_MATRIX, ALLOWED_METHODS, isMethodAllowed, getPrice } from '@/lib/payments/pricing';

const VALID_PLANS: PlanTier[] = ['gratuito', 'lite', 'pro', 'max', 'parceiro'];
const VALID_METHODS = ['pix', 'cartao'] as const;
const VALID_NICHES = ['pousada', 'airbnb'] as const;

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
    const propertyName = cleanString(body?.propertyName, 120);
    const niche = cleanString(body?.niche, 20) as (typeof VALID_NICHES)[number];
    const planType = cleanString(body?.planType, 20) as PlanTier;
    const paymentMethod = cleanString(body?.paymentMethod, 20) as (typeof VALID_METHODS)[number];

    if (!name || !requestedEmail || !planType || !paymentMethod || !niche) return createError(400, 'MISSING_FIELDS', 'Campos obrigatórios ausentes.');
    if (!validEmail(requestedEmail)) return createError(400, 'INVALID_EMAIL', 'E-mail inválido.');
    if (!VALID_PLANS.includes(planType)) return createError(400, 'INVALID_PLAN', 'Plano inválido.');
    if (!VALID_METHODS.includes(paymentMethod)) return createError(400, 'INVALID_PAYMENT_METHOD', 'Método de pagamento inválido.');
    if (!VALID_NICHES.includes(niche)) return createError(400, 'INVALID_NICHE', 'Nicho inválido.');
    if (!isMethodAllowed(planType, paymentMethod)) return createError(400, 'INVALID_PAYMENT_METHOD', 'Combinação plano/método não permitida.');

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
      // Never bind a guest checkout to an existing tenant by email: that would enable account takeover.
      const existingTenant = await db.tenant.findUnique({ where: { email: requestedEmail } });
      if (existingTenant) return createError(409, 'ACCOUNT_EXISTS', 'Este e-mail já possui uma conta. Faça login para continuar.');
      try {
        const newTenant = await db.tenant.create({
          data: {
            name: propertyName || name, email: requestedEmail, phone: phone || null, niche,
            plan: planType === 'parceiro' ? 'PARCEIRO' : planType.toUpperCase(),
            status: 'pending', role: 'owner',
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
    const responseData: Record<string, unknown> = {
      subscriptionId: subscription.id, amount, paymentMethod, planType,
      checkoutUrl: `/checkout/success?subscription_id=${encodeURIComponent(subscription.id)}`,
    };

    if (paymentMethod === 'pix' && process.env.MP_ACCESS_TOKEN) {
      try {
        const { createPixPayment } = await import('@/lib/mercadopago');
        const parts = name.split(/\s+/).filter(Boolean);
        const result = await createPixPayment({
          amount, email: customerEmail, firstName: parts[0] || name, lastName: parts.slice(1).join(' '),
          description: `ZEHLA SmartHotel - Plano ${planType.toUpperCase()}`, externalRef: subscription.id,
        });
        const externalId = String(result.id || '');
        if (!externalId) throw new Error('Gateway did not return payment id');
        const pix = result.point_of_interaction?.transaction_data;
        await db.paymentTransaction.create({
          data: { subscriptionId: subscription.id, amount, status: 'pending', paymentMethod: 'pix', externalId, metadata: JSON.stringify({ provider: 'mercadopago' }) },
        });
        await db.subscription.update({ where: { id: subscription.id }, data: { checkoutUrl: pix?.ticket_url || undefined, paymentId: externalId } });
        responseData.checkoutUrl = pix?.ticket_url || responseData.checkoutUrl;
        responseData.pix = pix ? { qrCode: pix.qr_code, qrCodeBase64: pix.qr_code_base64, ticketUrl: pix.ticket_url } : null;
      } catch {
        await db.subscription.update({ where: { id: subscription.id }, data: { paymentStatus: 'gateway_error' } });
        return createError(502, 'PAYMENT_GATEWAY_ERROR', 'Não foi possível iniciar o pagamento. Tente novamente.');
      }
    }

    return NextResponse.json({ success: true, data: responseData }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return createError(500, 'CHECKOUT_ERROR', 'Não foi possível iniciar o checkout.');
  }
}
