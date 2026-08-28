import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoist mocks for Vitest
const { mockDb, mockGetToken } = vi.hoisted(() => ({
  mockDb: {
    revokedSession: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockGetToken: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: mockDb,
  isDatabaseAvailable: vi.fn().mockResolvedValue(true),
}));

vi.mock('next-auth/jwt', () => ({
  getToken: mockGetToken,
}));

import { authOptions, revokeSessionToken, isSessionTokenRevoked } from '@/lib/auth';
import { middleware } from '@/middleware';

describe('🔒 LOTE 3: Session Revocation, Tenant Status Invalidation & Middleware Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. M-AUTH-002: Session Token Revocation (RevokedSession / jti)', () => {
    it('generates a jti and authTime on jwt callback', async () => {
      const jwtCallback = authOptions.callbacks?.jwt;
      expect(jwtCallback).toBeDefined();

      const token = await (jwtCallback as any)!({
        token: {},
        user: { id: 'user_1', tenantId: 'tenant_1', role: 'owner', plan: 'pro', niche: 'pousada' } as any,
        account: null,
      });

      expect(token.jti).toBeDefined();
      expect(typeof token.jti).toBe('string');
      expect(token.authTime).toBeDefined();
      expect(typeof token.authTime).toBe('number');
    });

    it('records and checks revoked session in database', async () => {
      mockDb.revokedSession.upsert.mockResolvedValue({ jti: 'jti_abc_123' });
      await revokeSessionToken('jti_abc_123', new Date(Date.now() + 86400000), 'tenant_1', 'logout');
      expect(mockDb.revokedSession.upsert).toHaveBeenCalledWith({
        where: { jti: 'jti_abc_123' },
        update: expect.objectContaining({ reason: 'logout' }),
        create: expect.objectContaining({ jti: 'jti_abc_123', tenantId: 'tenant_1' }),
      });

      mockDb.revokedSession.findUnique.mockResolvedValue({
        jti: 'jti_abc_123',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const isRevoked = await isSessionTokenRevoked('jti_abc_123');
      expect(isRevoked).toBe(true);
    });

    it('invalidates session if token jti has been revoked', async () => {
      mockDb.revokedSession.findUnique.mockResolvedValue({
        jti: 'jti_revoked_123',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const sessionCallback = authOptions.callbacks?.session;
      const result = await (sessionCallback as any)!({
        session: { user: { name: 'Hotel' } } as any,
        token: { jti: 'jti_revoked_123', tenantId: 'tenant_1' } as any,
      });

      expect(result.user).toBeUndefined();
    });
  });

  describe('2. M-AUTH-004 & M-AUTH-005: Tenant Status & Password Rotation Invalidation', () => {
    it('invalidates session if tenant is suspended or inactive in database', async () => {
      mockDb.revokedSession.findUnique.mockResolvedValue(null);
      mockDb.tenant.findUnique.mockResolvedValue({
        status: 'suspended',
        passwordChangedAt: null,
      });

      const sessionCallback = authOptions.callbacks?.session;
      const result = await (sessionCallback as any)!({
        session: { user: { name: 'Hotel' } } as any,
        token: { jti: 'jti_active_123', tenantId: 'tenant_suspended' } as any,
      });

      expect(result.user).toBeUndefined();
    });

    it('invalidates session if password was changed after token issuance', async () => {
      mockDb.revokedSession.findUnique.mockResolvedValue(null);
      const authTime = Math.floor(Date.now() / 1000) - 3600; // Issued 1 hour ago
      const passwordChangedAt = new Date(Date.now() - 60000); // Changed 1 minute ago

      mockDb.tenant.findUnique.mockResolvedValue({
        status: 'active',
        passwordChangedAt,
      });

      const sessionCallback = authOptions.callbacks?.session;
      const result = await (sessionCallback as any)!({
        session: { user: { name: 'Hotel' } } as any,
        token: { jti: 'jti_active_123', tenantId: 'tenant_1', authTime } as any,
      });

      expect(result.user).toBeUndefined();
    });

    it('allows session when tenant is active and password unchanged', async () => {
      mockDb.revokedSession.findUnique.mockResolvedValue(null);
      mockDb.tenant.findUnique.mockResolvedValue({
        status: 'active',
        passwordChangedAt: null,
      });

      const sessionCallback = authOptions.callbacks?.session;
      const result = await (sessionCallback as any)!({
        session: { user: { name: 'Hotel' } } as any,
        token: { jti: 'jti_active_123', tenantId: 'tenant_active', role: 'owner' } as any,
      });

      expect(result.user).toBeDefined();
      expect((result.user as any).tenantId).toBe('tenant_active');
    });
  });

  describe('3. M-RT-001: Middleware Webhook Routing & Security', () => {
    it('allows legitimate public webhooks through without credentials', async () => {
      const publicPaths = [
        'http://localhost/api/webhooks/payment',
        'http://localhost/api/checkout/webhook',
        'http://localhost/api/webhooks/asaas',
        'http://localhost/api/webhooks/mercadopago',
        'http://localhost/api/health',
      ];

      for (const path of publicPaths) {
        const req = new NextRequest(path, { method: 'POST' });
        const res = await middleware(req);
        // Does not reject with 401 AUTH_REQUIRED
        expect(res.status).not.toBe(401);
      }
    });

    it('blocks internal protected APIs when no session or auth header provided', async () => {
      const req = new NextRequest(new URL('/api/internal/sensitive-data', 'http://localhost'), { method: 'GET' });
      const res = await middleware(req);
      if (res.status !== 401) {
        console.log('DEBUG MIDDLEWARE STATUS:', res.status, req.nextUrl.pathname);
      }
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('AUTH_REQUIRED');
    });
  });
});
