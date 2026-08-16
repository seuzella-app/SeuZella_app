/**
 * Queue Service — BullMQ-style com fallback in-memory
 * ============================================================================
 *
 * Para produção: configurar Upstash Redis + BullMQ workers.
 * Para desenvolvimento: in-memory queue (perde em restart).
 *
 * Uso típico:
 *   1. Webhook Meta recebe mensagem → enfileira job (responde 200 OK imediato)
 *   2. Worker processa job assíncrono (chama IA, grava no banco, etc.)
 *   3. Evita timeout do webhook (<5s exigido pela Meta)
 * ============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export interface Job {
  id: string;
  queue: string;
  data: any;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
  error?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export type JobProcessor = (job: Job) => Promise<void>;

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY QUEUE (singleton)
// ─────────────────────────────────────────────────────────────────────────────
const queues: Record<string, Job[]> = {};
const processors: Record<string, JobProcessor> = {};

let workerRunning = false;

async function startWorker() {
  if (workerRunning) return;
  workerRunning = true;

  while (workerRunning) {
    let processed = false;

    for (const queueName of Object.keys(queues)) {
      const queue = queues[queueName];
      if (queue.length === 0) continue;

      const processor = processors[queueName];
      if (!processor) continue;

      const job = queue.find(j => j.status === 'pending');
      if (!job) continue;

      job.status = 'processing';
      job.startedAt = Date.now();
      job.attempts += 1;

      try {
        await processor(job);
        job.status = 'completed';
        job.completedAt = Date.now();
      } catch (err: any) {
        job.error = err.message;
        if (job.attempts >= job.maxAttempts) {
          job.status = 'failed';
          job.failedAt = Date.now();
          console.error(`[QUEUE] Job ${job.id} falhou definitivamente:`, err.message);
        } else {
          job.status = 'pending';
          console.warn(`[QUEUE] Job ${job.id} falhou (tentativa ${job.attempts}/${job.maxAttempts}):`, err.message);
          // Backoff exponencial
          await new Promise(r => setTimeout(r, Math.pow(2, job.attempts) * 1000));
        }
      }

      processed = true;
    }

    if (!processed) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────
export function registerProcessor(queueName: string, processor: JobProcessor): void {
  processors[queueName] = processor;
  if (!queues[queueName]) queues[queueName] = [];
  startWorker().catch(console.error);
}

export async function enqueueJob(queueName: string, data: any, maxAttempts = 3): Promise<Job> {
  if (!queues[queueName]) queues[queueName] = [];

  const job: Job = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queue: queueName,
    data,
    attempts: 0,
    maxAttempts,
    createdAt: Date.now(),
    status: 'pending',
  };

  queues[queueName].push(job);

  // Limpa jobs antigos (mantém últimos 1000)
  if (queues[queueName].length > 1000) {
    queues[queueName] = queues[queueName].slice(-1000);
  }

  return job;
}

export async function getJobStatus(jobId: string): Promise<Job | null> {
  for (const queue of Object.values(queues)) {
    const job = queue.find(j => j.id === jobId);
    if (job) return job;
  }
  return null;
}

export function getQueueStats(queueName: string): {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
} {
  const queue = queues[queueName] || [];
  return {
    pending: queue.filter(j => j.status === 'pending').length,
    processing: queue.filter(j => j.status === 'processing').length,
    completed: queue.filter(j => j.status === 'completed').length,
    failed: queue.filter(j => j.status === 'failed').length,
    total: queue.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUES PRÉ-DEFINIDOS
// ─────────────────────────────────────────────────────────────────────────────
export const QUEUE_NAMES = {
  WHATSAPP_WEBHOOK: 'whatsapp-webhook',
  MERCADOPAGO_WEBHOOK: 'mercadopago-webhook',
  EMAIL_SEND: 'email-send',
  UPSSELL_TRACKING: 'upsell-tracking',
  NIGHT_AUDIT: 'night-audit',
  LGPD_DELETE: 'lgpd-delete',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRA PROCESSORS PADRÃO (mock)
// ─────────────────────────────────────────────────────────────────────────────
if (typeof window === 'undefined') {
  // WhatsApp webhook processor
  registerProcessor(QUEUE_NAMES.WHATSAPP_WEBHOOK, async (job) => {
    console.log(`[QUEUE] Processando webhook WhatsApp: ${job.data?.entry?.[0]?.id || 'unknown'}`);
    // Em produção: chamar GuestResponderBrain.processGuestMessage()
    // Salvar mensagem no banco, etc.
  });

  // Mercado Pago webhook processor
  registerProcessor(QUEUE_NAMES.MERCADOPAGO_WEBHOOK, async (job) => {
    console.log(`[QUEUE] Processando webhook MP: payment_id=${job.data?.data?.id || 'unknown'}`);
    // Em produção: atualizar UpsellRecord.status = 'paid'
  });

  // Email send processor
  registerProcessor(QUEUE_NAMES.EMAIL_SEND, async (job) => {
    console.log(`[QUEUE] Enviando email para ${job.data?.to}: ${job.data?.subject}`);
    // Em produção: chamar email-service.send()
  });

  // LGPD delete processor
  registerProcessor(QUEUE_NAMES.LGPD_DELETE, async (job) => {
    console.log(`[QUEUE] Processando exclusão LGPD: ${job.data?.requestId}`);
    // Em produção: chamar lgpd-service.processarExclusaoDados()
  });
}
