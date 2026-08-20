import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createError } from '@/lib/error-handler';
import { authRatelimit } from '@/lib/rate-limit';

const MP_TIMEOUT_MS = 8000;
const PAYMENT_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

export async function GET(request: NextRequest) {
  try {
    const paymentId = new URL(request.url).searchParams.get('payment_id');
    if (!paymentId || !PAYMENT_ID_RE.test(paymentId)) return createError(400, 'INVALID_PAYMENT_ID', 'payment_id inválido');

    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return createError(401, 'UNAUTHORIZED', 'Faça login primeiro');

    const { success: allowed } = await authRatelimit.limit(tenantId);
    if (!allowed) return createError(429, 'RATE_LIMITED', 'Muitas requisições');

    // Bind the externally supplied payment id to the authenticated tenant before calling Mercado Pago.
    const transaction = await db.paymentTransaction.findFirst({ where: { externalId: paymentId } });
    if (!transaction) return createError(404, 'TRANSACTION_NOT_FOUND', 'Transação não encontrada');

    const subscription = await db.subscription.findUnique({ where: { id: transaction.subscriptionId } });
    if (!subscription || subscription.tenantId !== tenantId) return createError(403, 'FORBIDDEN', 'Esta transação não pertence à sua conta');

    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) return createError(503, 'MP_NOT_CONFIGURED', 'Serviço de pagamento indisponível');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MP_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: controller.signal,
        redirect: 'error',
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // Do not expose provider response bodies or credentials to the client.
      return createError(response.status === 404 ? 404 : 502, 'MP_PAYMENT_LOOKUP_FAILED', 'Não foi possível consultar o pagamento');
    }

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') return createError(502, 'INVALID_MP_RESPONSE', 'Resposta inválida do provedor');
    const payment = data as Record<string, unknown>;

    if (String(payment.id) !== paymentId) return createError(502, 'MP_PAYMENT_MISMATCH', 'Resposta do pagamento inconsistente');

    const pointOfInteraction = payment.point_of_interaction as Record<string, unknown> | undefined;
    const transactionData = pointOfInteraction?.transaction_data as Record<string, unknown> | undefined;

    return NextResponse.json({
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      transaction_amount: payment.transaction_amount,
      date_created: payment.date_created,
      date_approved: payment.date_approved,
      point_of_interaction: {
        transaction_data: {
          qr_code: transactionData?.qr_code,
          qr_code_base64: transactionData?.qr_code_base64,
          ticket_url: transactionData?.ticket_url,
        },
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('PIX status error', error instanceof Error ? error.name : 'UnknownError');
    return createError(502, 'PIX_STATUS_FAILED', 'Falha ao verificar status do PIX');
  }
}
