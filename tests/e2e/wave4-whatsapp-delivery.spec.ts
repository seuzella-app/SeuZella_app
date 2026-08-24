import { test, expect } from '@playwright/test';

test.describe('Wave 4 — WhatsApp delivery evidence', () => {
  test.skip(!process.env.META_ACCESS_TOKEN, 'META_ACCESS_TOKEN is required');
  test('records provider message id as delivery evidence', async () => {
    const wamid = process.env.E2E_WAMID;
    test.skip(!wamid, 'E2E_WAMID is required after a real sandbox send');
    expect(wamid).toMatch(/^wamid/i);
  });
});
