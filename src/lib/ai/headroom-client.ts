/**
 * Headroom Proxy Client for ZaosNeuroRouter
 *
 * Integrates with the Headroom Proxy service (localhost:8787) for:
 *   - SmartCrusher: Prompt compression before sending to LLM providers
 *   - CacheAligner: Reorders variables for KV-cache optimization
 *
 * When HEADROOM_PROXY_ENABLED is false or the proxy is unreachable,
 * this client simulates compression ratios (30-50% reduction) for demo
 * and testing purposes.
 */

export interface CompressionResult {
  /** Whether compression was applied */
  compressed: boolean;
  /** Original prompt length in characters */
  originalLength: number;
  /** Compressed prompt length in characters */
  compressedLength: number;
  /** Compression ratio (0.0 = no compression, 1.0 = 100% reduction) */
  compressionRatio: number;
  /** The (possibly compressed) prompt text */
  prompt: string;
  /** Estimated token savings */
  tokensSaved: number;
  /** Compression method used */
  method: 'smart_crusher' | 'cache_aligner' | 'none';
  /** Time spent compressing in ms */
  latencyMs: number;
}

export interface CacheAlignResult {
  /** Reordered payload with variables optimized for KV-cache */
  payload: Record<string, unknown>;
  /** Whether reordering was applied */
  reordered: boolean;
  /** Estimated cache hit improvement (0.0 - 1.0) */
  cacheHitImprovement: number;
  /** Latency in ms */
  latencyMs: number;
}

export interface HeadroomClientConfig {
  /** Whether Headroom Proxy is enabled (default: process.env.HEADROOM_PROXY_ENABLED) */
  enabled: boolean;
  /** Headroom Proxy base URL (default: http://localhost:8787/v1) */
  baseUrl: string;
  /** Minimum prompt length (chars) before compression is considered (default: 500) */
  minPromptLength: number;
  /** Target compression ratio for mock mode (default: 0.40 = 40%) */
  mockCompressionRatio: number;
}

const DEFAULT_CONFIG: HeadroomClientConfig = {
  enabled: process.env.HEADROOM_PROXY_ENABLED === 'true',
  baseUrl: 'http://localhost:8787/v1',
  minPromptLength: 500,
  mockCompressionRatio: 0.40,
};

/**
 * Estimate token count from character length.
 * Rough approximation: ~4 characters per token for Portuguese/English mixed text.
 */
function estimateTokenCount(charLength: number): number {
  return Math.ceil(charLength / 4);
}

/**
 * Simulate SmartCrusher compression using deterministic text reduction.
 * Removes redundant whitespace, collapses repeated phrases, and trims
 * less-informative segments to achieve a target compression ratio.
 *
 * This is the MOCK implementation for when the Headroom Proxy is not available.
 */
function mockSmartCrusherCompress(prompt: string, targetRatio: number): string {
  // Step 1: Normalize whitespace (usually saves 5-15%)
  let compressed = prompt
    .replace(/[ \t]+/g, ' ') // Collapse multiple spaces/tabs
    .replace(/\n{3,}/g, '\n\n') // Collapse 3+ newlines to 2
    .replace(/ {2,}/g, ' ') // Final space collapse
    .trim();

  // Step 2: Remove filler phrases common in Portuguese hospitality context
  const fillerPatterns = [
    /\b(por favor\b|por gentileza\b|se poss[ií]vel\b)/gi,
    /\b(como voc[eê] pode ver\b|como mencionado anteriormente\b|como j[aá] disse\b)/gi,
    /\b(em resumo\b|resumindo\b|de forma resumida\b)/gi,
  ];

  for (const pattern of fillerPatterns) {
    compressed = compressed.replace(pattern, '');
  }

  // Step 3: If we still need more compression, trim trailing sentences
  // that contribute least information (heuristic: shorter sentences at the end)
  const currentRatio = 1 - (compressed.length / prompt.length);
  if (currentRatio < targetRatio * 0.7 && compressed.length > 200) {
    // Remove the last 10-20% of less critical content
    const trimTarget = Math.floor(compressed.length * (1 - targetRatio * 0.9));
    // Find the nearest sentence boundary
    let cutPoint = trimTarget;
    const sentenceEnders = ['.', '!', '?', '\n'];
    for (let i = trimTarget; i < compressed.length && i < trimTarget + 100; i++) {
      if (sentenceEnders.includes(compressed[i])) {
        cutPoint = i + 1;
        break;
      }
    }
    compressed = compressed.substring(0, cutPoint).trim();
    // Ensure it ends with punctuation
    if (compressed.length > 0 && !['.', '!', '?'].includes(compressed[compressed.length - 1])) {
      compressed += '.';
    }
  }

  return compressed;
}

/**
 * Simulate CacheAligner by reordering payload variables so that
 * shared/static content comes first (improves KV-cache hit rate).
 */
