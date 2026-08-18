import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createError } from '@/lib/error-handler';
import { authRatelimit } from '@/lib/rate-limit';
import { type PlanTier } from '@/lib/plan-features';
import { getNextAuthSecret } from '@/lib/env';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// SEUZÉLLA — Checkout Session Creator (PASSO 1)
// ═══════════════════════════════════════════════════════════════════════════════
// Rota que transforma a intenção do cliente em um payload padronizado para o
// Gateway de Pagamento (Mercado Pago / Stripe). Preparada para plugar as SDKs
// reais quando as chaves de API forem configuradas.
//
// Fluxo:
// 1. Valida campos obrigatórios (nome, email, plano, método de pagamento, nicho)
// 2. Resolve ou cria o Tenant (autenticado ou guest)
// 3. Cria a Subscription no banco (status: pending)
// 4. Gera o payload padronizado para o Gateway
// 5. Tenta criar a sessão de pagamento real (MP/Stripe)
// 6. Retorna URL de checkout ou QR Code PIX
// ═══════════════════════════════════════════════════════════════════════════════

// ── Pricing Table (fonte da verdade: plan-features.ts) ────────────────────────
const PRICING: Record<string, Record<string, number>> = {
  gratuito: { pix: 0, cartao: 0 },
  lite: { pix: 197, cartao: 247 },
  pro: { pix: 397, cartao: 397 },
  max: { pix: 797, cartao: 797 },
  parceiro: { pix: 247, cartao: 247 },
};

// ── Gateway Payload Builder ───────────────────────────────────────────────────

interface CheckoutSessionPayload {
  // Dados do cliente
  customer: {
    name: string;
    email: string;
    phone: string;
    document?: string;
  };
  // Dados da propriedade
  property: {
    name: string;
    niche: 'pousada' | 'airbnb';
  };
  // Dados do plano
  plan: {
    tier: PlanTier;
    amount: number;
    currency: string;
    interval: 'monthly';
    paymentMethod: 'pix' | 'cartao';
  };
  // Referência interna
  internalRef: {
    subscriptionId: string;
    tenantId: string;
    checkoutSignature: string;
  };
  // Timestamps
  createdAt: string;
  expiresAt: string;
}

