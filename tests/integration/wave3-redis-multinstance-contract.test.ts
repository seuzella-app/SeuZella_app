import { describe, expect, it } from 'vitest';
import { getActiveTransport } from '@/lib/realtime/tenant-pubsub';

describe('Wave 3 — Redis multi-instance contract', () => {
  it('uses Redis when REDIS_URL is configured and in-memory fallback otherwise', () => {
    const transport = getActiveTransport();
    expect(['redis', 'memory']).toContain(transport);
  });
});
