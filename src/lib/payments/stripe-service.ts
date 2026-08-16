/**
 * Stripe Payment Service — Cobrança automática via cartão de crédito
 * ============================================================================
 *
 * Modelo:
 *   - Dono da pousada cadastra cartão de crédito uma única vez (SetupIntent)
 *   - No fim de cada mês, sistema cobra automaticamente 7% dos UPSELLs confirmados
 *   - Não há PIX manual — tudo é processado pela Stripe
 *
 * Fluência:
 *   1. setupIntent() → retorna client_secret para o frontend montar o cartão
 *   2. attachPaymentMethod(tenantId, paymentMethodId) → salva o cartão
 *   3. cobrarComissaoMensal(tenantId, mes, ano) → cobra no fim do mês
 *   4. webhook Stripe → confirma pagamento e atualiza status dos UpsellRecords
 * ============================================================================
 */

import { db } from '@/lib/db';
import {
  listarUpsells,
  marcarComoPago,
} from '@/lib/upsell/upsell-engine';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO STRIPE
// ─────────────────────────────────────────────────────────────────────────────
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// Taxa Zélla sobre UPSELL (7% — alinhado com COMISSAO_ZELLA_RATE)
const TAXA_ZELLA = 0.07;

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export interface SetupIntentResult {
  client_secret: string;
  setup_intent_id: string;
}

