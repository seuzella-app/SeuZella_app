import { test, expect } from '@playwright/test';

const e2ePassword = process.env.E2E_TEST_PASSWORD;

test.describe('Wave 3 — WhatsApp inbound acceptance', () => {
  test.skip(!e2ePassword, 'E2E_TEST_PASSWORD is required for the real-server suite');

  test('webhook rejects unsigned production payloads', async ({ request }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
    const response = await request.post(`${baseURL}/api/webhook-whatsapp`, {
      data: { object: 'whatsapp_business_account', entry: [] },
    });
    expect([401, 403, 503]).toContain(response.status());
  });
});
