import { db } from '@/lib/db';

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
