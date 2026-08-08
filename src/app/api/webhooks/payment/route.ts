import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// SEUZÉLLA — Webhook de Provisionamento (PASSO 2 + PASSO 3)
// ═══════════════════════════════════════════════════════════════════════════════
// Rota secreta de sistema que escuta o Gateway de Pagamentos e realiza o
// "Provisionamento Mágico" do cliente:
//
// 1. Valida assinatura HMAC no cabeçalho (garante que só o Gateway dispara)
// 2. No evento payment.created / invoice.paid:
//    a. Cria o Tenant com isolamento multi-tenant
//    b. Atribui o Niche (POUSADA ou AIRBNB)
//    c. Atribui o PlanTier correspondente ao valor pago
//    d. Cria o usuário admin da propriedade
// 3. Dispara telemetria ZCC com MRR e dados LGPD-compliant
//
// SEGURANÇA: HMAC-SHA256 obrigatório em produção. Zero Trust.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Types ─────────────────────────────────────────────────────────────────────

interface WebhookPayload {
  // Evento do gateway
  event: 'payment.created' | 'payment.updated' | 'invoice.paid' | 'invoice.payment_failed' | 'subscription.canceled';
  // ID externo do pagamento
  paymentId?: string;
  // ID externo da assinatura (Stripe: subscription ID, MP: preference ID)
  subscriptionExternalId?: string;
  // Status do pagamento
  status?: 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled';
  // Valor pago
  amount?: number;
  // Moeda
  currency?: string;
  // Metadados injetados no checkout
  metadata?: {
    tenantId?: string;
    subscriptionId?: string;
    niche?: 'pousada' | 'airbnb';
    planType?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    propertyName?: string;
    [key: string]: unknown;
  };
  // Dados do cliente (formato Mercado Pago)
  payer?: {
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: { area_code?: string; number?: string };
    identification?: { type?: string; number?: string };
  };
  // Timestamp
  createdAt?: string;
}

interface ProvisioningResult {
  tenantId: string;
  userId: string;
  propertyId?: string;
  subscriptionId: string;
  planTier: string;
  niche: string;
  isNewTenant: boolean;
}

// ── HMAC Signature Verification ───────────────────────────────────────────────

function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  _timestampHeader?: string | null,
): { valid: boolean; reason?: string } {
  // Em produção, assinatura é OBRIGATÓRIA
  if (process.env.NODE_ENV === 'production' && !secret) {
    return { valid: false, reason: 'WEBHOOK_SECRET_NOT_CONFIGURED: PAYMENT_WEBHOOK_SECRET is required in production' };
  }

  // Se não tem secret configurado (dev mode), permite sem assinatura
  if (!secret) {
    console.warn('[webhooks/payment] DEV MODE: No PAYMENT_WEBHOOK_SECRET configured — skipping verification');
    return { valid: true };
  }

  // Em produção, assinatura é obrigatória
  if (!signatureHeader) {
    return { valid: false, reason: 'MISSING_SIGNATURE: No signature header provided' };
  }

  // ── Formato 1: Stripe-style (t=TIMESTAMP,v1=HMAC_HEX) ────────────────
  if (signatureHeader.includes('t=') && signatureHeader.includes('v1=')) {
    const parts = signatureHeader.split(',');
    const tPart = parts.find(p => p.startsWith('t='));
    const v1Part = parts.find(p => p.startsWith('v1='));

    if (!tPart || !v1Part) {
      return { valid: false, reason: 'INVALID_SIGNATURE_FORMAT: Missing t= or v1= component' };
    }

    const timestamp = tPart.split('=')[1] || '';
    const signature = v1Part.split('=')[1] || '';

    // Replay protection: reject signatures older than 5 minutes
    const signatureAge = Date.now() - Number(timestamp) * 1000;
    if (signatureAge > 300_000) {
      return { valid: false, reason: 'SIGNATURE_EXPIRED: Webhook signature older than 5 minutes' };
    }

    // Stripe-style: HMAC(timestamp.rawBody)
    const expectedPayload = `${timestamp}.${rawBody}`;
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(expectedPayload)
      .digest('hex');

    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedHash, 'hex'),
      );
      if (!isValid) {
        return { valid: false, reason: 'SIGNATURE_MISMATCH: HMAC verification failed (Stripe format)' };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: 'SIGNATURE_ERROR: Could not compare signatures' };
    }
  }

  // ── Formato 2: Mercado Pago-style (ts=TIMESTAMP,v1=HMAC_HEX) ─────────
  if (signatureHeader.includes('ts=') && signatureHeader.includes('v1=')) {
    const parts = signatureHeader.split(',');
    const tsPart = parts.find(p => p.startsWith('ts='));
    const v1Part = parts.find(p => p.startsWith('v1='));

    if (!tsPart || !v1Part) {
      return { valid: false, reason: 'INVALID_SIGNATURE_FORMAT: Missing ts= or v1= component' };
    }

    const ts = tsPart.split('=')[1] || '';
    const v1 = v1Part.split('=')[1] || '';

    // Replay protection
    const signatureAge = Date.now() - Number(ts) * 1000;
    if (signatureAge > 300_000) {
      return { valid: false, reason: 'SIGNATURE_EXPIRED: Webhook signature older than 5 minutes' };
    }

    // MP-style: HMAC("id:TS;request:" + rawBody)
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(`id:${ts};request:`)
      .update(rawBody)
      .digest('hex');

    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(v1),
        Buffer.from(expectedHash),
      );
      if (!isValid) {
        return { valid: false, reason: 'SIGNATURE_MISMATCH: HMAC verification failed (MP format)' };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: 'SIGNATURE_ERROR: Could not compare signatures' };
    }
  }

  // ── Formato 3: Simple HMAC-SHA256 (sha256=HEX) ────────────────────────
  if (signatureHeader.startsWith('sha256=')) {
    const receivedHash = signatureHeader.slice('sha256='.length);
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(receivedHash, 'hex'),
        Buffer.from(expectedHash, 'hex'),
      );
      if (!isValid) {
        return { valid: false, reason: 'SIGNATURE_MISMATCH: HMAC verification failed (simple format)' };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: 'SIGNATURE_ERROR: Could not compare signatures' };
    }
  }

  return { valid: false, reason: 'UNKNOWN_SIGNATURE_FORMAT: Signature header format not recognized' };
}

