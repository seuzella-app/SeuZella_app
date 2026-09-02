import { describe, expect, it } from 'vitest';
import { TENANT_CONTEXT_SETTING } from '@/lib/db/tenant-context';

describe('Wave 13 F02 — RLS tenant context', () => {
  it('uses the canonical PostgreSQL setting name', () => {
    expect(TENANT_CONTEXT_SETTING).toBe('app.current_tenant_id');
  });

  it('rejects empty or malformed tenant identities before touching the database', async () => {
    const { withTenantContext } = await import('@/lib/db/tenant-context');
    const fakeDb = { $transaction: async () => { throw new Error('DB_MUST_NOT_BE_CALLED'); } } as never;
    await expect(withTenantContext(fakeDb, '', async () => null)).rejects.toThrow('INVALID_TENANT_ID');
    await expect(withTenantContext(fakeDb, 'tenant;drop', async () => null)).rejects.toThrow('INVALID_TENANT_ID');
  });
});
