import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

export interface DurableJob {
  id: string;
  queue: string;
  tenantId?: string;
  data: unknown;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
  error?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export type DurableJobProcessor = (job: DurableJob) => Promise<void>;

const redis = Redis.fromEnv();
const JOB_PREFIX = 'zella:job:';
const QUEUE_PREFIX = 'zella:queue:';
const DONE_PREFIX = 'zella:done:';
const LEASE_PREFIX = 'zella:lease:';
const DLQ_PREFIX = 'zella:dlq:';
const LEASE_MS = 120_000;

function jobKey(id: string) { return `${JOB_PREFIX}${id}`; }
function queueKey(queue: string) { return `${QUEUE_PREFIX}${queue}`; }
function doneKey(id: string) { return `${DONE_PREFIX}${id}`; }
function leaseKey(id: string) { return `${LEASE_PREFIX}${id}`; }
function dlqKey(queue: string) { return `${DLQ_PREFIX}${queue}`; }

function productionRequired(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function assertDurableQueueConfigured(): void {
  if (productionRequired() && (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)) {
    throw new Error('DURABLE_QUEUE_NOT_CONFIGURED');
  }
}

export async function enqueueDurableJob(
  queue: string,
  data: unknown,
  options: { jobId: string; tenantId?: string; maxAttempts?: number },
): Promise<DurableJob> {
  assertDurableQueueConfigured();
  const existing = await redis.get<DurableJob>(jobKey(options.jobId));
  if (existing) return existing;
  if (await redis.exists(doneKey(options.jobId))) {
    const completed: DurableJob = {
      id: options.jobId, queue, tenantId: options.tenantId, data,
      attempts: 1, maxAttempts: options.maxAttempts ?? 3, createdAt: Date.now(), status: 'completed', completedAt: Date.now(),
    };
    return completed;
  }

  const job: DurableJob = {
    id: options.jobId,
    queue,
    tenantId: options.tenantId,
    data,
    attempts: 0,
    maxAttempts: Math.max(1, Math.min(options.maxAttempts ?? 3, 10)),
    createdAt: Date.now(),
    status: 'pending',
  };

  // SET NX closes the enqueue race when two webhook deliveries arrive together.
  const created = await redis.set(jobKey(job.id), JSON.stringify(job), { nx: true });
  if (created === null) return (await redis.get<DurableJob>(jobKey(job.id))) as DurableJob;
  await redis.rpush(queueKey(queue), job.id);
  return job;
}

export async function getDurableJobStatus(jobId: string): Promise<DurableJob | null> {
  return redis.get<DurableJob>(jobKey(jobId));
}

export async function claimNextJob(queue: string): Promise<DurableJob | null> {
  assertDurableQueueConfigured();
  const id = await redis.lpop<string>(queueKey(queue));
  if (!id) return null;
  const job = await redis.get<DurableJob>(jobKey(id));
  if (!job || job.status === 'completed' || job.status === 'failed') return null;

  const lease = await redis.set(leaseKey(id), String(Date.now()), { nx: true, px: LEASE_MS });
  if (lease === null) {
    await redis.rpush(queueKey(queue), id);
    return null;
  }

  const claimed: DurableJob = { ...job, status: 'processing', startedAt: Date.now(), attempts: job.attempts + 1 };
  await redis.set(jobKey(id), JSON.stringify(claimed));
  return claimed;
}

export async function completeDurableJob(job: DurableJob): Promise<void> {
  await redis.set(jobKey(job.id), JSON.stringify({ ...job, status: 'completed', completedAt: Date.now() }));
  await redis.set(doneKey(job.id), '1', { ex: 60 * 60 * 24 * 30 });
  await redis.del(leaseKey(job.id));
}

export async function failDurableJob(job: DurableJob, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const updated: DurableJob = { ...job, error: message };
  await redis.del(leaseKey(job.id));
  if (job.attempts >= job.maxAttempts) {
    const failed = { ...updated, status: 'failed' as const, failedAt: Date.now() };
    await redis.set(jobKey(job.id), JSON.stringify(failed));
    await redis.rpush(dlqKey(job.queue), job.id);
    logger.error('[DURABLE_QUEUE] Job moved to DLQ', { jobId: job.id, queue: job.queue, tenantId: job.tenantId, error: message });
    return;
  }

  const pending = { ...updated, status: 'pending' as const };
  await redis.set(jobKey(job.id), JSON.stringify(pending));
  // Delayed retry is handled by the worker; the job remains durable even if the process dies.
  await redis.rpush(queueKey(job.queue), job.id);
}

export async function recoverExpiredLease(job: DurableJob): Promise<void> {
  const lease = await redis.get<string>(leaseKey(job.id));
  if (lease) return;
  if (job.status === 'processing') {
    await redis.set(jobKey(job.id), JSON.stringify({ ...job, status: 'pending' }));
    await redis.rpush(queueKey(job.queue), job.id);
  }
}

export async function runDurableWorker(queue: string, processor: DurableJobProcessor, options?: { pollMs?: number; concurrency?: number }): Promise<never> {
  assertDurableQueueConfigured();
  const pollMs = options?.pollMs ?? 250;
  const concurrency = Math.max(1, Math.min(options?.concurrency ?? 4, 20));

  logger.info('[DURABLE_QUEUE] Worker started', { queue, concurrency });
  while (true) {
    const jobs = await Promise.all(Array.from({ length: concurrency }, () => claimNextJob(queue)));
    const claimed = jobs.filter(Boolean) as DurableJob[];
    if (claimed.length === 0) {
      await new Promise(resolve => setTimeout(resolve, pollMs));
      continue;
    }
    await Promise.all(claimed.map(async job => {
      try {
        await processor(job);
        await completeDurableJob(job);
      } catch (error) {
        await failDurableJob(job, error);
      }
    }));
  }
}
