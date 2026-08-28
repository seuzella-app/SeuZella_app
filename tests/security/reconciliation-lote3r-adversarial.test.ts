import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as syncHandler } from '@/app/api/integrations/sync/route';
import { GET as monthlyBillingHandler } from '@/app/api/cron/monthly-billing/route';

describe('🔬 Adversarial Security Tests — Lote 3R Reconciliation (P0-A, P0-B, P0-C)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('P0-B: /api/integrations/sync boundary enforcement', () => {
    it('rejects unauthenticated request (no headers)', async () => {
      process.env.CALENDAR_SYNC_SECRET = 'super-secure-calendar-sync-secret-32ch!';
      const req = new NextRequest('http://localhost:3000/api/integrations/sync', {
        method: 'POST',
      });
      const res = await syncHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('UNAUTHORIZED');
    });

    it('rejects forged Authorization: Bearer x', async () => {
      process.env.CALENDAR_SYNC_SECRET = 'super-secure-calendar-sync-secret-32ch!';
      const req = new NextRequest('http://localhost:3000/api/integrations/sync', {
        method: 'POST',
        headers: {
          authorization: 'Bearer x',
        },
      });
      const res = await syncHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('UNAUTHORIZED');
    });

    it('rejects invalid x-sync-secret header', async () => {
      process.env.CALENDAR_SYNC_SECRET = 'super-secure-calendar-sync-secret-32ch!';
      const req = new NextRequest('http://localhost:3000/api/integrations/sync', {
        method: 'POST',
        headers: {
          'x-sync-secret': 'wrong-sync-secret-value-12345678',
        },
      });
      const res = await syncHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('UNAUTHORIZED');
    });
  });

  describe('P0-C: /api/cron/monthly-billing boundary enforcement', () => {
    it('rejects query parameter secret bypass (?secret=seuzella-cron-secret-2026)', async () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.CRON_SECRET = 'real-production-cron-secret-32chars!';

      const req = new NextRequest('http://localhost:3000/api/cron/monthly-billing?secret=seuzella-cron-secret-2026', {
        method: 'GET',
      });
      const res = await monthlyBillingHandler(req);
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated request in production', async () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.CRON_SECRET = 'real-production-cron-secret-32chars!';

      const req = new NextRequest('http://localhost:3000/api/cron/monthly-billing', {
        method: 'GET',
      });
      const res = await monthlyBillingHandler(req);
      expect(res.status).toBe(401);
    });
  });
});
