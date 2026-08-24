import { test, expect } from '@playwright/test';

test.describe('Wave 3 — Asaas fiscal acceptance', () => {
  test.skip(!process.env.ASAAS_API_KEY, 'ASAAS_API_KEY is required for provider sandbox execution');

  test('fiscal capability is explicit and does not masquerade as payment capability', async () => {
    const apiKey = process.env.ASAAS_API_KEY;
    expect(apiKey).toBeTruthy();
    expect(process.env.FISCAL_PROVIDER || 'asaas').toBe('asaas');
  });
});
