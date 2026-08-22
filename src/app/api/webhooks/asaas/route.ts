import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AsaasBillingService } from '@/lib/billing/asaas';
import { verifyAsaasWebhook } from '@/lib/security/webhook-verify';

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > 1024 * 1024) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > 1024 * 1024) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });

    // ── Webhook signature verification ──────────────────────────────
    // Asaas signs requests in the `asaas-signature` header. Legacy
    // integrations may still use `asaas-access-token` shared secret; both
    // forms are accepted via verifyAsaasWebhook, but production rejects
    // weak shared secrets (< 32 chars) and timing-unsafe comparisons.
    const signatureHeader =
      request.headers.get('asaas-signature') ||
      request.headers.get('x-asaas-signature') ||
      request.headers.get('asaas-access-token') ||
      request.headers.get('x-asaas-access-token');
    const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET;
    const verification = verifyAsaasWebhook(rawBody, signatureHeader, webhookSecret || '');
    if (!verification.valid) {
      const isMissingConfig = verification.reason === 'MISSING_WEBHOOK_SECRET' || verification.reason === 'WEAK_WEBHOOK_SECRET';
      const status = isMissingConfig ? 503 : 401;
      return NextResponse.json({ error: 'WEBHOOK_SIGNATURE_INVALID', reason: verification.reason }, { status });
    }

    let payload: unknown;
    try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'INVALID_JSON_BODY' }, { status: 400 }); }
    if (!payload || typeof payload !== 'object') return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });

    const body = payload as Record<string, unknown>;
    const event = typeof body.event === 'string' ? body.event : '';
    const payment = body.payment && typeof body.payment === 'object' ? body.payment as Record<string, unknown> : null;
    const invoice = body.invoice && typeof body.invoice === 'object' ? body.invoice as Record<string, unknown> : null;
    if (!event) return NextResponse.json({ error: 'MISSING_EVENT_TYPE' }, { status: 400 });
    if (!db) return NextResponse.json({ error: 'WEBHOOK_DATABASE_UNAVAILABLE' }, { status: 503 });

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const paymentId = typeof payment?.id === 'string' ? payment.id.trim() : '';
      const externalReference = typeof payment?.externalReference === 'string' ? payment.externalReference.trim() : '';
      if (!paymentId || !externalReference) return NextResponse.json({ error: 'MISSING_PAYMENT_TENANT_REFERENCE' }, { status: 400 });

      let existingTx: { id: string; status: string; tenantId: string } | null;
      try {
        existingTx = await (db as any).transaction.findFirst({ where: { externalId: paymentId }, select: { id: true, status: true, tenantId: true } });
      } catch (err) {
        console.error('[AsaasWebhook] Idempotency lookup failed:', err);
        return NextResponse.json({ error: 'IDEMPOTENCY_CHECK_UNAVAILABLE' }, { status: 503 });
      }
      if (existingTx) {
        if (existingTx.tenantId !== externalReference) return NextResponse.json({ error: 'PAYMENT_TENANT_MISMATCH' }, { status: 409 });
        return NextResponse.json({ success: true, received: true, duplicate: true, event });
      }

      const tenant = await (db as any).tenant.findUnique({ where: { id: externalReference }, select: { id: true } });
      if (!tenant) return NextResponse.json({ error: 'TENANT_NOT_FOUND' }, { status: 404 });

      try {
        await (db as any).transaction.create({ data: {
          tenantId: tenant.id,
          type: 'SUBSCRIPTION_PAYMENT',
          amount: typeof payment?.value === 'number' ? payment.value : Number(payment?.value || 0),
          status: 'CONFIRMED',
          externalId: paymentId,
          metadata: JSON.stringify({ gateway: 'asaas', billingType: payment?.billingType, invoiceUrl: payment?.invoiceUrl, dueDate: payment?.dueDate, confirmedAt: new Date().toISOString() }),
        }});
      } catch (err) {
        console.error('[AsaasWebhook] Transaction persistence failed:', err);
        return NextResponse.json({ error: 'PAYMENT_PERSISTENCE_FAILED' }, { status: 503 });
      }

      try {
        await (db as any).subscription.updateMany({ where: { tenantId: tenant.id }, data: { status: 'ACTIVE', updatedAt: new Date() } });
      } catch (err) {
        console.error('[AsaasWebhook] Subscription activation failed:', err);
        return NextResponse.json({ success: true, received: true, event, reconciliationRequired: true }, { status: 202 });
      }

      try {
        await AsaasBillingService.scheduleFiscalInvoice({ paymentId, description: typeof payment?.description === 'string' ? payment.description : undefined });
      } catch (err) { console.warn('[AsaasWebhook] NFS-e scheduling deferred:', err); }
      return NextResponse.json({ success: true, received: true, event });
    }

    if (event === 'PAYMENT_OVERDUE') {
      const externalReference = typeof payment?.externalReference === 'string' ? payment.externalReference.trim() : '';
      if (externalReference) {
        const tenant = await (db as any).tenant.findUnique({ where: { id: externalReference }, select: { id: true } });
        if (tenant) console.log('[AsaasWebhook] Payment overdue received for tenant:', tenant.id);
      }
      return NextResponse.json({ success: true, received: true, event });
    }

    if (event === 'INVOICE_CREATED' || event === 'INVOICE_SYNCHRONIZED' || event === 'INVOICE_AUTHORIZED') {
      console.log('[AsaasWebhook] Invoice event received:', typeof invoice?.id === 'string' ? invoice.id : 'N/A');
    }
    return NextResponse.json({ success: true, received: true, event });
  } catch (error) {
    console.error('[AsaasWebhook] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
