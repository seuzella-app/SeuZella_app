/**
 * QUEUE BRIDGE — In-memory (queue-service) → Durable (bullmq-queue) Bridge
 * ============================================================================
 *
 * PROBLEM
 * -------
 * The codebase has TWO PARALLEL queue systems that share ZERO queue names:
 *   - `queue-service.ts` (in-memory, 8 queue names) — used by webhooks/emails
 *   - `bullmq-queue.ts`  (Redis-backed, 5 queue names) — used by workers
 *
 * Webhook WhatsApp enqueues to `WHATSAPP_WEBHOOK` (in-memory), but the
 * delivery worker listens on `WHATSAPP_DELIVERY` (BullMQ). Result: jobs
 * are enqueued but never processed in production.
 *
 * SOLUTION
 * --------
 * This bridge transparently forwards in-memory enqueue calls to BullMQ
 * when Redis is configured. In dev/test (no Redis), it falls back to
 * the in-memory queue-service. The mapping is explicit and one-way:
 *
 *   queue-service.WHATSAPP_WEBHOOK   → bullmq.WHATSAPP_DELIVERY
 *   queue-service.ASAAS_WEBHOOK      → bullmq.PAYMENT_PROCESSING
 *   queue-service.MERCADOPAGO_WEBHOOK→ bullmq.PAYMENT_PROCESSING
 *   queue-service.LGPD_DELETE        → bullmq.SCHEDULER_TASKS
 *   queue-service.NIGHT_AUDIT        → bullmq.SCHEDULER_TASKS
 *   queue-service.UPSSELL_TRACKING   → bullmq.LOCK_AUTOMATION
 *   queue-service.EMAIL_SEND         → (stays in-memory, no BullMQ equivalent)
 *   queue-service.TEST_DELIVERY_QUEUE→ (stays in-memory, test only)
 *
 * The bridge is opt-in via `enqueueJobWithBridge()`. Existing `enqueueJob()`
 * callers continue to work unchanged — they simply don't benefit from
 * durability. New code should use `enqueueJobWithBridge()`.
 */

import { enqueueJob, QUEUE_NAMES as IN_MEMORY_QUEUE_NAMES, type Job } from '@/lib/queue/queue-service';
import {
  enqueueBullJob,
  QUEUE_NAMES as BULLMQ_QUEUE_NAMES,
  type DeliveryJobData,
  type QueueName as BullMQQueueName,
  getRedisConnection,
} from '@/lib/queue/bullmq-queue';
import { logger } from '@/lib/logger';

/** Mapping from in-memory queue names to BullMQ queue names. */
const BRIDGE_MAPPING: Record<string, BullMQQueueName> = {
  [IN_MEMORY_QUEUE_NAMES.WHATSAPP_WEBHOOK]: BULLMQ_QUEUE_NAMES.WHATSAPP_DELIVERY,
  [IN_MEMORY_QUEUE_NAMES.ASAAS_WEBHOOK]: BULLMQ_QUEUE_NAMES.PAYMENT_PROCESSING,
  [IN_MEMORY_QUEUE_NAMES.MERCADOPAGO_WEBHOOK]: BULLMQ_QUEUE_NAMES.PAYMENT_PROCESSING,
  [IN_MEMORY_QUEUE_NAMES.LGPD_DELETE]: BULLMQ_QUEUE_NAMES.SCHEDULER_TASKS,
  [IN_MEMORY_QUEUE_NAMES.NIGHT_AUDIT]: BULLMQ_QUEUE_NAMES.SCHEDULER_TASKS,
  [IN_MEMORY_QUEUE_NAMES.UPSSELL_TRACKING]: BULLMQ_QUEUE_NAMES.LOCK_AUTOMATION,
};

/** Returns true if Redis is configured and a connection can be established. */
export function isBullMQAvailable(): boolean {
  return getRedisConnection() !== null;
}

/**
 * Enqueue a job, preferring BullMQ (durable) when available and falling back
 * to the in-memory queue-service when Redis is not configured (dev/test).
 *
 * The bridge translates the in-memory queue name to the corresponding
 * BullMQ queue name via BRIDGE_MAPPING. Queues without a mapping (EMAIL_SEND,
 * TEST_DELIVERY_QUEUE) are always routed to the in-memory queue.
 */
