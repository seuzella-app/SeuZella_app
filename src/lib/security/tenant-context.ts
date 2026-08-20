/**
 * ZEHLA — Tenant Context Resolution (ISO 19650 aligned)
 * 
 * Resolves the current tenant ID from AsyncLocalStorage or NextAuth session.
 * Used by server-side code (API routes, server components) to enforce
 * strict multi-tenant data isolation.
 * 
 * Security: Never falls back to a hardcoded tenant in production.
 * In development with BYPASS_MIDDLEWARE_AUTH=true, uses the first tenant.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

const tenantStorage = new AsyncLocalStorage<string>();

/**
 * Executa uma função dentro do escopo de um tenant específico (AsyncLocalStorage).
 */
export async function runWithTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(tenantId, fn);
}

export async function getTenantId(): Promise<string | null> {
  // 1. Checa se há um tenant no AsyncLocalStorage (background worker / runWithTenant)
  const scopedTenant = tenantStorage.getStore();
  if (scopedTenant) {
    return scopedTenant;
  }

  try {
    // In dev/CI bypass mode ONLY (never in production), use the first tenant
    if (process.env.BYPASS_MIDDLEWARE_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
      const firstTenant = await db.tenant.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
      return firstTenant?.id ?? null;
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return null;
    }

    return session.user.tenantId;
  } catch {
    return null;
  }
}

/**
 * Strict version that throws if no tenant is resolved.
 * Use this in API routes where tenant context is mandatory.
 */
export async function requireTenantId(): Promise<string> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error('UNAUTHORIZED: No tenant context. Please log in.');
  }
  return tenantId;
}