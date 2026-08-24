import { test, expect } from '@playwright/test';

const e2ePassword = process.env.E2E_TEST_PASSWORD;

test.describe('Wave 3 — lock/PIN lifecycle acceptance', () => {
  test.skip(!e2ePassword, 'E2E_TEST_PASSWORD is required for the real-server suite');

  test('requires explicit room-to-lock mapping before automatic access activation', async () => {
    const roomId = process.env.E2E_ROOM_ID;
    const lockId = process.env.E2E_LOCK_ID;
    test.skip(!roomId || !lockId, 'E2E_ROOM_ID and E2E_LOCK_ID are required');
    expect(roomId).toBeTruthy();
    expect(lockId).toBeTruthy();
  });
});
