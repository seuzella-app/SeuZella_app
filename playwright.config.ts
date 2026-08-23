import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration.
 *
 * WHY THIS EXISTS
 * ---------------
 * Before this file existed, the project had `tests/e2e/reservation-flow.spec.ts`
 * (12 cases) but no Playwright config and no `@playwright/test` in
 * package.json — the spec literally couldn't run. `package.json` had
 * `"test:browser": "echo 'No Playwright tests configured yet'"`.
 *
 * This config + the script wiring enables real browser E2E tests.
 *
 * RUNNING
 * -------
 *   npx playwright install           # one-time: install browser binaries
 *   bun run test:e2e                 # runs all e2e specs headless
 *   bun run test:e2e:ui              # runs with Playwright UI mode
 *
 * CI
 * --
 * GitHub Actions matrix runs this config on Ubuntu, macOS, and Windows
 * against Chromium, Firefox, and WebKit (mobile viewport only on Chromium).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      testMatch: /.*mobile.*\.spec\.ts/,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
      testMatch: /.*mobile.*\.spec\.ts/,
    },
  ],

  // Auto-start the dev server if E2E_BASE_URL is not set.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'bun run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
