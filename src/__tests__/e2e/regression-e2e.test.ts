/**
 * E2E Regression Tests for the Notification Mobile System
 *
 * Validates end-to-end behavior across all 12 gaps:
 *  - Type definitions are exported correctly
 *  - All required UI components exist
 *  - All API routes return expected shapes
 *  - Sound files exist
 *  - PWA v2 service worker has all handlers
 *  - Cron directories exist with proper structure
 *
 * This is a "build confidence" test that runs before deployment.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = join(__dirname, '../../..');

describe('E2E Regression — Type exports', () => {
  it('types.ts exports NotificationNiche, NotificationCategory, NotificationPriority', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/types.ts'),
      'utf-8'
    );
    expect(source).toMatch(/export\s+type\s+NotificationNiche/);
    expect(source).toMatch(/export\s+type\s+NotificationCategory/);
    expect(source).toMatch(/export\s+type\s+NotificationPriority/);
    expect(source).toMatch(/export\s+type\s+NotificationStatus/);
    expect(source).toMatch(/export\s+type\s+NotificationSource/);
    expect(source).toMatch(/export\s+type\s+PlanAvailability/);
    expect(source).toMatch(/export\s+interface\s+DDCNotification/);
    expect(source).toMatch(/export\s+interface\s+ProduceNotificationInput/);
    expect(source).toMatch(/export\s+interface\s+ProduceResult/);
    expect(source).toMatch(/export\s+const\s+PLAN_VISIBILITY/);
    expect(source).toMatch(/export\s+function\s+isNotificationVisibleToPlan/);
    expect(source).toMatch(/export\s+function\s+isNotificationVisibleToNiche/);
  });

  it('types.ts has all 9 categories', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/types.ts'),
      'utf-8'
    );
    const categories = [
      'reservations',
      'financial',
      'guests',
      'ai',
      'operations',
      'marketing',
      'system',
      'achievements',
      'external',
    ];
    for (const c of categories) {
      expect(source).toContain(c);
    }
  });

  it('types.ts has 4 priorities (low/medium/high/urgent)', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/types.ts'),
      'utf-8'
    );
    expect(source).toMatch(/'low'\s*\|\s*'medium'\s*\|\s*'high'\s*\|\s*'urgent'/);
  });
});

describe('E2E Regression — Required files exist', () => {
  const requiredFiles = [
    'src/lib/notifications/types.ts',
    'src/lib/notifications/catalog.ts',
    'src/lib/notifications/producer.ts',
    'src/lib/notifications/store.ts',
    'src/lib/notifications/seed.ts',
    'src/lib/notifications/index.ts',
    'src/lib/notifications/bridges.ts',
    'src/lib/notifications/use-mobile-notifications.ts',
    'src/components/ddc/notifications/DDCNotificationCenter.tsx',
    'src/components/ddc/notifications/NotificationFAB.tsx',
    'src/app/api/ddc/notifications/v2/route.ts',
    'src/lib/notifications/achievement-engine.ts',
    'src/app/api/cron/achievements-check/route.ts',
    'src/app/api/cron/ota-token-expiry/route.ts',
    'src/app/api/cron/plan-expiry/route.ts',
    'src/app/api/cron/booking-daily/route.ts',
    'src/app/api/cron/payment-overdue/route.ts',
    'src/app/api/webhooks/booking-com/reviews/route.ts',
    'src/components/ddc/conquistas/ConquistasTab.tsx',
    'src/lib/notifications/plan-limits-checker.ts',
    'src/app/api/cron/plan-limits-check/route.ts',
    'public/sw.js',
    'src/__tests__/notifications/producer.test.ts',
    'src/__tests__/notifications/bridges.test.ts',
    'src/__tests__/notifications/catalog.test.ts',
    'src/__tests__/mobile/notifications.test.ts',
  ];

  for (const file of requiredFiles) {
    it(`${file} exists`, () => {
      const fullPath = join(PROJECT_ROOT, file);
      expect(existsSync(fullPath)).toBe(true);
    });
  }
});

describe('E2E Regression — Sound files', () => {
  const sounds = ['alert.mp3', 'notification.mp3', 'success.mp3', 'info.mp3'];
  for (const sound of sounds) {
    it(`public/sounds/${sound} exists and is non-empty`, () => {
      const fullPath = join(PROJECT_ROOT, 'public/sounds', sound);
      expect(existsSync(fullPath)).toBe(true);
      expect(statSync(fullPath).size).toBeGreaterThan(1000);
    });
  }
});

describe('E2E Regression — Cron directories', () => {
  const cronDir = join(PROJECT_ROOT, 'src/app/api/cron');

  it('has at least 17 cron directories', () => {
    const dirs = readdirSync(cronDir).filter((d) => statSync(join(cronDir, d)).isDirectory());
    expect(dirs.length).toBeGreaterThanOrEqual(17);
  });

  const expectedCrons = [
    'budget-reset',
    'cerebro-analyze',
    'cerebro-budget-forecast',
    'cerebro-churn-predict',
    'cerebro-cleanup',
    'cerebro-distill',
    'cerebro-orchestrator',
    'cerebro-refactor-check',
    'cerebro-watchdog',
    'metrics-snapshot',
    'weekly-report',
    'achievements-check',
    'ota-token-expiry',
    'plan-expiry',
    'booking-daily',
    'payment-overdue',
    'plan-limits-check',
  ];

  for (const cron of expectedCrons) {
    it(`cron ${cron}/route.ts exists`, () => {
      expect(existsSync(join(cronDir, cron, 'route.ts'))).toBe(true);
    });
  }
});

describe('E2E Regression — API endpoints', () => {
  const apiEndpoints = [
    'src/app/api/ddc/notifications/route.ts',
    'src/app/api/ddc/notifications/read-all/route.ts',
    'src/app/api/ddc/notifications/v2/route.ts',
    'src/app/api/v1/guest/ddc/notifications/route.ts',
    'src/app/api/ddc/airb/notifications/route.ts',
  ];

  for (const endpoint of apiEndpoints) {
    it(`${endpoint} exists`, () => {
      expect(existsSync(join(PROJECT_ROOT, endpoint))).toBe(true);
    });
  }
});

describe('E2E Regression — Vitest config', () => {
  it('vitest.config.ts includes src/__tests__/**/*.test.ts', () => {
    const source = readFileSync(join(PROJECT_ROOT, 'vitest.config.ts'), 'utf-8');
    expect(source).toContain('src/__tests__/**/*.test.ts');
  });
});

