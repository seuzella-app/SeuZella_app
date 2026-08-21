import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('unsafe execution regression', () => {
  it('does not contain obvious shell-evaluation primitives in application source', () => {
    const output = execFileSync(
      'git',
      ['grep', '-nE', '(^|[^A-Za-z])eval\\(|new Function\\(|execSync\\(|exec\\(', 'src'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    expect(output).toBe('');
  });
});
