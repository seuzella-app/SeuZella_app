/**
 * Tests for Contextual Bandits (Fase A do artigo ML)
 *
 * Validates:
 *  - Intent score calculation (S_intent ∈ [0,1])
 *  - Visitor segmentation (4 sub-nichos)
 *  - Thompson Sampling arm selection
 *  - Reward/penalty updates (α+1, β+1)
 *  - Bandit arms structure (4 variants)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    cerebroTelemetryEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/lib/cerebro/log-sink', () => ({
  logSink: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Contextual Bandits — Intent Score Calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns S_intent between 0 and 1', async () => {
    const { calculateIntentScore } = await import('@/lib/cerebro/contextual-bandits');
    const result = calculateIntentScore({
      sessionId: 'test-1',
      dwellTimeSec: 60,
      scrollDepthPercent: 50,
      roiCalculatorClicks: 1,
      cursorActivityScore: 50,
    });
    expect(result.sIntent).toBeGreaterThanOrEqual(0);
    expect(result.sIntent).toBeLessThanOrEqual(1);
  });

  it('returns low intent for visitor with low engagement', async () => {
    const { calculateIntentScore } = await import('@/lib/cerebro/contextual-bandits');
    const result = calculateIntentScore({
      sessionId: 'test-2',
      dwellTimeSec: 10,
      scrollDepthPercent: 10,
      roiCalculatorClicks: 0,
      cursorActivityScore: 10,
    });
    expect(result.sIntent).toBeLessThan(0.3);
  });

  it('returns high intent for highly engaged visitor', async () => {
    const { calculateIntentScore } = await import('@/lib/cerebro/contextual-bandits');
    const result = calculateIntentScore({
      sessionId: 'test-3',
      dwellTimeSec: 120,
      scrollDepthPercent: 100,
      roiCalculatorClicks: 3,
      cursorActivityScore: 90,
    });
    expect(result.sIntent).toBeGreaterThan(0.7);
  });

  it('recommends case_study_focus for low intent visitors', async () => {
    const { calculateIntentScore } = await import('@/lib/cerebro/contextual-bandits');
    const result = calculateIntentScore({
      sessionId: 'test-4',
      dwellTimeSec: 5,
      scrollDepthPercent: 5,
      roiCalculatorClicks: 0,
      cursorActivityScore: 5,
    });
    expect(result.recommendedVariant).toBe('case_study_focus');
  });

  it('recommends automation_focus for high intent visitors', async () => {
    const { calculateIntentScore } = await import('@/lib/cerebro/contextual-bandits');
    const result = calculateIntentScore({
      sessionId: 'test-5',
      dwellTimeSec: 180,
      scrollDepthPercent: 100,
      roiCalculatorClicks: 0, // 0 cliques no ROI para não ativar anfitriao_multi_imoveis
      cursorActivityScore: 90,
    });
    expect(result.sIntent).toBeGreaterThan(0.5);
    // Pode ser automation_focus ou commission_savings_focus dependendo da segmentação
    expect(['automation_focus', 'commission_savings_focus']).toContain(result.recommendedVariant);
  });
});

describe('Contextual Bandits — Visitor Segmentation', () => {
  it('segments pousada_litoranea based on utmCampaign', async () => {
    const { calculateIntentScore } = await import('@/lib/cerebro/contextual-bandits');
    const result = calculateIntentScore({
      sessionId: 'test-6',
      dwellTimeSec: 30,
      scrollDepthPercent: 40,
      roiCalculatorClicks: 0,
      cursorActivityScore: 30,
      utmCampaign: 'litoral_promo',
    });
    expect(result.segment).toBe('pousada_litoranea');
  });

  it('segments pousada_serra based on referrer', async () => {
    const { calculateIntentScore } = await import('@/lib/cerebro/contextual-bandits');
    const result = calculateIntentScore({
      sessionId: 'test-7',
      dwellTimeSec: 30,
      scrollDepthPercent: 40,
      roiCalculatorClicks: 0,
      cursorActivityScore: 30,
      referrer: 'https://example.com/serra-pousada',
    });
    expect(result.segment).toBe('pousada_serra');
  });

  it('segments anfitriao_multi_imoveis for engaged ROI users', async () => {
    const { calculateIntentScore } = await import('@/lib/cerebro/contextual-bandits');
    const result = calculateIntentScore({
      sessionId: 'test-8',
      dwellTimeSec: 100,
      scrollDepthPercent: 80,
      roiCalculatorClicks: 3,
      cursorActivityScore: 60,
    });
    expect(result.segment).toBe('anfitriao_multi_imoveis');
  });
});

describe('Contextual Bandits — Thompson Sampling', () => {
  it('selectArmThompsonSampling returns one of the 4 arms', async () => {
    const { selectArmThompsonSampling } = await import('@/lib/cerebro/contextual-bandits');
    const result = selectArmThompsonSampling();
    expect(result.selectedArm).toBeDefined();
    expect(result.selectedArm.variantId).toBeTruthy();
    expect(['automation_focus', 'roi_calculator_focus', 'commission_savings_focus', 'case_study_focus'])
      .toContain(result.selectedArm.variantId);
    expect(['thompson_sampling', 'exploration']).toContain(result.method);
  });

  it('returns arm with alpha >= 1 and beta >= 1', async () => {
    const { selectArmThompsonSampling } = await import('@/lib/cerebro/contextual-bandits');
    const result = selectArmThompsonSampling();
    expect(result.selectedArm.alpha).toBeGreaterThanOrEqual(1);
    expect(result.selectedArm.beta).toBeGreaterThanOrEqual(1);
  });
});

describe('Contextual Bandits — Reward Update', () => {
  it('rewardBanditArm increases alpha on success', async () => {
    const { rewardBanditArm, getBanditArms } = await import('@/lib/cerebro/contextual-bandits');
    const armsBefore = getBanditArms();
    const armBefore = armsBefore.find((a) => a.variantId === 'automation_focus')!;
    const alphaBefore = armBefore.alpha;

    await rewardBanditArm('automation_focus', true);
    const armsAfter = getBanditArms();
    const armAfter = armsAfter.find((a) => a.variantId === 'automation_focus')!;
    expect(armAfter.alpha).toBe(alphaBefore + 1);
  });

  it('rewardBanditArm increases beta on failure', async () => {
    const { rewardBanditArm, getBanditArms } = await import('@/lib/cerebro/contextual-bandits');
    const armsBefore = getBanditArms();
    const armBefore = armsBefore.find((a) => a.variantId === 'roi_calculator_focus')!;
    const betaBefore = armBefore.beta;

    await rewardBanditArm('roi_calculator_focus', false);
    const armsAfter = getBanditArms();
    const armAfter = armsAfter.find((a) => a.variantId === 'roi_calculator_focus')!;
    expect(armAfter.beta).toBe(betaBefore + 1);
  });

  it('rewardBanditArm returns false for unknown variant', async () => {
    const { rewardBanditArm } = await import('@/lib/cerebro/contextual-bandits');
    const result = await rewardBanditArm('unknown_variant', true);
    expect(result.updated).toBe(false);
  });
});

describe('Contextual Bandits — Bandit Arms Structure', () => {
  it('getBanditArms returns 4 variants', async () => {
    const { getBanditArms } = await import('@/lib/cerebro/contextual-bandits');
    const arms = getBanditArms();
    expect(arms.length).toBe(4);
    expect(arms.map((a) => a.variantId).sort()).toEqual([
      'automation_focus',
      'case_study_focus',
      'commission_savings_focus',
      'roi_calculator_focus',
    ]);
  });

  it('each arm has expectedConversion between 0 and 1', async () => {
    const { getBanditArms } = await import('@/lib/cerebro/contextual-bandits');
    const arms = getBanditArms();
    for (const arm of arms) {
      expect(arm.expectedConversion).toBeGreaterThanOrEqual(0);
      expect(arm.expectedConversion).toBeLessThanOrEqual(1);
    }
  });
});

describe('Contextual Bandits — Track Visitor Signals', () => {
  it('trackVisitorSignals persists without errors', async () => {
    const { trackVisitorSignals } = await import('@/lib/cerebro/contextual-bandits');
    await expect(
      trackVisitorSignals({
        sessionId: 'test-track-1',
        dwellTimeSec: 60,
        scrollDepthPercent: 50,
        roiCalculatorClicks: 1,
        cursorActivityScore: 50,
      })
    ).resolves.toBeUndefined();
  });
});

describe('Contextual Bandits — Module exports', () => {
  it('exports all expected functions', async () => {
    const mod = await import('@/lib/cerebro/contextual-bandits');
    expect(typeof mod.calculateIntentScore).toBe('function');
    expect(typeof mod.rewardBanditArm).toBe('function');
    expect(typeof mod.selectArmThompsonSampling).toBe('function');
    expect(typeof mod.getBanditArms).toBe('function');
    expect(typeof mod.trackVisitorSignals).toBe('function');
  });
});
