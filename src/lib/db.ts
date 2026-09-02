import type { PrismaClient as PrismaClientType } from '@prisma/client';

export class DatabaseUnavailableError extends Error {
  constructor(message = 'Database is currently unavailable') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

type SafePrismaClient = PrismaClientType & Record<string, any>;

let _db: SafePrismaClient | null = null;
let _dbAvailable: boolean | null = null;

/**
 * No-op proxy used only outside production so local mocks/build-time code can
 * keep importing the database facade. Production must fail closed instead.
 */
const createDeepNoop = (): any => {
  const unavailable = (..._args: any[]) => {
    throw new DatabaseUnavailableError();
  };
  return new Proxy(unavailable, {
    get(_target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
      return createDeepNoop();
    },
    apply(_target, _thisArg, _argArray) {
      throw new DatabaseUnavailableError();
    },
  });
};

const noopProxy: SafePrismaClient = createDeepNoop() as SafePrismaClient;

export async function isDatabaseAvailable(): Promise<boolean> {
  if (_dbAvailable !== null) return _dbAvailable;

  try {
    const url = process.env.DATABASE_URL;
    if (!url || (!url.startsWith('file:') && !url.startsWith('postgresql:') && !url.startsWith('postgres:') && !url.startsWith('mysql:'))) {
      _dbAvailable = false;
      return false;
    }

    const client = getDbClient();
    if (!client) {
      _dbAvailable = false;
      return false;
    }

    await client.$queryRaw`SELECT 1`;
    _dbAvailable = true;
    return true;
  } catch {
    _dbAvailable = false;
    return false;
  }
}

function getDbClient(): SafePrismaClient | null {
  if (typeof window !== 'undefined') return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { prismaEncryptionExtension } = require('./prisma-encryption-middleware');

    const globalForPrisma = globalThis as unknown as { prisma: any };
    const client =
      globalForPrisma.prisma ??
      new (PrismaClient as any)({
        log: ['error', 'warn'],
      });

    const db = (client as any).$extends(prismaEncryptionExtension) as unknown as SafePrismaClient;
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
    return db;
  } catch {
    return null;
  }
}

function createDb(): SafePrismaClient {
  if (typeof window !== 'undefined') return noopProxy;

  const client = getDbClient();
  if (client) return client;

  if (process.env.NODE_ENV === 'production') {
    throw new DatabaseUnavailableError('Prisma client is unavailable in production');
  }

  console.warn('[db] Prisma client unavailable — using no-op fallback outside production');
  return noopProxy;
}

export const db: SafePrismaClient = new Proxy({} as SafePrismaClient, {
  get(_target, prop, receiver) {
    if (!_db) _db = createDb();
    const value = Reflect.get(_db, prop, receiver);
    if (typeof value === 'function') return value.bind(_db);
    return value;
  },
});

export type { PrismaClientType as PrismaClient };
