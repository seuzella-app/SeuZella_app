import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Mock DB and push modules for F01 testing
vi.mock('@/lib/db', () => ({
  isDatabaseAvailable: vi.fn(),
  db: {
    tenant: {
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/push/push-service', () => ({
  isPushEnabled: vi.fn(),
}));

vi.mock('@/lib/realtime/tenant-pubsub', () => ({
  getActiveTransport: vi.fn(),
}));

vi.mock('@/lib/queue/queue-bridge', () => ({
  isBullMQAvailable: vi.fn(),
}));

import { GET as healthGet } from '@/app/api/health/route';
import { isDatabaseAvailable, db } from '@/lib/db';
import { isPushEnabled } from '@/lib/push/push-service';
import { getActiveTransport } from '@/lib/realtime/tenant-pubsub';
import { isBullMQAvailable } from '@/lib/queue/queue-bridge';
import { middleware } from '@/middleware';

describe('🌊 WAVE 12 — PR #37 Fronts Hardening (F01–F04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('🏥 F01: Health Endpoint Hardening (/api/health)', () => {
    it('returns HTTP 200 with status "ok" when all subsystems are fully operational', async () => {
      vi.mocked(isDatabaseAvailable).mockResolvedValue(true);
      vi.mocked(db.tenant.count).mockResolvedValue(5 as any);
      vi.mocked(getActiveTransport).mockReturnValue('redis');
      vi.mocked(isBullMQAvailable).mockReturnValue(true);
      vi.mocked(isPushEnabled).mockReturnValue(true);

      const req = new NextRequest('http://localhost:3000/api/health');
      const res = await healthGet(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('ok');
      expect(json.services.database.available).toBe(true);
      expect(json.services.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(json.services.redis.configured).toBe(true);
      expect(json.services.redis.transport).toBe('redis');
      expect(json.services.bullmq.available).toBe(true);
      expect(json.services.push.enabled).toBe(true);
      expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0, must-revalidate');
    });

    it('returns HTTP 200 with status "degraded" when DB is available but auxiliary services are unavailable', async () => {
      vi.mocked(isDatabaseAvailable).mockResolvedValue(true);
      vi.mocked(db.tenant.count).mockResolvedValue(1 as any);
      vi.mocked(getActiveTransport).mockReturnValue('memory');
      vi.mocked(isBullMQAvailable).mockReturnValue(false);
      vi.mocked(isPushEnabled).mockReturnValue(false);

      const req = new NextRequest('http://localhost:3000/api/health');
      const res = await healthGet(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('degraded');
      expect(json.services.database.available).toBe(true);
      expect(json.services.redis.configured).toBe(false);
      expect(json.services.bullmq.available).toBe(false);
    });

    it('returns HTTP 503 with status "down" when database is unavailable (Fail-Closed)', async () => {
      vi.mocked(isDatabaseAvailable).mockResolvedValue(false);

      const req = new NextRequest('http://localhost:3000/api/health');
      const res = await healthGet(req);
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.status).toBe('down');
      expect(json.services.database.available).toBe(false);
    });

    it('returns HTTP 503 when database count query throws an exception', async () => {
      vi.mocked(isDatabaseAvailable).mockResolvedValue(true);
      vi.mocked(db.tenant.count).mockRejectedValue(new Error('Connection terminated'));

      const req = new NextRequest('http://localhost:3000/api/health');
      const res = await healthGet(req);
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.status).toBe('down');
      expect(json.services.database.available).toBe(false);
    });

    it('does NOT expose database credentials, secrets, or internal stacks in health payload', async () => {
      vi.mocked(isDatabaseAvailable).mockResolvedValue(true);
      vi.mocked(db.tenant.count).mockResolvedValue(1 as any);

      const req = new NextRequest('http://localhost:3000/api/health');
      const res = await healthGet(req);
      const bodyStr = JSON.stringify(await res.json());

      expect(bodyStr).not.toContain('postgres://');
      expect(bodyStr).not.toContain('password');
      expect(bodyStr).not.toContain('secret');
      expect(bodyStr).not.toContain('DATABASE_URL');
    });
  });

  describe('🛡️ F02: Request Correlation & X-Request-ID (Middleware)', () => {
    it('preserves valid X-Request-ID and injects it into response headers', async () => {
      const validId = 'req-trace-12345678_abcdef';
      const req = new NextRequest('http://localhost:3000/api/health', {
        headers: { 'x-request-id': validId },
      });

      const res = await middleware(req);
      expect(res.headers.get('X-Request-ID')).toBe(validId);
      expect(res.headers.get('X-Security-Shield')).toBe('zero-trust-v4');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('generates a safe UUID when no X-Request-ID is supplied', async () => {
      const req = new NextRequest('http://localhost:3000/api/health');
      const res = await middleware(req);
      const generatedId = res.headers.get('X-Request-ID');

      expect(generatedId).toBeDefined();
      expect(generatedId).toMatch(/^mid-[0-9a-f-]{36}$/);
    });

    it('replaces Header Injection attempts and illegal symbols with safe generated UUID', async () => {
      const maliciousId = 'evil;Injected-Header:true;--drop';
      const req = new NextRequest('http://localhost:3000/api/health', {
        headers: { 'x-request-id': maliciousId },
      });

      const res = await middleware(req);
      const resultingId = res.headers.get('X-Request-ID');

      expect(resultingId).not.toContain('evil');
      expect(resultingId).not.toContain(';');
      expect(resultingId).not.toContain('--drop');
      expect(resultingId).toMatch(/^mid-[0-9a-f-]{36}$/);
    });

    it('replaces oversized Request IDs (>64 chars) with a safe UUID', async () => {
      const oversizedId = 'A'.repeat(128);
      const req = new NextRequest('http://localhost:3000/api/health', {
        headers: { 'x-request-id': oversizedId },
      });

      const res = await middleware(req);
      const resultingId = res.headers.get('X-Request-ID');

      expect(resultingId).not.toBe(oversizedId);
      expect(resultingId).toMatch(/^mid-[0-9a-f-]{36}$/);
    });

    it('replaces characters outside [A-Za-z0-9_-] with a safe UUID', async () => {
      const invalidCharsId = '<script>alert(1)</script>';
      const req = new NextRequest('http://localhost:3000/api/health', {
        headers: { 'x-request-id': invalidCharsId },
      });

      const res = await middleware(req);
      const resultingId = res.headers.get('X-Request-ID');

      expect(resultingId).not.toContain('<script>');
      expect(resultingId).toMatch(/^mid-[0-9a-f-]{36}$/);
    });
  });

  describe('🚀 F03: Production Smoke Script Audit (smoke-post-release.sh)', () => {
    const smokeScriptPath = path.join(process.cwd(), 'scripts/production/smoke-post-release.sh');

    it('verifies smoke script exists and has strict bash safety flags (set -Eeuo pipefail)', () => {
      expect(fs.existsSync(smokeScriptPath)).toBe(true);
      const content = fs.readFileSync(smokeScriptPath, 'utf8');

      expect(content).toContain('set -Eeuo pipefail');
      expect(content).toContain('assert_status 200 "$BASE_URL/api/health"');
      expect(content).toContain('assert_status 200 "$BASE_URL/"');
      expect(content).toContain('status === \'down\'');
    });

    it('verifies smoke script does NOT contain hardcoded secrets or passwords', () => {
      const content = fs.readFileSync(smokeScriptPath, 'utf8');
      expect(content).not.toMatch(/postgres:\/\/[^$]/);
      expect(content).not.toMatch(/sk_live_[^$]/);
      expect(content).not.toMatch(/mp-secret-[^$]/);
    });
  });

  describe('🔒 F04: Production Preflight Script Audit (preflight-production.sh)', () => {
    const preflightScriptPath = path.join(process.cwd(), 'scripts/production/preflight-production.sh');

    it('verifies preflight script exists and is strictly READ-ONLY', () => {
      expect(fs.existsSync(preflightScriptPath)).toBe(true);
      const content = fs.readFileSync(preflightScriptPath, 'utf8');

      expect(content).toContain('set -Eeuo pipefail');
      expect(content).toContain('PREFLIGHT_FAIL');
      expect(content).toContain('PREFLIGHT_OK');

      // Must NOT contain destructive mutating commands
      expect(content).not.toContain('prisma migrate deploy');
      expect(content).not.toContain('DROP TABLE');
      expect(content).not.toContain('DELETE FROM');
      expect(content).not.toContain('git push');
      expect(content).not.toContain('git commit');
      expect(content).not.toContain('rm -rf /');
    });

    it('verifies preflight checks secret presence without printing secret values', () => {
      const content = fs.readFileSync(preflightScriptPath, 'utf8');

      expect(content).toContain('DATABASE_URL');
      expect(content).toContain('NEXTAUTH_SECRET');
      expect(content).toContain('ENCRYPTION_SECRET');
      expect(content).toContain('ZEHLA_MASTER_ADMIN_PASSWORD');

      // Ensures length / presence is printed, NOT the raw value
      expect(content).toContain('present_length=');
      expect(content).not.toContain('echo $NEXTAUTH_SECRET');
      expect(content).not.toContain('echo $DATABASE_URL');
    });
  });
});
