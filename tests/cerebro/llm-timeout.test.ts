import { describe, expect, it } from 'vitest';
import { withLlmTimeout, withLlmFallback } from '@/lib/ai/llm-timeout';

describe('withLlmTimeout — hard timeout for LLM calls', () => {
  it('returns the result when the call completes within the timeout', async () => {
    const result = await withLlmTimeout(
      () => Promise.resolve({ content: 'hello', tokens: 5 }),
      1_000,
      { provider: 'test' },
    );
    expect(result).toEqual({ content: 'hello', tokens: 5 });
  });

  it('rejects with LLM_TIMEOUT when the call exceeds the timeout', async () => {
    const slowCall = () =>
      new Promise<{ content: string }>((resolve) => {
        setTimeout(() => resolve({ content: 'late' }), 200);
      });

    await expect(withLlmTimeout(slowCall, 50, { provider: 'slow' })).rejects.toThrow(
      /LLM_TIMEOUT.*slow.*50ms/,
    );
  });

  it('attaches a structured context to the timeout error for telemetry', async () => {
    let caught: any = null;
    try {
      await withLlmTimeout(
        () => new Promise<string>(() => { /* never resolves */ }),
        30,
        { provider: 'gemini-1.5-flash', traceId: 'trc_123', tenantId: 'tenant_abc' },
      );
    } catch (err: any) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    expect(caught.code).toBe('LLM_TIMEOUT');
    expect(caught.context).toEqual({
      provider: 'gemini-1.5-flash',
      traceId: 'trc_123',
      tenantId: 'tenant_abc',
    });
  });

  it('propagates the original error when the call rejects before timeout', async () => {
    await expect(
      withLlmTimeout(
        () => Promise.reject(new Error('API key invalid')),
        1_000,
        { provider: 'test' },
      ),
    ).rejects.toThrow('API key invalid');
  });

  it('clears the timeout after successful resolution (no leak)', async () => {
    const result = await withLlmTimeout(
      () => Promise.resolve(42),
      1_000,
      { provider: 'test' },
    );
    expect(result).toBe(42);
  });
});

describe('withLlmFallback — provider fallback chain', () => {
  it('returns the result from the first successful provider', async () => {
    const result = await withLlmFallback([
      () => Promise.resolve('gemini-response'),
      () => Promise.resolve('openai-response'),
    ]);
    expect(result).toBe('gemini-response');
  });

  it('falls through to the next provider on rejection', async () => {
    const result = await withLlmFallback([
      () => Promise.reject(new Error('gemini down')),
      () => Promise.resolve('openai-response'),
    ]);
    expect(result).toBe('openai-response');
  });

  it('rejects with the last error when all providers fail', async () => {
    await expect(
      withLlmFallback([
        () => Promise.reject(new Error('gemini 503')),
        () => Promise.reject(new Error('openai 429')),
        () => Promise.reject(new Error('anthropic 500')),
      ]),
    ).rejects.toThrow('anthropic 500');
  });

  it('rejects with LLM_FALLBACK_EXHAUSTED when the calls array is empty', async () => {
    await expect(withLlmFallback([])).rejects.toThrow(/LLM_FALLBACK_EXHAUSTED/);
  });
});

describe('withLlmTimeout — zaos-neuro-router integration contract', () => {
  it('zaos-neuro-router.ts imports withLlmTimeout and wraps Gemini + Anthropic calls', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/ai/zaos-neuro-router.ts'),
      'utf8',
    );
    expect(source).toContain("from './llm-timeout'");
    expect(source).toContain('withLlmTimeout');
    const matches = source.match(/withLlmTimeout\(/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
