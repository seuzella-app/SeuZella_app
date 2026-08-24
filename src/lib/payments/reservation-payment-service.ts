import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { getGateway } from './gateway-factory';
import type { GatewayId, PaymentMethod, PaymentStatus } from './types';

interface ReservationPaymentRow {
  id: string;
  tenant_id: string;
  reservation_id: string;
  gateway: string;
  gateway_payment_id: string;
  provider_event_id: string | null;
  reference_type: string;
  amount: number;
  payment_method: string;
  status: string;
  checkout_url: string | null;
  metadata: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateReservationPaymentInput {
  tenantId: string;
  reservationId: string;
  gateway: Exclude<GatewayId, 'mock'> | 'mock';
  paymentMethod: PaymentMethod;
  customer: { name: string; email: string; phone?: string; document?: string };
  successUrl: string;
  cancelUrl: string;
  webhookUrl: string;
}

export interface CreateReservationPaymentResult {
  paymentId: string;
  reservationId: string;
  gateway: GatewayId;
  gatewayPaymentId: string;
  status: PaymentStatus;
  checkoutUrl?: string;
  pix?: { qrCode: string; qrCodeBase64?: string; expiresAt?: string };
  boleto?: { url: string; barcode?: string; expiresAt?: string };
}

export async function createReservationPayment(input: CreateReservationPaymentInput): Promise<CreateReservationPaymentResult> {
  const reservation = await db.reservation.findFirst({
    where: { id: input.reservationId, tenantId: input.tenantId },
    include: { guest: true, room: true },
  });
  if (!reservation) throw new Error('RESERVATION_NOT_FOUND');
  if (['CANCELLED', 'cancelled', 'NO_SHOW', 'no_show'].includes(reservation.status)) throw new Error('RESERVATION_NOT_PAYABLE');

  const existing = await db.$queryRaw<ReservationPaymentRow[]>`
    SELECT * FROM "reservation_payments"
    WHERE "tenant_id" = ${input.tenantId}
      AND "reservation_id" = ${input.reservationId}
      AND "status" IN ('pending', 'in_progress', 'approved', 'authorized')
    ORDER BY "created_at" DESC
    LIMIT 1
  `;
  if (existing[0]) {
    const current = existing[0];
    return {
      paymentId: current.id,
      reservationId: current.reservation_id,
      gateway: current.gateway as GatewayId,
      gatewayPaymentId: current.gateway_payment_id,
      status: current.status as PaymentStatus,
      checkoutUrl: current.checkout_url ?? undefined,
    };
  }

  const gateway = getGateway(input.gateway);
  if (!gateway.isConfigured() && input.gateway !== 'mock') throw new Error('PAYMENT_GATEWAY_NOT_CONFIGURED');
  if (input.gateway === 'mock' && process.env.NODE_ENV === 'production') throw new Error('MOCK_GATEWAY_FORBIDDEN');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  const result = await gateway.createPayment({
    referenceId: reservation.id,
    referenceType: 'reservation',
    tenantId: input.tenantId,
    amount: reservation.totalPrice,
    paymentMethod: input.paymentMethod,
    customer: input.customer,
    description: `Seu Zélla - Reserva ${reservation.id}`,
    successUrl: input.successUrl || `${baseUrl ?? ''}/ddc?reservation_id=${encodeURIComponent(reservation.id)}&payment=success`,
    cancelUrl: input.cancelUrl || `${baseUrl ?? ''}/ddc?reservation_id=${encodeURIComponent(reservation.id)}&payment=cancelled`,
    webhookUrl: input.webhookUrl,
  });

  if (!result.gatewayPaymentId) throw new Error('GATEWAY_PAYMENT_ID_MISSING');

  const paymentId = randomUUID();
  await db.$executeRaw`
    INSERT INTO "reservation_payments"
      ("id", "tenant_id", "reservation_id", "gateway", "gateway_payment_id", "reference_type", "amount", "payment_method", "status", "checkout_url", "metadata")
    VALUES
      (${paymentId}, ${input.tenantId}, ${reservation.id}, ${result.gateway}, ${result.gatewayPaymentId}, 'reservation', ${reservation.totalPrice}, ${input.paymentMethod}, ${result.status}, ${result.checkoutUrl ?? null}, ${JSON.stringify({ gateway: result.gateway, roomId: reservation.roomId, guestId: reservation.guestId })})
  `;

  return {
    paymentId,
    reservationId: reservation.id,
    gateway: result.gateway,
    gatewayPaymentId: result.gatewayPaymentId,
    status: result.status,
    checkoutUrl: result.checkoutUrl,
    pix: result.pix,
    boleto: result.boleto,
  };
}