export interface CobrancaResult {
  success: boolean;
  payment_intent_id?: string;
  error?: string;
  amount_charged: number;
  upsell_ids: string[];
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS STRIPE
// ─────────────────────────────────────────────────────────────────────────────
function getStripeAPI() {
  if (!STRIPE_SECRET_KEY) return null;
  // Lazy import — só carrega se tiver chave configurada
  try {
    // Em produção, usar: import Stripe from 'stripe'
    // Para evitar dependência circular, fazemos fetch direto à API REST do Stripe
    return {
      baseUrl: 'https://api.stripe.com/v1',
      secretKey: STRIPE_SECRET_KEY,
    };
  } catch {
    return null;
  }
}

async function stripeRequest(endpoint: string, body: URLSearchParams, method: 'POST' | 'GET' = 'POST') {
  const api = getStripeAPI();
  if (!api) throw new Error('STRIPE_SECRET_KEY não configurada');

  const res = await fetch(`${api.baseUrl}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${api.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'POST' ? body.toString() : undefined,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `Stripe API error: ${res.status}`);
  }

  return await res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP INTENT — para cadastrar cartão (frontend usa Stripe.js)
// ─────────────────────────────────────────────────────────────────────────────
export async function criarSetupIntent(tenantId: string): Promise<SetupIntentResult> {
  try {
    const body = new URLSearchParams();
    body.append('payment_method_types[]', 'card');
    body.append('metadata[tenant_id]', tenantId);
    body.append('metadata[purpose]', 'upsell_comission_auto');
    body.append('description', `Zélla UPSELL - cadastro cartão pousada ${tenantId}`);

    const result = await stripeRequest('/setup_intents', body);
    return {
      client_secret: result.client_secret,
      setup_intent_id: result.id,
    };
  } catch (err) {
    console.error('[STRIPE] criarSetupIntent falhou:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANEXAR PAYMENT METHOD AO CUSTOMER — salva cartão para uso futuro
// ─────────────────────────────────────────────────────────────────────────────
export async function attachPaymentMethod(
  tenantId: string,
  paymentMethodId: string,
): Promise<{ success: boolean; customer_id?: string; error?: string }> {
  try {
    // 1. Busca ou cria Customer no Stripe
    let customerId = await getOrCreateStripeCustomer(tenantId);

    // 2. Anexa payment_method ao customer
    const attachBody = new URLSearchParams();
    attachBody.append('customer', customerId);
    await stripeRequest(`/payment_methods/${paymentMethodId}`, attachBody, 'POST');

    // 3. Seta como default
    const updateBody = new URLSearchParams();
    updateBody.append('invoice_settings[default_payment_method]', paymentMethodId);
    await stripeRequest(`/customers/${customerId}`, updateBody, 'POST');

    // 4. Salva no Tenant (Prisma) — adicionar campos stripe_customer_id e stripe_payment_method_id
    if (db) {
      await (db as any).tenant.update({
        where: { id: tenantId },
        data: {
          // Campos hipotéticos — adicionar ao Prisma schema se necessário
          // stripeCustomerId: customerId,
          // stripePaymentMethodId: paymentMethodId,
          // stripeSetupAt: new Date(),
        } as any,
      }).catch(() => { /* ignora se campos não existem */ });
    }

    return { success: true, customer_id: customerId };
  } catch (err: any) {
    console.error('[STRIPE] attachPaymentMethod falhou:', err);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSCA OU CRIA CUSTOMER STRIPE POR TENANT
// ─────────────────────────────────────────────────────────────────────────────
async function getOrCreateStripeCustomer(tenantId: string): Promise<string> {
  // Em produção, buscar stripe_customer_id do Tenant no banco
  // Se não existir, cria no Stripe e salva
  try {
    if (db) {
      const tenant = await (db as any).tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, email: true, /* stripeCustomerId: true */ },
      }).catch(() => null);

      // if (tenant?.stripeCustomerId) return tenant.stripeCustomerId;
    }

    // Cria customer no Stripe
    const body = new URLSearchParams();
    body.append('metadata[tenant_id]', tenantId);
    body.append('description', `Pousada ${tenantId} - Zélla UPSELL`);

    const result = await stripeRequest('/customers', body);
    return result.id;
  } catch (err) {
    console.error('[STRIPE] getOrCreateStripeCustomer falhou:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COBRAR COMISSÃO MENSAL — cobra 7% dos UPSELLs confirmados do mês
// ─────────────────────────────────────────────────────────────────────────────
export async function cobrarComissaoMensal(
  tenantId: string,
  mes: number,
  ano: number,
): Promise<CobrancaResult> {
  try {
    // 1. Busca todos os UPSELLs confirmados do mês (ainda não pagos)
    const startDate = new Date(ano, mes - 1, 1);
    const endDate = new Date(ano, mes, 0, 23, 59, 59);

    const upsells = await listarUpsells({
      tenantId,
      startDate,
      endDate,
      status: 'confirmed',
      limit: 1000,
    });

    if (upsells.length === 0) {
      return {
        success: true,
        amount_charged: 0,
        upsell_ids: [],
      };
    }

    // 2. Calcula total a cobrar (7% já está no comissionAmount)
    const totalCentavos = Math.round(
      upsells.reduce((s, u) => s + u.comissionAmount, 0) * 100,
    );

    if (totalCentavos <= 0) {
      return {
        success: true,
        amount_charged: 0,
        upsell_ids: upsells.map((u) => u.id),
      };
    }

    // 3. Busca customer ID e payment method default
    const customerId = await getOrCreateStripeCustomer(tenantId);
    // const paymentMethodId = await getDefaultPaymentMethod(tenantId);

    // 4. Cria PaymentIntent
    const body = new URLSearchParams();
    body.append('amount', String(totalCentavos));
    body.append('currency', 'brl');
    body.append('customer', customerId);
    body.append('description', `Zélla UPSELL - Comissão ${mes}/${ano} - 7% sobre ${upsells.length} UPSELLs`);
    body.append('metadata[tenant_id]', tenantId);
    body.append('metadata[mes]', String(mes));
    body.append('metadata[ano]', String(ano));
    body.append('metadata[upsell_count]', String(upsells.length));
    body.append('metadata[upsell_ids]', upsells.map((u) => u.id).join(','));
    body.append('metadata[taxa_zehla]', String(TAXA_ZELLA));
    // body.append('payment_method', paymentMethodId);
    body.append('off_session', 'true'); // cobrança automática sem interação do cliente
    body.append('confirm', 'true');

    const result = await stripeRequest('/payment_intents', body);

    // 5. Se sucesso, marca UPSELLs como pagos
    if (result.status === 'succeeded') {
      await marcarComoPago(upsells.map((u) => u.id), tenantId);
    }

    return {
      success: result.status === 'succeeded',
      payment_intent_id: result.id,
      amount_charged: totalCentavos / 100,
      upsell_ids: upsells.map((u) => u.id),
    };
  } catch (err: any) {
    console.error('[STRIPE] cobrarComissaoMensal falhou:', err);
    return {
      success: false,
      error: err.message,
      amount_charged: 0,
      upsell_ids: [],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR MÉTODOS DE PAGAMENTO DO TENANT
// ─────────────────────────────────────────────────────────────────────────────
export async function listarMetodosPagamento(tenantId: string): Promise<PaymentMethod[]> {
  try {
    const customerId = await getOrCreateStripeCustomer(tenantId);
    const body = new URLSearchParams();
    body.append('customer', customerId);
    body.append('type', 'card');

    const result = await stripeRequest('/payment_methods', body, 'GET');
    return (result.data || []).map((pm: any) => ({
      id: pm.id,
      brand: pm.card?.brand || 'unknown',
      last4: pm.card?.last4 || '****',
      exp_month: pm.card?.exp_month || 0,
      exp_year: pm.card?.exp_year || 0,
      is_default: false,
    }));
  } catch (err) {
    console.error('[STRIPE] listarMetodosPagamento falhou:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAR WEBHOOK (chamado pela rota /api/stripe/webhook)
// ─────────────────────────────────────────────────────────────────────────────
export async function processarWebhookStripe(payload: any, signature: string): Promise<{
  received: boolean;
  type?: string;
  data?: any;
}> {
  try {
    // Em produção: usar stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET)
    // Aqui simplificado — apenas processa o evento
    const event = typeof payload === 'string' ? JSON.parse(payload) : payload;

    switch (event.type) {
      case 'payment_intent.succeeded':
        // Marca UPSELLs como pagos
        const metadata = event.data?.object?.metadata || {};
        if (metadata.tenant_id && metadata.upsell_ids) {
          const upsellIds = metadata.upsell_ids.split(',');
          await marcarComoPago(upsellIds, metadata.tenant_id);
        }
        break;

      case 'payment_intent.payment_failed':
        // Notifica o dono da pousada que a cobrança falhou
        console.warn('[STRIPE] Pagamento falhou:', event.data?.object?.id);
        break;

      default:
        // Evento não processado
        break;
    }

    return { received: true, type: event.type, data: event.data };
  } catch (err) {
    console.error('[STRIPE] processarWebhookStripe falhou:', err);
    return { received: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS DA INTEGRAÇÃO — para o DDC mostrar se cartão está cadastrado
// ─────────────────────────────────────────────────────────────────────────────
export async function statusIntegracaoStripe(tenantId: string): Promise<{
  stripe_configured: boolean;
  has_payment_method: boolean;
  default_card?: PaymentMethod;
}> {
  try {
    if (!STRIPE_SECRET_KEY) {
      return { stripe_configured: false, has_payment_method: false };
    }

    const methods = await listarMetodosPagamento(tenantId);
    if (methods.length === 0) {
      return { stripe_configured: true, has_payment_method: false };
    }

    return {
      stripe_configured: true,
      has_payment_method: true,
      default_card: methods[0],
    };
  } catch (err) {
    console.error('[STRIPE] statusIntegracaoStripe falhou:', err);
    return { stripe_configured: false, has_payment_method: false };
  }
}
