/**
 * Mercado Pago Payment Service — Cobrança automática via cartão de crédito
 * ============================================================================
 *
 * Substitui o Stripe — agora usamos Mercado Pago (gateway brasileiro).
 *
 * Modelo:
 *   - Dono da pousada cadastra cartão de crédito uma única vez (Customer + Card)
 *   - No fim de cada mês, sistema cobra automaticamente 7% dos UPSELLs confirmados
 *   - Não há PIX manual — tudo é processado pelo Mercado Pago
 *
 * Fluxo:
 *   1. criarCustomer(tenantId) → cria customer no Mercado Pago
 *   2. attachCard(tenantId, cardToken) → salva cartão
 *   3. cobrarComissaoMensal(tenantId, mes, ano) → cobra no fim do mês
 *   4. webhook Mercado Pago → confirma pagamento e atualiza UpsellRecords
 *
 * Variáveis de ambiente necessárias:
 *   - MERCADOPAGO_ACCESS_TOKEN (production)
 *   - MERCADOPAGO_PUBLIC_KEY (frontend para gerar card token)
 *   - MERCADOPAGO_WEBHOOK_SECRET (validar webhook)
 * ============================================================================
 */

import { db } from '@/lib/db';
import {
  listarUpsells,
  marcarComoPago,
} from '@/lib/upsell/upsell-engine';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO MERCADO PAGO
// ─────────────────────────────────────────────────────────────────────────────
const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const MP_PUBLIC_KEY = process.env.MERCADOPAGO_PUBLIC_KEY || '';
const MP_WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET || '';

// Taxa Zélla sobre UPSELL (7%)
const TAXA_ZELLA = 0.07;

const MP_API_BASE = 'https://api.mercadopago.com';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export interface MercadoPagoCustomer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface MercadoPagoCard {
  id: string;
  brand: string;       // visa, mastercard, amex, elo, hipercard
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
  cardholder_name: string;
}

