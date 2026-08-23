/**
 * DELIVERY MACHINE — Queue Service
 * Security invariants:
 * - production jobs require explicit tenantId
 * - job payload tenantId must match job tenantId
 * - status/DLQ lookups are tenant-scoped in production
 * - retry/circuit state is bounded
 */
import { logger } from '@/lib/logger';

export interface Job { id: string; queue: string; tenantId?: string; data: Record<string, any>; attempts: number; maxAttempts: number; createdAt: number; startedAt?: number; completedAt?: number; failedAt?: number; error?: string; status: 'pending' | 'processing' | 'completed' | 'failed'; }
export type JobProcessor = (job: Job) => Promise<void>;
const MAX_JOB_PAYLOAD_BYTES = 128 * 1024;
const MAX_QUEUE_LENGTH = 2000;
const queues: Record<string, Job[]> = {};
const deadLetterQueue: Job[] = [];
const processedJobIds = new Map<string, string>();
const processors: Record<string, JobProcessor> = {};
let workerRunning = false;

export const QUEUE_NAMES = { WHATSAPP_WEBHOOK: 'whatsapp-webhook', MERCADOPAGO_WEBHOOK: 'mercadopago-webhook', ASAAS_WEBHOOK: 'asaas-webhook', EMAIL_SEND: 'email-send', UPSSELL_TRACKING: 'upsell-tracking', NIGHT_AUDIT: 'night-audit', LGPD_DELETE: 'lgpd-delete', TEST_DELIVERY_QUEUE: 'test-delivery-queue' } as const;
const ALLOWED_QUEUES = new Set<string>(Object.values(QUEUE_NAMES));
function assertQueueName(queueName: string): void { if (!ALLOWED_QUEUES.has(queueName)) throw new Error('UNKNOWN_QUEUE'); }
function assertTenantForProduction(tenantId?: string): void { if (process.env.NODE_ENV === 'production' && (!tenantId || tenantId.includes('demo'))) throw new Error('TENANT_ID_REQUIRED_FOR_PRODUCTION_JOB'); }
function assertTenantPayload(tenantId: string | undefined, data: Record<string, any>): void {
  if (tenantId && data.tenantId !== undefined && data.tenantId !== tenantId) throw new Error('QUEUE_TENANT_CONTEXT_MISMATCH');
  if (process.env.NODE_ENV === 'production' && tenantId && data.tenantId !== tenantId) throw new Error('QUEUE_TENANT_CONTEXT_REQUIRED');
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_JOB_PAYLOAD_BYTES) throw new Error('QUEUE_PAYLOAD_TOO_LARGE');
}

