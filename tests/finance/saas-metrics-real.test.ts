/**
 * Behavioral tests for saas-metrics.ts (REAL PostgreSQL queries).
 *
 * These tests validate that:
 *   1. calcularSaasMetrics returns REAL data from DB (not hardcoded)
 *   2. calcularDre computes correct DRE structure
 *   3. Multi-tenant isolation works (tenant A cannot see tenant B data)
 *   4. Empty tenant returns zeros (not stale mock numbers)
 *   5. No hardcoded constants remain in the source
 *
 * Strategy: mock the `db` module to return controlled fixtures, then
 * verify the functions compute correctly from those fixtures.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mock the db module BEFORE importing saas-metrics
// We use a controlled mock so tests are deterministic and don't need a real DB.
vi.mock('@/lib/db', () => {
  const mockDb = {
    tenant: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    subscription: {
      findMany: vi.fn(),
    },
    upsellRecord: {
      aggregate: vi.fn(),
    },
    metaCostLog: {
      aggregate: vi.fn(),
    },
  };
  const mockIsDatabaseAvailable = vi.fn().mockResolvedValue(true);
  return { db: mockDb, isDatabaseAvailable: mockIsDatabaseAvailable };
});

import { calcularSaasMetrics, calcularDre } from '@/lib/finance/saas-metrics';
import { db, isDatabaseAvailable } from '@/lib/db';

const mockDb = db as any;
const mockIsDbAvailable = isDatabaseAvailable as any;

describe('saas-metrics — NO hardcoded values remain', () => {
  it('does NOT contain the old hardcoded constants', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/finance/saas-metrics.ts'),
      'utf8',
    );
    // The old version had these hardcoded values — they MUST be gone.
    expect(source).not.toContain('activeTenants = 134');
    expect(source).not.toContain('marketingSpend = 8500');
    expect(source).not.toContain('upsellRevenueMonth = 12500');
    expect(source).not.toContain('newTenantsThisMonth = 18');
    expect(source).not.toContain('churnedTenantsThisMonth = 4');
    expect(source).not.toContain('planDistribution = {');
    expect(source).not.toContain('LITE: 60');
    expect(source).not.toContain('PRO: 45');
    expect(source).not.toContain('expansion = 3200');
    expect(source).not.toContain('contraction = 800');
  });

  it('uses REAL db queries (tenant.count, subscription.findMany, etc.)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/finance/saas-metrics.ts'),
      'utf8',
    );
    expect(source).toContain('db.tenant.count(');
    expect(source).toContain('db.tenant.groupBy(');
    expect(source).toContain('db.subscription.findMany(');
    expect(source).toContain('db.upsellRecord.aggregate(');
    expect(source).toContain('db.metaCostLog.aggregate(');
  });

  it('accepts optional tenantId for multi-tenant isolation', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/finance/saas-metrics.ts'),
      'utf8',
    );
    expect(source).toContain('tenantId?: string');
    expect(source).toContain('...(tenantId ? { tenantId } : {})');
  });

  it('returns emptyMetrics() when DB is unavailable (NOT fake numbers)', async () => {
    mockIsDbAvailable.mockResolvedValueOnce(false);
    const result = await calcularSaasMetrics(8, 2026);
    expect(result.activeTenants).toBe(0);
    expect(result.mrr).toBe(0);
    expect(result.cac).toBe(0);
    expect(result.upsellRevenueMonth).toBe(0);
  });
});

describe('saas-metrics — computes from REAL DB queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDbAvailable.mockResolvedValue(true);
  });

  it('returns activeTenants from db.tenant.count', async () => {
    mockDb.tenant.count
      .mockResolvedValueOnce(42)  // active
      .mockResolvedValueOnce(5)  // new this month
      .mockResolvedValueOnce(2)  // churned
      .mockResolvedValueOnce(40) // prev active (for trend)
      .mockResolvedValueOnce(4); // prev new (for trend)
    mockDb.tenant.groupBy.mockResolvedValueOnce([
      { plan: 'lite', _count: { plan: 20 } },
      { plan: 'pro', _count: { plan: 15 } },
      { plan: 'max', _count: { plan: 7 } },
    ]);
    mockDb.subscription.findMany.mockResolvedValueOnce([
      { amount: 197 },
      { amount: 397 },
    ]);
    mockDb.metaCostLog.aggregate
      .mockResolvedValueOnce({ _sum: { costUsd: 100 } })  // current month
      .mockResolvedValueOnce({ _sum: { costUsd: 80 } });  // prev month
    mockDb.upsellRecord.aggregate.mockResolvedValueOnce({
      _sum: { totalPrice: 5000, comissionAmount: 350 },
    });

    const result = await calcularSaasMetrics(8, 2026);

    expect(result.activeTenants).toBe(42);
    expect(result.newTenantsThisMonth).toBe(5);
    expect(result.churnedTenantsThisMonth).toBe(2);
    // MRR = max(subscription amounts, plan prices × count)
    // Subs: 197 + 397 = 594
    // Plans: 20×197 + 15×397 + 7×797 = 3940 + 5955 + 5579 = 15474
    // effectiveMrr = max(594, 15474) = 15474
    expect(result.mrr).toBe(15474);
    expect(result.arr).toBe(15474 * 12);
    // CAC = marketingSpendBrl / newTenants = (100 × 5.0) / 5 = 100
    expect(result.cac).toBe(100);
    // ARPU = mrr / activeTenants = 15474 / 42 = 368.43
    expect(result.arpu).toBeCloseTo(368.43, 1);
    // Churn rate = 2/42 × 100 = 4.76%
    expect(result.churnRate).toBeCloseTo(4.76, 1);
    // Upsell
    expect(result.upsellRevenueMonth).toBe(5000);
    expect(result.upsellCommissionMonth).toBe(350);
    expect(result.totalRevenueWithUpsell).toBe(15474 + 350);
  });

  it('returns zeros for empty tenant (no active tenants, no subscriptions)', async () => {
    mockDb.tenant.count
      .mockResolvedValueOnce(0)  // active
      .mockResolvedValueOnce(0)  // new
      .mockResolvedValueOnce(0)  // churned
      .mockResolvedValueOnce(0)  // prev active
      .mockResolvedValueOnce(0); // prev new
    mockDb.tenant.groupBy.mockResolvedValueOnce([]);
    mockDb.subscription.findMany.mockResolvedValueOnce([]);
    mockDb.metaCostLog.aggregate
      .mockResolvedValueOnce({ _sum: { costUsd: null } })
      .mockResolvedValueOnce({ _sum: { costUsd: null } });
    mockDb.upsellRecord.aggregate.mockResolvedValueOnce({
      _sum: { totalPrice: null, comissionAmount: null },
    });

    const result = await calcularSaasMetrics(8, 2026);

    // Empty tenant → zeros, NOT fake numbers like 134
    expect(result.activeTenants).toBe(0);
    expect(result.mrr).toBe(0);
    expect(result.cac).toBe(0);
    expect(result.upsellRevenueMonth).toBe(0);
  });

  it('scopes queries to tenantId when provided (multi-tenant isolation)', async () => {
    mockDb.tenant.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    mockDb.tenant.groupBy.mockResolvedValueOnce([
      { plan: 'pro', _count: { plan: 1 } },
    ]);
    mockDb.subscription.findMany.mockResolvedValueOnce([{ amount: 397 }]);
    mockDb.metaCostLog.aggregate
      .mockResolvedValueOnce({ _sum: { costUsd: 10 } })
      .mockResolvedValueOnce({ _sum: { costUsd: 5 } });
    mockDb.upsellRecord.aggregate.mockResolvedValueOnce({
      _sum: { totalPrice: 1000, comissionAmount: 70 },
    });

    const result = await calcularSaasMetrics(8, 2026, 'tenant_abc');

    // Verify tenantId was passed to ALL queries
    const countCalls = mockDb.tenant.count.mock.calls;
    expect(countCalls[0][0].where.id).toBe('tenant_abc');

    const subCalls = mockDb.subscription.findMany.mock.calls;
    expect(subCalls[0][0].where.tenantId).toBe('tenant_abc');

    const upsellCalls = mockDb.upsellRecord.aggregate.mock.calls;
    expect(upsellCalls[0][0].where.tenantId).toBe('tenant_abc');

    const metaCalls = mockDb.metaCostLog.aggregate.mock.calls;
    expect(metaCalls[0][0].where.tenantId).toBe('tenant_abc');

    // Result should reflect only this tenant's data
    expect(result.activeTenants).toBe(1);
    expect(result.mrr).toBe(397); // from subscription
  });
});

describe('calcularDre — DRE structure with real data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDbAvailable.mockResolvedValue(true);
  });

  it('computes DRE: grossRevenue - fees - taxes - COGS - OPEX = netRevenue', async () => {
    // Setup: 1 active tenant, MRR=397, upsell commission=70
    mockDb.tenant.count
      .mockResolvedValueOnce(1)  // active
      .mockResolvedValueOnce(0)  // new
      .mockResolvedValueOnce(0)  // churned
      .mockResolvedValueOnce(1)  // prev active
      .mockResolvedValueOnce(0); // prev new
    mockDb.tenant.groupBy.mockResolvedValueOnce([
      { plan: 'pro', _count: { plan: 1 } },
    ]);
    mockDb.subscription.findMany.mockResolvedValueOnce([{ amount: 397 }]);
    // MetaCostLog called 2x in calcularSaasMetrics + 1x in calcularDre
    mockDb.metaCostLog.aggregate
      .mockResolvedValueOnce({ _sum: { costUsd: 50 } })  // current month (saas)
      .mockResolvedValueOnce({ _sum: { costUsd: 40 } })  // prev month (saas)
      .mockResolvedValueOnce({ _sum: { costUsd: 50 } }); // DRE COGS
    mockDb.upsellRecord.aggregate.mockResolvedValueOnce({
      _sum: { totalPrice: 1000, comissionAmount: 70 },
    });

    const dre = await calcularDre(8, 2026);

    // grossRevenue = MRR (397) + upsell commission (70) = 467
    expect(dre.grossRevenue).toBe(467);
    // paymentFees = 3% of MRR = 397 × 0.03 = 11.91
    expect(dre.paymentFees).toBeCloseTo(11.91, 1);
    // taxes = 6% of (grossRevenue - paymentFees) = (467 - 11.91) × 0.06 = 27.31
    expect(dre.taxes).toBeCloseTo(27.31, 1);
    // COGS = 50 USD × 5.0 = 250 BRL
    expect(dre.cogs).toBe(250);
    // OPEX = 8230 (fixed)
    expect(dre.opex).toBe(8230);
    // netRevenue = 467 - 11.91 - 27.31 - 250 - 8230 = -8052.22
    expect(dre.netRevenue).toBeCloseTo(-8052.22, 1);
    // netMargin = netRevenue / grossRevenue × 100
    expect(dre.netMargin).toBeCloseTo((dre.netRevenue / 467) * 100, 1);
    // period
    expect(dre.period).toBe('2026-08');
  });

  it('returns zeros when DB unavailable', async () => {
    mockIsDbAvailable.mockResolvedValue(false);
    const dre = await calcularDre(8, 2026);
    expect(dre.grossRevenue).toBe(0);
    expect(dre.netRevenue).toBe(0);
    expect(dre.netMargin).toBe(0);
    expect(dre.period).toBe('2026-08');
  });

  it('scopes DRE to tenantId when provided', async () => {
    mockDb.tenant.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    mockDb.tenant.groupBy.mockResolvedValueOnce([
      { plan: 'lite', _count: { plan: 1 } },
    ]);
    mockDb.subscription.findMany.mockResolvedValueOnce([{ amount: 197 }]);
    mockDb.metaCostLog.aggregate
      .mockResolvedValueOnce({ _sum: { costUsd: 5 } })
      .mockResolvedValueOnce({ _sum: { costUsd: 3 } })
      .mockResolvedValueOnce({ _sum: { costUsd: 5 } });
    mockDb.upsellRecord.aggregate.mockResolvedValueOnce({
      _sum: { totalPrice: 0, comissionAmount: 0 },
    });

    const dre = await calcularDre(8, 2026, 'tenant_xyz');

    // Verify tenantId was passed to DRE's own MetaCostLog query (3rd call)
    const metaCalls = mockDb.metaCostLog.aggregate.mock.calls;
    expect(metaCalls[2][0].where.tenantId).toBe('tenant_xyz');

    expect(dre.grossRevenue).toBe(197); // MRR only, no upsell
  });
});

describe('saas-metrics — multi-tenant isolation (security critical)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDbAvailable.mockResolvedValue(true);
  });

  it('tenant A metrics NEVER include tenant B data', async () => {
    // Setup: tenant_A has 5 active tenants (impossible in reality but
    // the mock returns whatever we tell it — the test verifies the
    // WHERE clause includes tenantId).
    mockDb.tenant.count
      .mockResolvedValueOnce(5)  // active for tenant_A
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);
    mockDb.tenant.groupBy.mockResolvedValueOnce([
      { plan: 'pro', _count: { plan: 5 } },
    ]);
    mockDb.subscription.findMany.mockResolvedValueOnce([
      { amount: 397 }, { amount: 397 }, { amount: 397 }, { amount: 397 }, { amount: 397 },
    ]);
    mockDb.metaCostLog.aggregate
      .mockResolvedValueOnce({ _sum: { costUsd: 20 } })
      .mockResolvedValueOnce({ _sum: { costUsd: 15 } });
    mockDb.upsellRecord.aggregate.mockResolvedValueOnce({
      _sum: { totalPrice: 2000, comissionAmount: 140 },
    });

    const result = await calcularSaasMetrics(8, 2026, 'tenant_A');

    // Every db query MUST include tenantId: 'tenant_A' in the WHERE clause.
    // This is the security contract — tenant A cannot see tenant B's data.
    const allCountCalls = mockDb.tenant.count.mock.calls;
    for (const call of allCountCalls) {
      expect(call[0].where.id).toBe('tenant_A');
    }

    const subCalls = mockDb.subscription.findMany.mock.calls;
    expect(subCalls[0][0].where.tenantId).toBe('tenant_A');

    const upsellCalls = mockDb.upsellRecord.aggregate.mock.calls;
    expect(upsellCalls[0][0].where.tenantId).toBe('tenant_A');

    // Result reflects ONLY tenant_A's data
    expect(result.activeTenants).toBe(5);
    expect(result.mrr).toBe(5 * 397); // 1985
  });

  it('global metrics (no tenantId) do NOT filter by tenantId', async () => {
    mockDb.tenant.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(95)
      .mockResolvedValueOnce(8);
    mockDb.tenant.groupBy.mockResolvedValueOnce([
      { plan: 'lite', _count: { plan: 50 } },
      { plan: 'pro', _count: { plan: 50 } },
    ]);
    mockDb.subscription.findMany.mockResolvedValueOnce([]);
    mockDb.metaCostLog.aggregate
      .mockResolvedValueOnce({ _sum: { costUsd: 500 } })
      .mockResolvedValueOnce({ _sum: { costUsd: 400 } });
    mockDb.upsellRecord.aggregate.mockResolvedValueOnce({
      _sum: { totalPrice: 10000, comissionAmount: 700 },
    });

    const result = await calcularSaasMetrics(8, 2026); // NO tenantId

    // Count calls should NOT have id filter
    const countCalls = mockDb.tenant.count.mock.calls;
    for (const call of countCalls) {
      expect(call[0].where.id).toBeUndefined();
    }

    // Subscription query should NOT have tenantId filter
    const subCalls = mockDb.subscription.findMany.mock.calls;
    expect(subCalls[0][0].where.tenantId).toBeUndefined();

    expect(result.activeTenants).toBe(100);
  });
});
