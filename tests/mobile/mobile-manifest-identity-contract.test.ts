import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/app/manifest.ts'), 'utf8');

describe('Mobile manifest identity', () => {
  it('keeps one installable identity for both DDC niches', () => {
    expect(source).toContain("id: '/mobile'");
    expect(source).toContain("start_url: '/mobile'");
    expect(source).toContain("display: 'standalone'");
  });
});