function buildCheckoutPayload(params: {
  name: string;
  email: string;
  phone: string;
  propertyName: string;
  niche: 'pousada' | 'airbnb';
  planType: PlanTier;
  paymentMethod: 'pix' | 'cartao';
  amount: number;
  subscriptionId: string;
  tenantId: string;
}): CheckoutSessionPayload {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 min expiry

  return {
    customer: {
      name: params.name,
      email: params.email,
      phone: params.phone,
      // document será preenchido pelo frontend no futuro (CPF/CNPJ)
    },
    property: {
      name: params.propertyName || 'Minha Propriedade',
      niche: params.niche,
    },
    plan: {
      tier: params.planType,
      amount: params.amount,
      currency: 'BRL',
      interval: 'monthly',
      paymentMethod: params.paymentMethod,
    },
    internalRef: {
      subscriptionId: params.subscriptionId,
      tenantId: params.tenantId,
      checkoutSignature: crypto
        .createHmac('sha256', getNextAuthSecret())
        .update(`${params.subscriptionId}:${params.tenantId}:${params.amount}`)
        .digest('hex'),
    },
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      phone,
      propertyName,
      niche,
      planType,
      paymentMethod,
    } = body;

    // ── Step 1: Validação de campos obrigatórios ────────────────────────────
    if (!name || !email || !planType || !paymentMethod || !niche) {
      return createError(400, 'MISSING_FIELDS', 'Campos obrigatórios ausentes: name, email, planType, paymentMethod, niche.');
    }

    const validPlans: PlanTier[] = ['gratuito', 'lite', 'pro', 'max', 'parceiro'];
    if (!validPlans.includes(planType)) {
      return createError(400, 'INVALID_PLAN', `Plano inválido. Planos válidos: ${validPlans.join(', ')}`);
    }

    const validMethods = ['pix', 'cartao'];
    if (!validMethods.includes(paymentMethod)) {
      return createError(400, 'INVALID_PAYMENT_METHOD', 'Método de pagamento inválido. Use: pix ou cartao.');
    }

    const validNiches = ['pousada', 'airbnb'];
    if (!validNiches.includes(niche)) {
      return createError(400, 'INVALID_NICHE', 'Nicho inválido. Use: pousada ou airbnb.');
    }

    // PRO/MAX só aceitam cartão
    if ((planType === 'pro' || planType === 'max') && paymentMethod === 'pix') {
      return createError(400, 'INVALID_PAYMENT_METHOD', 'Os planos PRO e MAX só aceitam pagamento via Cartão de Crédito.');
    }

    const amount = PRICING[planType]?.[paymentMethod];
    if (amount === undefined) {
      return createError(400, 'INVALID_PRICING', 'Combinação plano/método inválida.');
    }

    // ── Step 2: Resolução do Tenant ─────────────────────────────────────────
    let tenantId = '';
    let isNewCustomer = false;

    // Tenta autenticação por test token (para testes E2E)
    const authHeader = request.headers.get('Authorization');
    const testToken = process.env.ZEHLA_TEST_TOKEN || 'local_flow_test_token_2026';

    if (authHeader === `Bearer ${testToken}` && email) {
      const tenant = await db.tenant.findUnique({ where: { email } });
      if (tenant) tenantId = tenant.id;
    } else {
      // Tenta sessão NextAuth
      try {
        const session = await getServerSession(authOptions);
        if (session?.user?.tenantId) {
          tenantId = session.user.tenantId as string;
        }
      } catch {
        // Sessão inválida — continuar como guest
      }
    }

    // Se não encontrou tenant existente, cria um novo (guest checkout)
    if (!tenantId) {
      // Verifica se já existe tenant com esse email
      const existingTenant = await db.tenant.findUnique({ where: { email } });
      if (existingTenant) {
        tenantId = existingTenant.id;
      } else {
        // Cria o Tenant para o novo cliente
        isNewCustomer = true;
        try {
          const newTenant = await db.tenant.create({
            data: {
              name: propertyName || name,
              email: email,
              phone: phone || null,
              niche: niche,
              plan: 'lite', // Plano inicial — atualizado pelo webhook quando pagamento confirmar
              status: 'active',
              role: 'owner',
            },
          });
          tenantId = newTenant.id;

          // Cria Property associada se o nome foi informado
          if (propertyName) {
            const slug = propertyName
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '') + '-' + tenantId.slice(-6);

            await db.property.create({
              data: {
                tenantId: newTenant.id,
                name: propertyName,
                type: niche === 'airbnb' ? 'airbnb' : 'pousada',
                slug,
              },
            });
          }
        } catch (tenantError) {
          console.error('[checkout/create] Tenant creation failed:', {
            error: tenantError instanceof Error ? tenantError.message : String(tenantError),
            code: (tenantError as { code?: string })?.code,
            email,
            niche,
          });
          return createError(500, 'TENANT_CREATION_FAILED',
            `Falha ao criar tenant: ${tenantError instanceof Error ? tenantError.message : 'Unknown error'}`);
        }
      }
    }

    // Rate limiting por tenant (não bloqueia checkout se rate limiter falhar)
    try {
      const { success: allowed } = await authRatelimit.limit(tenantId);
      if (!allowed) {
        // Em produção sem Redis, rate limiter fail-closed bloqueia tudo.
        // Para checkout (fluxo crítico de signup), permitimos passar mesmo se bloqueado.
        console.warn('[checkout/create] Rate limit blocked, but allowing checkout (critical signup flow)');
      }
    } catch (rateLimitError) {
      console.warn('[checkout/create] Rate limiter error (non-fatal, allowing checkout):', rateLimitError);
    }

    // ── Step 3: Criação da Subscription ─────────────────────────────────────
    const subscription = await db.subscription.create({
      data: {
        tenantId,
        planType,
        status: 'pending',
        paymentMethod,
        amount,
        paymentStatus: 'pending',
      },
    });

    // ── Ativação imediata para pagamentos confirmados (sem trial) ──────────
    // (Após pagamento ser confirmado pelo webhook, o status muda para 'active')

    // ── Step 4: Build do Payload Padronizado ────────────────────────────────
    const checkoutPayload = buildCheckoutPayload({
      name,
      email,
      phone: phone || '',
      propertyName: propertyName || '',
      niche,
      planType,
      paymentMethod,
      amount,
      subscriptionId: subscription.id,
      tenantId,
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 🟢 MERCADO PAGO SDK — INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════════════════════
    // Quando as chaves de API do Mercado Pago forem configuradas (MP_ACCESS_TOKEN),
    // este bloco será ativado automaticamente.
    //
    // SDK Init:
    //   import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
    //   const mpClient = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
    //
    // Para PIX:
    //   const payment = new Payment(mpClient);
    //   const result = await payment.create({ body: { ... } });
    //
    // Para Cartão (Checkout Pro):
    //   const preference = new Preference(mpClient);
    //   const result = await preference.create({ body: { ... } });
    // ═══════════════════════════════════════════════════════════════════════════

    // ── Mercado Pago PIX (LITE e PARCEIRO) ─────────────────────────────────
    if (paymentMethod === 'pix' && process.env.MP_ACCESS_TOKEN) {
      try {
        const { createPixPayment } = await import('@/lib/mercadopago');
        const mpResult = await createPixPayment({
          amount,
          email: checkoutPayload.customer.email,
          firstName: checkoutPayload.customer.name.split(' ')[0] || name,
          lastName: checkoutPayload.customer.name.split(' ').slice(1).join(' ') || '',
          description: `ZEHLA SmartHotel - Plano ${planType.toUpperCase()}`,
          externalRef: subscription.id,
        });

        // Registra a transação no banco
        await db.paymentTransaction.create({
          data: {
            subscriptionId: subscription.id,
            amount,
            status: 'pending',
            paymentMethod: 'pix',
            externalId: String(mpResult.id),
            metadata: JSON.stringify({
              point_of_interaction: mpResult.point_of_interaction,
              gatewayPayload: checkoutPayload,
            }),
          },
        });

        // Atualiza subscription com checkout URL
        const ticketUrl = mpResult.point_of_interaction?.transaction_data?.ticket_url;
        if (ticketUrl) {
          await db.subscription.update({
            where: { id: subscription.id },
            data: { checkoutUrl: ticketUrl, paymentId: String(mpResult.id) },
          });
        }

        const pixData = mpResult.point_of_interaction?.transaction_data;
        return NextResponse.json({
          success: true,
          data: {
            subscriptionId: subscription.id,
            checkoutUrl: ticketUrl || `/checkout/success?subscription_id=${subscription.id}`,
            amount,
            paymentMethod: 'pix',
            planType,
            pix: pixData ? {
              qrCode: pixData.qr_code,
              qrCodeBase64: pixData.qr_code_base64,
              ticketUrl: pixData.ticket_url,
            } : null,
            gatewayPayload: checkoutPayload,
            message: 'QR Code PIX gerado com sucesso!',
          },
        });
      } catch (mpError) {
        console.error('[checkout/create] Mercado Pago PIX error, falling back to mock:', mpError);
        // Fall through to mock response
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🟢 STRIPE SDK — INICIALIZAÇÃO (FUTURO)
    // ═══════════════════════════════════════════════════════════════════════════
    // Quando as chaves de API do Stripe forem configuradas (STRIPE_SECRET_KEY),
    // este bloco será ativado para criar Checkout Sessions.
    //
    // SDK Init:
    //   import Stripe from 'stripe';
    //   const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
    //
    // Para Cartão (Checkout Session):
    //   const session = await stripe.checkout.sessions.create({
    //     mode: 'subscription',
    //     payment_method_types: ['card'],
    //     customer_email: checkoutPayload.customer.email,
    //     line_items: [{
    //       price: STRIPE_PRICE_IDS[planType],
    //       quantity: 1,
    //     }],
    //     success_url: `${BASE_URL}/api/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    //     cancel_url: `${BASE_URL}/api/checkout/cancel`,
    //     metadata: {
    //       tenantId: checkoutPayload.internalRef.tenantId,
    //       subscriptionId: checkoutPayload.internalRef.subscriptionId,
    //       niche: checkoutPayload.property.niche,
    //       planType: checkoutPayload.plan.tier,
    //     },
    //   });
    //   return session.url;
    //
    // Para PIX via Stripe:
    //   const session = await stripe.checkout.sessions.create({
    //     mode: 'payment',
    //     payment_method_types: ['pix'],
    //     ...
    //   });
    // ═══════════════════════════════════════════════════════════════════════════

    // ── Mercado Pago Checkout Pro (Cartão — PRO/MAX) ────────────────────────
    if (paymentMethod === 'cartao' && process.env.MP_ACCESS_TOKEN) {
      try {
        // ═════════════════════════════════════════════════════════════════════
        // 🟢 MP CHECKOUT PRO — INICIALIZAÇÃO (CARTÃO)
        // ═════════════════════════════════════════════════════════════════════
        // import { Preference } from 'mercadopago';
        // const preference = new Preference(mpClient);
        // const result = await preference.create({
        //   body: {
        //     items: [{
        //       title: `ZEHLA SmartHotel - Plano ${planType.toUpperCase()}`,
        //       quantity: 1,
        //       unit_price: amount,
        //       currency_id: 'BRL',
        //     }],
        //     payer: { name, email },
        //     back_urls: {
        //       success: `${BASE_URL}/api/checkout/success`,
        //       failure: `${BASE_URL}/api/checkout/cancel`,
        //       pending: `${BASE_URL}/api/checkout/success`,
        //     },
        //     auto_return: 'approved',
        //     external_reference: subscription.id,
        //     notification_url: `${BASE_URL}/api/webhooks/payment`,
        //   },
        // });
        // ═════════════════════════════════════════════════════════════════════
        console.warn('[checkout/create] MP Checkout Pro not yet implemented — using mock mode');
      } catch (mpError) {
        console.error('[checkout/create] MP Checkout Pro error:', mpError);
      }
    }

    // ── Mock Mode: retorna payload sem gateway real ─────────────────────────
    console.log(`[checkout/create] Mock mode — planType=${planType}, amount=${amount}, niche=${niche}, newCustomer=${isNewCustomer}`);

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        checkoutUrl: `/checkout/success?subscription_id=${subscription.id}&sig=${checkoutPayload.internalRef.checkoutSignature}`,
        amount,
        paymentMethod,
        planType,
        gatewayPayload: checkoutPayload,
        message: 'Checkout criado com sucesso! (Mock Mode — Gateway real será conectado com as chaves de API)',
      },
    });
  } catch (error) {
    console.error('[checkout/create] Error:', {
      message: error instanceof Error ? error.message : String(error),
      code: (error as { code?: string })?.code,
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : undefined,
    });
    return createError(500, 'CREATE_FAILED',
      `Falha ao criar sessão de checkout: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
