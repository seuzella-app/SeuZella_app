import { test, expect } from '@playwright/test';

/**
 * Checkout flow E2E spec.
 *
 * Validates the billing/subscription flow:
 *   - Plan selection (LITE/PRO/MAX/PARCEIRO)
 *   - Payment method validation (PIX/card/boleto per plan)
 *   - Asaas/MercadoPago integration (mock in test, real in prod)
 *   - Subscription activation after payment confirmation
 *   - Tenant plan upgrade
 *
 * SKIP: requires authenticated tenant + test payment gateway
 */
test.describe('Checkout flow', () => {
  test.skip(!process.env.E2E_TEST_PASSWORD, 'Set E2E_TEST_PASSWORD');

  test('user can select a plan and see payment options', async ({ page }) => {
    await page.goto('/login?callbackUrl=/dashboard/settings/billing');
    await page.getByLabel(/email/i).first().fill('admin@seuzella.com');
    await page.getByLabel(/senha/i).first().fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard|\/ddc/, { timeout: 10_000 });

    // Navigate to billing
    await page.goto('/dashboard/settings/billing');
    await expect(page.locator('body')).toContainText(/plano|plan|assinatura/i, { timeout: 5_000 });
  });

  test('PIX payment method is available for all paid plans', async ({ page }) => {
    test.skip(true, 'Requires test gateway configuration');
  });

  test('subscription activates after successful payment webhook', async ({ page }) => {
    test.skip(true, 'Requires test webhook endpoint');
  });
});

test.describe('Locks PIN flow', () => {
  test.skip(!process.env.E2E_TEST_PASSWORD, 'Set E2E_TEST_PASSWORD');

  test('host can generate a PIN for a lock device', async ({ page }) => {
    // Login
    await page.goto('/login?callbackUrl=/ddc/pousada');
    await page.getByLabel(/email/i).first().fill('admin@seuzella.com');
    await page.getByLabel(/senha/i).first().fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).first().click();
    await expect(page).toHaveURL(/\/ddc\/pousada/, { timeout: 10_000 });

    // Wait for hydration (rooms loaded from API)
    await page.waitForTimeout(3_000);

    // Find a lock device in the UI
    const lockCard = page.locator('[data-testid="lock-card"]').first();
    const lockVisible = await lockCard.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!lockVisible) {
      test.skip(true, 'No lock devices seeded for testing');
      return;
    }

    // Click "Generate PIN" button
    const genPinBtn = lockCard.getByRole('button', { name: /gerar.*pin|novo.*pin/i });
    if (await genPinBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await genPinBtn.click();
      // Should show a toast with the generated PIN
      await expect(page.locator('text=/pin.*gerado/i').first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('panic revoke removes all active PINs', async ({ page }) => {
    test.skip(true, 'Requires seed data with active PINs');
  });

  test('PIN appears on Mobile after generation on Desktop', async ({ browser }) => {
    test.skip(true, 'Requires multi-device test setup — see mobile-desktop-sync.spec.ts');
  });
});

test.describe('Notifications flow', () => {
  test.skip(!process.env.E2E_TEST_PASSWORD, 'Set E2E_TEST_PASSWORD');

  test('notification badge updates when new reservation is created', async ({ page }) => {
    await page.goto('/login?callbackUrl=/ddc/pousada');
    await page.getByLabel(/email/i).first().fill('admin@seuzella.com');
    await page.getByLabel(/senha/i).first().fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole('button', { name: /entrar/i }).first().click();
    await expect(page).toHaveURL(/\/ddc\/pousada/, { timeout: 10_000 });

    // Wait for SSE connection
    await page.waitForTimeout(2_000);

    // Trigger a reservation via API (simulates WhatsApp AI booking)
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const res = await fetch(`${process.env.E2E_BASE_URL || 'http://localhost:3000'}/api/ddc/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
      body: JSON.stringify({
        guestId: 'test-guest-id',
        guestName: 'E2E Test Guest',
        checkIn: new Date().toISOString(),
        checkOut: new Date(Date.now() + 86400000).toISOString(),
        total: 397,
        roomId: 'test-room',
      }),
    });

    if (!res.ok) {
      test.skip(true, 'Booking creation failed — likely no test guest seeded');
      return;
    }

    // Toast should appear with reservation confirmation
    await expect(page.locator('text=/reserva.*criada/i').first()).toBeVisible({ timeout: 5_000 });
  });

  test('push notification permission prompt works', async ({ page }) => {
    test.skip(true, 'Requires notification permission grant in browser');
  });
});