export interface CobrancaResult {
  success: boolean;
  payment_id?: string;       // ID do pagamento no MP
  status?: string;            // approved, pending, rejected
  error?: string;
  amount_charged: number;
  upsell_ids: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — chamada à API REST do Mercado Pago
// ─────────────────────────────────────────────────────────────────────────────
async function mpRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
  body?: Record<string, unknown>,
  idempotencyKey?: string,
) {
  if (!MP_ACCESS_TOKEN) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurada');
  }

  const res = await fetch(`${MP_API_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
    },
    body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const errMsg = data?.message || data?.error || data?.cause?.[0]?.description || `MP API error: ${res.status}`;
    throw new Error(errMsg);
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRIAR CUSTOMER NO MERCADO PAGO
// ─────────────────────────────────────────────────────────────────────────────
export async function criarCustomer(
  tenantId: string,
  email: string,
  firstName?: string,
  lastName?: string,
): Promise<MercadoPagoCustomer> {
  try {
    // 1. Verifica se tenant já tem customer_id salvo
    const existingCustomerId = await getExistingCustomerId(tenantId);
    if (existingCustomerId) {
      // Busca customer existente
      const existing = await mpRequest(`/v1/customers/${existingCustomerId}`, 'GET');
      return {
        id: existing.id,
        email: existing.email,
        first_name: existing.first_name,
        last_name: existing.last_name,
      };
    }

    // 2. Cria novo customer
    const body: any = {
      email,
      metadata: {
        tenant_id: tenantId,
        purpose: 'upsell_comission_auto',
      },
    };
    if (firstName) body.first_name = firstName;
    if (lastName) body.last_name = lastName;

    const result = await mpRequest('/v1/customers', 'POST', body);

    // 3. Salva customer_id no Tenant (campo novo)
    if (db) {
      await (db as any).tenant.update({
        where: { id: tenantId },
        data: {
          // stripeCustomerId → renomear para mpCustomerId
          // mpCustomerId: result.id,
        } as any,
      }).catch(() => { /* campo ainda não existe no schema */ });
    }

    return {
      id: result.id,
      email: result.email,
      first_name: result.first_name,
      last_name: result.last_name,
    };
  } catch (err: any) {
    console.error('[MERCADO_PAGO] criarCustomer falhou:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANEXAR CARTÃO AO CUSTOMER
// ─────────────────────────────────────────────────────────────────────────────
export async function attachCard(
  tenantId: string,
  cardToken: string,  // token gerado pelo SDK Mercado Pago no frontend
): Promise<{ success: boolean; card?: MercadoPagoCard; error?: string }> {
  try {
    // Busca tenant para obter email
    let email = '';
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (db) {
      const tenant = await (db as any).tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, email: true },
      }).catch(() => null);
      email = tenant?.email || `tenant-${tenantId}@zella.com`;
      const parts = (tenant?.name || '').split(' ');
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }

    // 1. Cria ou reutiliza customer
    const customer = await criarCustomer(tenantId, email, firstName, lastName);

    // 2. Cria card a partir do token
    const cardBody = {
      token: cardToken,
      customer_id: customer.id,
    };
    const cardResult = await mpRequest(`/v1/customers/${customer.id}/cards`, 'POST', cardBody);

    const card: MercadoPagoCard = {
      id: cardResult.id,
      brand: cardResult.payment_method?.id || 'unknown',
      last4: cardResult.last_four_digits || '****',
      exp_month: cardResult.exp_month || 0,
      exp_year: cardResult.exp_year || 0,
      is_default: true,
      cardholder_name: cardResult.cardholder?.name || '',
    };

    return { success: true, card };
  } catch (err: any) {
    console.error('[MERCADO_PAGO] attachCard falhou:', err);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR CARTÕES DO TENANT
// ─────────────────────────────────────────────────────────────────────────────
export async function listarCartoes(tenantId: string): Promise<MercadoPagoCard[]> {
  try {
    const customerId = await getExistingCustomerId(tenantId);
    if (!customerId) return [];

    const result = await mpRequest(`/v1/customers/${customerId}/cards`, 'GET');
    return (result || []).map((card: any) => ({
      id: card.id,
      brand: card.payment_method?.id || 'unknown',
      last4: card.last_four_digits || '****',
      exp_month: card.exp_month || 0,
      exp_year: card.exp_year || 0,
      is_default: false,
      cardholder_name: card.cardholder?.name || '',
    }));
  } catch (err) {
    console.error('[MERCADO_PAGO] listarCartoes falhou:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COBRAR COMISSÃO MENSAL — cobra 7% dos UPSELLs confirmados via cartão
// ─────────────────────────────────────────────────────────────────────────────
export async function cobrarComissaoMensal(
  tenantId: string,
  mes: number,
  ano: number,
): Promise<CobrancaResult> {
  try {
    // 1. Busca UPSELLs confirmados do mês (ainda não pagos)
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
      return { success: true, amount_charged: 0, upsell_ids: [] };
    }

    // 2. Total a cobrar (já é 7% — armazenado em comissionAmount)
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

    // 3. Busca customer + cartão default
    const customerId = await getExistingCustomerId(tenantId);
    if (!customerId) {
      throw new Error('Cliente sem cartão cadastrado no Mercado Pago');
    }
    const cards = await listarCartoes(tenantId);
    if (cards.length === 0) {
      throw new Error('Nenhum cartão cadastrado');
    }
    const card = cards[0];

    // 4. Cria Payment no Mercado Pago
    const paymentBody = {
      transaction_amount: totalCentavos / 100,
      token: card.id,  // card_id salvo
      installments: 1,   // à vista (sem parcelamento)
      description: `Zélla UPSELL — Comissão ${mes}/${ano} — 7% sobre ${upsells.length} UPSELLs`,
      payment_method_id: card.brand,  // visa, mastercard, etc.
      payer: {
        type: 'customer',
        id: customerId,
      },
      metadata: {
        tenant_id: tenantId,
        mes,
        ano,
        upsell_count: upsells.length,
        upsell_ids: upsells.map((u) => u.id).join(','),
        taxa_zehla: TAXA_ZELLA,
        purpose: 'upsell_comission_auto',
      },
      statement_descriptor: 'ZEHLA UPSELL',
      // Captura automática (off_session)
      capture: true,
    };

    const result = await mpRequest(
      '/v1/payments',
      'POST',
      paymentBody,
      `upsell-${tenantId}-${ano}-${mes}`,  // idempotency key
    );

    // 5. Se aprovado, marca UPSELLs como pagos
    if (result.status === 'approved') {
      await marcarComoPago(upsells.map((u) => u.id), tenantId);
    }

    return {
      success: result.status === 'approved',
      payment_id: String(result.id),
      status: result.status,
      amount_charged: result.transaction_amount,
      upsell_ids: upsells.map((u) => u.id),
    };
  } catch (err: any) {
    console.error('[MERCADO_PAGO] cobrarComissaoMensal falhou:', err);
    return {
      success: false,
      error: err.message,
      amount_charged: 0,
      upsell_ids: [],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESSAR WEBHOOK — atualiza status dos UpsellRecords
// ─────────────────────────────────────────────────────────────────────────────
export async function processarWebhookMercadoPago(payload: any): Promise<{
  received: boolean;
  type?: string;
  data?: any;
}> {
  try {
    const eventType = payload?.type || payload?.action;
    const data = payload?.data || payload;

    switch (eventType) {
      case 'payment':
      case 'payment.created':
      case 'payment.updated':
      case 'payment.approved': {
        // Payment aprovado — marca UPSELLs como pagos
        const paymentInfo = data?.object || data;
        const metadata = paymentInfo?.metadata || {};
        if (metadata.tenant_id && metadata.upsell_ids) {
          const upsellIds = String(metadata.upsell_ids).split(',').filter(Boolean);
          await marcarComoPago(upsellIds, metadata.tenant_id);
        }
        break;
      }

      case 'payment.rejected':
      case 'payment.failed':
        console.warn('[MERCADO_PAGO] Pagamento rejeitado:', data?.id || data?.object?.id);
        break;

      default:
        // Evento não relevante
        break;
    }

    return { received: true, type: eventType, data };
  } catch (err) {
    console.error('[MERCADO_PAGO] processarWebhookMercadoPago falhou:', err);
    return { received: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS DA INTEGRAÇÃO — verifica se tenant tem cartão cadastrado
// ─────────────────────────────────────────────────────────────────────────────
export async function statusIntegracaoMercadoPago(tenantId: string): Promise<{
  mercado_pago_configured: boolean;
  has_card: boolean;
  default_card?: MercadoPagoCard;
}> {
  try {
    if (!MP_ACCESS_TOKEN) {
      return { mercado_pago_configured: false, has_card: false };
    }

    const cards = await listarCartoes(tenantId);
    if (cards.length === 0) {
      return { mercado_pago_configured: true, has_card: false };
    }

    return {
      mercado_pago_configured: true,
      has_card: true,
      default_card: cards[0],
    };
  } catch (err) {
    console.error('[MERCADO_PAGO] statusIntegracaoMercadoPago falhou:', err);
    return { mercado_pago_configured: false, has_card: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAVE PÚBLICA — para o frontend inicializar SDK do Mercado Pago
// ─────────────────────────────────────────────────────────────────────────────
export function getMercadoPagoPublicKey(): string {
  return MP_PUBLIC_KEY;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER INTERNO — busca customer_id salvo no Tenant
// ─────────────────────────────────────────────────────────────────────────────
async function getExistingCustomerId(tenantId: string): Promise<string | null> {
  try {
    if (!db) return null;
    const tenant = await (db as any).tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        // mpCustomerId: true  // futuro campo
      },
    }).catch(() => null);

    // return tenant?.mpCustomerId || null;
    return null;  // ainda não temos o campo — criar migration quando necessário
  } catch {
    return null;
  }
}
