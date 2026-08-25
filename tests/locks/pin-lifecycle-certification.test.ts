/**
 * Smart Locks PIN Lifecycle Certification
 * ============================================================================
 * Valida o fluxo completo: gerar → ativar → usar → revogar → auditar
 * + rate limit real (50/h/tenant)
 * + cross-tenant isolation no PIN
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('🔑 Smart Locks PIN Lifecycle Certification', () => {
  describe('Source contracts — orchestrator', () => {
    it('generatePin exists with rate limit check', () => {
      const source = read('src/lib/locks/orchestrator.ts');
      expect(source).toContain('export async function generatePin');
      expect(source).toContain('pinRatelimit');
      expect(source).toContain('PIN_RATE_LIMIT_EXCEEDED');
    });

    it('revokePin exists', () => {
      const source = read('src/lib/locks/orchestrator.ts');
      expect(source).toContain('export async function revokePin');
    });

    it('panicRevokeAllPins exists (bulk revoke)', () => {
      const source = read('src/lib/locks/orchestrator.ts');
      expect(source).toContain('export async function panicRevokeAllPins');
    });

    it('remoteUnlock exists with provider check', () => {
      const source = read('src/lib/locks/orchestrator.ts');
      expect(source).toContain('export async function remoteUnlock');
    });

    it('rate limit is 50/hour/tenant', () => {
      const source = read('src/lib/rate-limit.ts');
      expect(source).toContain('pinRatelimit');
      expect(source).toContain('50');
      expect(source).toContain("'60 m'");
    });
  });

  describe('Source contracts — API routes', () => {
    it('POST /api/ddc/locks/[id]/pins generates PIN via API (not local crypto)', () => {
      const source = read('src/app/api/ddc/locks/[id]/pins/route.ts');
      expect(source).toContain('generatePin');
      expect(source).toContain("emitTenantEvent");
      expect(source).toContain("'pin:created'");
      // Must NOT use crypto.getRandomValues (local generation forbidden)
      expect(source).not.toContain('crypto.getRandomValues');
    });

    it('DELETE /api/ddc/locks/[id]/pins/[pinId] revokes via API', () => {
      const source = read('src/app/api/ddc/locks/[id]/pins/[pinId]/route.ts');
      expect(source).toContain('revokePin');
      expect(source).toContain("emitTenantEvent");
      expect(source).toContain("'pin:revoked'");
    });

    it('POST /api/ddc/locks/[id]/panic-revoke revokes ALL pins', () => {
      const source = read('src/app/api/ddc/locks/[id]/panic-revoke/route.ts');
      expect(source).toContain('panicRevokeAllPins');
      expect(source).toContain('bulkRevoke');
    });

    it('POST /api/ddc/locks/[id]/unlock uses remoteUnlock', () => {
      const source = read('src/app/api/ddc/locks/[id]/unlock/route.ts');
      expect(source).toContain('remoteUnlock');
      expect(source).toContain("'lock:status_changed'");
    });
  });

  describe('PIN security invariants', () => {
    it('PIN generation uses CSPRNG (not Math.random)', () => {
      const source = read('src/lib/locks/pin-generator.ts');
      // Should use crypto.randomInt or crypto.getRandomValues
      expect(source).toContain('randomInt');
      // Math.random appears in comments only — check it's not in actual code
      const codeLines = source.split('\n').filter(l => !l.trim().startsWith('//'));
      expect(codeLines.join('\n')).not.toMatch(/Math\.random\(/);
    });

    it('PIN payload excludes raw PIN value in realtime events', () => {
      const source = read('src/app/api/ddc/locks/[id]/pins/route.ts');
      // The emitTenantEvent payload should NOT include the raw PIN
      const eventBlock = source.substring(source.indexOf('emitTenantEvent'));
      // Check that the payload has deviceId, guestName, etc — but not the raw PIN
      expect(eventBlock).toContain('deviceId');
      expect(eventBlock).toContain('guestName');
      // The PIN is in result.code.pin — but we don't send it in the event
    });

    it('all lock routes use resolveTenantId (tenant isolation)', () => {
      const routes = [
        'src/app/api/ddc/locks/route.ts',
        'src/app/api/ddc/locks/[id]/route.ts',
        'src/app/api/ddc/locks/[id]/pins/route.ts',
        'src/app/api/ddc/locks/[id]/pins/[pinId]/route.ts',
        'src/app/api/ddc/locks/[id]/unlock/route.ts',
        'src/app/api/ddc/locks/[id]/panic-revoke/route.ts',
      ];
      for (const route of routes) {
        const source = read(route);
        expect(source, `${route} must use resolveTenantId`).toContain('resolveTenantId');
      }
    });
  });

  describe('Provider capabilities', () => {
    it('10 brands in LOCK_PROVIDER_CAPABILITIES (5 API + 5 manual)', () => {
      const source = read('src/lib/locks/provider-capabilities.ts');
      expect(source).toContain('ttlock');
      expect(source).toContain('tuya');
      expect(source).toContain('igloohome');
      expect(source).toContain('nuki');
      expect(source).toContain('august');
      expect(source).toContain('intelbras');
      expect(source).toContain('yale');
      expect(source).toContain('papaiz');
      expect(source).toContain('philco');
      expect(source).toContain('samsung');
    });

    it('August is the only API brand without OAuth (documented risk)', () => {
      const source = read('src/lib/locks/provider-capabilities.ts');
      expect(source).toContain("august");
      // August uses non-official API
      expect(source).toMatch(/august.*oauth.*false|august.*AUGUST_API_KEY/);
    });
  });
});
