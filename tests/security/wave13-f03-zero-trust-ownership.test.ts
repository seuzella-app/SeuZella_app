import { describe, expect, it } from 'vitest';
import { assertResourceBelongsToTenant, resourceBelongsToTenant } from '@/lib/security/resource-authorization';

describe('Wave 13 F03 — Zero Trust ownership', () => {
  it('authorizes an owned resource', () => {
    expect(assertResourceBelongsToTenant({ resource: { tenantId: 'tenant-a' }, tenantId: 'tenant-a' })).toBe(true);
    expect(resourceBelongsToTenant({ tenantId: 'tenant-a' }, 'tenant-a')).toBe(true);
  });

  it('rejects cross-tenant resources', () => {
    expect(() => assertResourceBelongsToTenant({ resource: { tenantId: 'tenant-b' }, tenantId: 'tenant-a', resourceName: 'Reservation' })).toThrow('Acesso proibido');
    expect(resourceBelongsToTenant({ tenantId: 'tenant-b' }, 'tenant-a')).toBe(false);
  });

  it('fails closed when ownership metadata is absent', () => {
    expect(() => assertResourceBelongsToTenant({ resource: {}, tenantId: 'tenant-a' })).toThrow('Acesso proibido');
    expect(resourceBelongsToTenant(null, 'tenant-a')).toBe(false);
  });
});
