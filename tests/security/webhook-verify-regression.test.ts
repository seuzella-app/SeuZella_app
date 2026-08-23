import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('webhook verification regression contracts', () => {
  const source = fs.readFileSync('src/lib/security/webhook-verify.ts', 'utf8');

  it('requires Mercado Pago manifest identifiers in production', () => {
    expect(source).toContain('MISSING_MANIFEST_IDENTIFIERS');
    expect(source).toContain('!resourceId || !requestId');
  });

  it('keeps replay protection bounded', () => {
    expect(source).toContain('MP_MAX_SKEW_MS');
    expect(source).toContain('MP_MAX_FUTURE_MS');
  });

  it('uses timing-safe comparison for signatures', () => {
    expect(source).toContain('crypto.timingSafeEqual');
  });
});
