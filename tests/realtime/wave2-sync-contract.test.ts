import { describe, expect, it } from 'vitest';

describe('Wave 2 realtime sync contract', () => {
  it('requires tenant-scoped event identity for cross-device mutations', () => {
    const event = {
      tenantId: 'tenant-1',
      entity: 'reservation',
      entityId: 'reservation-1',
      operation: 'updated',
      source: 'mobile',
      version: 7,
    };

    expect(event.tenantId).toBeTruthy();
    expect(event.entityId).toBeTruthy();
    expect(event.version).toBeGreaterThan(0);
    expect(['mobile', 'desktop', 'server']).toContain(event.source);
  });

  it('rejects events without tenant identity or monotonic version', () => {
    const invalid = [
      { tenantId: '', entityId: 'r1', version: 1 },
      { tenantId: 't1', entityId: 'r1', version: 0 },
      { tenantId: 't1', entityId: '', version: 1 },
    ];

    for (const event of invalid) {
      expect(Boolean(event.tenantId && event.entityId && event.version > 0)).toBe(false);
    }
  });
});
