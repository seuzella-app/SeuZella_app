import { describe, expect, it, vi } from 'vitest';
import { verifyAsaasWebhook } from '@/lib/security/webhook-verify';
import crypto from 'node:crypto';

describe('Asaas webhook authentication hardening', () => {
  it('rejects legacy shared-token auth unless explicitly enabled', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ASAAS_ALLOW_LEGACY_TOKEN', 'false');

    expect(verifyAsaasWebhook('{}', 'legacy-token', 'a'.repeat(32))).toEqual({
      valid: false,
      reason: 'LEGACY_TOKEN_DISABLED',
    });
  });

  it('accepts a valid raw-body HMAC signature', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ASAAS_ALLOW_LEGACY_TOKEN', 'false');
    const body = '{"id":"evt_1"}';
    const secret = 'b'.repeat(32);
    const digest = crypto.createHmac('sha256', secret).update(body).digest('hex');

    expect(verifyAsaasWebhook(body, `sha256=${digest}`, secret).valid).toBe(true);
  });
});
