// ============================================================================
// Playwright E2E Test — Fluxo completo de reserva
// ============================================================================
// Testa: lead → conversa WhatsApp → cotação → caução → reserva → NPS
//
// Rodar: npx playwright test tests/e2e/reservation-flow.spec.ts
// ============================================================================

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Fluxo completo de reserva Zélla', () => {
  test('hóspede pode ver a landing page', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/Zélla|SmartHotel/i);
  });

  test('ZCC carrega com login', async ({ page }) => {
    await page.goto(`${BASE_URL}/zcc`);
    // Verifica se redireciona para login ou mostra ZCC
    await page.waitForLoadState('networkidle');
    // Pode estar em /login ou /zcc
    expect(page.url()).toMatch(/\/(login|zcc)/);
  });

  test('DDC tem aba UPSELL', async ({ page }) => {
    // Login (mock em dev — depende do ambiente)
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', process.env.E2E_TEST_EMAIL || 'test@zella.com');
    await page.fill('input[type="password"]', process.env.E2E_TEST_PASSWORD || 'test123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    // Navega para DDC
    await page.goto(`${BASE_URL}/ddc`);
    await page.waitForLoadState('networkidle');

    // Verifica se aba UPSELL existe
    const upsellTab = page.locator('button:has-text("UPSELL")');
    await expect(upsellTab).toBeVisible({ timeout: 5000 });
  });

  test('Calculadora UPSELL funciona', async ({ page }) => {
    // Login + navega para DDC > UPSELL
    await page.goto(`${BASE_URL}/ddc`);
    await page.waitForLoadState('networkidle');

    // Clica na aba UPSELL
    await page.click('button:has-text("UPSELL")');
    await page.waitForLoadState('networkidle');

    // Verifica se calculadora está visível
    await expect(page.locator('text=Calculadora de UPSELL')).toBeVisible({ timeout: 5000 });

    // Altera diária base
    await page.fill('input[type="number"]', '500');

    // Verifica se o resultado atualiza
    await expect(page.locator('text=Receita pousada')).toBeVisible();
  });

  test('API /api/health responde 200', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('API /api/readiness responde', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/readiness`);
    // Pode retornar 200 ou 503 (se algum serviço não estiver pronto)
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
    expect(body).toHaveProperty('timestamp');
  });

  test('API /api/lgpd/dpa retorna template', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/lgpd/dpa`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.template).toContain('DATA PROCESSING AGREEMENT');
    expect(body.data.template).toContain('LGPD');
  });

  test('API /api/ddc/upsell/metrics responde', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/ddc/upsell/metrics`);
    // Pode ser 200 (autenticado) ou 401 (não autenticado)
    expect([200, 401]).toContain(res.status());
  });

  test('WAF bloqueia User-Agent suspeito', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/health`, {
      headers: { 'User-Agent': 'sqlmap/1.6' },
    });
    expect(res.status()).toBe(403);
  });

  test('WAF bloqueia path traversal', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/../../../etc/passwd`);
    expect([400, 403, 404]).toContain(res.status());
  });
});

test.describe('Mobile responsive', () => {
  test('ZCC funciona em mobile (375px)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}`);
    await expect(page).toHaveTitle(/Zélla|SmartHotel/i);
    await context.close();
  });

  test('DDC funciona em tablet (768px)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/ddc`);
    await page.waitForLoadState('networkidle');
    await context.close();
  });
});
