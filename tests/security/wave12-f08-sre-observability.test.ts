/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { checkAlertThresholds, type ObservabilityMetrics } from '@/lib/observability/sre-service';

describe('📊 F08: SRE Alerting & Fail-Closed Observability Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getHealthyMetrics = (): ObservabilityMetrics => ({
    timestamp: new Date().toISOString(),
    uptime: { processUptimeSec: 3600, status: 'healthy' },
    dataQuality: { status: 'complete', collectorErrors: [] },
    database: {
      available: true,
      activeTenants: 12,
      totalTransactions: 150,
      totalBookings: 85,
      totalLockDevices: 24,
      queryLatencyMs: 45,
    },
    realtime: { transport: 'redis', activeSubscribers: 10 },
    queue: { bullmqAvailable: true, dlqCount: 0 },
    push: { enabled: true, activeSubscriptions: 50 },
    security: { openFindings: 0, criticalFindings: 0, highFindings: 0 },
    errors: { cerebroAnalysisErrors: 0, webhookFailures: 0, cronFailures: 0 },
    costs: { llmCostUsdThisMonth: 4.5, estimatedMonthlyCost: 9.0 },
    endpoints: { healthStatus: 'ok', readinessPassed: 1, readinessFailed: 0 },
  });

  describe('1. Clean Healthy State Verification', () => {
    it('returns ZERO alerts for a completely healthy production state on Redis', () => {
      const metrics = getHealthyMetrics();
      const alerts = checkAlertThresholds(metrics);
      expect(alerts).toEqual([]);
    });

    it('returns only an INFO alert when realtime transport is in-memory fallback', () => {
      const metrics = getHealthyMetrics();
      metrics.realtime.transport = 'memory';
      const alerts = checkAlertThresholds(metrics);
      expect(alerts.length).toBe(1);
      expect(alerts[0].level).toBe('info');
      expect(alerts[0].metric).toBe('realtime.transport');
    });
  });

  describe('2. Fail-Closed & Partial Data Quality Guards', () => {
    it('triggers CRITICAL alert when data quality is partial and collector errors exist', () => {
      const metrics = getHealthyMetrics();
      metrics.dataQuality = {
        status: 'partial',
        collectorErrors: ['database.core_metrics', 'security.scanner'],
      };

      const alerts = checkAlertThresholds(metrics);
      const criticals = alerts.filter((a) => a.level === 'critical');
      expect(criticals.some((a) => a.metric === 'dataQuality.status')).toBe(true);
      expect(criticals.find((a) => a.metric === 'dataQuality.status')?.message).toContain('database.core_metrics');
    });

    it('triggers CRITICAL alert when database is marked unavailable', () => {
      const metrics = getHealthyMetrics();
      metrics.database.available = false;

      const alerts = checkAlertThresholds(metrics);
      const dbAlert = alerts.find((a) => a.metric === 'database.available');
      expect(dbAlert).toBeDefined();
      expect(dbAlert?.level).toBe('critical');
    });
  });

  describe('3. Threshold Alerting Rules', () => {
    it('triggers CRITICAL alert when open critical security findings exist', () => {
      const metrics = getHealthyMetrics();
      metrics.security.criticalFindings = 2;

      const alerts = checkAlertThresholds(metrics);
      const secAlert = alerts.find((a) => a.metric === 'security.criticalFindings');
      expect(secAlert).toBeDefined();
      expect(secAlert?.level).toBe('critical');
      expect(secAlert?.value).toBe('2');
    });

    it('triggers WARNING alert when high security findings exist', () => {
      const metrics = getHealthyMetrics();
      metrics.security.highFindings = 1;

      const alerts = checkAlertThresholds(metrics);
      const secAlert = alerts.find((a) => a.metric === 'security.highFindings');
      expect(secAlert).toBeDefined();
      expect(secAlert?.level).toBe('warning');
    });

    it('triggers WARNING alerts when webhook failures exceed threshold (> 5)', () => {
      const metrics = getHealthyMetrics();
      metrics.errors.webhookFailures = 7;

      const alerts = checkAlertThresholds(metrics);
      const whAlert = alerts.find((a) => a.metric === 'errors.webhookFailures');
      expect(whAlert).toBeDefined();
      expect(whAlert?.level).toBe('warning');
      expect(whAlert?.value).toBe('7');
    });

    it('triggers WARNING alert when DB query latency exceeds 500ms', () => {
      const metrics = getHealthyMetrics();
      metrics.database.queryLatencyMs = 650;

      const alerts = checkAlertThresholds(metrics);
      const latAlert = alerts.find((a) => a.metric === 'database.queryLatencyMs');
      expect(latAlert).toBeDefined();
      expect(latAlert?.level).toBe('warning');
      expect(latAlert?.value).toBe('650ms');
    });

    it('triggers WARNING alert when monthly LLM budget exceeds $15.00', () => {
      const metrics = getHealthyMetrics();
      metrics.costs.llmCostUsdThisMonth = 18.5;

      const alerts = checkAlertThresholds(metrics);
      const costAlert = alerts.find((a) => a.metric === 'costs.llmCostUsdThisMonth');
      expect(costAlert).toBeDefined();
      expect(costAlert?.level).toBe('warning');
      expect(costAlert?.value).toBe('$18.50');
    });
  });
});
