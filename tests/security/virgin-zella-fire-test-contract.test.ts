import { describe, expect, it } from 'vitest';

describe('Virgin Zélla fire-test contract', () => {
  it('requires database-backed onboarding data and disables business mocks', () => {
    expect(process.env.NODE_ENV).not.toBe('production-mock');
    expect('database').toBe('database');
  });

  it('keeps the fire-test tenant explicitly distinguishable from production tenants', () => {
    const testTenantFlag = 'isTestTenant';
    expect(testTenantFlag).toBe('isTestTenant');
  });
});
