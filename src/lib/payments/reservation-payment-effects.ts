/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import { getLockForRoom } from '@/lib/locks/room-assignment';
import { generateReservationPin } from '@/lib/locks/system-pin-service';

export async function createReservationPaymentConfirmationNotification(input: {
  tenantId: string;
  reservationId: string;
  guestName: string;
  amount: number;
  gateway: string;
}): Promise<void> {
  await db.notification.create({
    data: {
      tenantId: input.tenantId,
      type: 'payment.reservation_confirmed',
      priority: 'high',
      title: 'Pagamento da reserva confirmado',
      message: `Pagamento da reserva de ${input.guestName} confirmado via ${input.gateway}. Valor: R$ ${input.amount.toFixed(2)}.`,
      actionUrl: `/ddc/pousada?reservation_id=${encodeURIComponent(input.reservationId)}`,
      actionLabel: 'Abrir reserva',
      read: false,
      metadata: JSON.stringify({
        reservationId: input.reservationId,
        guestName: input.guestName,
        amount: input.amount,
        gateway: input.gateway,
      }),
    },
  });
}

export async function activateReservationAccess(input: {
  tenantId: string;
  reservationId: string;
  guestName: string;
  guestPhone?: string;
  checkIn: Date;
  checkOut: Date;
}): Promise<{ pinId?: string; lockDeviceId?: string; reason?: string }> {
  const reservation = await db.reservation.findFirst({
    where: { id: input.reservationId, tenantId: input.tenantId },
    select: { id: true, roomId: true },
  });
  if (!reservation) return { reason: 'RESERVATION_NOT_FOUND' };

  const lock = await getLockForRoom({ tenantId: input.tenantId, roomId: reservation.roomId });
  if (!lock) {
    await db.notification.create({
      data: {
        tenantId: input.tenantId,
        type: 'lock.reservation_setup_required',
        priority: 'high',
        title: 'Reserva paga sem fechadura associada',
        message: `A reserva ${input.reservationId} foi paga, mas o quarto ainda não possui uma fechadura vinculada.`,
        actionUrl: `/ddc/pousada?reservation_id=${encodeURIComponent(input.reservationId)}`,
        actionLabel: 'Configurar fechadura',
        read: false,
        metadata: JSON.stringify({ reservationId: input.reservationId, roomId: reservation.roomId }),
      },
    });
    return { reason: 'ROOM_LOCK_NOT_ASSIGNED' };
  }

  try {
    const pin = await generateReservationPin({
      tenantId: input.tenantId,
      deviceId: lock.deviceId,
      reservationId: input.reservationId,
      guestName: input.guestName,
      guestPhone: input.guestPhone,
      validFrom: input.checkIn,
      validTo: input.checkOut,
    });

    await db.notification.create({
      data: {
        tenantId: input.tenantId,
        type: 'lock.reservation_pin_created',
        priority: 'high',
        title: 'PIN da reserva programado',
        message: `PIN da reserva de ${input.guestName} criado para a janela de check-in/check-out.`,
        actionUrl: `/ddc/pousada?reservation_id=${encodeURIComponent(input.reservationId)}`,
        actionLabel: 'Ver PIN',
        read: false,
        metadata: JSON.stringify({ reservationId: input.reservationId, lockDeviceId: lock.deviceId, pinId: pin.id }),
      },
    });

    return { pinId: pin.id, lockDeviceId: lock.deviceId };
  } catch (error) {
    await db.notification.create({
      data: {
        tenantId: input.tenantId,
        type: 'lock.reservation_pin_failed',
        priority: 'urgent',
        title: 'Falha ao programar PIN da reserva',
        message: `O pagamento foi confirmado, mas o PIN da fechadura não pôde ser programado automaticamente.`,
        actionUrl: `/ddc/pousada?reservation_id=${encodeURIComponent(input.reservationId)}`,
        actionLabel: 'Resolver agora',
        read: false,
        metadata: JSON.stringify({ reservationId: input.reservationId, lockDeviceId: lock.deviceId, error: error instanceof Error ? error.message : 'UNKNOWN' }),
      },
    });
    return { lockDeviceId: lock.deviceId, reason: 'PIN_GENERATION_FAILED' };
  }
}

/**
 * Registra o estorno/reversão contábil no ledger de transações de reservas (C4.1).
 * Preserva o lançamento original e cria um lançamento contrapartida idempotente.
 */
export async function writeReversalTransaction(
  tx: any,
  input: {
    tenantId: string;
    reservationId: string;
    amount: number;
    gateway: string;
    reason?: string;
    providerEventId?: string;
  }
): Promise<{ transactionId: string; alreadyReversed: boolean }> {
  // Idempotência: verifica se já existe uma transação de estorno para este evento/reserva
  const existingReversal = await tx.transaction.findFirst({
    where: {
      tenantId: input.tenantId,
      reservationId: input.reservationId,
      type: `RESERVATION_REFUND:${input.gateway}`,
      status: 'REFUNDED',
    },
    select: { id: true },
  });

  if (existingReversal) {
    return { transactionId: existingReversal.id, alreadyReversed: true };
  }

  const reversalAmount = -Math.abs(input.amount);
  const created = await tx.transaction.create({
    data: {
      tenantId: input.tenantId,
      reservationId: input.reservationId,
      type: `RESERVATION_REFUND:${input.gateway}`,
      amount: reversalAmount,
      method: input.gateway,
      status: 'REFUNDED',
    },
  });

  return { transactionId: created.id, alreadyReversed: false };
}

/**
 * Emite notificação persistida de estorno de reserva para o dashboard do cliente (C4.4).
 */
export async function createReservationRefundNotification(input: {
  tenantId: string;
  reservationId: string;
  guestName: string;
  amount: number;
  gateway: string;
  reason?: string;
}): Promise<void> {
  await db.notification.create({
    data: {
      tenantId: input.tenantId,
      type: 'payment.reservation_refunded',
      priority: 'high',
      title: 'Estorno de reserva processado',
      message: `Estorno da reserva de ${input.guestName} processado via ${input.gateway}. Valor: R$ ${Math.abs(input.amount).toFixed(2)}.`,
      actionUrl: `/ddc/pousada?reservation_id=${encodeURIComponent(input.reservationId)}`,
      actionLabel: 'Abrir reserva',
      read: false,
      metadata: JSON.stringify({
        reservationId: input.reservationId,
        guestName: input.guestName,
        amount: input.amount,
        gateway: input.gateway,
        reason: input.reason || 'refund_requested',
      }),
    },
  });
}
