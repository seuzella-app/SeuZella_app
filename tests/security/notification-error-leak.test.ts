import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('notification API error handling', () => {
  it('does not serialize exception messages to clients', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/api/ddc/notifications/read-all/route.ts'), 'utf8');

    expect(source).not.toContain('details: error instanceof Error ? error.message');
    expect(source).toContain("error: { code: 'INTERNAL_ERROR'");
    expect(source).toContain("console.error('[DDC_NOTIFICATIONS_READ_ALL]'");
  });
});
