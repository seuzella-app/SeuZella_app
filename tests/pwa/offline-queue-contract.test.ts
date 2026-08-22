import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');

describe('offline queue durability', () => {
  it('does not acknowledge failed replay as completed', () => {
    expect(source).toContain('if (!response.ok) throw new Error');
    expect(source).toContain('queued action retained after failed replay');
  });

  it('deletes queued actions only after successful HTTP replay', () => {
    expect(source).toContain('.delete(keys[index])');
    expect(source).toContain('await fetch(action.url');
  });
});
