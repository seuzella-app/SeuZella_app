import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  enqueueJobWithBridge,
  isBullMQAvailable,
  drainDeadLetterQueue,
} from '@/lib/queue/queue-bridge';
import { QUEUE_NAMES as IN_MEMORY_QUEUE_NAMES } from '@/lib/queue/queue-service';
import { QUEUE_NAMES as BULLMQ_QUEUE_NAMES } from '@/lib/queue/bullmq-queue';

// Mock BullMQ module so tests don't require a live Redis instance.
vi.mock('@/lib/queue/bullmq-queue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/queue/bullmq-queue')>();
  const mockEnqueueBullJob = vi.fn().mockResolvedValue(undefined);
  const mockGetRedisConnection = vi.fn().mockReturnValue(null);
  const mockGetBullQueue = vi.fn().mockReturnValue({
    getFailed: vi.fn().mockResolvedValue([]),
  });

  return {
    ...actual,
    enqueueBullJob: mockEnqueueBullJob,
    getRedisConnection: mockGetRedisConnection,
    getBullQueue: mockGetBullQueue,
  };
});

describe('Queue Bridge — in-memory → BullMQ forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports BullMQ as unavailable when Redis is not configured', () => {
    expect(isBullMQAvailable()).toBe(false);
  });

  it('routes WHATSAPP_WEBHOOK to in-memory queue when BullMQ unavailable', async () => {
    const job = await enqueueJobWithBridge(
      IN_MEMORY_QUEUE_NAMES.WHATSAPP_WEBHOOK,
      { messageId: 'msg_1', from: '+5511999999999', text: 'Olá' },
      { tenantId: 'tenant_1' },
    );
    expect(job.id).toBeDefined();
    expect(job.queue).toBe(IN_MEMORY_QUEUE_NAMES.WHATSAPP_WEBHOOK);
    expect(job.tenantId).toBe('tenant_1');
    expect(job.status).toBe('pending');
  });

  it('routes ASAAS_WEBHOOK to in-memory queue when BullMQ unavailable', async () => {
    const job = await enqueueJobWithBridge(
      IN_MEMORY_QUEUE_NAMES.ASAAS_WEBHOOK,
      { paymentId: 'pay_123', event: 'PAYMENT_RECEIVED' },
      { tenantId: 'tenant_2' },
    );
    expect(job.queue).toBe(IN_MEMORY_QUEUE_NAMES.ASAAS_WEBHOOK);
  });

  it('keeps EMAIL_SEND in-memory (no BullMQ mapping)', async () => {
    const job = await enqueueJobWithBridge(
      IN_MEMORY_QUEUE_NAMES.EMAIL_SEND,
      { to: 'guest@example.com', subject: 'Reserva confirmada' },
      { tenantId: 'tenant_3' },
    );
    expect(job.queue).toBe(IN_MEMORY_QUEUE_NAMES.EMAIL_SEND);
  });

  it('keeps TEST_DELIVERY_QUEUE in-memory (no BullMQ mapping)', async () => {
    const job = await enqueueJobWithBridge(
      IN_MEMORY_QUEUE_NAMES.TEST_DELIVERY_QUEUE,
      { payload: 'test' },
    );
    expect(job.queue).toBe(IN_MEMORY_QUEUE_NAMES.TEST_DELIVERY_QUEUE);
  });

  it('returns a job object even on BullMQ failure (graceful fallback)', async () => {
    // Force BullMQ to look available, then throw.
    const bullmq = await import('@/lib/queue/bullmq-queue');
    vi.mocked(bullmq.getRedisConnection).mockReturnValue({} as any);
    vi.mocked(bullmq.enqueueBullJob).mockRejectedValueOnce(new Error('Redis connection refused'));

    const job = await enqueueJobWithBridge(
      IN_MEMORY_QUEUE_NAMES.WHATSAPP_WEBHOOK,
      { messageId: 'msg_2' },
      { tenantId: 'tenant_4' },
    );
    expect(job.queue).toBe(IN_MEMORY_QUEUE_NAMES.WHATSAPP_WEBHOOK);
    expect(job.status).toBe('pending');
  });

  it('derives correct job type for each in-memory queue', async () => {
    const bullmq = await import('@/lib/queue/bullmq-queue');
    vi.mocked(bullmq.getRedisConnection).mockReturnValue({} as any);

    await enqueueJobWithBridge(IN_MEMORY_QUEUE_NAMES.WHATSAPP_WEBHOOK, { id: 1 });
    await enqueueJobWithBridge(IN_MEMORY_QUEUE_NAMES.ASAAS_WEBHOOK, { id: 2 });
    await enqueueJobWithBridge(IN_MEMORY_QUEUE_NAMES.UPSSELL_TRACKING, { id: 3 });

    const calls = vi.mocked(bullmq.enqueueBullJob).mock.calls;
    expect(calls[0][1].type).toBe('whatsapp_incoming');
    expect(calls[1][1].type).toBe('payment_event');
    expect(calls[2][1].type).toBe('lock_action');
  });
});

