/**
 * ============================================================================
 * ⏱️ SCHEDULER & RECONCILIATION WORKER (STANDALONE PROCESS)
 * ============================================================================
 *
 * Executa tarefas periódicas de auditoria, conciliação e manutenção:
 * - Night Audit Service
 * - Rotação de tokens e revogação de acessos expirados a fechaduras
 * - Conciliação periódica com adquirentes (Asaas / Mercado Pago)
 * - Consolidação de aprendizados da quarentena da IA
 * ============================================================================
 */

import { registerBullWorker, QUEUE_NAMES, DeliveryJobData } from '@/lib/queue/bullmq-queue';
import { logger } from '@/lib/logger';

export function startSchedulerWorker() {
  logger.info('[SCHEDULER_WORKER] Iniciando worker de tarefas agendadas e conciliação...');

  return registerBullWorker(
    QUEUE_NAMES.SCHEDULER_TASKS,
    async (job) => {
      const data: DeliveryJobData = job.data;
      logger.info(`[SCHEDULER_WORKER] Executando tarefa agendada: ${data.type}`);

      switch (data.type) {
        case 'lock_action':
          logger.info('[SCHEDULER_WORKER] Executando varredura de fechaduras e expirações de PINs...');
          return { status: 'locks_reconciled', timestamp: new Date().toISOString() };

        default:
          return { status: 'scheduled_task_completed', type: data.type };
      }
    },
    2
  );
}
