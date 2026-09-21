import { describe, it, expect } from 'vitest';
import { LocalQueue, QUEUE_DEAD_CAP } from '../../src/lib/infra/queue';

/**
 * RUN11-W2 — invariantes da fila (cronograma 11C):
 * retry/backoff, dead-letter, idempotência, isolamento de worker, stats.
 * backoffBaseMs=1 mantém a suíte rápida; semântica é a mesma de produção.
 */

const tick = () => new Promise((r) => setTimeout(r, 5));

describe('RUN11-W2 fila — processamento e retry', () => {
  it('job com sucesso: done sobe, stats coerentes', async () => {
    const q = new LocalQueue();
    let ran = 0;
    const r = q.enqueue<number>('ok', { payload: 1, backoffBaseMs: 1 }, async () => {
      ran += 1;
    });
    expect(r.ok).toBe(true);
    await tick();
    const s = q.stats('ok');
    expect(ran).toBe(1);
    expect(s.done).toBe(1);
    expect(s.pending).toBe(0);
    expect(s.active).toBe(0);
  });

  it('falha transiente: retry com backoff até sucesso (retries contabilizados)', async () => {
    const q = new LocalQueue();
    let attempts = 0;
    q.enqueue<number>(
      'retry',
      { payload: 1, maxAttempts: 3, backoffBaseMs: 1 },
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('transiente');
      },
    );
    await tick();
    await tick();
    const s = q.stats('retry');
    expect(attempts).toBe(3);
    expect(s.done).toBe(1);
    expect(s.retries).toBe(2);
    expect(s.dead).toBe(0);
  });

  it('falha permanente: vai para dead-letter com lastError e attempts; observabilidade via onDead', async () => {
    const q = new LocalQueue();
    const seen: string[] = [];
    q.onDead((dl) => seen.push(`${dl.job.queue}:${dl.attempts}:${dl.lastError}`));
    q.enqueue<number>(
      'dead',
      { payload: 7, maxAttempts: 2, backoffBaseMs: 1 },
      async () => {
        throw new Error('boom-permanente');
      },
    );
    await tick();
    await tick();
    const dead = q.listDead<number>('dead');
    expect(dead).toHaveLength(1);
    expect(dead[0].attempts).toBe(2);
    expect(dead[0].lastError).toContain('boom-permanente');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('dead:2');
  });

  it('worker failure NÃO escapa: exceção no handler nunca derruba a fila (próximo job roda)', async () => {
    const q = new LocalQueue();
    q.enqueue<number>('iso', { payload: 1, maxAttempts: 1, backoffBaseMs: 1 }, async () => {
      throw new Error('explode');
    });
    await tick();
    let ok = 0;
    q.enqueue<number>('iso', { payload: 2, backoffBaseMs: 1 }, async () => {
      ok += 1;
    });
    await tick();
    expect(ok).toBe(1);
    expect(q.stats('iso').done).toBe(1);
    expect(q.stats('iso').dead).toBe(1);
  });
});

describe('RUN11-W2 fila — idempotência e capacidade', () => {
  it('idempotencyKey duplicada enquanto pending/active é rejeitada (mesma jobId)', async () => {
    const q = new LocalQueue();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((res) => {
      release = res;
    });
    let calls = 0;
    const first = q.enqueue<string>(
      'idem',
      { payload: 'a', idempotencyKey: ' booking-42 ', backoffBaseMs: 1 },
      async () => {
        calls += 1;
        await gate;
      },
    );
    const dup = q.enqueue<string>(
      'idem',
      { payload: 'a', idempotencyKey: ' booking-42 ', backoffBaseMs: 1 },
      async () => {
        calls += 1;
      },
    );
    expect(first.ok).toBe(true);
    expect(dup.ok).toBe(true);
    expect(dup.jobId).toBe(first.jobId);
    expect(q.stats('idem').duplicatesRejected).toBe(1);
    release();
    await tick();
    expect(calls).toBe(1);
  });

  it('dead-letter tem teto (QUEUE_DEAD_CAP)', async () => {
    const q = new LocalQueue();
    for (let i = 0; i < QUEUE_DEAD_CAP + 10; i += 1) {
      q.enqueue<number>('cap', { payload: i, maxAttempts: 1, backoffBaseMs: 1 }, async () => {
        throw new Error('x');
      });
    }
    await tick();
    await tick();
    await tick();
    expect(q.listDead('cap').length).toBeLessThanOrEqual(QUEUE_DEAD_CAP);
  });

  it('requeueDead reprocessa e limpa a lista', async () => {
    const q = new LocalQueue();
    q.enqueue<number>('rq', { payload: 1, maxAttempts: 1, backoffBaseMs: 1 }, async () => {
      throw new Error('f');
    });
    await tick();
    await tick();
    const processed: number[] = [];
    const n = q.requeueDead<number>('rq', async (p) => {
      processed.push(p);
    });
    expect(n).toBe(1);
    await tick();
    expect(processed).toEqual([1]);
    expect(q.listDead('rq')).toHaveLength(0);
  });
});
