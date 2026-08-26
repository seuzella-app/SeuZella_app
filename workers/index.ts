/**
 * ============================================================================
 * 🚀 MASTER WORKER SUPERVISOR — P0 Delivery Machine
 * ============================================================================
 *
 * Ponto de entrada do processo de workers desacoplado do Next.js.
 * Responsável por:
 * 1. Inicializar todos os workers (Delivery, Payments, Scheduler)
 * 2. Monitorar saúde dos workers
 * 3. Capturar sinais SIGTERM / SIGINT e executar graceful shutdown sem perda de jobs
 *
 * ⚠️ VPS-ONLY: Este processo NÃO roda na Vercel (serverless não suporta
 * processos longos). Deve ser executado via systemd em VPS:
 *   systemctl start zella-workers
 * ou via CLI: npx tsx workers/index.ts
 *
 * Na Vercel, o processamento assíncrono é feito via Vercel Cron Jobs
 * que invocam endpoints /api/cron/* periodicamente.
 * ============================================================================
 */

import { startDeliveryWorker } from './delivery-worker';
import { startPaymentWorker } from './payment-worker';
import { startSchedulerWorker } from './scheduler-worker';
import { startAlexaLockWorker } from './alexa-lock-worker';
import { closeAllQueuesAndWorkers } from '@/lib/queue/bullmq-queue';
import { logger } from '@/lib/logger';

export async function bootstrapWorkers() {
  logger.info('====================================================================');
  logger.info('🚀 INICIALIZANDO ZÉLLA MASTER WORKERS DAEMON (P0 PRODUCTION READY)');
  logger.info('====================================================================');

  const deliveryWorker = startDeliveryWorker();
  const paymentWorker = startPaymentWorker();
  const schedulerWorker = startSchedulerWorker();
  const alexaLockWorker = startAlexaLockWorker();

  const shutdown = async (signal: string) => {
    logger.info(`[WORKERS_SUPERVISOR] Sinal ${signal} recebido. Iniciando graceful shutdown...`);
    try {
      await closeAllQueuesAndWorkers();
      logger.info('[WORKERS_SUPERVISOR] Todos os workers foram finalizados com sucesso. Encerrando processo.');
      process.exit(0);
    } catch (err: any) {
      logger.error('[WORKERS_SUPERVISOR] Erro durante o shutdown:', { error: err.message });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return {
    deliveryWorker,
    paymentWorker,
    schedulerWorker,
    alexaLockWorker,
  };
}

// Se executado diretamente via CLI (node workers/index.ts ou npx tsx workers/index.ts)
if (require.main === module) {
  bootstrapWorkers().catch((err) => {
    logger.error('[WORKERS_SUPERVISOR] Falha fatal ao inicializar workers:', { error: err.message });
    process.exit(1);
  });
}
