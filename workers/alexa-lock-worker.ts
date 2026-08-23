// workers/alexa-lock-worker.ts
import { Worker, Job } from 'bullmq';
import { db } from '@/lib/db';
import { LockOrchestrator } from '@/lib/locks/orchestrator';
import { logger } from '@/lib/logger';
import { registerBullWorker, QUEUE_NAMES } from '@/lib/queue/bullmq-queue';

export interface LockJobPayload {
  lockId: string;
  tenantId: string;
  action: 'LOCK' | 'UNLOCK' | 'SYNC_STATUS';
  actor: string;
  correlationToken?: string;
}

const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

export async function processLockJob(data: LockJobPayload) {
  const { lockId, tenantId, action, actor } = data;
  logger.info(`[LOCK_WORKER] Processando ${action} para Fechadura: ${lockId} (Tenant: ${tenantId})`);

  try {
    if (action === 'LOCK') {
      await LockOrchestrator.remoteLock({ lockId, tenantId, actor });
    } else if (action === 'UNLOCK') {
      await LockOrchestrator.remoteUnlock({ lockId, tenantId, actor });
    }

    // Registro de Auditoria no DB (patAuditLog se existir, ou fallback)
    try {
      if (db && (db as any).patAuditLog) {
        await (db as any).patAuditLog.create({
          data: {
            credentialId: lockId,
            action: `SMARTLOCK_${action}`,
            repository: tenantId,
            success: true,
            ipAddress: 'ALEXA_SKILL_SERVICE',
          },
        });
      }
    } catch {}

    return { status: 'COMPLETED', lockId, action };
  } catch (error: any) {
    logger.error(`[LOCK_WORKER_ERROR] Falha ao executar ${action} no lock ${lockId}:`, error);

    try {
      if (db && (db as any).patAuditLog) {
        await (db as any).patAuditLog.create({
          data: {
            credentialId: lockId,
            action: `SMARTLOCK_${action}_FAILED`,
            repository: tenantId,
            success: false,
            errorMessage: error.message,
            ipAddress: 'ALEXA_SKILL_SERVICE',
          },
        });
      }
    } catch {}

    throw error;
  }
}

export function startAlexaLockWorker() {
  logger.info('[LOCK_WORKER] Registrando Alexa Smart Home Lock Worker...');
  return registerBullWorker(
    QUEUE_NAMES.LOCK_AUTOMATION,
    async (job) => {
      const payload: LockJobPayload = (job.data as any).payload || (job.data as any);
      return processLockJob(payload);
    },
    5
  );
}

export const alexaLockWorker = new Worker<LockJobPayload>(
  'alexa-lock-dispatch',
  async (job: Job<LockJobPayload>) => {
    return processLockJob(job.data);
  },
  {
    connection: REDIS_CONNECTION,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000, // Máximo 10 operações por segundo por worker
    },
  }
);