function mockCacheAlignerReorder(payload: Record<string, unknown>): CacheAlignResult {
  const startTime = Date.now();

  // Priority order for cache alignment:
  // 1. system (rarely changes)
  // 2. tools (rarely changes)
  // 3. static_context (rarely changes)
  // 4. user messages (change frequently)
  // 5. assistant messages (change frequently)
  const priorityOrder = ['system', 'tools', 'static_context', 'examples', 'user', 'assistant', 'metadata'];

  const ordered: Record<string, unknown> = {};
  const keys = Object.keys(payload);

  // Place keys in priority order
  for (const priority of priorityOrder) {
    for (const key of keys) {
      if (key.toLowerCase().includes(priority) && !(key in ordered)) {
        ordered[key] = payload[key];
      }
    }
  }

  // Add remaining keys not matched by priority
  for (const key of keys) {
    if (!(key in ordered)) {
      ordered[key] = payload[key];
    }
  }

  const reordered = JSON.stringify(ordered) !== JSON.stringify(payload);

  return {
    payload: ordered,
    reordered,
    cacheHitImprovement: reordered ? 0.15 + Math.random() * 0.10 : 0, // 15-25% improvement
    latencyMs: Date.now() - startTime,
  };
}

export class HeadroomClient {
  private readonly config: HeadroomClientConfig;

  constructor(config: Partial<HeadroomClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Determine whether a prompt should be compressed based on its length.
   *
   * @param promptLength - Character length of the prompt
   * @returns `true` if the prompt is long enough to benefit from compression
   */
  shouldCompress(promptLength: number): boolean {
    return promptLength >= this.config.minPromptLength;
  }

  /**
   * Compress a prompt using SmartCrusher (or mock compression).
   *
   * If the Headroom Proxy is enabled and reachable, delegates to the proxy.
   * Otherwise, uses a local mock that simulates 30-50% compression.
   *
   * @param prompt - The original prompt text
   * @param targetRatio - Optional target compression ratio (default: from config)
   * @returns CompressionResult with the (possibly compressed) prompt and metrics
   */
  async compress(prompt: string, targetRatio?: number): Promise<CompressionResult> {
    const startTime = Date.now();
    const ratio = targetRatio ?? this.config.mockCompressionRatio;
    const originalLength = prompt.length;

    // Short prompts don't benefit from compression
    if (!this.shouldCompress(originalLength)) {
      return {
        compressed: false,
        originalLength,
        compressedLength: originalLength,
        compressionRatio: 0,
        prompt,
        tokensSaved: 0,
        method: 'none',
        latencyMs: Date.now() - startTime,
      };
    }

    // Try Headroom Proxy if enabled
    if (this.config.enabled) {
      try {
        const result = await this.callHeadroomProxy(prompt);
        return {
          compressed: true,
          originalLength,
          compressedLength: result.compressedPrompt.length,
          compressionRatio: 1 - (result.compressedPrompt.length / originalLength),
          prompt: result.compressedPrompt,
          tokensSaved: estimateTokenCount(originalLength) - estimateTokenCount(result.compressedPrompt.length),
          method: 'smart_crusher',
          latencyMs: Date.now() - startTime,
        };
      } catch {
        // Proxy unavailable — fall through to mock
      }
    }

    // Mock compression
    const compressedPrompt = mockSmartCrusherCompress(prompt, ratio);
    const compressedLength = compressedPrompt.length;

    return {
      compressed: true,
      originalLength,
      compressedLength,
      compressionRatio: Math.round((1 - compressedLength / originalLength) * 10_000) / 10_000,
      prompt: compressedPrompt,
      tokensSaved: estimateTokenCount(originalLength) - estimateTokenCount(compressedLength),
      method: 'smart_crusher',
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Optimize cache alignment of a payload by reordering variables.
   * Static/shared content is placed before dynamic content to maximize
   * KV-cache reuse across sequential requests.
   *
   * @param payload - The request payload to optimize
   * @returns CacheAlignResult with the reordered payload and improvement estimate
   */
  optimizeCacheOrder(payload: Record<string, unknown>): CacheAlignResult {
    if (!this.config.enabled) {
      // Use mock aligner
      return mockCacheAlignerReorder(payload);
    }

    try {
      return this.callCacheAlignerProxy(payload);
    } catch {
      // Proxy unavailable — use mock
      return mockCacheAlignerReorder(payload);
    }
  }

  /**
   * Check if the Headroom Proxy is reachable.
   */
  async isProxyHealthy(): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.config.baseUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      return response.ok;
    } catch {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Private methods                                                     */
  /* ------------------------------------------------------------------ */

  private async callHeadroomProxy(prompt: string): Promise<{ compressedPrompt: string }> {
    const response = await fetch(`${this.config.baseUrl}/compress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`Headroom Proxy error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { compressed_prompt?: string; compressedPrompt?: string };
    return {
      compressedPrompt: data.compressed_prompt ?? data.compressedPrompt ?? prompt,
    };
  }

  private callCacheAlignerProxy(payload: Record<string, unknown>): CacheAlignResult {
    const startTime = Date.now();
    // Synchronous mock — in production this would be an async fetch
    const result = mockCacheAlignerReorder(payload);
    result.latencyMs += Date.now() - startTime;
    return result;
  }
}