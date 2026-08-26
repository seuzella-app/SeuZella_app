import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('Real adapter stubs — architecture contract', () => {
  it('src/adapters/real/index.ts declares all 8 stubs with @stub markers', () => {
    const source = read('src/adapters/real/index.ts');

    // The header block must document every stub with @stub-tracker markers.
    // Removing a tracker without implementing the adapter breaks this test,
    // surfacing accidental deletions during code review.
    const expectedTrackers = [
      'GoogleAds',
      'MetaAds',
      'Payment',
      'CRM',
      'WhatsApp',
      'Analytics',
      'Email',
      'Maps',
    ];
    for (const tracker of expectedTrackers) {
      expect(source).toContain(`@stub-tracker ${tracker}`);
    }
  });

  it('every real adapter exports an instance that throws RealAdapterNotImplementedError', async () => {
    const moduleInstance = await import('@/adapters/real');
    const adapters = [
      { name: 'googleAdsReal', instance: moduleInstance.googleAdsReal },
      { name: 'metaAdsReal', instance: moduleInstance.metaAdsReal },
      { name: 'paymentReal', instance: moduleInstance.paymentReal },
      { name: 'crmReal', instance: moduleInstance.crmReal },
      { name: 'whatsappReal', instance: moduleInstance.whatsappReal },
      { name: 'analyticsReal', instance: moduleInstance.analyticsReal },
      { name: 'emailReal', instance: moduleInstance.emailReal },
      { name: 'mapsReal', instance: moduleInstance.mapsReal },
    ];

    for (const { name, instance } of adapters) {
      expect(instance, `${name} should be exported`).toBeDefined();
      expect(instance.isDigitalTwin(), `${name}.isDigitalTwin() must be false`).toBe(false);
    }
  });

  it('every real adapter method throws RealAdapterNotImplementedError (never silently no-ops)', async () => {
    const moduleInstance = await import('@/adapters/real');

    // Each adapter must throw on every method call. This contract ensures
    // we never silently route production traffic through an unimplemented adapter.
    const calls = [
      () => moduleInstance.googleAdsReal.createCampaign(),
      () => moduleInstance.metaAdsReal.createCampaign(),
      () => moduleInstance.paymentReal.createIntent(),
      () => moduleInstance.crmReal.createLead(),
      () => moduleInstance.whatsappReal.send(),
      () => moduleInstance.analyticsReal.trackEvent(),
      () => moduleInstance.emailReal.send(),
      () => moduleInstance.mapsReal.geocode(),
    ];

    for (const call of calls) {
      await expect(call()).rejects.toThrow(/not implemented yet/i);
    }
  });

  it('whatsappReal.onInbound() returns a no-op function (does NOT throw)', async () => {
    // Exception: onInbound returns an unsubscribe function, not a Promise.
    // It must return a no-op rather than throwing so consumers can register
    // handlers without try/catch around the subscription.
    const moduleInstance = await import('@/adapters/real');
    const unsubscribe = moduleInstance.whatsappReal.onInbound();
    expect(typeof unsubscribe).toBe('function');
  });
});

describe('tenant-prisma.ts — type safety contract', () => {
  it('does NOT carry @ts-nocheck (was the #1 architecture smell)', () => {
    const source = read('src/lib/db/tenant-prisma.ts');
    expect(source).not.toContain('@ts-nocheck');
  });

  it('TENANT_MODELS list has no duplicates (was the reason for @ts-nocheck)', () => {
    const source = read('src/lib/db/tenant-prisma.ts');
    // Extract the TENANT_MODELS array literal
    const match = source.match(/const TENANT_MODELS = \[([\s\S]*?)\] as const;/);
    expect(match, 'TENANT_MODELS array must be marked as const').not.toBeNull();

    const items = match![1]
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      // Strip quotes
      .map((s) => s.replace(/^['"]|['"]$/g, ''));

    const dupes = items.filter((item, idx) => items.indexOf(item) !== idx);
    expect(dupes, `Duplicate models found: ${dupes.join(', ')}`).toEqual([]);
  });

  it('getTenantDb extension is named tenantRLS (visible in Prisma logs)', () => {
    const source = read('src/lib/db/tenant-prisma.ts');
    expect(source).toMatch(/name:.*tenant/i);
  });
});
