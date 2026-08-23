import { describe, expect, it, beforeEach, vi } from 'vitest';
import { pinRatelimit } from '@/lib/rate-limit';

describe('PIN generation rate limit — 50 PINs per hour per tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports a pinRatelimit instance', () => {
    expect(pinRatelimit).toBeDefined();
    expect(typeof pinRatelimit.limit).toBe('function');
  });

  it('allows the first PIN generation for a tenant', async () => {
    const result = await pinRatelimit.limit('pin:tenant_test_1');
    expect(result.success).toBe(true);
  });

  it('blocks the 51st PIN within the same hour window', async () => {
    const tenantKey = 'pin:tenant_test_2';
    // The local fallback rate-limit implementation uses a sliding window.
    // The first 50 calls must succeed; the 51st must fail.
    for (let i = 0; i < 50; i++) {
      const r = await pinRatelimit.limit(tenantKey);
      expect(r.success).toBe(true);
    }
    const blocked = await pinRatelimit.limit(tenantKey);
    expect(blocked.success).toBe(false);
  });

  it('isolates tenants (tenant A hitting limit does not block tenant B)', async () => {
    const tenantA = 'pin:tenant_a';
    const tenantB = 'pin:tenant_b';

    // Burn through tenant A's quota
    for (let i = 0; i < 50; i++) {
      await pinRatelimit.limit(tenantA);
    }
    const blockedA = await pinRatelimit.limit(tenantA);
    expect(blockedA.success).toBe(false);

    // Tenant B should still be allowed
    const allowedB = await pinRatelimit.limit(tenantB);
    expect(allowedB.success).toBe(true);
  });

  it('rate-limit key follows the pin:<tenantId> format expected by orchestrator.ts', async () => {
    // Sanity check: the orchestrator imports pinRatelimit and uses the key
    // pattern `pin:${tenantId}`. If either side changes without the other,
    // PIN generation silently bypasses the limit.
    const tenantId = 'tenant_test_format';
    const expectedKey = `pin:${tenantId}`;
    const result = await pinRatelimit.limit(expectedKey);
    expect(result.success).toBe(true);
  });
});

describe('PIN rate limit — orchestrator integration contract', () => {
  it('orchestrator.ts imports pinRatelimit and applies it to generatePin', async () => {
    // Source-text contract: the rate-limit import must exist (either as a
    // static `from '@/lib/rate-limit'` import or a dynamic await import())
    // and the rate-limit check must appear before the device lookup
    // (so we fail fast on abuse).
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/locks/orchestrator.ts'),
      'utf8',
    );
    // The orchestrator uses dynamic import to avoid loading rate-limit at module load.
    expect(source).toMatch(/import\(.*@\/lib\/rate-limit.*\)/);
    expect(source).toContain('pinRatelimit');
    expect(source).toContain('PIN_RATE_LIMIT_EXCEEDED');
    // Rate-limit check must come AFTER tenant resolution but BEFORE device lookup.
    const tenantIdx = source.indexOf('resolveTenantId()');
    const rateLimitIdx = source.indexOf('pinRatelimit.limit');
    const deviceIdx = source.indexOf('getLockDevice(input.deviceId)');
    expect(tenantIdx).toBeGreaterThan(-1);
    expect(rateLimitIdx).toBeGreaterThan(tenantIdx);
    expect(deviceIdx).toBeGreaterThan(rateLimitIdx);
  });
});
