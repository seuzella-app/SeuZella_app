import { beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyCronM2MToken, verifyCronSecret } = vi.hoisted(() => ({
  verifyCronM2MToken: vi.fn(),
  verifyCronSecret: vi.fn(),
}));

vi.mock('@/lib/security/cron-auth', () => ({
  verifyCronM2MToken,
}));
vi.mock('@/lib/security/cron-secret', () => ({
  verifyCronSecret,
}));

import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

describe('unified cron auth regression', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.ZELLA_M2M_ED25519_PUBLIC_KEY;
    delete process.env.ZELLA_M2M_JWKS_URL;
    delete process.env.ZELLA_M2M_CLIENTS;
  });

  it('never falls back to CRON_SECRET after a configured JWT fails validation', async () => {
    process.env.ZELLA_M2M_ED25519_PUBLIC_KEY = 'configured';
    verifyCronM2MToken.mockResolvedValue({
      ok: false,
      response: new Response('invalid jwt', { status: 401 }),
    });
    verifyCronSecret.mockReturnValue({ ok: true, source: 'bearer' });

    const request = new Request('https://example.test/api/cron/x', {
      headers: { authorization: 'Bearer eyJinvalid' },
    });
    const result = await verifyCronAuth(request as unknown as import('next/server').NextRequest, 'cerebro:write');

    expect(result.ok).toBe(false);
    expect(result.source).toBe('m2m');
    expect(verifyCronM2MToken).toHaveBeenCalledTimes(1);
    expect(verifyCronSecret).not.toHaveBeenCalled();
  });

  it('uses CRON_SECRET only when no M2M configuration exists', async () => {
    verifyCronSecret.mockReturnValue({ ok: true, source: 'header' });

    const request = new Request('https://example.test/api/cron/x');
    const result = await verifyCronAuth(request as unknown as import('next/server').NextRequest, 'cerebro:write');

    expect(result).toEqual({ ok: true, source: 'cron-secret' });
    expect(verifyCronM2MToken).not.toHaveBeenCalled();
    expect(verifyCronSecret).toHaveBeenCalledTimes(1);
  });
});
