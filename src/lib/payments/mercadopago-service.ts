import { db } from '@/lib/db';
import { listarUpsells, marcarComoPago } from '@/lib/upsell/upsell-engine';

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const MP_API_BASE = 'https://api.mercadopago.com';
const TAXA_ZELLA = 0.07;

export interface MercadoPagoCustomer { id: string; email: string; first_name?: string; last_name?: string; }
export interface MercadoPagoCard { id: string; brand: string; last4: string; exp_month: number; exp_year: number; is_default: boolean; cardholder_name: string; }
export interface CobrancaResult { success: boolean; payment_id?: string; status?: string; error?: string; amount_charged: number; upsell_ids: string[]; }

async function mpRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST', body?: Record<string, unknown>, idempotencyKey?: string) {
  if (!MP_ACCESS_TOKEN) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurada');
  const res = await fetch(`${MP_API_BASE}${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}) },
    body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.message || data?.error || data?.cause?.[0]?.description || `MP API error: ${res.status}`);
  return data;
}

export async function criarCustomer(tenantId: string, email: string, firstName?: string, lastName?: string): Promise<MercadoPagoCustomer> {
  const existingCustomerId = await getExistingCustomerId(tenantId, email);
  if (existingCustomerId) {
    const existing = await mpRequest(`/v1/customers/${encodeURIComponent(existingCustomerId)}`, 'GET');
    return { id: String(existing.id), email: existing.email, first_name: existing.first_name, last_name: existing.last_name };
  }
  const body: any = { email, metadata: { tenant_id: tenantId, purpose: 'upsell_comission_auto' } };
  if (firstName) body.first_name = firstName;
  if (lastName) body.last_name = lastName;
  const result = await mpRequest('/v1/customers', 'POST', body, `customer:${tenantId}`);
  return { id: String(result.id), email: result.email, first_name: result.first_name, last_name: result.last_name };
}

export async function attachCard(tenantId: string, cardToken: string): Promise<{ success: boolean; card?: MercadoPagoCard; error?: string }> {
  try {
    if (!cardToken || cardToken.length < 8) return { success: false, error: 'INVALID_CARD_TOKEN' };
    const tenant = await (db as any).tenant.findUnique({ where: { id: tenantId }, select: { name: true, email: true } });
    if (!tenant) return { success: false, error: 'TENANT_NOT_FOUND' };
    const email = tenant.email || `tenant-${tenantId}@zella.com`;
    const parts = String(tenant.name || '').trim().split(/\s+/);
    const customer = await criarCustomer(tenantId, email, parts[0], parts.slice(1).join(' '));
    const cardResult = await mpRequest(`/v1/customers/${encodeURIComponent(customer.id)}/cards`, 'POST', { token: cardToken, customer_id: customer.id }, `card:${tenantId}:${cardToken}`);
    return { success: true, card: { id: String(cardResult.id), brand: cardResult.payment_method?.id || 'unknown', last4: cardResult.last_four_digits || '****', exp_month: cardResult.exp_month || 0, exp_year: cardResult.exp_year || 0, is_default: true, cardholder_name: cardResult.cardholder?.name || '' } };
  } catch (err: any) { console.error('[MERCADO_PAGO] attachCard falhou:', err); return { success: false, error: err.message }; }
}

export async function listarCartoes(tenantId: string): Promise<MercadoPagoCard[]> {
  try {
    const customerId = await getExistingCustomerId(tenantId);
    if (!customerId) return [];
    const result = await mpRequest(`/v1/customers/${encodeURIComponent(customerId)}/cards`, 'GET');
    return (result || []).map((card: any) => ({ id: String(card.id), brand: card.payment_method?.id || 'unknown', last4: card.last_four_digits || '****', exp_month: card.exp_month || 0, exp_year: card.exp_year || 0, is_default: false, cardholder_name: card.cardholder?.name || '' }));
  } catch (err) { console.error('[MERCADO_PAGO] listarCartoes falhou:', err); return []; }
}

export async function cobrarComissaoMensal(tenantId: string, mes: number, ano: number): Promise<CobrancaResult> {
  const upsells = await listarUpsells({ tenantId, status: 'CONFIRMED' as any });
  const target = upsells.filter((u: any) => { const d = new Date(u.createdAt || u.created_at || Date.now()); return d.getMonth() + 1 === mes && d.getFullYear() === ano; });
  const total = target.reduce((sum: number, u: any) => sum + Number(u.price || u.amount || 0), 0);
  const amount = Number((total * TAXA_ZELLA).toFixed(2));
  if (amount <= 0) return { success: true, status: 'nothing_to_charge', amount_charged: 0, upsell_ids: [] };
  const customerId = await getExistingCustomerId(tenantId);
  if (!customerId) return { success: false, error: 'MP_CUSTOMER_NOT_FOUND', amount_charged: amount, upsell_ids: target.map((u: any) => u.id) };
  try {
    const result = await mpRequest('/v1/payments', 'POST', { transaction_amount: amount, description: `Comissão Zélla ${mes}/${ano}`, payer: { id: customerId }, metadata: { tenant_id: tenantId, period: `${ano}-${String(mes).padStart(2, '0')}` } }, `commission:${tenantId}:${ano}-${String(mes).padStart(2, '0')}`);
    if (result.status === 'approved') await marcarComoPago(target.map((u: any) => u.id), tenantId);
    return { success: true, payment_id: String(result.id), status: result.status, amount_charged: amount, upsell_ids: target.map((u: any) => u.id) };
  } catch (err: any) { return { success: false, error: err.message, amount_charged: amount, upsell_ids: target.map((u: any) => u.id) }; }
}

export async function processarWebhookMercadoPago(body: any): Promise<{ received: boolean; type: string }> {
  const type = String(body?.type || body?.action || 'unknown');
  const paymentId = body?.data?.id || body?.id;
  if (!paymentId) return { received: false, type };
  if (type === 'payment' || type.startsWith('payment.')) {
    const payment = await mpRequest(`/v1/payments/${encodeURIComponent(String(paymentId))}`, 'GET');
    console.info('[MP_WEBHOOK] verified provider payment', { paymentId: String(paymentId), status: String(payment?.status || 'unknown') });
  }
  return { received: true, type };
}

async function getExistingCustomerId(tenantId: string, emailHint?: string): Promise<string | null> {
  const tenant = await (db as any).tenant.findUnique({ where: { id: tenantId }, select: { email: true } });
  const email = tenant?.email || emailHint;
  if (!email) return null;
  try {
    const result = await mpRequest(`/v1/customers/search?email=${encodeURIComponent(email)}`, 'GET');
    const customers = Array.isArray(result?.results) ? result.results : [];
    const exact = customers.find((c: any) => String(c.email || '').toLowerCase() === String(email).toLowerCase());
    return exact?.id ? String(exact.id) : null;
  } catch (error) {
    console.error('[MERCADO_PAGO] customer lookup failed:', error);
    return null;
  }
}
