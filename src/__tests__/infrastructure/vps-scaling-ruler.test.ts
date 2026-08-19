import { describe, it, expect } from 'vitest';
import { evaluateVpsScaling, HOSTINGER_VPS_TIERS } from '@/lib/infrastructure/vps-scaling-ruler';

describe('VPS Scaling Ruler (Hostinger Infrastructure Advisor)', () => {
  it('should evaluate KVM_4 as OPTIMAL with 18 pousadas', () => {
    const evalResult = evaluateVpsScaling(18, 'KVM_4');
    expect(evalResult.status).toBe('OPTIMAL');
    expect(evalResult.currentEstimatedLatencyMs).toBeLessThanOrEqual(50);
    expect(evalResult.recommendation.action).toBe('MAINTAIN');
    expect(evalResult.recommendation.headroomPousadasRemaining).toBeGreaterThan(250);
  });

  it('should evaluate KVM_4 as WARNING when approaching 310 pousadas', () => {
    const evalResult = evaluateVpsScaling(310, 'KVM_4');
    expect(evalResult.status).toBe('WARNING');
    expect(evalResult.recommendation.action).toBe('PREPARE_UPGRADE');
    expect(evalResult.recommendation.suggestedTier.id).toBe('KVM_8');
  });

  it('should trigger CRITICAL and MIGRATE_NOW when exceeding 360 pousadas on KVM_4', () => {
    const evalResult = evaluateVpsScaling(360, 'KVM_4');
    expect(evalResult.status).toBe('CRITICAL');
    expect(evalResult.recommendation.action).toBe('MIGRATE_NOW');
    expect(evalResult.recommendation.suggestedTier.id).toBe('KVM_8');
    expect(evalResult.currentEstimatedLatencyMs).toBeGreaterThan(150);
  });

  it('should generate a 10-point latency ruler projection curve', () => {
    const evalResult = evaluateVpsScaling(100, 'KVM_4');
    expect(evalResult.latencyRulerCurve.length).toBe(10);
    expect(evalResult.latencyRulerCurve[0].pousadas).toBe(10);
    expect(evalResult.latencyRulerCurve[evalResult.latencyRulerCurve.length - 1].pousadas).toBe(500);
  });
});
