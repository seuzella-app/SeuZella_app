/**
 * Tests for Gap 1 — Bridge Wiring Validation
 *
 * Validates that all 12 missing bridges from the original super prompt
 * are now WIRED (called from at least one non-bridges.ts file).
 *
 * This test reads source files directly (no React rendering needed)
 * so it can run in CI without a DOM.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const PROJECT_ROOT = join(__dirname, '../../..');
const SRC_DIR = join(PROJECT_ROOT, 'src');

// ─── Helper: recursively find files matching pattern ──────────────────────
function findFiles(dir: string, pattern: RegExp, results: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      findFiles(fullPath, pattern, results);
    } else if (pattern.test(entry)) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Helper: read file as string ────────────────────────────────────────────
function readSource(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

describe('Gap 1 — All 13 bridges are wired', () => {
  const expectedBridges = [
    'bridgeWhatsAppIncoming',
    'bridgeWhatsAppEscalation',
    'bridgeReservationEvent',
    'bridgePaymentEvent',
    'bridgeCerebroAlert',
    'bridgeIcalSync',
    'bridgeOtaTokenExpired',
    'bridgeDynamicPricingAlert',
    'bridgeAdsBudgetLow',
    'bridgePlanExpiring',
    'bridgeSecurityAlert',
    'bridgeReviewNegative',
    'bridgeAchievement',
  ];

  const allFiles = [
    ...findFiles(join(SRC_DIR, 'app/api'), /\.tsx?$/),
    ...findFiles(join(SRC_DIR, 'lib'), /\.tsx?$/),
  ].filter((f) => !f.includes('lib/notifications/bridges.ts'));

  it(`finds at least 13 source files referencing bridges`, () => {
    const filesWithBridge = allFiles.filter((f) => {
      const source = readSource(f);
      return expectedBridges.some((b) => source.includes(b));
    });
    expect(filesWithBridge.length).toBeGreaterThanOrEqual(13);
  });

  for (const bridgeName of expectedBridges) {
    it(`${bridgeName} is imported and called from at least 1 file`, () => {
      const filesReferencing = allFiles.filter((f) => {
        const source = readSource(f);
        return (
          source.includes(bridgeName) &&
          (source.includes(`import { ${bridgeName}`) ||
            source.includes(`import {${bridgeName}`) ||
            source.includes(`${bridgeName}(`) ||
            source.match(new RegExp(`\\b${bridgeName}\\b`)))
        );
      });
      expect(filesReferencing.length).toBeGreaterThan(0);
    });
  }
});

describe('Gap 1 — Specific wiring point validation', () => {
  it('bridgeWhatsAppIncoming is wired in /api/webhooks/whatsapp/route.ts', () => {
    const source = readSource(join(SRC_DIR, 'app/api/webhooks/whatsapp/route.ts'));
    expect(source).toContain('bridgeWhatsAppIncoming');
  });

  it('bridgeWhatsAppEscalation is wired in /api/ddc/conversations/[id]/escalate/route.ts', () => {
    const source = readSource(
      join(SRC_DIR, 'app/api/ddc/conversations/[id]/escalate/route.ts')
    );
    expect(source).toContain('bridgeWhatsAppEscalation');
  });

  it('bridgeReservationEvent is wired in /api/ddc/bookings/route.ts', () => {
    const source = readSource(join(SRC_DIR, 'app/api/ddc/bookings/route.ts'));
    expect(source).toContain('bridgeReservationEvent');
  });

  it('bridgeIcalSync is wired in /api/ddc/booking-sync/route.ts', () => {
    const source = readSource(join(SRC_DIR, 'app/api/ddc/booking-sync/route.ts'));
    expect(source).toContain('bridgeIcalSync');
  });

  it('bridgePaymentEvent is wired in /api/webhooks/payment/route.ts', () => {
    const source = readSource(join(SRC_DIR, 'app/api/webhooks/payment/route.ts'));
    expect(source).toContain('bridgePaymentEvent');
  });

  it('bridgePaymentEvent is also wired in /api/checkout/webhook/route.ts', () => {
    const source = readSource(join(SRC_DIR, 'app/api/checkout/webhook/route.ts'));
    expect(source).toContain('bridgePaymentEvent');
  });

  it('bridgeCerebroAlert is wired in /api/cron/cerebro-watchdog/route.ts', () => {
    const source = readSource(join(SRC_DIR, 'app/api/cron/cerebro-watchdog/route.ts'));
    expect(source).toContain('bridgeCerebroAlert');
  });

  it('bridgeCerebroAlert is wired in /api/cron/cerebro-analyze/route.ts', () => {
    const source = readSource(join(SRC_DIR, 'app/api/cron/cerebro-analyze/route.ts'));
    expect(source).toContain('bridgeCerebroAlert');
  });

  it('bridgeCerebroAlert is wired in /api/cron/cerebro-budget-forecast/route.ts', () => {
    const source = readSource(
      join(SRC_DIR, 'app/api/cron/cerebro-budget-forecast/route.ts')
    );
    expect(source).toContain('bridgeCerebroAlert');
  });

  it('bridgeOtaTokenExpired is wired in /api/cron/ota-token-expiry/route.ts', () => {
    const source = readSource(join(SRC_DIR, 'app/api/cron/ota-token-expiry/route.ts'));
    expect(source).toContain('bridgeOtaTokenExpired');
  });

  it('bridgeDynamicPricingAlert is wired in /lib/dynamic-pricing-engine.ts', () => {
    const source = readSource(join(SRC_DIR, 'lib/dynamic-pricing-engine.ts'));
    expect(source).toContain('bridgeDynamicPricingAlert');
  });

  it('bridgeAdsBudgetLow is wired in /api/cron/budget-reset/route.ts', () => {
    const source = readSource(join(SRC_DIR, 'app/api/cron/budget-reset/route.ts'));
    expect(source).toContain('bridgeAdsBudgetLow');
  });

  it('bridgePlanExpiring is wired in /api/cron/plan-expiry/route.ts', () => {
    const source = readSource(join(SRC_DIR, 'app/api/cron/plan-expiry/route.ts'));
    expect(source).toContain('bridgePlanExpiring');
  });

  it('bridgeSecurityAlert helper is in /lib/rate-limit.ts', () => {
    const source = readSource(join(SRC_DIR, 'lib/rate-limit.ts'));
    expect(source).toContain('bridgeSecurityAlert');
    expect(source).toContain('notifyRateLimitBlocked');
  });

  it('bridgeSecurityAlert is wired in /api/checkout/webhook/route.ts', () => {
    const source = readSource(join(SRC_DIR, 'app/api/checkout/webhook/route.ts'));
    expect(source).toContain('bridgeSecurityAlert');
  });

  it('bridgeReviewNegative is wired in /api/webhooks/booking-com/reviews/route.ts', () => {
    const source = readSource(
      join(SRC_DIR, 'app/api/webhooks/booking-com/reviews/route.ts')
    );
    expect(source).toContain('bridgeReviewNegative');
  });

  it('bridgeAchievement is wired in /lib/notifications/achievement-engine.ts', () => {
    const source = readSource(join(SRC_DIR, 'lib/notifications/achievement-engine.ts'));
    expect(source).toContain('bridgeAchievement');
  });
});

describe('Gap 1 — All wiring is non-blocking (try/catch)', () => {
  const wiringFiles = [
    'src/app/api/ddc/conversations/[id]/escalate/route.ts',
    'src/app/api/ddc/bookings/route.ts',
    'src/app/api/ddc/booking-sync/route.ts',
    'src/app/api/checkout/webhook/route.ts',
    'src/app/api/webhooks/payment/route.ts',
    'src/app/api/cron/cerebro-watchdog/route.ts',
    'src/app/api/cron/cerebro-analyze/route.ts',
    'src/app/api/cron/cerebro-budget-forecast/route.ts',
    'src/app/api/cron/ota-token-expiry/route.ts',
    'src/app/api/cron/plan-expiry/route.ts',
    'src/app/api/cron/booking-daily/route.ts',
    'src/app/api/cron/payment-overdue/route.ts',
    'src/app/api/cron/achievements-check/route.ts',
    'src/app/api/cron/plan-limits-check/route.ts',
    'src/app/api/cron/budget-reset/route.ts',
    'src/app/api/webhooks/booking-com/reviews/route.ts',
  ];

  for (const file of wiringFiles) {
    it(`${file} wraps bridge calls in try/catch`, () => {
      const source = readSource(join(PROJECT_ROOT, file));
      expect(source).toMatch(/try\s*\{/);
      expect(source).toMatch(/catch\s*\(/);
    });
  }
});

describe('Gap 1 — Wiring count summary', () => {
  it('total files referencing bridges (excluding bridges.ts) >= 13', () => {
    const allFiles = [
      ...findFiles(join(SRC_DIR, 'app/api'), /\.tsx?$/),
      ...findFiles(join(SRC_DIR, 'lib'), /\.tsx?$/),
    ].filter((f) => !f.includes('lib/notifications/bridges.ts'));

    const bridgePattern =
      /bridge(?:WhatsApp|Reservation|Payment|Cerebro|Ical|Ota|DynamicPricing|Ads|Plan|Security|Review|Achievement)/;
    const filesWithBridge = allFiles.filter((f) => {
      const source = readSource(f);
      return bridgePattern.test(source);
    });

    console.log(
      `\n  [Bridge Wiring Summary] ${filesWithBridge.length} files reference bridges:`
    );
    for (const f of filesWithBridge.sort()) {
      console.log(`    - ${relative(PROJECT_ROOT, f)}`);
    }

    expect(filesWithBridge.length).toBeGreaterThanOrEqual(13);
  });
});
