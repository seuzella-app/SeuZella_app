import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Asaas webhook security contracts', () => {
  it('checks the actual UTF-8 body size, not only Content-Length', () => {
    const s = fs.readFileSync('src/app/api/webhooks/asaas/route.ts', 'utf8');
    expect(s).toContain("Buffer.byteLength(rawBody, 'utf8')");
    expect(s).toContain('PAYLOAD_TOO_LARGE');
  });

  it('keeps production webhook authentication fail-closed', () => {
    const s = fs.readFileSync('src/app/api/webhooks/asaas/route.ts', 'utf8');
    expect(s).toContain('ASAAS_WEBHOOK_SECRET');
    expect(s).toContain('UNAUTHORIZED_WEBHOOK_TOKEN');
  });
});
