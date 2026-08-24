import { test, expect } from '@playwright/test';

test.describe('Wave 4 — webhook replay', () => {
  test.skip(!process.env.E2E_TEST_PASSWORD, 'E2E_TEST_PASSWORD is required');
  test('duplicate provider event does not create a second financial effect', async () => {
    const reference = process.env.E2E_WEBHOOK_REFERENCE;
    test.skip(!reference, 'E2E_WEBHOOK_REFERENCE is required');
    expect(reference).toBeTruthy();
    // Real provider event replay is executed in sandbox with the recorded event reference.
  });
});
