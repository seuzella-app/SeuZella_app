import { describe, it, expect } from 'vitest';
import {
  hashClientSecret,
  registerM2MClient,
  verifyM2MClientCredentials,
  revokeJti,
  isJtiRevoked,
} from '@/lib/security/m2m-policy';

describe('🔐 M2M Client Credentials & Hash Security Suite (P1)', () => {
  it('deve gerar hash bcrypt seguro e validar credenciais corretamente', async () => {
    const plainSecret = 'super_secret_m2m_token_passcode_xyz_999';
    const secretHash = await hashClientSecret(plainSecret);

    expect(secretHash).toMatch(/^\$2[aby]\$\d+\$/);

    registerM2MClient({
      clientId: 'test-cron-agent',
      secretHash,
      allowedScopes: ['cerebro:read', 'cerebro:write'],
      description: 'Cliente de Teste M2M',
      active: true,
    });

    const validAuth = await verifyM2MClientCredentials('test-cron-agent', plainSecret, 'cerebro:read');
    expect(validAuth.valid).toBe(true);
    expect(validAuth.client?.clientId).toBe('test-cron-agent');
  });

  it('deve rejeitar credenciais com secret incorreto', async () => {
    const validAuth = await verifyM2MClientCredentials('test-cron-agent', 'wrong_password_attempt', 'cerebro:read');
    expect(validAuth.valid).toBe(false);
    expect(validAuth.reason).toBe('INVALID_CLIENT_SECRET');
  });

  it('deve rejeitar solicitação de escopo não autorizado para o client_id', async () => {
    const plainSecret = 'super_secret_m2m_token_passcode_xyz_999';
    const unauthorizedScope = await verifyM2MClientCredentials('test-cron-agent', plainSecret, 'reports:read');
    expect(unauthorizedScope.valid).toBe(false);
    expect(unauthorizedScope.reason).toContain('UNAUTHORIZED_SCOPE');
  });

  it('deve rastrear e revogar JTIs (JWT IDs) impedindo reuso de tokens revogados', () => {
    const jti = 'm2m_test_revocation_uuid_777';
    expect(isJtiRevoked(jti)).toBe(false);

    revokeJti(jti);
    expect(isJtiRevoked(jti)).toBe(true);
  });
});
