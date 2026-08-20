/**
 * ============================================================================
 * 💳 PAYMENT & RECONCILIATION WORKER (STANDALONE PROCESS)
 * ============================================================================
 *
 * Processa eventos financeiros assíncronos:
 * - Execução estrita da Payment State Machine
 * - Rejeição e auditoria de transições proibidas (ex: REFUNDED -> ACTIVE)
 * - Emissão e revogação de acessos a fechaduras inteligentes baseadas no estado de pagamento
 * ============================================================================
 */

import { registerBullWorker, QUEUE_NAMES, DeliveryJobData } from '@/lib/queue/bullmq-queue';
import { validatePaymentTransition, type PaymentState } from '@/lib/finance/payment-state-machine';
import { revokeReservationPins, generateReservationPin } from '@/lib/locks/orchestrator';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

export function startPaymentWorker() {
  logger.info('[PAYMENT_WORKER] Iniciando worker financeiro e conciliação de pagamentos...');

  return registerBullWorker(
    QUEUE_NAMES.PAYMENT_PROCESSING,
    async (job) => {
      const data: DeliveryJobData = job.data;
      logger.info(`[PAYMENT_WORKER] Processando evento de pagamento ${job.id} para tenant ${data.tenantId}`);

      const { reservationId, currentState, targetState, provider, eventId } = data.payload;

      // 1. Validação estrita da Máquina de Estados
      const transitionResult = validatePaymentTransition({
        currentState: currentState as PaymentState,
        targetState: targetState as PaymentState,
        paymentId: reservationId,
        metadata: { provider, eventId, tenantId: data.tenantId },
      });

      if (!transitionResult.allowed) {
        logger.error(`[PAYMENT_WORKER] Transição proibida rejeitada: ${currentState} -> ${targetState}`, {
          reason: transitionResult.reason,
        });
        return { status: 'rejected_illegal_transition', reason: transitionResult.reason };
      }

      // 2. Transição para estados terminais de cancelamento / estorno
      if (targetState === 'REFUNDED' || targetState === 'CANCELLED' || targetState === 'CHARGEBACK') {
        logger.warn(`[PAYMENT_WORKER] Pagamento cancelado/estornado (${targetState}). Revogando PINs de fechadura...`);
        const revokeRes = await revokeReservationPins({
          tenantId: data.tenantId,
          reservationId,
          reason: `Payment transition to ${targetState}`,
        });

        return {
          status: 'processed',
          state: targetState,
          locksRevoked: revokeRes.revokedCount,
        };
      }

      // 3. Transição para estado confirmado / ativo
      if (targetState === 'CONFIRMED' || targetState === 'ACTIVE' || targetState === 'PAID') {
        logger.info(`[PAYMENT_WORKER] Pagamento confirmado (${targetState}). Liberando fechadura para a reserva ${reservationId}`);
        const pinRes = await generateReservationPin({
          tenantId: data.tenantId,
          reservationId,
          roomName: data.payload.roomName || 'Quarto Principal',
          checkIn: new Date(data.payload.checkIn || Date.now()),
          checkOut: new Date(data.payload.checkOut || Date.now() + 86400000),
          guestPhone: data.payload.guestPhone,
        });

        return {
          status: 'processed',
          state: targetState,
          pinGenerated: pinRes.passcode ? true : false,
        };
      }

      return { status: 'processed', state: targetState };
    },
    5
  );
}
