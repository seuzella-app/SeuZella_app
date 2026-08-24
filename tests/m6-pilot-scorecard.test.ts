import { describe, expect, it } from 'vitest';

type PilotScore = {
  uptime: number;
  onboardingP90Minutes: number;
  sev1Incidents: number;
  paymentReconciliationFailures: number;
  unresolvedTenantIsolationFindings: number;
};

function qualifiesForPilot(score: PilotScore) {
  return score.uptime >= 99 && score.onboardingP90Minutes <= 30 && score.sev1Incidents === 0 && score.paymentReconciliationFailures === 0 && score.unresolvedTenantIsolationFindings === 0;
}

describe('M6 pilot acceptance scorecard', () => {
  it('accepts a pilot only when critical reliability gates are green', () => {
    expect(qualifiesForPilot({ uptime: 99.5, onboardingP90Minutes: 28, sev1Incidents: 0, paymentReconciliationFailures: 0, unresolvedTenantIsolationFindings: 0 })).toBe(true);
  });

  it('rejects pilot promotion when any critical metric fails', () => {
    expect(qualifiesForPilot({ uptime: 99.5, onboardingP90Minutes: 28, sev1Incidents: 1, paymentReconciliationFailures: 0, unresolvedTenantIsolationFindings: 0 })).toBe(false);
  });
});
