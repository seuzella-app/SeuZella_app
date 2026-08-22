/**
 * LLM Timeout Utility
 * ============================================================================
 *
 * Wraps a Promise-returning LLM call with a hard timeout. If the LLM provider
 * does not respond within `timeoutMs`, the wrapper rejects with a
 * `LLM_TIMEOUT` error and the caller can fall through to the next provider
 * in the fallback chain.
 *
 * Why this exists
 * ---------------
 * `zaos-neuro-router.ts` (1916 LOC) had ZERO timeout enforcement on
 * `callRealLLM`. A hung provider (e.g. OpenRouter during an outage) would
 * block the entire Cérebro tick indefinitely. This utility gives the router
 * a deterministic escape hatch.
 *
 * Usage
 * -----
 *   const result = await withLlmTimeout(
 *     () => callGemini({ ... }),
 *     8_000,
 *     { provider: 'gemini-1.5-flash', prompt: '...' }
 *   );
 *
 * The third argument is for structured logging — it gets attached to the
 * error so the Cérebro telemetry event is actionable.
 */

export interface LlmTimeoutContext {
  provider: string;
  prompt?: string;
  traceId?: string;
  tenantId?: string;
}

const DEFAULT_LLM_TIMEOUT_MS = 8_000;

/**
 * Wrap an LLM call with a hard timeout. The timeout fires regardless of
 * whether the underlying provider supports AbortSignal — we don't rely on
 * the provider to honor cancellation, we simply stop waiting.
 *
 * The underlying Promise may continue running in the background (Node.js
 * can't cancel a Promise), but the caller gets a deterministic rejection.
 */
export async function withLlmTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = DEFAULT_LLM_TIMEOUT_MS,
  context?: LlmTimeoutContext,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(
        `LLM_TIMEOUT: provider=${context?.provider || 'unknown'} did not respond within ${timeoutMs}ms`,
      );
      (err as Error & { code: string; context?: LlmTimeoutContext }).code = 'LLM_TIMEOUT';
      (err as Error & { code: string; context?: LlmTimeoutContext }).context = context;
      reject(err);
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Helper for the fallback chain: try a sequence of LLM calls in order,
 * returning the first successful result. If all calls fail (timeout or
 * otherwise), rejects with the last error.
 *
 * Usage:
 *   const result = await withLlmFallback([
 *     () => withLlmTimeout(() => callGemini(...), 8000, { provider: 'gemini' }),
 *     () => withLlmTimeout(() => callOpenAI(...), 8000, { provider: 'openai' }),
 *     () => withLlmTimeout(() => callAnthropic(...), 8000, { provider: 'anthropic' }),
 *   ]);
 */
export async function withLlmFallback<T>(
  calls: Array<() => Promise<T>>,
): Promise<T> {
  let lastError: unknown = null;
  for (const call of calls) {
    try {
      return await call();
    } catch (err) {
      lastError = err;
      // Continue to next provider.
    }
  }
  throw lastError ?? new Error('LLM_FALLBACK_EXHAUSTED: no providers succeeded');
}
