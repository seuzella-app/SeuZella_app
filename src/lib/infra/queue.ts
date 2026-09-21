/**
 * SEUZELLA RUN11-W2 — fila local com retry/backoff/dead-letter (cronograma 11C).
 *
 * Cobertura do escopo 11C nesta camada aditiva:
 *   jobs (payload tipado), retry com backoff exponencial + jitter,
 *   dead-letter com teto, idempotency-key (dedup enquanto pending/active),
 *   isolamento de falha do worker (exceção do handler NUNCA escapa do loop),
 *   observabilidade (stats por fila + hooks onDead).
 *
 * Fila é in-process (concorrência 1 por fila, backpressure por teto).
 * Distribuição entre processos = driver futuro com REDIS_URL (W3), nunca aqui.
 */
import { randomUUID } from 'node:crypto';

export interface QueueJobInput<T> {
  payload: T;
  idempotencyKey?: string;
  maxAttempts?: number;
  backoffBaseMs?: number;
}

export interface EnqueuedJob<T> {
  id: string;
  queue: string;
  payload: T;
  maxAttempts: number;
  backoffBaseMs: number;
}

export interface QueueStats {
  pending: number;
  active: number;
  done: number;
  dead: number;
  retries: number;
  duplicatesRejected: number;
  capacity: number;
}

export interface DeadLetter<T> {
  job: EnqueuedJob<T>;
  attempts: number;
  lastError: string;
  at: string;
}

type Handler<T> = (payload: T, job: EnqueuedJob<T>) => Promise<void>;

interface Runtime<T> {
  pending: Array<EnqueuedJob<T> & { handler: Handler<T> }>;
  active: EnqueuedJob<T> | null;
  idem: Map<string, string>;
  done: number;
  dead: DeadLetter<T>[];
  retries: number;
  duplicatesRejected: number;
  draining: boolean;
}

export const QUEUE_DEAD_CAP = 100;
export const QUEUE_PENDING_CAP = 10000;
const MAX_ATTEMPTS_DEFAULT = 3;
const BACKOFF_DEFAULT_MS = 500;

export class LocalQueue {
  private runtimes = new Map<string, Runtime<unknown>>();
  private onDeadHooks: Array<(dl: DeadLetter<unknown>) => void> = [];

  onDead(hook: (dl: DeadLetter<unknown>) => void): void {
    this.onDeadHooks.push(hook);
  }

  enqueue<T>(
    name: string,
    input: QueueJobInput<T>,
    handler: Handler<T>,
  ): { ok: true; jobId: string } | { ok: false; reason: 'CAPACITY_FULL'; jobId?: string } {
    const rt = this.runtime<T>(name);
    if (rt.pending.length >= QUEUE_PENDING_CAP && rt.active !== null) {
      return { ok: false, reason: 'CAPACITY_FULL' };
    }
    if (input.idempotencyKey && rt.idem.has(input.idempotencyKey)) {
      rt.duplicatesRejected += 1;
      return { ok: true, jobId: rt.idem.get(input.idempotencyKey) as string };
    }
    const job: EnqueuedJob<T> & { handler: Handler<T> } = {
      id: randomUUID(),
      queue: name,
      payload: input.payload,
      maxAttempts: input.maxAttempts ?? MAX_ATTEMPTS_DEFAULT,
      backoffBaseMs: input.backoffBaseMs ?? BACKOFF_DEFAULT_MS,
      handler,
    };
    rt.pending.push(job);
    if (input.idempotencyKey) rt.idem.set(input.idempotencyKey, job.id);
    void this.drain(name);
    return { ok: true, jobId: job.id };
  }

  stats(name: string): QueueStats {
    const rt = this.runtime<unknown>(name);
    return {
      pending: rt.pending.length,
      active: rt.active === null ? 0 : 1,
      done: rt.done,
      dead: rt.dead.length,
      retries: rt.retries,
      duplicatesRejected: rt.duplicatesRejected,
      capacity: QUEUE_PENDING_CAP,
    };
  }

  listDead<T>(name: string): DeadLetter<T>[] {
    return this.runtime<T>(name).dead.slice();
  }

  /** Reprocessa dead-letter (ex.: após correção); limpa a lista da fila. */
  requeueDead<T>(name: string, handler: Handler<T>): number {
    const rt = this.runtime<T>(name);
    const items = rt.dead.splice(0, rt.dead.length);
    for (const dl of items) {
      rt.pending.push({ ...dl.job, handler });
    }
    void this.drain(name);
    return items.length;
  }

  /* ------------------------------------------------------------ interno */

  private runtime<T>(name: string): Runtime<T> {
    let rt = this.runtimes.get(name) as Runtime<T> | undefined;
    if (!rt) {
      rt = {
        pending: [],
        active: null,
        idem: new Map(),
        done: 0,
        dead: [],
        retries: 0,
        duplicatesRejected: 0,
        draining: false,
      };
      this.runtimes.set(name, rt as Runtime<unknown>);
    }
    return rt;
  }

  private async drain<T>(name: string): Promise<void> {
    const rt = this.runtime<T>(name);
    if (rt.draining) return;
    rt.draining = true;
    try {
      while (rt.pending.length > 0) {
        const job = rt.pending.shift() as (EnqueuedJob<T> & { handler: Handler<T> });
        rt.active = job;
        let attempt = 0;
        let lastError = 'unknown';
        while (attempt < job.maxAttempts) {
          attempt += 1;
          if (attempt > 1) rt.retries += 1;
          try {
            await job.handler(job.payload, job);
            lastError = '';
            break;
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            if (attempt < job.maxAttempts) {
              const backoff = job.backoffBaseMs * Math.pow(2, attempt - 1);
              const jitter = Math.floor(Math.random() * Math.max(1, job.backoffBaseMs / 2));
              await new Promise((r) => setTimeout(r, backoff + jitter));
            }
          }
        }
        if (lastError === '') {
          rt.done += 1;
        } else {
          const dl: DeadLetter<T> = {
            job,
            attempts: attempt,
            lastError,
            at: new Date().toISOString(),
          };
          rt.dead.push(dl);
          if (rt.dead.length > QUEUE_DEAD_CAP) rt.dead.shift();
          for (const hook of this.onDeadHooks) {
            try {
              hook(dl);
            } catch {
              // hook de observabilidade nunca derruba a fila
            }
          }
        }
        rt.active = null;
        // idempotency-key só protege enquanto pending/active
        for (const [k, id] of rt.idem) if (id === job.id) rt.idem.delete(k);
      }
    } finally {
      rt.draining = false;
    }
  }
}

let singleton: LocalQueue | null = null;
export function getQueue(): LocalQueue {
  if (!singleton) singleton = new LocalQueue();
  return singleton;
}
