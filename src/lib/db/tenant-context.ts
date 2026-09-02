import type { Prisma, PrismaClient } from '@prisma/client';

export const TENANT_CONTEXT_SETTING = 'app.current_tenant_id';

type PrismaTransaction = Prisma.TransactionClient;

function assertTenantId(tenantId: string): void {
  if (!tenantId || tenantId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(tenantId)) {
    throw new Error('INVALID_TENANT_ID');
  }
}

/**
 * Binds tenant identity to the same PostgreSQL transaction as the protected work.
 * The third argument to set_config is true, making the setting transaction-local.
 */
export async function withTenantContext<T>(db: PrismaClient, tenantId: string, work: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
  assertTenantId(tenantId);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config(${TENANT_CONTEXT_SETTING}, ${tenantId}, true)`;
    return work(tx);
  });
}

export async function setTenantContext(tx: PrismaTransaction, tenantId: string): Promise<void> {
  assertTenantId(tenantId);
  await tx.$executeRaw`SELECT set_config(${TENANT_CONTEXT_SETTING}, ${tenantId}, true)`;
}
