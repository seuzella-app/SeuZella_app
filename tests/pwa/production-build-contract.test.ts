import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('production build contract', () => {
  it('keeps Vercel on the explicit production build path', () => {
    const pkg = read('package.json');
    expect(pkg).toContain('"vercel-build": "prisma generate && next build"');
  });

  it('does not silently ignore TypeScript build failures', () => {
    const config = read('next.config.ts');
    expect(config).toContain('ignoreBuildErrors: false');
  });

  it('keeps standalone output required by the production container build', () => {
    const config = read('next.config.ts');
    expect(config).toContain("output: 'standalone'");
  });
});
