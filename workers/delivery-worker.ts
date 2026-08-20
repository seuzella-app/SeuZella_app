/**
 * ============================================================================
 * 📨 WHATSAPP & NOTIFICATIONS DELIVERY WORKER (STANDALONE PROCESS)
 * ============================================================================
 *
 * Processa mensagens enfileiradas de forma assíncrona, desacoplada do Next.js.
 * Responsabilidades:
 * - Processamento de mensagens WhatsApp recebidas
 * - Disparo de IA (Zélla Brain) fora do ciclo síncrono do Webhook
 * - Re-tentativa automática com backoff exponencial
 * - Envio para Dead Letter Queue após 5 falhas
 * ============================================================================
 */

import { registerBullWorker, QUEUE_NAMES, DeliveryJobData } from '@/lib/queue/bullmq-queue';
import { GuestResponderBrain } from '@/lib/cerebro/guest-responder-brain';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

export function startDeliveryWorker() {
  logger.info('[DELIVERY_WORKER] Iniciando worker de entrega e mensageria WhatsApp...');

  return registerBullWorker(
    QUEUE_NAMES.WHATSAPP_DELIVERY,
    async (job) => {
      const data: DeliveryJobData = job.data;
      logger.info(`[DELIVERY_WORKER] Processando job ${job.id} (${data.type}) para tenant ${data.tenantId}`);

      if (data.type === 'whatsapp_incoming') {
        const { messageId, from, text, audioUrl, tenantId } = data.payload;

        // 1. Verificação de idempotência no banco
        try {
          if (db && (db as any).conversationMessage) {
            const existing = await (db as any).conversationMessage.findFirst({
              where: { tenantId, ...(messageId ? { id: messageId } : {}) },
            });
            if (existing) {
              logger.info(`[DELIVERY_WORKER] Mensagem ${messageId} já processada anteriormente (idempotente).`);
              return { status: 'duplicate_skipped', messageId };
            }
          }
        } catch {
          // Best effort
        }

        // 2. Invoca o Zélla Brain
        const response = await GuestResponderBrain.processGuestMessage({
          tenantId: tenantId || data.tenantId,
          niche: 'pousada',
          channel: 'whatsapp',
          guestPhone: from,
          messageContent: text || '[Áudio Recebido]',
        });

        logger.info(`[DELIVERY_WORKER] Resposta gerada com sucesso para ${from}: ${response.response.slice(0, 50)}...`);
        return { status: 'processed', messageId, replied: true, response: response.response };
      }

      return { status: 'unsupported_type', type: data.type };
    },
    10 // Concurrency de 10 jobs simultâneos
  );
}
