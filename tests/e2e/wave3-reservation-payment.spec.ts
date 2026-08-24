import { test, expect } from '@playwright/test';

const e2ePassword = process.env.E2E_TEST_PASSWORD;

test.describe('Wave 3 — reservation payment acceptance', () => {
  test.skip(!e2ePassword, 'E2E_TEST_PASSWORD is required for the real-server suite');

  test('reservation payment entrypoint exposes a tenant-safe flow', async ({ request }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
    const reservationId = process.env.E2E_RESERVATION_ID;
    const cookie = process.env.E2E_AUTH_COOKIE;
    test.skip(!reservationId || !cookie, 'E2E_RESERVATION_ID and E2E_AUTH_COOKIE are required');

    const response = await request.post(`${baseURL}/api/v1/reservations/${encodeURIComponent(reservationId!)}/payment`, {
      headers: { Cookie: cookie! },
      data: { gateway: 'asaas', paymentMethod: 'pix' },
    });

    expect([201, 409]).toContain(response.status());
    if (response.status() === 201) {
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    }
  });
});
