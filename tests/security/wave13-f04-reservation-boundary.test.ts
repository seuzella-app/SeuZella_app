import { describe, expect, it } from 'vitest';
import { resourceBelongsToTenant } from '@/lib/security/resource-authorization';

describe('Wave 13 F04 — reservation security contract', () => {
  it('requires tenant ownership for room and guest resources', () => {
    expect(resourceBelongsToTenant({ tenantId: 'tenant-a' }, 'tenant-a')).toBe(true);
    expect(resourceBelongsToTenant({ tenantId: 'tenant-b' }, 'tenant-a')).toBe(false);
    expect(resourceBelongsToTenant({}, 'tenant-a')).toBe(false);
  });

  it('does not treat an absent ownership field as authorized', () => {
    expect(resourceBelongsToTenant(undefined, 'tenant-a')).toBe(false);
    expect(resourceBelongsToTenant({ tenant_id: null }, 'tenant-a')).toBe(false);
  });
});
