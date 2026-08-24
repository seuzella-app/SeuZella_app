import { describe, expect, it } from 'vitest';

type EventEnvelope = {
  tenantId: string;
  entityId: string;
  version: number;
  source: 'desktop' | 'mobile' | 'server';
};

function isValidEnvelope(event: EventEnvelope): boolean {
  return Boolean(event.tenantId && event.entityId && event.version > 0);
}

describe('Realtime tenant event envelope', () => {
  it('requires tenant, entity and monotonic version', () => {
    expect(isValidEnvelope({ tenantId: 't1', entityId: 'r1', version: 1, source: 'mobile' })).toBe(true);
    expect(isValidEnvelope({ tenantId: '', entityId: 'r1', version: 1, source: 'mobile' })).toBe(false);
    expect(isValidEnvelope({ tenantId: 't1', entityId: '', version: 1, source: 'mobile' })).toBe(false);
    expect(isValidEnvelope({ tenantId: 't1', entityId: 'r1', version: 0, source: 'server' })).toBe(false);
  });
});