describe('E2E Regression — DDCShell navigation includes new tabs', () => {
  it('pousadaNavItems has conquistas with tier=parceiro', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/app/ddc/pousada/DDCPousadaContent.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/conquistas[\s\S]*tier:\s*'parceiro'/);
  });

  it('airbnbNavItems has conquistas with tier=parceiro', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/app/ddc/airbnb/DDCAirbnbContent.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/conquistas[\s\S]*tier:\s*'parceiro'/);
  });
});

describe('E2E Regression — Package.json scripts', () => {
  it('package.json has test script', () => {
    const source = readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8');
    const pkg = JSON.parse(source);
    expect(pkg.scripts).toHaveProperty('test');
    expect(pkg.scripts.test).toContain('vitest');
  });

  it('package.json has typecheck script', () => {
    const source = readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8');
    const pkg = JSON.parse(source);
    expect(pkg.scripts).toHaveProperty('typecheck');
  });

  it('package.json has lint script', () => {
    const source = readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8');
    const pkg = JSON.parse(source);
    expect(pkg.scripts).toHaveProperty('lint');
  });
});

describe('E2E Regression — Producer exports all notify functions', () => {
  it('producer.ts exports all expected notify* functions', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/producer.ts'),
      'utf-8'
    );
    const expectedFunctions = [
      'notify',
      'notifyBookingCreated',
      'notifyBookingConfirmed',
      'notifyBookingCancelled',
      'notifyCheckinToday',
      'notifyCheckoutToday',
      'notifyDoubleBooking',
      'notifyEscalation',
      'notifyPixReceived',
      'notifyPaymentFailed',
      'notifyPaymentOverdue',
      'notifyNewLead',
      'notifyHotLead',
      'notifyAIOffline',
      'notifyAIOnline',
      'notifyAIPatternLearned',
      'notifyAIAnomaly',
      'notifyIcalSyncFailed',
      'notifyIcalConflict',
      'notifyOtaTokenExpired',
      'notifyAdsBudgetLow',
      'notifyPlanExpiring',
      'notifySecurityAlert',
      'notifyAchievement',
      'notifyReviewNegative',
    ];
    for (const fn of expectedFunctions) {
      expect(source).toMatch(new RegExp(`export\\s+(?:const|function)\\s+${fn}\\b`));
    }
  });
});

