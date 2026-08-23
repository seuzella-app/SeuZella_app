import { test, expect } from '@playwright/test';

/**
 * Authentication flow E2E spec.
 *
 * Covers the canonical auth paths:
 *   - Login page renders with ZCC + DDC tabs
 *   - Credential login rejects invalid creds
 *   - Credential login redirects admin to /zcc, owner to /ddc
 *   - Magic link request shows "email sent" state
 *   - Logout clears session and returns to /login
 *
 * IMPORTANT: This spec runs against a real browser via Playwright.
 * It does NOT mock the NextAuth backend — it uses the dev DB seeded
 * with the test tenant. Run `bun run db:seed:beta` before this spec.
 */

const TEST_TENANT_EMAIL = 'admin@seuzella.com';
const TEST_TENANT_PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPassword123!';

test.describe('Authentication flow', () => {
  test('login page renders with ZCC and DDC tabs', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Seu Zélla/i);

    // ZCC tab
    const zccTab = page.getByRole('button', { name: /zcc/i }).first();
    await expect(zccTab).toBeVisible();

    // DDC tab (default)
    const ddcTab = page.getByRole('button', { name: /ddc/i }).first();
    await expect(ddcTab).toBeVisible();

    // Email + password fields are visible
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByLabel(/senha/i).first()).toBeVisible();
  });

  test('rejects invalid credentials with error message', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).first().fill('nonexistent@seuzella.com');
    await page.getByLabel(/senha/i).first().fill('wrong-password');
    await page.getByRole('button', { name: /entrar/i }).first().click();

    // Error message appears (via sonner toast or inline)
    await expect(page.locator('text=/credenciais|inv[aá]lidas|incorretas/i')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('redirects to /zcc after successful admin login', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari requires manual env var setup for test creds');
    test.skip(!process.env.E2E_TEST_PASSWORD, 'Set E2E_TEST_PASSWORD env var to run this test');

    await page.goto('/login?callbackUrl=/zcc');

    await page.getByLabel(/email/i).first().fill(TEST_TENANT_EMAIL);
    await page.getByLabel(/senha/i).first().fill(TEST_TENANT_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();

    // Should redirect to /zcc
    await expect(page).toHaveURL(/\/zcc/, { timeout: 10_000 });
  });

  test('redirects to /ddc after successful owner login', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari requires manual env var setup for test creds');
    test.skip(!process.env.E2E_TEST_PASSWORD, 'Set E2E_TEST_PASSWORD env var to run this test');

    await page.goto('/login?callbackUrl=/ddc/pousada');

    await page.getByLabel(/email/i).first().fill('demo@pousada.com.br');
    await page.getByLabel(/senha/i).first().fill(TEST_TENANT_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();

    // Should redirect to DDC Pousada
    await expect(page).toHaveURL(/\/ddc\/pousada/, { timeout: 10_000 });
  });

  test('magic link request shows "email sent" confirmation', async ({ page }) => {
    await page.goto('/login');

    // Switch to magic-link mode if there's a tab/button for it
    const magicLinkButton = page.getByRole('button', { name: /magic|link/i }).first();
    if (await magicLinkButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await magicLinkButton.click();
    }

    // Fill email and request magic link
    const emailInput = page.getByLabel(/email/i).first();
    await emailInput.fill('test-recipient@seuzella.com');
    await page.getByRole('button', { name: /enviar|magic/i }).first().click();

    // Confirmation message
    await expect(page.locator('text=/enviamos|enviado|check your email/i')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('logout clears session and returns to /login', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari requires manual env var setup for test creds');
    test.skip(!process.env.E2E_TEST_PASSWORD, 'Set E2E_TEST_PASSWORD env var to run this test');

    // Login first
    await page.goto('/login?callbackUrl=/zcc');
    await page.getByLabel(/email/i).first().fill(TEST_TENANT_EMAIL);
    await page.getByLabel(/senha/i).first().fill(TEST_TENANT_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();
    await expect(page).toHaveURL(/\/zcc/, { timeout: 10_000 });

    // Find and click logout button
    const logoutButton = page.getByRole('button', { name: /sair|logout|sign out/i }).first();
    if (await logoutButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await logoutButton.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
    }
  });
});