export async function enqueueJobWithBridge(
  queueName: string,
  data: Record<string, unknown>,
  options?: { jobId?: string; maxAttempts?: number; tenantId?: string },
): Promise<Job> {
  const bullmqQueueName = BRIDGE_MAPPING[queueName];

  // If no mapping exists, always use in-memory queue.
  if (!bullmqQueueName) {
    return enqueueJob(queueName, data, options);
  }

  // If Redis is available, forward to BullMQ (durable).
  if (isBullMQAvailable()) {
    try {
      const bullJobData: DeliveryJobData = {
        jobId: options?.jobId || `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        tenantId: options?.tenantId || 'unknown',
        type: deriveJobType(queueName),
        payload: data,
        receivedAt: new Date().toISOString(),
        traceId: (data.traceId as string) || undefined,
        retryCount: 0,
      };

      await enqueueBullJob(bullmqQueueName, bullJobData, options?.jobId);

      // Return a Job-shaped object so the caller API doesn't change.
      return {
        id: bullJobData.jobId,
        queue: queueName,
        tenantId: options?.tenantId,
        data,
        attempts: 0,
        maxAttempts: options?.maxAttempts || 5,
        createdAt: Date.now(),
        status: 'pending',
      };
    } catch (err) {
      logger.warn('[QUEUE_BRIDGE] BullMQ enqueue failed, falling back to in-memory', {
        queue: queueName,
        error: err instanceof Error ? err.message : 'unknown',
      });
      // Fall through to in-memory fallback.
    }
  }

  // In-memory fallback (dev/test or BullMQ failure).
  return enqueueJob(queueName, data, options);
}

function deriveJobType(inMemoryQueueName: string): DeliveryJobData['type'] {
  switch (inMemoryQueueName) {
    case IN_MEMORY_QUEUE_NAMES.WHATSAPP_WEBHOOK:
      return 'whatsapp_incoming';
    case IN_MEMORY_QUEUE_NAMES.ASAAS_WEBHOOK:
    case IN_MEMORY_QUEUE_NAMES.MERCADOPAGO_WEBHOOK:
      return 'payment_event';
    case IN_MEMORY_QUEUE_NAMES.UPSSELL_TRACKING:
      return 'lock_action';
    default:
      return 'whatsapp_outgoing';
  }
}

/**
 * Drain the BullMQ dead-letter queue and log/alert on each dead job.
 *
 * In a serverless deployment (Vercel), this is invoked by the
 * `/api/cron/dlq-drain` route on a 5-minute schedule. In a long-running
 * worker process, it's invoked on bootstrap and every 5 minutes thereafter.
 */
export async function drainDeadLetterQueue(): Promise<{ drained: number; failed: number }> {
  let drained = 0;
  let failed = 0;

  if (!isBullMQAvailable()) {
    return { drained, failed };
  }

  // BullMQ DLQ is drained by fetching failed jobs and logging them.
  // Actual re-queue logic is handled per-business-rule (some go to retry,
  // some go to alert-only, some get discarded).
  try {
    const bullmq = await import('@/lib/queue/bullmq-queue');
    const dlq = bullmq.getBullQueue(BULLMQ_QUEUE_NAMES.DEAD_LETTER);
    if (!dlq) return { drained, failed };

    const failedJobs = await dlq.getFailed(0, 100);
    for (const job of failedJobs) {
      try {
        logger.error('[QUEUE_BRIDGE] DLQ job drained', {
          jobId: job.id,
          attempts: job.attemptsMade,
          data: job.data,
          error: job.failedReason,
        });
        await job.remove();
        drained++;
      } catch (err) {
        logger.error('[QUEUE_BRIDGE] Failed to drain DLQ job', {
          jobId: job.id,
          error: err instanceof Error ? err.message : 'unknown',
        });
        failed++;
      }
    }
  } catch (err) {
    logger.error('[QUEUE_BRIDGE] DLQ drain operation failed', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    failed++;
  }

  return { drained, failed };
}
