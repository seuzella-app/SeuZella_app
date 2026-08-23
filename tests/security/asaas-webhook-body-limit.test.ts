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
    // Auth is enforced via verifyAsaasWebhook (HMAC or timing-safe shared token).
    // Failure returns WEBHOOK_SIGNATURE_INVALID with a reason field.
    expect(s).toContain('verifyAsaasWebhook');
    expect(s).toContain('WEBHOOK_SIGNATURE_INVALID');
  });
});
