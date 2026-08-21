import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const source = fs.readFileSync('src/app/api/telemetry/landing/route.ts', 'utf8');

describe('landing telemetry security regression', () => {
  it('does not expose aggregate landing metrics anonymously', () => {
    expect(source).toContain("request.headers.get('x-zcc-master-key')");
    expect(source).toContain('cryptoSafeEqual');
    expect(source).toContain('status: 401');
  });

  it('enforces the actual UTF-8 request body limit', () => {
    expect(source).toContain("Buffer.byteLength(rawBody, 'utf8')");
    expect(source).toContain('MAX_BODY_BYTES');
  });
});