// ── Plan Tier Resolver (amount → planTier) ────────────────────────────────────

const AMOUNT_TO_TIER: Array<{ minAmount: number; maxAmount: number; tier: string }> = [
  { minAmount: 0, maxAmount: 0, tier: 'gratuito' },
  { minAmount: 197, maxAmount: 247, tier: 'lite' },
  { minAmount: 247.01, maxAmount: 396.99, tier: 'parceiro' },
  { minAmount: 397, maxAmount: 796.99, tier: 'pro' },
  { minAmount: 797, maxAmount: Infinity, tier: 'max' },
];

function resolvePlanTier(amount: number): string {
  for (const entry of AMOUNT_TO_TIER) {
    if (amount >= entry.minAmount && amount <= entry.maxAmount) {
      return entry.tier;
    }
  }
  return 'gratuito';
}

// ── Magic Provisioning Engine ─────────────────────────────────────────────────

async function provisionNewCustomer(payload: WebhookPayload): Promise<ProvisioningResult> {
  const meta = payload.metadata || {};
  const niche = meta.niche || 'pousada';
  const planTier = meta.planType || resolvePlanTier(payload.amount || 0);
  const customerName = meta.customerName || payload.payer?.first_name || 'Proprietário';
  const customerEmail = meta.customerEmail || payload.payer?.email || '';
  const customerPhone = meta.customerPhone ||
    (payload.payer?.phone ? `${payload.payer.phone.area_code || ''}${payload.payer.phone.number || ''}` : '');
  const propertyName = meta.propertyName || '';

  // Se já temos tenantId nos metadados, é um cliente existente
  if (meta.tenantId) {
    const existingTenant = await db.tenant.findUnique({ where: { id: meta.tenantId } });
    if (existingTenant) {
      // Atualiza o plano do tenant existente
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await db.tenant.update({
        where: { id: existingTenant.id },
        data: {
          plan: planTier,
          status: 'active',
          subscriptionAt: now,
          niche: niche as string,
        },
      });

      // Atualiza a subscription existente
      if (meta.subscriptionId) {
        await db.subscription.update({
          where: { id: meta.subscriptionId },
          data: {
            status: 'active',
            paymentStatus: 'approved',
            paymentId: payload.paymentId || null,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
      }

      return {
        tenantId: existingTenant.id,
        userId: '',
        subscriptionId: meta.subscriptionId || '',
        planTier,
        niche,
        isNewTenant: false,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🪄 PROVISIONAMENTO MÁGICO — Novo Cliente
  // ═══════════════════════════════════════════════════════════════════════════

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  // 1. Cria o Tenant com isolamento multi-tenant
  const tenant = await db.tenant.create({
    data: {
      name: propertyName || customerName,
      email: customerEmail || undefined,
      phone: customerPhone || null,
      niche: niche,
      plan: planTier,
      status: 'active',
      role: 'owner',
      subscriptionAt: now,
    },
  });

  // 2. Cria o Property associado (se nome informado)
  let propertyId: string | undefined;
  if (propertyName) {
    const slug = propertyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + tenant.id.slice(-6);

    const property = await db.property.create({
      data: {
        tenantId: tenant.id,
        name: propertyName,
        type: niche === 'airbnb' ? 'airbnb' : 'pousada',
        slug,
      },
    });
    propertyId = property.id;
  }

  // 3. Cria o usuário admin da propriedade
  const adminUser = await db.user.create({
    data: {
      email: customerEmail || `admin-${tenant.id.slice(-8)}@zehla.com`,
      name: customerName,
      tenantId: tenant.id,
    },
  });

  // 4. Cria ou atualiza a Subscription
  let subscriptionId = meta.subscriptionId || '';
  if (subscriptionId) {
    await db.subscription.update({
      where: { id: subscriptionId },
      data: {
        tenantId: tenant.id,
        status: 'active',
        paymentStatus: 'approved',
        paymentId: payload.paymentId || null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
  } else {
    const subscription = await db.subscription.create({
      data: {
        tenantId: tenant.id,
        planType: planTier,
        status: 'active',
        paymentMethod: payload.amount && payload.amount >= 397 ? 'cartao' : 'pix',
        amount: payload.amount || 0,
        paymentStatus: 'approved',
        paymentId: payload.paymentId || null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
    subscriptionId = subscription.id;
  }

  // 5. Registra a transação de pagamento
  await db.paymentTransaction.create({
    data: {
      subscriptionId,
      amount: payload.amount || 0,
      status: 'approved',
      paymentMethod: payload.amount && payload.amount >= 397 ? 'cartao' : 'pix',
      externalId: payload.paymentId || '',
      metadata: JSON.stringify({
        event: payload.event,
        gatewayPayload: payload,
        provisionedAt: now.toISOString(),
      }),
    },
  });

  console.log(`[webhooks/payment] ✅ PROVISIONED: tenant=${tenant.id} plan=${planTier} niche=${niche} user=${adminUser.id}`);

  return {
    tenantId: tenant.id,
    userId: adminUser.id,
    propertyId,
    subscriptionId,
    planTier,
    niche,
    isNewTenant: true,
  };
}

// ── ZCC Telemetry Notifier (PASSO 3 — LGPD Compliant) ────────────────────────

async function notifyZCCConversion(result: ProvisioningResult, payload: WebhookPayload): Promise<void> {
  try {
    const meta = payload.metadata || {};
    const customerName = meta.customerName || payload.payer?.first_name || '';
    const amount = payload.amount || 0;

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔒 LGPD COMPLIANCE — Dados minimizados para o dashboard corporativo
    // ═══════════════════════════════════════════════════════════════════════════
    // Regra: enviar APENAS:
    //   - Iniciais do proprietário (ex: "J.S.")
    //   - Região (state do property, se disponível)
    //   - Valor do pacote (R$)
    // NÃO enviar: nome completo, email, telefone, CPF
    // ═══════════════════════════════════════════════════════════════════════════

    const lgpdInitials = customerName
      .split(' ')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('.');

    // Busca região do property (se existir)
    let region = 'N/A';
    if (result.propertyId) {
      try {
        const property = await db.property.findUnique({ where: { id: result.propertyId } });
        if (property?.state) {
          region = property.state;
        }
      } catch {
        // Property lookup failed — use default
      }
    }

    // Calcula MRR (Receita Recorrente Mensal)
    const mrrContribution = amount;

    const telemetryPayload = {
      event: 'conversion.provisioned',
      conversionData: {
        // LGPD: apenas iniciais + região + valor
        ownerInitials: lgpdInitials || 'N/A',
        region,
        packageValue: amount,
        packageCurrency: 'BRL',
        planTier: result.planTier,
        niche: result.niche,
        isNewCustomer: result.isNewTenant,
      },
      mrr: {
        contribution: mrrContribution,
        currency: 'BRL',
        period: 'monthly',
      },
      timestamp: new Date().toISOString(),
    };

    // Dispara telemetria silenciosamente (fire-and-forget)
    const zccMasterKey = process.env.ZCC_MASTER_KEY;
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    fetch(`${baseUrl}/api/zcc/burn-rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(zccMasterKey ? { 'X-ZCC-Master-Key': zccMasterKey } : {}),
      },
      body: JSON.stringify({
        event: `conversion.${result.planTier}`,
        messagesCount: 0,
        tariffsUsed: 0,
        tariffsSaved: 0,
        metaCostSpent: 0,
        metaCostSaved: mrrContribution, // Reaproveita o campo para MRR tracking
        economyPercent: 0,
        niche: result.niche as 'pousada' | 'airbnb',
        _conversionTelemetry: telemetryPayload,
      }),
    }).catch(() => {
      // Silencioso — nunca bloquear o fluxo principal por telemetria
    });

    console.log(`[webhooks/payment] 📊 ZCC NOTIFIED: initials=${lgpdInitials} region=${region} mrr=R$${mrrContribution} plan=${result.planTier}`);
  } catch (error) {
    // Telemetria nunca deve quebrar o fluxo principal
    console.error('[webhooks/payment] ZCC notification failed (non-critical):', error);
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // ── Step 1: Captura raw body para verificação de assinatura ────────────
    const rawBody = await request.text();

    // ── Step 2: Validação HMAC da assinatura ──────────────────────────────
    const signatureHeader = request.headers.get('x-signature')
      || request.headers.get('stripe-signature')
      || request.headers.get('x-hub-signature-256');
    const timestampHeader = request.headers.get('x-timestamp');
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || process.env.MP_WEBHOOK_SECRET || '';

    const verification = verifyWebhookSignature(rawBody, signatureHeader, webhookSecret, timestampHeader);

    if (!verification.valid) {
      // Em produção, rejeitar IMEDIATAMENTE
      if (process.env.NODE_ENV === 'production') {
        console.warn(`[webhooks/payment] ❌ REJECTED: ${verification.reason}`);
        return NextResponse.json(
          { error: 'SIGNATURE_INVALID', reason: verification.reason },
          { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } },
        );
      }
      // Em dev, logar warning mas continuar para testes
      console.warn(`[webhooks/payment] ⚠️ DEV WARNING: ${verification.reason} — allowing for testing`);
    }

    // ── Step 3: Parse do payload ──────────────────────────────────────────
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'INVALID_PAYLOAD', message: 'Could not parse webhook payload.' },
        { status: 400 },
      );
    }

    // ── Step 4: Roteamento por tipo de evento ─────────────────────────────
    const eventType = payload.event;

// Eventos que disparam provisionamento
    const PROVISIONING_EVENTS = ['payment.created', 'invoice.paid'];
    // Eventos que disparam atualização de status
    const STATUS_UPDATE_EVENTS = ['payment.updated'];
    // Eventos que disparam cancelamento
    const CANCELLATION_EVENTS = ['subscription.canceled', 'invoice.payment_failed'];
    // Notification bridge — Phase 2
    const { bridgePaymentEvent } = await import('@/lib/notifications/bridges');

    if (PROVISIONING_EVENTS.includes(eventType) && payload.status === 'approved') {
      // ═══════════════════════════════════════════════════════════════════════
      // 🪄 PROVISIONAMENTO MÁGICO
      // ═══════════════════════════════════════════════════════════════════════
      const result = await provisionNewCustomer(payload);

      // ── PASSO 3: Notificador ZCC (telemetria de conversão) ─────────────
      await notifyZCCConversion(result, payload);

      const durationMs = Date.now() - startTime;
      console.log(`[webhooks/payment] ✅ ${eventType} processed in ${durationMs}ms — tenant=${result.tenantId}`);

      return NextResponse.json({
        received: true,
        event: eventType,
        provisioning: {
          tenantId: result.tenantId,
          planTier: result.planTier,
          niche: result.niche,
          isNewTenant: result.isNewTenant,
        },
        processingTimeMs: durationMs,
      }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
    }

    if (STATUS_UPDATE_EVENTS.includes(eventType)) {
      // ── Atualização de status de pagamento ──────────────────────────────
      if (payload.paymentId && payload.status) {
        const transaction = await db.paymentTransaction.findFirst({
          where: { externalId: String(payload.paymentId) },
        });

        if (transaction) {
          await db.paymentTransaction.update({
            where: { id: transaction.id },
            data: { status: payload.status },
          });

          if (payload.status === 'approved') {
            const subscription = await db.subscription.findUnique({
              where: { id: transaction.subscriptionId },
            });

            if (subscription) {
              const now = new Date();
              const periodEnd = new Date(now);
              periodEnd.setMonth(periodEnd.getMonth() + 1);

              await db.subscription.update({
                where: { id: subscription.id },
                data: {
                  status: 'active',
                  paymentStatus: 'approved',
                  currentPeriodStart: now,
                  currentPeriodEnd: periodEnd,
                },
              });

              await db.tenant.update({
                where: { id: subscription.tenantId },
                data: { plan: subscription.planType, subscriptionAt: now, status: 'active' },
              });

              // ── Notification bridge: payment received ──
              try {
                bridgePaymentEvent({
                  niche: 'all',
                  paymentId: String(payload.paymentId),
                  amount: Number(transaction.amount ?? 0),
                  guestName: subscription.tenantId,
                  method: 'pix',
                  status: 'received',
                  tenantId: subscription.tenantId,
                });
              } catch (notifErr) {
                console.error('[webhooks/payment] bridgePaymentEvent error:', notifErr);
              }
            }
          } else if (payload.status === 'rejected') {
            const subscription = await db.subscription.findUnique({
              where: { id: transaction.subscriptionId },
            });
            if (subscription) {
              await db.subscription.update({
                where: { id: subscription.id },
                data: { paymentStatus: 'rejected' },
              });
              // ── Notification bridge: payment failed ──
              try {
                bridgePaymentEvent({
                  niche: 'all',
                  paymentId: String(payload.paymentId),
                  amount: Number(transaction.amount ?? 0),
                  guestName: subscription.tenantId,
                  status: 'failed',
                  tenantId: subscription.tenantId,
                });
              } catch (notifErr) {
                console.error('[webhooks/payment] bridgePaymentEvent rejected error:', notifErr);
              }
            }
          }
        }
      }

      return NextResponse.json(
        { received: true, event: eventType },
        { headers: { 'X-Security-Shield': 'zero-trust-v2' } },
      );
    }

    if (CANCELLATION_EVENTS.includes(eventType)) {
      // ── Cancelamento / Falha de pagamento ───────────────────────────────
      const meta = payload.metadata || {};
      if (meta.tenantId) {
        // Marca subscription como cancelada
        if (meta.subscriptionId) {
          await db.subscription.update({
            where: { id: meta.subscriptionId },
            data: {
              status: eventType === 'subscription.canceled' ? 'canceled' : 'pending',
              paymentStatus: 'rejected',
              cancelAtPeriodEnd: eventType === 'subscription.canceled',
            },
          });
        }

        // Tenant: suspende apenas se cancelamento definitivo
        if (eventType === 'subscription.canceled') {
          await db.tenant.update({
            where: { id: meta.tenantId },
            data: { status: 'suspended' },
          });
        }
      }

      return NextResponse.json(
        { received: true, event: eventType, action: 'cancellation_processed' },
        { headers: { 'X-Security-Shield': 'zero-trust-v2' } },
      );
    }

    // ── Evento não reconhecido — ack silencioso ──────────────────────────
    console.log(`[webhooks/payment] Unhandled event: ${eventType} — acknowledging silently`);
    return NextResponse.json(
      { received: true, event: eventType },
      { headers: { 'X-Security-Shield': 'zero-trust-v2' } },
    );
  } catch (error) {
    console.error('[webhooks/payment] CRITICAL ERROR:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v2' } },
    );
  }
}

// ── GET: Health check (útil para monitoramento) ──────────────────────────────
export async function GET() {
  return NextResponse.json({
    status: 'active',
    route: '/api/webhooks/payment',
    version: 'v2-zero-trust',
    supportedEvents: [
      'payment.created',
      'payment.updated',
      'invoice.paid',
      'invoice.payment_failed',
      'subscription.canceled',
    ],
    security: {
      hmacVerification: true,
      replayProtection: true,
      timingSafeComparison: true,
    },
  });
}
