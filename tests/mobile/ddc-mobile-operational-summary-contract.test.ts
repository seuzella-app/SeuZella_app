import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('DDC Mobile operational summary', () => {
  it('derives metrics from the shared live context', () => {
    const source = read('src/components/mobile/useDDCMobileOperationalSummary.ts');
    expect(source).toContain('useMobileDDCLive()');
    expect(source).toContain('data?.reservations');
    expect(source).toContain('CHECKED_IN');
    expect(source).toContain('CONFIRMED');
  });

  it('does not introduce client tenant identity or demo guest fixtures', () => {
    const source = read('src/components/mobile/useDDCMobileOperationalSummary.ts');
    expect(source).not.toContain('tenantId');
    expect(source).not.toContain('Maria Silva');
    expect(source).not.toContain('849201');
  });
});
