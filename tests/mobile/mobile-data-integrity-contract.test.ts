import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('Mobile data integrity', () => {
  it('derives operational totals from live reservations', () => {
    const source = read('src/components/mobile/useDDCMobileOperationalSummary.ts');
    expect(source).toContain('data?.reservations');
    expect(source).toContain('reduce(');
  });

  it('does not expose a browser tenant selector in the live context', () => {
    const source = read('src/components/mobile/MobileDDCLiveContext.tsx');
    expect(source).not.toMatch(/tenantId.*(searchParams|localStorage|sessionStorage)/i);
  });
});
