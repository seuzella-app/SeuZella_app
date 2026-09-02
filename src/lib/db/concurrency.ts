/**
 * Database Concurrency & Advisory Lock Helpers
 * Provides transactional advisory locking, serializable retry,
 * and deterministic error mapping to prevent race conditions (e.g. double-booking).
 */
import { db, isDatabaseAvailable } from '@/lib/db';
import { Prisma } from '@prisma/client';

export type TransactionClient = Prisma.TransactionClient;

/**
 * Execute an operation with a PostgreSQL transaction-scoped advisory lock.
 *
 * Production invariant: if PostgreSQL is expected and the lock cannot be
 * acquired, fail closed. Never silently execute a supposedly serialized
 * financial/reservation operation without its concurrency guard.
 *
 * The database-unavailable branch exists only for isolated/unit environments
 * that intentionally use the project's non-PostgreSQL test fallback.
 */
export async function withAdvisoryLock<T>(
  lockKey: string,
  fn: (tx: TransactionClient) => Promise<T>,
  options?: { isolationLevel?: Prisma.TransactionIsolationLevel }
): Promise<T> {
  const dbOk = await isDatabaseAvailable();
  if (!dbOk) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_UNAVAILABLE_FOR_ADVISORY_LOCK');
    }
    return (db as any).$transaction(async (tx: TransactionClient) => fn(tx), options);
  }

  return (db as any).$transaction(async (tx: TransactionClient) => {
    // PostgreSQL is the configured production datasource. A lock failure is
    // a correctness failure, not an optional optimization.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    return fn(tx);
  }, options);
}

/**
 * Execute an operation with retry on serializable transaction conflicts (P2034).
 */
export async function withSerializableRetry<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await (db as any).$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034') {
          const delayMs = 25 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Maps database concurrency errors to standardized HTTP status codes and messages.
 */
export function mapConcurrencyError(error: unknown): {
  status: number;
  code: string;
  message: string;
} | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return { status: 409, code: 'UNIQUE_CONSTRAINT_VIOLATION', message: 'Recurso já cadastrado ou em conflito.' };
    }
    if (error.code === 'P2034') {
      return { status: 409, code: 'SERIALIZATION_FAILURE', message: 'Conflito de concorrência na transação.' };
    }
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes('23P01') || msg.includes('no_overlap') || msg.includes('ROOM_UNAVAILABLE_OVERLAPPING_DATES')) {
      return {
        status: 409,
        code: 'ROOM_UNAVAILABLE',
        message: 'Quarto indisponível para o período solicitado (conflito de reserva concorrente).',
      };
    }
    if (msg === 'ROOM_NOT_FOUND_OR_NOT_OWNED' || msg === 'GUEST_NOT_FOUND_OR_NOT_OWNED') {
      return {
        status: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Recurso não encontrado ou não pertence ao tenant autenticado.',
      };
    }
  }

  return null;
}
