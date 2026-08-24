import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { withSecurity } from '@/lib/security/api-shield';
import { createReservationPayment } from '@/lib/payments/reservation-payment-service';
import type { GatewayId, PaymentMethod } from '@/lib/payments/types';

const METHODS: PaymentMethod[] = ['pix', 'cartao', 'boleto'];
const GATEWAYS: GatewayId[] = ['asaas', 'mercadopago', 'mock'];

async function postHandler(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = await requireTenant();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const paymentMethod = String(body?.paymentMethod || '') as PaymentMethod;
    const gateway = String(body?.gateway || '') as GatewayId;

    if (!METHODS.includes(paymentMethod)) return NextResponse.json({ error: 'INVALID_PAYMENT_METHOD' }, { status: 400 });
    if (!GATEWAYS.includes(gateway) || (gateway === 'mock' && process.env.NODE_ENV === 'production')) {
      return NextResponse.json({ error: 'INVALID_GATEWAY' }, { status: 400 });
    }

    const reservation = await (await import('@/lib/db')).db.reservation.findFirst({
      where: { id, tenantId },
      include: { guest: true },
    });
    if (!reservation?.guest) return NextResponse.json({ error: 'RESERVATION_OR_GUEST_NOT_FOUND' }, { status: 404 });

    const guestEmail = reservation.guest.email?.trim().toLowerCase() || '';
    if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      return NextResponse.json({ error: 'GUEST_EMAIL_REQUIRED_FOR_PAYMENT' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || request.nextUrl.origin;
    const result = await createReservationPayment({
      tenantId,
      reservationId: id,
      gateway,
      paymentMethod,
      customer: {
        name: reservation.guest.name,
        email: guestEmail,
        phone: reservation.guest.phone || undefined,
        document: reservation.guest.document || undefined,
      },
      successUrl: `${baseUrl}/ddc?reservation_id=${encodeURIComponent(id)}&payment=success`,
      cancelUrl: `${baseUrl}/ddc?reservation_id=${encodeURIComponent(id)}&payment=cancelled`,
      webhookUrl: `${baseUrl}/api/webhooks/payment`,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RESERVATION_PAYMENT_ERROR';
    const status = message === 'RESERVATION_NOT_FOUND' ? 404 : message === 'RESERVATION_NOT_PAYABLE' ? 409 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

export const POST = withSecurity(postHandler, { routeLabel: 'reservation-payment-create' });
