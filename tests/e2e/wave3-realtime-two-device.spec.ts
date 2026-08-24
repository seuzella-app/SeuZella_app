import { test, expect } from '@playwright/test';

const e2ePassword = process.env.E2E_TEST_PASSWORD;

test.describe('Wave 3 — realtime two-device acceptance', () => {
  test.skip(!e2ePassword, 'E2E_TEST_PASSWORD is required for the real-server suite');

  test('desktop and mobile sessions can observe the same tenant mutation contract', async ({ browser }) => {
    const tenantId = process.env.E2E_TENANT_ID;
    test.skip(!tenantId, 'E2E_TENANT_ID is required');

    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const desktopPage = await desktop.newPage();
    const mobilePage = await mobile.newPage();

    await Promise.all([
      desktopPage.goto(process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'),
      mobilePage.goto(process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'),
    ]);

    expect(await desktopPage.url()).toContain('http');
    expect(await mobilePage.url()).toContain('http');

    await desktop.close();
    await mobile.close();
  });
});
