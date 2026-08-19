// Browser-safe Prisma client wrapper
// On the server: creates a real PrismaClient with encryption extension
// On the client: exports a dummy object that won't crash
// On Vercel/serverless: falls back to no-op (SQLite file doesn't exist there)

import type { PrismaClient as PrismaClientType } from '@prisma/client';

type SafePrismaClient = PrismaClientType & Record<string, any>;

let _db: SafePrismaClient | null = null;
let _dbAvailable: boolean | null = null;

/** No-op proxy that safely returns resolving promises for any model method call */
const createDeepNoop = (): any => {
  const fn = (..._args: any[]) => Promise.resolve(null);
  return new Proxy(fn, {
    get(_target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return undefined; // Not a thenable itself unless called
      }
      return createDeepNoop();
    },
    apply(_target, _thisArg, _argArray) {
      return Promise.resolve(null);
    },
  });
};

const noopProxy: SafePrismaClient = createDeepNoop() as SafePrismaClient;

/** Check if we're running on Vercel (serverless — no persistent SQLite) */
function isVercelServerless(): boolean {
  return !!(process.env.VERCEL || process.env.VERCEL_ENV);
}

/**
 * Check if the database is available by testing the connection.
 * Returns false if DATABASE_URL is invalid or connection fails.
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  // On Vercel serverless, SQLite is never available
  if (isVercelServerless()) {
    _dbAvailable = false;
    return false;
  }

  if (_dbAvailable !== null) return _dbAvailable;
  
  try {
    const url = process.env.DATABASE_URL;
    if (!url || (!url.startsWith('file:') && !url.startsWith('postgresql:') && !url.startsWith('mysql:'))) {
      _dbAvailable = false;
      return false;
    }
    
    // Try a lightweight query
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
  // Only create Prisma on the server
  if (typeof window !== 'undefined') {
    return null;
  }

  // On Vercel, don't create Prisma client — SQLite file doesn't exist there
  if (isVercelServerless()) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { prismaEncryptionExtension } = require('./prisma-encryption-middleware');

    const globalForPrisma = globalThis as unknown as { prisma: any };

    const client =
      globalForPrisma.prisma ??
      new (PrismaClient as any)({
        log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
      });

    const db = (client as any).$extends(prismaEncryptionExtension) as unknown as SafePrismaClient;

    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

    return db;
  } catch {
    return null;
  }
}

function createDb(): SafePrismaClient {
  // Only create Prisma on the server
  if (typeof window !== 'undefined') {
    return noopProxy;
  }

  // On Vercel, return no-op proxy — SQLite file doesn't exist there
  if (isVercelServerless()) {
    console.warn('[db] Vercel serverless detected — using no-op DB proxy');
    return noopProxy;
  }

  // Server-side: try to create real Prisma client
  const client = getDbClient();
  if (client) {
    return client;
  }

  // Fallback: return a no-op proxy that won't crash
  console.warn('[db] Prisma client unavailable — using no-op fallback');
  return noopProxy;
}

// Lazy singleton
export const db: SafePrismaClient = new Proxy({} as SafePrismaClient, {
  get(_target, prop, receiver) {
    if (!_db) {
      _db = createDb();
    }
    const value = Reflect.get(_db, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(_db);
    }
    return value;
  },
});

// Re-export the type
export type { PrismaClientType as PrismaClient };
