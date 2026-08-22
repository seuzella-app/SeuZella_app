import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const files = readdirSync(resolve(root, 'src/app/api'), { recursive: true })
  .filter((file): file is string => typeof file === 'string' && /lock/i.test(file) && file.endsWith('route.ts'));

describe('mobile lock security boundary', () => {
  it('keeps lock routes tenant-scoped and fail-closed', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(resolve(root, 'src/app/api', file), 'utf8');
      if (/Mobile|mobile|lock/i.test(file)) {
        expect(source).toMatch(/requireTenantId|tenantId/);
      }
    }
  });
});
