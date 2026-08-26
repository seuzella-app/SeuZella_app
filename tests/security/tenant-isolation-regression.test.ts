/** Regression tests for application-level tenant isolation. */
import { describe, expect, it, vi } from 'vitest';
import { getTenantDb } from '@/lib/db/tenant-prisma';

describe('tenant isolation regression', () => {
  function operationFor(tenantId: string) {
    let extension: any;
    const prisma = {
      $extends: vi.fn((value: any) => {
        extension = value;
        return value;
      }),
    } as any;
    getTenantDb(prisma, tenantId);
    return extension.query.$allModels.$allOperations;
  }

  it('forces tenantId into upsert where and create data', async () => {
    const operation = operationFor('tenant-a');
    const query = vi.fn(async (args: any) => args);
    const args = await operation({
      model: 'Reservation',
      operation: 'upsert',
      args: { where: { id: 'reservation-1' }, create: { guestName: 'Guest' }, update: { guestName: 'Guest 2' } },
      query,
    });

    expect(args.where.tenantId).toBe('tenant-a');
    expect(args.create.tenantId).toBe('tenant-a');
    expect(args.update.tenantId).toBe('tenant-a');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('blocks an explicit cross-tenant unique read', async () => {
    const operation = operationFor('tenant-a');
    const query = vi.fn(async () => ({ id: 'foreign' }));
    const result = await operation({
      model: 'Reservation',
      operation: 'findUnique',
      args: { where: { id: 'reservation-1', tenantId: 'tenant-b' } },
      query,
    });

    expect(result).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects an empty tenant context before creating an extension', () => {
    const prisma = { $extends: vi.fn() } as any;
    expect(() => getTenantDb(prisma, '')).toThrow('TENANT_CONTEXT_REQUIRED');
    expect(prisma.$extends).not.toHaveBeenCalled();
  });
});
