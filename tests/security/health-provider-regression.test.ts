import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const source = fs.readFileSync('src/lib/monitoring/health.ts', 'utf8');

describe('health provider regression contract', () => {
  it('recognizes configured LLM providers instead of a single hard-coded provider', () => {
    expect(source).toContain('OPENAI_API_KEY');
    expect(source).toContain('GEMINI_API_KEY');
    expect(source).toContain('OPENROUTER_API_KEY');
  });

  it('uses the canonical Mercado Pago token with compatibility fallback', () => {
    expect(source).toContain('MP_ACCESS_TOKEN');
    expect(source).toContain('MERCADOPAGO_ACCESS_TOKEN');
  });

  it('does not expose upstream provider HTTP status details', () => {
    expect(source).not.toMatch(/message:\s*`HTTP \$\{res\.status\}`/);
  });
});
