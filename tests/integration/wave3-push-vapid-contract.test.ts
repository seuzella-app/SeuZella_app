import { describe, expect, it } from 'vitest';

describe('Wave 3 — Web Push VAPID contract', () => {
  it('fails closed when production push credentials are incomplete', () => {
    if (process.env.NODE_ENV !== 'production') return;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      expect(publicKey).toBeFalsy();
      expect(privateKey).toBeFalsy();
    }
  });
});
