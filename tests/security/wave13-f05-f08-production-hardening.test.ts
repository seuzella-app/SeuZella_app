import { describe, expect, it } from 'vitest';
import { evaluateProductionReleaseGate } from '@/lib/production/release-gate';

describe('Wave 13 F08 production release gate', () => {
  const base = {
    nodeEnv: 'production',
    databaseUrl: 'postgresql://db.example/zella',
    nextAuthSecret: 'a'.repeat(32),
    encryptionSecret: 'b'.repeat(32),
    cacheSigningSecret: 'c'.repeat(32),
    whatsappCommercial: '5511999999999',
    whatsappSupport: '5511888888888',
  };

  it('passes a complete production configuration', () => {
    expect(evaluateProductionReleaseGate(base)).toEqual({ status: 'PASS', blockers: [] });
  });

  it('blocks SQLite/file database in production', () => {
    const result = evaluateProductionReleaseGate({ ...base, databaseUrl: 'file:./db.sqlite' });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('DATABASE_URL:not-postgresql');
  });

  it('blocks demo and middleware bypass flags', () => {
    const result = evaluateProductionReleaseGate({ ...base, demoMode: 'true', bypassMiddlewareAuth: 'true' });
    expect(result.blockers).toEqual(expect.arrayContaining(['ZELLA_DEMO_MODE:true', 'BYPASS_MIDDLEWARE_AUTH:true']));
  });

  it('requires provider credentials when Asaas is the selected gateway', () => {
    const result = evaluateProductionReleaseGate({ ...base, paymentGateway: 'asaas' });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toEqual(expect.arrayContaining(['ASAAS_ACCESS_TOKEN:missing', 'ASAAS_WEBHOOK_SECRET:missing']));
  });

  it('does not expose secret values in blockers', () => {
    const secret = 'super-secret-production-token';
    const result = evaluateProductionReleaseGate({ ...base, asaasAccessToken: secret, paymentGateway: 'asaas' });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
