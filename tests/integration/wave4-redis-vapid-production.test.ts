import { describe, expect, it } from 'vitest';

describe('Wave 4 — production transport contracts', () => {
  it('requires Redis for explicit multi-instance mode', () => {
    const multiInstance = process.env.MULTI_INSTANCE_MODE === 'true';
    if (multiInstance) expect(process.env.REDIS_URL).toBeTruthy();
  });

  it('requires complete VAPID configuration when push is enabled', () => {
    const pushEnabled = process.env.PUSH_ENABLED === 'true';
    if (pushEnabled) {
      expect(process.env.VAPID_PUBLIC_KEY).toBeTruthy();
      expect(process.env.VAPID_PRIVATE_KEY).toBeTruthy();
      expect(process.env.VAPID_SUBJECT).toMatch(/^mailto:/);
    }
  });
});
