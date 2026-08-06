// ============================================================================
// Test: Universal Adapter Layer — adapter swap and contract compliance
// ----------------------------------------------------------------------------
// Verifies that:
//   1. The Adapter Registry picks Mock by default.
//   2. The Registry picks Real when env var is set.
//   3. Mock adapters report `isDigitalTwin() === true`.
//   4. Mock adapters produce statistically plausible metrics.
//   5. The GoogleAdsMock generates consistent historical data.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getAdapters,
  __resetAdaptersForTest,
  resolveModeMap,
} from '@/adapters';
import { googleAdsMock, metaAdsMock } from '@/adapters/mock';

describe('Adapter Registry', () => {
  afterEach(() => {
    // Reset env vars between tests.
    delete process.env.ZELLA_OPERATING_MODE;
    delete process.env.ZELLA_ADAPTER_GOOGLE_ADS;
    delete process.env.ZELLA_ADAPTER_META_ADS;
    delete process.env.ZELLA_ADAPTER_PAYMENT;
    delete process.env.ZELLA_ADAPTER_CRM;
    delete process.env.ZELLA_ADAPTER_WHATSAPP;
    delete process.env.ZELLA_ADAPTER_ANALYTICS;
    delete process.env.ZELLA_ADAPTER_EMAIL;
    delete process.env.ZELLA_ADAPTER_MAPS;
    __resetAdaptersForTest();
  });

  it('defaults to digital-twin for every adapter', () => {
    const modeMap = resolveModeMap();
    expect(modeMap.googleAds).toBe('digital-twin');
    expect(modeMap.metaAds).toBe('digital-twin');
    expect(modeMap.payment).toBe('digital-twin');
    expect(modeMap.crm).toBe('digital-twin');
    expect(modeMap.whatsapp).toBe('digital-twin');
    expect(modeMap.analytics).toBe('digital-twin');
    expect(modeMap.email).toBe('digital-twin');
    expect(modeMap.maps).toBe('digital-twin');
  });

  it('respects per-adapter env overrides', () => {
    process.env.ZELLA_ADAPTER_PAYMENT = 'real';
    const modeMap = resolveModeMap();
    expect(modeMap.payment).toBe('real');
    expect(modeMap.googleAds).toBe('digital-twin'); // unchanged
  });

  it('global production mode flips all adapters', () => {
    process.env.ZELLA_OPERATING_MODE = 'production';
    const modeMap = resolveModeMap();
    expect(modeMap.googleAds).toBe('real');
    expect(modeMap.payment).toBe('real');
  });

  it('builds a bundle with all 8 adapters', () => {
    const bundle = getAdapters();
    expect(bundle.googleAds).toBeDefined();
    expect(bundle.metaAds).toBeDefined();
    expect(bundle.payment).toBeDefined();
    expect(bundle.crm).toBeDefined();
    expect(bundle.whatsapp).toBeDefined();
    expect(bundle.analytics).toBeDefined();
    expect(bundle.email).toBeDefined();
    expect(bundle.maps).toBeDefined();
  });
});

describe('GoogleAdsMock', () => {
  beforeEach(() => {
    __resetAdaptersForTest();
  });

  it('reports isDigitalTwin=true', () => {
    expect(googleAdsMock.isDigitalTwin()).toBe(true);
  });

  it('creates a campaign and returns a campaignId', async () => {
    const out = await googleAdsMock.createCampaign({
      name: 'Test Campaign',
      budgetDailyBRL: 50,
      adGroupKey: 'pousada-test',
      keywords: ['pousada praia grande'],
      matchType: 'phrase',
      geoTargets: ['BR'],
      landingUrl: 'https://example.com',
    });
    expect(out.campaignId).toMatch(/^gads_/);
    expect(out.status).toBe('active');
    expect(out.budgetDailyBRL).toBe(50);
  });

  it('fetches metrics with plausible ranges', async () => {
    const out = await googleAdsMock.createCampaign({
      name: 'Test',
      budgetDailyBRL: 100,
      adGroupKey: 'test',
      keywords: ['test keyword'],
      matchType: 'phrase',
      geoTargets: ['BR'],
      landingUrl: 'https://example.com',
    });
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();
    const metrics = await googleAdsMock.fetchMetrics({ campaignId: out.campaignId, from, to });
    expect(metrics.length).toBeGreaterThan(0);
    for (const m of metrics) {
      expect(m.impressions).toBeGreaterThan(0);
      expect(m.ctr).toBeGreaterThan(0);
      expect(m.ctr).toBeLessThan(0.5); // CTR should be < 50%
      expect(m.cpcBRL).toBeGreaterThan(0);
      expect(m.cpcBRL).toBeLessThan(10); // CPC should be < R$ 10
      expect(m.spendBRL).toBeGreaterThan(0);
      expect(m.spendBRL).toBeLessThanOrEqual(100); // bounded by daily budget
    }
  });

  it('returns consistent metrics for the same campaign + day', async () => {
    const out = await googleAdsMock.createCampaign({
      name: 'Reproducibility Test',
      budgetDailyBRL: 50,
      adGroupKey: 'repro',
      keywords: ['repro'],
      matchType: 'phrase',
      geoTargets: ['BR'],
      landingUrl: 'https://example.com',
    });
    const from = '2025-01-01';
    const to = '2025-01-01';
    const m1 = await googleAdsMock.fetchMetrics({ campaignId: out.campaignId, from, to });
    const m2 = await googleAdsMock.fetchMetrics({ campaignId: out.campaignId, from, to });
    expect(m1[0].impressions).toBe(m2[0].impressions);
    expect(m1[0].clicks).toBe(m2[0].clicks);
    expect(m1[0].ctr).toBe(m2[0].ctr);
  });
});

describe('MetaAdsMock', () => {
  beforeEach(() => {
    __resetAdaptersForTest();
  });

  it('reports isDigitalTwin=true', () => {
    expect(metaAdsMock.isDigitalTwin()).toBe(true);
  });

  it('generates reach <= impressions', async () => {
    const out = await metaAdsMock.createCampaign({
      name: 'Meta Test',
      budgetDailyBRL: 100,
      audienceKey: 'lookalike-1',
      placement: 'instagram_feed',
      creative: { headline: 'Test', body: 'Test body' },
      geoTargets: ['BR'],
      landingUrl: 'https://example.com',
    });
    const from = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();
    const metrics = await metaAdsMock.fetchMetrics({ campaignId: out.campaignId, from, to });
    for (const m of metrics) {
      expect(m.reach).toBeLessThanOrEqual(m.impressions);
    }
  });
});
