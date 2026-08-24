import { describe, expect, it } from 'vitest';

function healthScore(input: { usage: number; paymentSuccess: number; supportIncidents: number; automationCoverage: number }) {
  return Math.max(0, Math.min(100,
    input.usage * 0.25 +
    input.paymentSuccess * 0.30 +
    (100 - Math.min(input.supportIncidents * 10, 100)) * 0.15 +
    input.automationCoverage * 0.30,
  ));
}

describe('M6 customer health', () => {
  it('scores a healthy active tenant above the target threshold', () => {
    expect(healthScore({ usage: 90, paymentSuccess: 99, supportIncidents: 1, automationCoverage: 85 })).toBeGreaterThanOrEqual(80);
  });

  it('keeps the score bounded', () => {
    expect(healthScore({ usage: 0, paymentSuccess: 0, supportIncidents: 50, automationCoverage: 0 })).toBe(0);
  });
});
