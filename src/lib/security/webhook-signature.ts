/**
 * Webhook Signature Verification — Meta + Mercado Pago
 * ============================================================================
 *
 * Valida OBRIGATORIAMENTE a assinatura HMAC de webhooks recebidos da
 * Meta (WhatsApp Business API) e do Mercado Pago. Sem isso, qualquer um
 * pode forjar webhooks e executar ações em nome do provedor.
 * ============================================================================
 */

import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const META_APP_SECRET = process.env.META_APP_SECRET || '';
const MP_WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET || '';

// ─────────────────────────────────────────────────────────────────────────────
// META WEBHOOK — X-Hub-Signature-256 (HMAC SHA256)
// ─────────────────────────────────────────────────────────────────────────────
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string = META_APP_SECRET,
): boolean {
  if (!appSecret) {
    console.error('[META_WEBHOOK] META_APP_SECRET não configurada');
    return false;
  }

  if (!signatureHeader) {
    console.error('[META_WEBHOOK] Header X-Hub-Signature-256 ausente');
    return false;
  }

  // Formato esperado: "sha256=<hex>"
  const expectedPrefix = 'sha256=';
  if (!signatureHeader.startsWith(expectedPrefix)) {
    console.error('[META_WEBHOOK] Formato inválido (esperado "sha256=...")');
    return false;
  }

  const receivedSignature = signatureHeader.slice(expectedPrefix.length);
  const computedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  // Timing-safe comparison (evita timing attacks)
  try {
    const received = Buffer.from(receivedSignature, 'hex');
    const computed = Buffer.from(computedSignature, 'hex');

    if (received.length !== computed.length) {
      console.error('[META_WEBHOOK] Tamanho da assinatura não confere');
      return false;
    }

    return crypto.timingSafeEqual(received, computed);
  } catch (err) {
    console.error('[META_WEBHOOK] Erro ao comparar assinaturas:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MERCADO PAGO WEBHOOK — x-signature + x-request-id
// ─────────────────────────────────────────────────────────────────────────────
export function verifyMercadoPagoWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  requestIdHeader: string | null,
  webhookSecret: string = MP_WEBHOOK_SECRET,
): boolean {
  if (!webhookSecret) {
    console.error('[MP_WEBHOOK] MERCADOPAGO_WEBHOOK_SECRET não configurada');
    return false;
  }

  if (!signatureHeader) {
    console.error('[MP_WEBHOOK] Header x-signature ausente');
    return false;
  }

  // Mercado Pago assina: HMAC SHA256 de (data_id + "|" + data.timestamp)
  // O header x-signature contém "ts=TIMESTAMP,v1=SIGNATURE"
  const parts = signatureHeader.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key.trim()] = value;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts['ts'];
  const receivedSignature = parts['v1'];

  if (!timestamp || !receivedSignature) {
    console.error('[MP_WEBHOOK] Assinatura malformada (esperado ts=...,v1=...)');
    return false;
  }

  // Tolerância de tempo (5 minutos para evitar replay attacks)
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (Math.abs(now - ts) > 300) {
    console.error('[MP_WEBHOOK] Timestamp fora da janela tolerada (replay?)');
    return false;
  }

  // Parse do body para pegar data.id
  let dataId = '';
  try {
    const body = JSON.parse(rawBody);
    dataId = body?.data?.id || body?.id || '';
  } catch {
    dataId = '';
  }

  // Manifest para assinatura: "id:<data_id>;ts:<timestamp>;"
  const manifest = `id:${dataId};ts:${timestamp};`;
  const computedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(manifest, 'utf8')
    .digest('hex');

  // Timing-safe comparison
  try {
    const received = Buffer.from(receivedSignature, 'hex');
    const computed = Buffer.from(computedSignature, 'hex');

    if (received.length !== computed.length) {
      console.error('[MP_WEBHOOK] Tamanho da assinatura não confere');
      return false;
    }

    return crypto.timingSafeEqual(received, computed);
  } catch (err) {
    console.error('[MP_WEBHOOK] Erro ao comparar assinaturas:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — Para uso em API routes
// ─────────────────────────────────────────────────────────────────────────────
export interface WebhookVerifyResult {
  valid: boolean;
  error?: string;
}

/**
 * Helper para validar webhook Meta.
 *
 * @example
 * export async function POST(req: NextRequest) {
 *   const rawBody = await req.text();
 *   const signature = req.headers.get('x-hub-signature-256');
 *   const verify = verifyMetaWebhook(rawBody, signature);
 *   if (!verify.valid) {
 *     return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
 *   }
 *   // processa webhook
 * }
 */
export function verifyMetaWebhook(
  rawBody: string,
  signatureHeader: string | null,
): WebhookVerifyResult {
  const valid = verifyMetaWebhookSignature(rawBody, signatureHeader);
  return valid
    ? { valid: true }
    : { valid: false, error: 'Invalid Meta signature' };
}

/**
 * Helper para validar webhook Mercado Pago.
 */
export function verifyMercadoPagoWebhook(
  rawBody: string,
  signatureHeader: string | null,
  requestIdHeader: string | null,
): WebhookVerifyResult {
  const valid = verifyMercadoPagoWebhookSignature(rawBody, signatureHeader, requestIdHeader);
  return valid
    ? { valid: true }
    : { valid: false, error: 'Invalid Mercado Pago signature' };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUÇÃO — Lance alerta se secret não estiver configurado
// ─────────────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  if (!META_APP_SECRET) {
    console.error('⚠️ [SECURITY] META_APP_SECRET não configurada! Webhooks Meta NÃO serão validados.');
  }
  if (!MP_WEBHOOK_SECRET) {
    console.error('⚠️ [SECURITY] MERCADOPAGO_WEBHOOK_SECRET não configurada! Webhooks MP NÃO serão validados.');
  }
}