async function startWorker() {
  if (workerRunning) return;
  workerRunning = true;
  while (workerRunning) {
    let processed = false;
    for (const queueName of Object.keys(queues)) {
      const queue = queues[queueName]; if (queue.length === 0) continue;
      const processor = processors[queueName]; if (!processor) continue;
      const job = queue.find(j => j.status === 'pending'); if (!job) continue;
      job.status = 'processing'; job.startedAt = Date.now(); job.attempts += 1;
      try {
        if (process.env.NODE_ENV === 'production' && (!job.tenantId || job.data?.tenantId !== job.tenantId)) throw new Error('QUEUE_TENANT_CONTEXT_MISMATCH');
        await processor(job);
        job.status = 'completed'; job.completedAt = Date.now();
        processedJobIds.set(`${job.tenantId || 'dev'}:${job.id}`, job.tenantId || 'dev');
      } catch (err) {
        job.error = err instanceof Error ? err.name : 'UnknownJobError';
        if (job.attempts >= job.maxAttempts) { job.status = 'failed'; job.failedAt = Date.now(); deadLetterQueue.push({ ...job, data: { ...job.data } }); logger.error('[DELIVERY_QUEUE] Job moved to DLQ', undefined, { jobId: job.id, queue: queueName, tenantId: job.tenantId, error: job.error }); }
        else { job.status = 'pending'; logger.warn('[DELIVERY_QUEUE] Job retry scheduled', { jobId: job.id, queue: queueName, attempt: job.attempts }); await new Promise(r => setTimeout(r, Math.min(30000, Math.pow(2, job.attempts) * 1000))); }
      }
      processed = true;
    }
    if (!processed) await new Promise(r => setTimeout(r, 100));
  }
}
export function registerProcessor(queueName: string, processor: JobProcessor): void { assertQueueName(queueName); processors[queueName] = processor; if (!queues[queueName]) queues[queueName] = []; startWorker().catch(err => logger.error('[DELIVERY_QUEUE] Worker startup failed', undefined, { error: err instanceof Error ? err.name : 'UnknownError' })); }
export async function enqueueJob(queueName: string, data: Record<string, any>, options?: { jobId?: string; maxAttempts?: number; tenantId?: string }): Promise<Job> {
  assertQueueName(queueName); assertTenantForProduction(options?.tenantId); assertTenantPayload(options?.tenantId, data); if (!queues[queueName]) queues[queueName] = [];
  const deterministicId = options?.jobId || `job_${Date.now()}_${crypto.randomUUID()}`; const processedKey = `${options?.tenantId || 'dev'}:${deterministicId}`;
  if (processedJobIds.has(processedKey)) { const existing = await getJobStatus(deterministicId, options?.tenantId); return existing || { id: deterministicId, queue: queueName, tenantId: options?.tenantId, data: { ...data }, attempts: 1, maxAttempts: options?.maxAttempts || 3, createdAt: Date.now(), status: 'completed' }; }
  const existingPending = queues[queueName].find(j => j.id === deterministicId && j.status !== 'failed' && j.tenantId === options?.tenantId); if (existingPending) return existingPending;
  const maxAttempts = Math.max(1, Math.min(options?.maxAttempts || 3, 10)); const job: Job = { id: deterministicId, queue: queueName, tenantId: options?.tenantId, data: { ...data }, attempts: 0, maxAttempts, createdAt: Date.now(), status: 'pending' }; queues[queueName].push(job); if (queues[queueName].length > MAX_QUEUE_LENGTH) queues[queueName] = queues[queueName].slice(-MAX_QUEUE_LENGTH); return job;
}
export async function getJobStatus(jobId: string, tenantId?: string): Promise<Job | null> { assertTenantForProduction(tenantId); for (const queue of Object.values(queues)) { const job = queue.find(j => j.id === jobId && (tenantId === undefined || j.tenantId === tenantId)); if (job) return { ...job, data: { ...job.data } }; } const dlqJob = deadLetterQueue.find(j => j.id === jobId && (tenantId === undefined || j.tenantId === tenantId)); return dlqJob ? { ...dlqJob, data: { ...dlqJob.data } } : null; }
export function getQueueStats(queueName: string, tenantId?: string) { assertQueueName(queueName); assertTenantForProduction(tenantId); const queue = (queues[queueName] || []).filter(j => tenantId === undefined || j.tenantId === tenantId); return { pending: queue.filter(j => j.status === 'pending').length, processing: queue.filter(j => j.status === 'processing').length, completed: queue.filter(j => j.status === 'completed').length, failed: queue.filter(j => j.status === 'failed').length, total: queue.length, dlqCount: deadLetterQueue.filter(j => j.queue === queueName && (tenantId === undefined || j.tenantId === tenantId)).length }; }

if (typeof window === 'undefined') { registerProcessor(QUEUE_NAMES.WHATSAPP_WEBHOOK, async (job) => { if (!job.tenantId || job.data?.tenantId !== job.tenantId) throw new Error('QUEUE_TENANT_CONTEXT_MISMATCH'); try { const { processIncomingMessage } = await import('@/lib/whatsapp-ai-responder'); const { bufferMessage } = await import('@/lib/message-bundler'); await new Promise<void>((resolve, reject) => { bufferMessage({ tenantId: job.tenantId!, guestPhone: job.data.guestPhone, guestName: job.data.guestName, messageContent: job.data.messageContent, messageFrom: job.data.messageFrom || 'whatsapp' }, async (params: any) => { try { await processIncomingMessage(params); resolve(); } catch (err) { reject(err); } }); }); } catch (err) { logger.error('[DELIVERY_QUEUE] WhatsApp processing failed', undefined, { tenantId: job.tenantId, error: err instanceof Error ? err.name : 'UnknownError' }); throw err; } }); }