describe('Queue Bridge — DLQ drainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero counts when BullMQ is unavailable', async () => {
    const bullmq = await import('@/lib/queue/bullmq-queue');
    vi.mocked(bullmq.getRedisConnection).mockReturnValue(null);

    const result = await drainDeadLetterQueue();
    expect(result.drained).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('drains failed jobs when BullMQ is available', async () => {
    const bullmq = await import('@/lib/queue/bullmq-queue');
    vi.mocked(bullmq.getRedisConnection).mockReturnValue({} as any);
    const mockJob = { id: 'job_1', attemptsMade: 3, data: {}, failedReason: 'timeout', remove: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(bullmq.getBullQueue).mockReturnValue({
      getFailed: vi.fn().mockResolvedValue([mockJob]),
    } as any);

    const result = await drainDeadLetterQueue();
    expect(result.drained).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockJob.remove).toHaveBeenCalledOnce();
  });

  it('counts failures when job.remove() throws', async () => {
    const bullmq = await import('@/lib/queue/bullmq-queue');
    vi.mocked(bullmq.getRedisConnection).mockReturnValue({} as any);
    const mockJob = { id: 'job_2', attemptsMade: 5, data: {}, failedReason: 'fatal', remove: vi.fn().mockRejectedValue(new Error('redis gone')) };
    vi.mocked(bullmq.getBullQueue).mockReturnValue({
      getFailed: vi.fn().mockResolvedValue([mockJob]),
    } as any);

    const result = await drainDeadLetterQueue();
    expect(result.drained).toBe(0);
    expect(result.failed).toBe(1);
  });
});

describe('Queue Bridge — mapping coverage', () => {
  it('maps all production webhook queues to BullMQ durable queues', async () => {
    // The bridge mapping must cover every queue that receives production
    // webhook events. Unmapped queues (EMAIL_SEND, TEST_DELIVERY_QUEUE)
    // are intentionally in-memory-only.
    const expectedMapping: Record<string, string> = {
      [IN_MEMORY_QUEUE_NAMES.WHATSAPP_WEBHOOK]: BULLMQ_QUEUE_NAMES.WHATSAPP_DELIVERY,
      [IN_MEMORY_QUEUE_NAMES.ASAAS_WEBHOOK]: BULLMQ_QUEUE_NAMES.PAYMENT_PROCESSING,
      [IN_MEMORY_QUEUE_NAMES.MERCADOPAGO_WEBHOOK]: BULLMQ_QUEUE_NAMES.PAYMENT_PROCESSING,
      [IN_MEMORY_QUEUE_NAMES.LGPD_DELETE]: BULLMQ_QUEUE_NAMES.SCHEDULER_TASKS,
      [IN_MEMORY_QUEUE_NAMES.NIGHT_AUDIT]: BULLMQ_QUEUE_NAMES.SCHEDULER_TASKS,
      [IN_MEMORY_QUEUE_NAMES.UPSSELL_TRACKING]: BULLMQ_QUEUE_NAMES.LOCK_AUTOMATION,
    };

    // Read the bridge mapping by inspecting the source — this is a
    // regression test that catches accidental mapping removal.
    // (We can't import the private BRIDGE_MAPPING constant directly,
    // but we can verify the behavior via enqueueJobWithBridge calls.)
    const bullmq = await import('@/lib/queue/bullmq-queue');
    vi.mocked(bullmq.getRedisConnection).mockReturnValue({} as any);

    for (const [inMemory, expectedBullMQ] of Object.entries(expectedMapping)) {
      vi.mocked(bullmq.enqueueBullJob).mockClear();
      await enqueueJobWithBridge(inMemory, { test: true });
      const calls = vi.mocked(bullmq.enqueueBullJob).mock.calls;
      expect(calls[0][0]).toBe(expectedBullMQ);
    }
  });
});
