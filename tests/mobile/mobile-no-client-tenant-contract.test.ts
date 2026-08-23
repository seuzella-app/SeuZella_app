import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const mobileFiles = [
  'src/components/mobile/MobileDDCLiveContext.tsx',
  'src/components/mobile/MobileDDCDataBoundary.tsx',
  'src/components/mobile/useDDCMobileOperationalSummary.ts',
];

describe('Mobile tenant security boundary', () => {
  it('does not derive tenant identity from browser-controlled query parameters', () => {
    for (const file of mobileFiles) {
      const source = readFileSync(resolve(root, file), 'utf8');
      expect(source).not.toMatch(/searchParams.*tenantId|tenantId.*searchParams/i);
    }
  });
});
