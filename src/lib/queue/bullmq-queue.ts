/**
 * BULLMQ & REDIS RESILIENT QUEUE ENGINE
 *
 * Production never reports a job as enqueued when durable Redis persistence is
 * unavailable. The in-memory fallback is restricted to non-production use.
 */
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '@/lib/logger';

export const QUEUE_NAMES = {
  WHATSAPP_DELIVERY: 'whatsapp-delivery-queue',
  PAYMENT_PROCESSING: 'payment-processing-queue',
  LOCK_AUTOMATION: 'lock-automation-queue',
  SCHEDULER_TASKS: 'scheduler-tasks-queue',
  DEAD_LETTER: 'dead-letter-queue',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

export interface DeliveryJobData {
  jobId: string;
  tenantId: string;
  type: 'whatsapp_incoming' | 'whatsapp_outgoing' | 'payment_event' | 'lock_action';
  payload: Record<string, any>;
  receivedAt: string;
  traceId?: string;
  retryCount?: number;
}

let redisConnection: IORedis | null = null;
const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getRedisConnection(): IORedis | null {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;
  if (!redisUrl) return null;

  if (!redisConnection) {
    try {
      redisConnection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => Math.min(times * 100, 3000),
      });
      redisConnection.on('error', (err) => {
        logger.error('[BULLMQ_REDIS] Redis error:', { error: err.message });
      });
      redisConnection.on('connect', () => {
        logger.info('[BULLMQ_REDIS] Redis connected.');
      });
    } catch (err: any) {
      logger.error('[BULLMQ_REDIS] Failed to initialize Redis:', { error: err.message });
      redisConnection = null;
    }
  }

  return redisConnection;
}

export function getBullQueue(name: QueueName): Queue | null {
  const connection = getRedisConnection();
  if (!connection) return null;

  if (!queues.has(name)) {
    const queue = new Queue(name, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
    queues.set(name, queue);
  }

  return queues.get(name) ?? null;
}

export async function enqueueBullJob(
  queueName: QueueName,
  data: DeliveryJobData,
  customJobId?: string,
): Promise<{ enqueued: boolean; jobId: string; mode: 'bullmq' | 'fallback' }> {
  const deterministicJobId = customJobId || data.jobId || `job_${data.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const queue = getBullQueue(queueName);

  if (!queue) {
    if (isProduction()) {
      throw new Error('DURABLE_QUEUE_UNAVAILABLE');
    }
    return { enqueued: true, jobId: deterministicJobId, mode: 'fallback' };
  }

  try {
    const job = await queue.add(data.type, data, { jobId: deterministicJobId });
    return { enqueued: true, jobId: job.id || deterministicJobId, mode: 'bullmq' };
  } catch (err: any) {
    logger.error('[BULLMQ] Failed to persist job:', { error: err.message });
    if (isProduction()) {
      throw new Error('DURABLE_QUEUE_WRITE_FAILED');
    }
    return { enqueued: true, jobId: deterministicJobId, mode: 'fallback' };
  }
}

export function registerBullWorker(
  queueName: QueueName,
  processor: (job: Job<DeliveryJobData>) => Promise<any>,
  concurrency = 5,
): Worker | null {
  const connection = getRedisConnection();
  if (!connection) return null;
  if (workers.has(queueName)) return workers.get(queueName)!;

  const worker = new Worker(queueName, processor, { connection, concurrency });
  worker.on('completed', (job) => {
    logger.info(`[BULLMQ_WORKER] Job ${job.id} completed in ${queueName}`);
  });
  worker.on('failed', async (job, err) => {
    logger.error(`[BULLMQ_WORKER] Job ${job?.id} failed in ${queueName}:`, {
      attempts: job?.attemptsMade,
      error: err.message,
    });
    if (job && job.attemptsMade >= (job.opts.attempts || 5)) {
      const dlq = getBullQueue(QUEUE_NAMES.DEAD_LETTER);
      if (dlq) {
        await dlq.add('failed_job', {
          originalQueue: queueName,
          jobData: job.data,
          failedReason: err.message,
          failedAt: new Date().toISOString(),
        });
      }
    }
  });

  workers.set(queueName, worker);
  return worker;
}

export async function closeAllQueuesAndWorkers(): Promise<void> {
  for (const [name, worker] of workers.entries()) {
    try {
      await worker.close();
      logger.info(`[BULLMQ] Worker ${name} closed.`);
    } catch (e: any) {
      logger.error(`[BULLMQ] Worker close failed:`, { error: e.message });
    }
  }
  workers.clear();

  for (const [name, queue] of queues.entries()) {
    try {
      await queue.close();
      logger.info(`[BULLMQ] Queue ${name} closed.`);
    } catch (e: any) {
      logger.error(`[BULLMQ] Queue close failed:`, { error: e.message });
    }
  }
  queues.clear();

  if (redisConnection) {
    try {
      await redisConnection.quit();
      redisConnection = null;
      logger.info('[BULLMQ_REDIS] Redis connection closed.');
    } catch (e: any) {
      logger.error('[BULLMQ_REDIS] Redis close failed:', { error: e.message });
    }
  }
}
