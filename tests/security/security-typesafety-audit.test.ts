import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function collectTsFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) collectTsFiles(path, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(path);
  }
  return files;
}

describe('security type-safety audit', () => {
  it('does not allow @ts-nocheck in security-critical source trees', () => {
    const roots = [
      resolve(process.cwd(), 'src/lib/security'),
      resolve(process.cwd(), 'src/app/api/auth'),
      resolve(process.cwd(), 'src/app/api/webhooks'),
    ];
    const violations: string[] = [];

    for (const root of roots) {
      for (const file of collectTsFiles(root)) {
        const source = readFileSync(file, 'utf8');
        if (/^\s*\/\/\s*@ts-nocheck\b/m.test(source)) violations.push(file);
      }
    }

    expect(violations, `Security-critical files using @ts-nocheck:\n${violations.join('\n')}`).toEqual([]);
  });
});
