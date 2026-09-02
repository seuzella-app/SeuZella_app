/**
 * LATENCY TRACKER — Wave 15 / F08 — Observability Instrumentation
 * ============================================================================
 * In-memory latency tracker for critical business flows.
 *
 * STATUS: CODE_READY
 * RUNTIME_VALIDATED: FALSE (requires production traffic for real p95/p99)
 *
 * Records request durations for instrumented routes and computes
 * p50, p95, p99 percentiles using nearest-rank method.
 *
 * LIMITATIONS (honestly documented):
 *   - In-memory only — NOT persisted across cold starts
 *   - Per-instance only — NOT aggregated across Vercel serverless instances
 *   - Rolling window: last 1000 samples per route
 *   - Reset on cold start (multi-instance = each instance has own samples)
 *
 * For production-grade metrics, an external APM tool (Datadog/New Relic/Honeycomb)
 * should be integrated. This module provides a minimum viable observability
 * baseline for staging validation.
 *
 * USAGE:
 *   ```ts
 *   import { measureLatency } from '@/lib/observability/latency-tracker';
 *
 *   export const POST = measureLatency('checkout.create', async (req) => {
 *     // ... existing handler logic ...
 *   });
 *   ```
 */
import { logger } from '@/lib/logger';

const MAX_SAMPLES_PER_ROUTE = 1000;
const PERCENTILES = [50, 95, 99] as const;

interface RouteSamples {
  samples: number[];
  totalRecorded: number;
}

const routeStore = new Map<string, RouteSamples>();

/**
 * Records a latency sample for a given route.
 * Thread-safe (Node.js single-threaded but defensive).
 */
export function recordLatency(route: string, durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return; // Ignore invalid samples
  }

  let entry = routeStore.get(route);
  if (!entry) {
    entry = { samples: [], totalRecorded: 0 };
    routeStore.set(route, entry);
  }

  // Rolling window: keep last MAX_SAMPLES_PER_ROUTE samples
  if (entry.samples.length >= MAX_SAMPLES_PER_ROUTE) {
    entry.samples.shift();
  }
  entry.samples.push(durationMs);
  entry.totalRecorded += 1;
}

/**
 * Measures the latency of an async handler and records it.
 * Returns the handler's result unchanged.
 *
 * Usage:
 *   const result = await measureLatency('route.name', async () => { ... });
 */
export async function measureLatency<T>(
  route: string,
  handler: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await handler();
    return result;
  } finally {
    const duration = Date.now() - start;
    recordLatency(route, duration);
  }
}

/**
 * Synchronous variant for measuring sync operations.
 */
export function measureLatencySync<T>(route: string, handler: () => T): T {
  const start = Date.now();
  try {
    return handler();
  } finally {
    const duration = Date.now() - start;
    recordLatency(route, duration);
  }
}

/**
 * Computes a percentile using the nearest-rank method.
 *
 * Nearest-rank: sort samples, take the value at ceil(percentile/100 * n) - 1.
 * For empty samples, returns 0.
 */
export function getPercentile(samples: number[], percentile: number): number {
  if (samples.length === 0) return 0;
  if (samples.length === 1) return samples[0];

  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((percentile / 100) * sorted.length);
  const index = Math.max(0, Math.min(sorted.length - 1, rank - 1));
  return sorted[index];
}

/**
 * Returns latency percentiles (p50, p95, p99) for a specific route.
 */
export function getPercentiles(route: string): {
  p50: number;
  p95: number;
  p99: number;
  samples: number;
  totalRecorded: number;
  min: number;
  max: number;
  mean: number;
} {
  const entry = routeStore.get(route);
  if (!entry || entry.samples.length === 0) {
    return {
      p50: 0,
      p95: 0,
      p99: 0,
      samples: 0,
      totalRecorded: 0,
      min: 0,
      max: 0,
      mean: 0,
    };
  }

  const samples = entry.samples;
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((acc, s) => acc + s, 0);

  return {
    p50: getPercentile(samples, 50),
    p95: getPercentile(samples, 95),
    p99: getPercentile(samples, 99),
    samples: samples.length,
    totalRecorded: entry.totalRecorded,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round((sum / samples.length) * 100) / 100,
  };
}

/**
 * Returns latency report for ALL instrumented routes.
 * Used by /api/v1/latency endpoint (ZCC-admin-gated).
 */
export function getLatencyReport(): Record<
  string,
  ReturnType<typeof getPercentiles>
> {
  const report: Record<string, ReturnType<typeof getPercentiles>> = {};
  for (const route of routeStore.keys()) {
    report[route] = getPercentiles(route);
  }
  return report;
}

/**
 * Returns list of instrumented route names.
 */
export function getInstrumentedRoutes(): string[] {
  return Array.from(routeStore.keys());
}

/**
 * Resets all samples (for testing only).
 */
export function _resetForTests(): void {
  if (process.env.NODE_ENV === 'production') {
    logger.warn('latency-tracker._resetForTests called in production — ignoring');
    return;
  }
  routeStore.clear();
}
