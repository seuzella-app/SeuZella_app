interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

export interface ResourceLimits {
  maxMessages: number;
  maxCharsPerMessage: number;
  maxTotalPromptChars: number;
  maxTotalPromptBytes: number;
  maxLlmOutputTokens: number;
  maxLlmCostUsd: number;
  dbQueryTimeoutMs: number;
  dbMaxRows: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeoutMs: number;
}

export const DEFAULT_LIMITS: ResourceLimits = {
  maxMessages: 50,
  maxCharsPerMessage: 2000,
  maxTotalPromptChars: 12000,
  maxTotalPromptBytes: 50000,
  maxLlmOutputTokens: 1024,
  maxLlmCostUsd: 0.10,
  dbQueryTimeoutMs: 5000,
  dbMaxRows: 100,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeoutMs: 60000,
};

export class ResourceExhaustionError extends Error {
  constructor(public code: string, public details: any) {
    super(`RESOURCE_EXHAUSTED: ${code}`);
    this.name = 'ResourceExhaustionError';
  }
}

export function checkCircuitBreaker(key: string): void {
  const now = Date.now();
  let cb = circuitBreakers.get(key);
  if (!cb) {
    cb = { failures: 0, lastFailure: 0, state: 'CLOSED' };
    circuitBreakers.set(key, cb);
  }
  if (cb.state === 'OPEN') {
    if (now - cb.lastFailure > DEFAULT_LIMITS.circuitBreakerTimeoutMs) {
      cb.state = 'HALF_OPEN';
      cb.failures = 0;
    } else {
      throw new ResourceExhaustionError('CIRCUIT_OPEN', {
        key, retryAfter: Math.ceil((cb.lastFailure + DEFAULT_LIMITS.circuitBreakerTimeoutMs - now) / 1000)
      });
    }
  }
}

export function recordFailure(key: string): void {
  const cb = circuitBreakers.get(key);
  if (cb) {
    cb.failures++;
    cb.lastFailure = Date.now();
    if (cb.failures >= DEFAULT_LIMITS.circuitBreakerThreshold) {
      cb.state = 'OPEN';
      console.error(`🚨 [CircuitBreaker] OPEN for ${key}. Failures: ${cb.failures}`);
    }
  }
}

export function recordSuccess(key: string): void {
  const cb = circuitBreakers.get(key);
  if (cb && cb.state === 'HALF_OPEN') {
    cb.state = 'CLOSED';
    cb.failures = 0;
  }
}

export function truncateMessagesSecure(
  messages: Array<{ content: string }>,
  limits: ResourceLimits = DEFAULT_LIMITS,
  circuitKey?: string
): Array<{ content: string }> {
  if (circuitKey) checkCircuitBreaker(circuitKey);
  if (!Array.isArray(messages)) {
    throw new ResourceExhaustionError('INVALID_INPUT', { reason: 'messages_not_array' });
  }
  if (messages.length > limits.dbMaxRows) {
    throw new ResourceExhaustionError('ROW_LIMIT_EXCEEDED', { received: messages.length, max: limits.dbMaxRows });
  }
  const sliced = messages.slice(0, limits.maxMessages);
  let totalBytes = 0;
  const result: Array<{ content: string }> = [];
  for (const msg of sliced) {
    if (!msg.content || typeof msg.content !== 'string') continue;
    if (msg.content.startsWith('data:') || msg.content.length > limits.maxCharsPerMessage * 2) continue;
    let {content} = msg;
    if (content.length > limits.maxCharsPerMessage) {
      content = `${content.slice(0, limits.maxCharsPerMessage) }...[TRUNCADO]`;
    }
    const bytes = Buffer.byteLength(content, 'utf8');
    if (totalBytes + bytes > limits.maxTotalPromptBytes) {
      const remaining = limits.maxTotalPromptBytes - totalBytes;
      if (remaining > 100) {
        const truncated = Buffer.from(content).slice(0, remaining - 50).toString('utf8');
        result.push({ content: `${truncated }...[BYTES_LIMIT]` });
      }
      break;
    }
    totalBytes += bytes;
    result.push({ content });
  }
  if (result.length === 0) {
    throw new ResourceExhaustionError('EMPTY_PROMPT', { reason: 'all_messages_filtered' });
  }
  return result;
}

export function estimateCost(inputChars: number, outputTokens: number): number {
  const inputTokens = Math.ceil(inputChars / 4);
  const inputCost = (inputTokens / 1_000_000) * 0.50;
  const outputCost = (outputTokens / 1_000_000) * 1.50;
  return inputCost + outputCost;
}

export function assertCostLimit(inputChars: number, outputTokens: number, limitUsd: number = DEFAULT_LIMITS.maxLlmCostUsd): void {
  const cost = estimateCost(inputChars, outputTokens);
  if (cost > limitUsd) {
    throw new ResourceExhaustionError('COST_LIMIT_EXCEEDED', {
      estimatedUsd: cost.toFixed(4), limitUsd, inputChars, outputTokens,
    });
  }
}
