import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AsaasBillingService } from '@/lib/billing/asaas';

/**
 * POST /api/webhooks/asaas
 * Security invariants:
 * - production requires the configured webhook secret
 * - payment events require an explicit tenant externalReference
 * - idempotency lookup failure is fail-closed
 * - transaction persistence failure is never reported as successful processing
 */
export async function POST(request: NextRequest) {
  try {
    const webhookToken = request.headers.get('asaas-access-token') || request.headers.get('x-asaas-access-token');
    const expectedSecret = process.env.ASAAS_WEBHOOK_SECRET;

    if (process.env.NODE_ENV === 'production') {
      if (!expectedSecret || !webhookToken || webhookToken !== expectedSecret) {
        return NextResponse.json({ error: 'UNAUTHORIZED_WEBHOOK_TOKEN' }, { status: 401 });
      }
    } else if (expectedSecret && webhookToken !== expectedSecret) {
      return NextResponse.json({ error: 'UNAUTHORIZED_WEBHOOK_TOKEN' }, { status: 401 });
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > 1024 * 1024) {
      return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'INVALID_JSON_BODY' }, { status: 400 });
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
    }

    const body = payload as Record<string, unknown>;
    const event = typeof body.event === 'string' ? body.event : '';
    const payment = body.payment && typeof body.payment === 'object'
      ? body.payment as Record<string, unknown>
      : null;
    const invoice = body.invoice && typeof body.invoice === 'object'
      ? body.invoice as Record<string, unknown>
      : null;

    if (!event) {
      return NextResponse.json({ error: 'MISSING_EVENT_TYPE' }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ error: 'WEBHOOK_DATABASE_UNAVAILABLE' }, { status: 503 });
    }

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const paymentId = typeof payment?.id === 'string' ? payment.id : '';
      const externalReference = typeof payment?.externalReference === 'string'
        ? payment.externalReference.trim()
        : '';

      // A payment webhook without an explicit tenant binding is ambiguous and must not mutate billing.
      if (!paymentId || !externalReference) {
        return NextResponse.json({ error: 'MISSING_PAYMENT_TENANT_REFERENCE' }, { status: 400 });
      }

      let existingTx: any;
      try {
        existingTx = await (db as any).transaction.findFirst({
          where: { externalId: paymentId },
          select: { id: true, status: true, tenantId: true },
        });
      } catch (err) {
        console.error('[AsaasWebhook] Idempotency lookup failed:', err);
        return NextResponse.json({ error: 'IDEMPOTENCY_CHECK_UNAVAILABLE' }, { status: 503 });
      }

      if (existingTx) {
        if (existingTx.tenantId !== externalReference) {
          console.error('[AsaasWebhook] Payment ID attempted cross-tenant reuse:', paymentId);
          return NextResponse.json({ error: 'PAYMENT_TENANT_MISMATCH' }, { status: 409 });
        }
        return NextResponse.json({ success: true, received: true, duplicate: true, event }, { status: 200 });
      }

      const tenant = await (db as any).tenant.findUnique({
        where: { id: externalReference },
        select: { id: true, name: true },
      });

      if (!tenant) {
        return NextResponse.json({ error: 'TENANT_NOT_FOUND' }, { status: 404 });
      }

      try {
        await (db as any).transaction.create({
          data: {
            tenantId: tenant.id,
            type: 'SUBSCRIPTION_PAYMENT',
            amount: typeof payment?.value === 'number' ? payment.value : Number(payment?.value || 0),
            status: 'CONFIRMED',
            externalId: paymentId,
            metadata: JSON.stringify({
              gateway: 'asaas',
              billingType: payment?.billingType,
              invoiceUrl: payment?.invoiceUrl,
              dueDate: payment?.dueDate,
              confirmedAt: new Date().toISOString(),
            }),
          },
        });
      } catch (err) {
        console.error('[AsaasWebhook] Transaction persistence failed:', err);
        return NextResponse.json({ error: 'PAYMENT_PERSISTENCE_FAILED' }, { status: 503 });
      }

      try {
        await (db as any).subscription.updateMany({
          where: { tenantId: tenant.id },
          data: { status: 'ACTIVE', updatedAt: new Date() },
        });
      } catch (err) {
        // Payment is durably recorded; provisioning can be retried asynchronously.
        console.error('[AsaasWebhook] Subscription activation failed after durable payment record:', err);
        return NextResponse.json({ success: true, received: true, event, reconciliationRequired: true }, { status: 202 });
      }

      try {
        await AsaasBillingService.scheduleFiscalInvoice({
          paymentId,
          description: typeof payment?.description === 'string' ? payment.description : undefined,
        });
      } catch (err) {
        console.warn('[AsaasWebhook] NFS-e scheduling deferred:', err);
      }

      return NextResponse.json({ success: true, received: true, event }, { status: 200 });
    }

    if (event === 'PAYMENT_OVERDUE') {
      const externalReference = typeof payment?.externalReference === 'string'
        ? payment.externalReference.trim()
        : '';
      if (externalReference) {
        const tenant = await (db as any).tenant.findUnique({ where: { id: externalReference }, select: { id: true } });
        if (tenant) {
          console.log('[AsaasWebhook] Payment overdue received for tenant:', tenant.id);
        }
      }
      return NextResponse.json({ success: true, received: true, event });
    }

    if (event === 'INVOICE_CREATED' || event === 'INVOICE_SYNCHRONIZED' || event === 'INVOICE_AUTHORIZED') {
      console.log('[AsaasWebhook] Invoice event received:', typeof invoice?.id === 'string' ? invoice.id : 'N/A');
      return NextResponse.json({ success: true, received: true, event });
    }

    return NextResponse.json({ success: true, received: true, event });
  } catch (error) {
    console.error('[AsaasWebhook] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