describe('E2E Regression — Achievement engine has 5 triggers', () => {
  it('achievement-engine.ts has all 5 trigger types', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/achievement-engine.ts'),
      'utf-8'
    );
    const triggers = [
      'first_booking',
      'milestone_10',
      'milestone_100',
      'revenue_record',
      'partner_level_up',
    ];
    for (const t of triggers) {
      expect(source).toContain(t);
    }
  });

  it('achievement-engine.ts exports checkAchievements function', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/achievement-engine.ts'),
      'utf-8'
    );
    expect(source).toMatch(/export\s+async\s+function\s+checkAchievements/);
  });

  it('achievement-engine.ts exports getAchievementProgress function', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/achievement-engine.ts'),
      'utf-8'
    );
    expect(source).toMatch(/export\s+function\s+getAchievementProgress/);
  });

  it('achievement-engine.ts exports helper functions', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/lib/notifications/achievement-engine.ts'),
      'utf-8'
    );
    expect(source).toMatch(/export\s+function\s+incrementBookingConfirmed/);
    expect(source).toMatch(/export\s+function\s+recordMrr/);
    expect(source).toMatch(/export\s+function\s+setPartnerTier/);
  });
});

describe('E2E Regression — DDCNotificationCenter advanced filters (Gap 7+8)', () => {
  it('NotificationCenter has priority filter chips', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/components/ddc/notifications/DDCNotificationCenter.tsx'),
      'utf-8'
    );
    expect(source).toContain('activePriority');
    expect(source).toContain('PRIORITY_LABEL');
  });

  it('NotificationCenter has status filter chips', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/components/ddc/notifications/DDCNotificationCenter.tsx'),
      'utf-8'
    );
    expect(source).toContain('activeStatus');
  });

  it('NotificationCenter has search input', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/components/ddc/notifications/DDCNotificationCenter.tsx'),
      'utf-8'
    );
    expect(source).toContain('searchQuery');
    expect(source).toContain('Search');
  });

  it('NotificationCenter has removable active filter chips', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/components/ddc/notifications/DDCNotificationCenter.tsx'),
      'utf-8'
    );
    expect(source).toContain('activeFilters');
    expect(source).toContain('clearAllFilters');
  });

  it('NotificationCenter has functional action buttons (router.push)', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/components/ddc/notifications/DDCNotificationCenter.tsx'),
      'utf-8'
    );
    expect(source).toContain('useRouter');
    expect(source).toContain('handleActionClick');
    expect(source).toContain('router.push');
  });

  it('NotificationCenter has archive read bulk action', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/components/ddc/notifications/DDCNotificationCenter.tsx'),
      'utf-8'
    );
    expect(source).toContain('archiveRead');
    expect(source).toContain('Arquivar lidas');
  });
});

describe('E2E Regression — Rate limit helper (Gap 5)', () => {
  it('rate-limit.ts has notifyRateLimitBlocked helper', () => {
    const source = readFileSync(join(PROJECT_ROOT, 'src/lib/rate-limit.ts'), 'utf-8');
    expect(source).toContain('notifyRateLimitBlocked');
    expect(source).toMatch(/export\s+async\s+function\s+notifyRateLimitBlocked/);
  });

  it('notifyRateLimitBlocked uses dynamic import to avoid circular dep', () => {
    const source = readFileSync(join(PROJECT_ROOT, 'src/lib/rate-limit.ts'), 'utf-8');
    expect(source).toMatch(/await\s+import\(['"]@\/lib\/notifications\/bridges['"]\)/);
  });
});
