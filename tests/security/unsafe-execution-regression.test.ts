import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

describe('unsafe execution regression', () => {
  it('does not contain obvious shell-evaluation primitives in application source', () => {
    const result = spawnSync(
      'git',
      ['grep', '-nE', '(^|[^A-Za-z_.])eval\\(|new Function\\(|child_process.*execSync\\(', 'src/app', 'src/lib/security'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
  });
});
