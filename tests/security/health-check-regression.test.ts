import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const source = fs.readFileSync('src/lib/monitoring/health.ts', 'utf8');

describe('health check security contract', () => {
  it('does not expose exception details and does not claim an unconfigured LLM is healthy', () => {
    expect(source).toContain("message: 'Database check failed'");
    expect(source).toContain("message: 'Redis check failed'");
    expect(source).toContain("message: 'Mercado Pago check failed'");
    expect(source).toContain("message: 'LLM provider not configured'");
    expect(source).toContain('process.env.ZAI_API_KEY');
    expect(source).not.toContain('message: err.message');
  });
});
