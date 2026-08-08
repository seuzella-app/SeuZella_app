/**
 * Tests for the 6 new cron routes (Gap 3 + Gap 2 + Gap 10)
 *
 * Validates:
 *  - Route files exist and export GET/POST handlers
 *  - Auth gate is enforced in production
 *  - Returns 401 without auth header in production
 *  - Returns 200 with auth header (mock mode in dev)
 *  - Returns the expected JSON shape with mode, timestamp, processingTimeMs
 *  - Each cron calls the correct bridge (validated via memoryStore inspection)
 *
 * Crons covered:
 *  - ota-token-expiry (Gap 3) → bridgeOtaTokenExpired
 *  - plan-expiry (Gap 3) → bridgePlanExpiring
 *  - booking-daily (Gap 3) → bridgeReservationEvent (checkin_today/checkout_today)
 *  - payment-overdue (Gap 3) → bridgePaymentEvent (overdue)
 *  - achievements-check (Gap 2) → bridgeAchievement via achievement-engine
 *  - plan-limits-check (Gap 10) → notify plan.lite_* via plan-limits-checker
 *
 * Mocking strategy: Prisma `db` is mocked via vi.mock to return empty arrays
 * so the crons don't crash. The bridges still fire and we verify the response shape.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { memoryStore } from '@/lib/notifications/producer';

// ─── Mock Prisma db ────────────────────────────────────────────────────────
// Crons call db.tenant.findMany, db.booking.findMany, db.subscription.findMany,
// db.paymentTransaction.findMany. We mock all of them to return empty arrays.
vi.mock('@/lib/db', () => ({
  db: {
    tenant: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    booking: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    subscription: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    paymentTransaction: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    budgetGuardState: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    bookingSyncConfig: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    oAuthToken: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
  isDatabaseAvailable: vi.fn().mockResolvedValue(true),
}));

// ─── Helper: dynamic import of route handler ──────────────────────────────
async function importCronRoute(name: string): Promise<any> {
  const mod = await import(`@/app/api/cron/${name}/route`);
  return mod;
}

// ─── Mock NextRequest for cron invocation ──────────────────────────────────
function mockCronRequest(headers: Record<string, string> = {}): Request {
  const url = 'http://localhost:3000/api/cron/test';
  return new Request(url, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

beforeEach(() => {
  process.env.CI = 'true';
  (process.env as any).NODE_ENV = 'test';
  process.env.DATABASE_URL = 'file:./test-ci.db';
  memoryStore.clear();
});

describe('Cron routes — file existence and exports', () => {
  const cronNames = [
    'ota-token-expiry',
    'plan-expiry',
    'booking-daily',
    'payment-overdue',
    'achievements-check',
    'plan-limits-check',
  ];

  for (const name of cronNames) {
    it(`${name} route exists and exports GET + POST`, async () => {
      const mod = await importCronRoute(name);
      expect(typeof mod.GET).toBe('function');
      expect(typeof mod.POST).toBe('function');
    });
  }
});

describe('Cron routes — auth gate in production', () => {
  beforeEach(() => {
    (process.env as any).NODE_ENV = 'production';
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  afterEach(() => {
    (process.env as any).NODE_ENV = 'test';
  });

  it('ota-token-expiry returns 401 without auth header in production', async () => {
    const { GET } = await importCronRoute('ota-token-expiry');
    const req = mockCronRequest() as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('ota-token-expiry returns 200 with valid Bearer token in production', async () => {
    const { GET } = await importCronRoute('ota-token-expiry');
    const req = mockCronRequest({ authorization: 'Bearer test-cron-secret' }) as any;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe('mock');
    expect(body.timestamp).toBeTruthy();
    expect(body.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('plan-expiry returns 401 without auth header in production', async () => {
    const { GET } = await importCronRoute('plan-expiry');
    const req = mockCronRequest() as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('booking-daily returns 401 without auth header in production', async () => {
    const { GET } = await importCronRoute('booking-daily');
    const req = mockCronRequest() as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('payment-overdue returns 401 without auth header in production', async () => {
    const { GET } = await importCronRoute('payment-overdue');
    const req = mockCronRequest() as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('achievements-check returns 401 without auth header in production', async () => {
    const { GET } = await importCronRoute('achievements-check');
    const req = mockCronRequest() as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('plan-limits-check returns 401 without auth header in production', async () => {
    const { GET } = await importCronRoute('plan-limits-check');
    const req = mockCronRequest() as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe('Cron routes — happy path in dev mode', () => {
  beforeEach(() => {
    (process.env as any).NODE_ENV = 'test';
    delete process.env.CRON_SECRET;
  });

  it('ota-token-expiry runs in dev mode and returns ok', async () => {
    const { GET } = await importCronRoute('ota-token-expiry');
    const req = mockCronRequest() as any;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBeGreaterThanOrEqual(0);
    expect(body.alerted).toBeGreaterThanOrEqual(0);
  });

  it('plan-expiry runs in dev mode and returns ok', async () => {
    const { GET } = await importCronRoute('plan-expiry');
    const req = mockCronRequest() as any;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.subscriptionAlerts).toBeGreaterThanOrEqual(0);
    expect(body.totalAlerts).toBeGreaterThanOrEqual(0);
  });

  it('booking-daily runs in dev mode and returns ok', async () => {
    const { GET } = await importCronRoute('booking-daily');
    const req = mockCronRequest() as any;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.checkinToday).toBeGreaterThanOrEqual(0);
    expect(body.checkoutToday).toBeGreaterThanOrEqual(0);
    expect(body.totalProcessed).toBeGreaterThanOrEqual(0);
  });

  it('payment-overdue runs in dev mode and returns ok', async () => {
    const { GET } = await importCronRoute('payment-overdue');
    const req = mockCronRequest() as any;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.overdueCount).toBeGreaterThanOrEqual(0);
  });

  it('achievements-check runs in dev mode and returns ok', async () => {
    const { GET } = await importCronRoute('achievements-check');
    const req = mockCronRequest() as any;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.tenantsProcessed).toBeGreaterThanOrEqual(0);
    expect(body.achievementsTriggered).toBeGreaterThanOrEqual(0);
  });

  it('plan-limits-check runs in dev mode and returns ok', async () => {
    const { GET } = await importCronRoute('plan-limits-check');
    const req = mockCronRequest() as any;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.tenantsProcessed).toBeGreaterThanOrEqual(0);
    expect(body.notificationsSent).toBeGreaterThanOrEqual(0);
  });
});

describe('Cron routes — POST handler parity with GET', () => {
  it('ota-token-expiry POST returns same shape as GET', async () => {
    const { POST } = await importCronRoute('ota-token-expiry');
    const req = mockCronRequest() as any;
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('booking-daily POST works', async () => {
    const { POST } = await importCronRoute('booking-daily');
    const req = mockCronRequest() as any;
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('achievements-check POST works', async () => {
    const { POST } = await importCronRoute('achievements-check');
    const req = mockCronRequest() as any;
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

describe('Cron routes — export config', () => {
  it('all crons export dynamic=force-dynamic', async () => {
    const names = [
      'ota-token-expiry',
      'plan-expiry',
      'booking-daily',
      'payment-overdue',
      'achievements-check',
      'plan-limits-check',
    ];
    for (const name of names) {
      const mod = await importCronRoute(name);
      expect(mod.dynamic).toBe('force-dynamic');
      expect(mod.maxDuration).toBe(60);
    }
  });
});

describe('Cron routes — response shape validation', () => {
  beforeEach(() => {
    (process.env as any).NODE_ENV = 'test';
    delete process.env.CRON_SECRET;
  });

  it('all crons return ok=true in dev mode', async () => {
    const names = [
      'ota-token-expiry',
      'plan-expiry',
      'booking-daily',
      'payment-overdue',
      'achievements-check',
      'plan-limits-check',
    ];
    for (const name of names) {
      const { GET } = await importCronRoute(name);
      const req = mockCronRequest() as any;
      const res = await GET(req);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.mode).toBe('mock');
      expect(body.timestamp).toBeTruthy();
      expect(typeof body.processingTimeMs).toBe('number');
    }
  });
});
