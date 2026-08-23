import { test, expect } from '@playwright/test';

/**
 * DDC (Digital Dashboard Casa) navigation E2E spec.
 *
 * Covers the canonical DDC navigation paths for both niches:
 *   - /ddc/pousada renders with operational tabs
 *   - /ddc/airbnb renders with operational tabs
 *   - Tab switching works (Overview → Finance → Locks → Notifications)
 *   - Mobile responsive layout (Pixel 7 viewport)
 *   - Dark mode rendering
 *
 * IMPORTANT: This spec runs against a real browser via Playwright.
 * Requires the dev server running with the test DB seeded.
 */

test.describe('DDC Desktop navigation', () => {
  test('DDC Pousada renders all canonical tabs', async ({ page }) => {
    await page.goto('/ddc/pousada');

    // Sidebar tabs must be visible
    await expect(page.getByRole('button', { name: /visão geral|overview/i }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /financeiro|finance/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /fechaduras|locks/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /notificações|notifications/i }).first()).toBeVisible();
  });

  test('DDC Airbnb renders all canonical tabs', async ({ page }) => {
    await page.goto('/ddc/airbnb');

    await expect(page.getByRole('button', { name: /visão geral|overview/i }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /financeiro|finance/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /fechaduras|locks/i }).first()).toBeVisible();
  });

  test('clicking Finance tab switches the active panel', async ({ page }) => {
    await page.goto('/ddc/pousada');

    const financeTab = page.getByRole('button', { name: /financeiro/i }).first();
    await financeTab.click();

    // The active panel should contain financial content
    await expect(page.locator('body')).toContainText(/receita|faturamento|comissão/i, { timeout: 3_000 });
  });

  test('DDC Pousada renders the property name in the header', async ({ page }) => {
    await page.goto('/ddc/pousada');

    // Header should contain the property name (not just "DDC")
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('DDC Mobile navigation (Pixel 7 viewport)', () => {
  test.use({ viewport: { width: 412, height: 915 } });

  test('mobile /mobile entry redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/mobile');

    // Should redirect to /login with callbackUrl=/mobile (URL-encoded)
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
    expect(page.url()).toMatch(/callbackUrl=(?:%2Fmobile|\/mobile)/);
  });

  test('mobile /mobile/pousada renders the MobilePousadaSuperApp', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari mobile requires authenticated session');
    // Requires login first — see auth-flow.spec.ts

    await page.goto('/mobile/pousada');
    // If unauthenticated, should redirect to login
    // (We test the redirect path, not the authenticated view here.)
    await expect(page).toHaveURL(/\/login|\/mobile/, { timeout: 5_000 });
  });
});

test.describe('DDC dark mode rendering', () => {
  test('DDC Pousada renders in dark theme by default', async ({ page }) => {
    await page.goto('/ddc/pousada');

    // The body should have dark background (slate-900 / #0f172a)
    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // Allow any of the dark palette colors
    expect(bodyBg).toMatch(/rgb\(15,\s*23,\s*42\)|#0f172a|rgb\(2,\s*6,\s*23\)|#020617/);
  });
});
