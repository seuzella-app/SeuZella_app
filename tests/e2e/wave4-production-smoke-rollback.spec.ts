import { test, expect } from '@playwright/test';

test.describe('Wave 4 — production smoke and rollback', () => {
  test.skip(!process.env.E2E_BASE_URL, 'E2E_BASE_URL is required');

  test('health endpoint is reachable before promotion', async ({ request }) => {
    const response = await request.get(`${process.env.E2E_BASE_URL}/api/health`);
    expect(response.status()).toBe(200);
  });

  test('previous production deployment evidence is recorded', () => {
    expect(process.env.PREVIOUS_PRODUCTION_DEPLOYMENT).toBeTruthy();
  });
});
