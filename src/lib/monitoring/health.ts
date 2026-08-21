/**
 * Monitoring Service — health check + uptime + métricas
 */

import { db } from '@/lib/db';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs?: number;
  message?: string;
  timestamp: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  checks: HealthCheckResult[];
  timestamp: string;
  version: string;
  uptime: string;
}

const APP_VERSION = process.env.npm_package_version || '0.2.0';
const START_TIME = Date.now();

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    if (!db) {
      return { service: 'database', status: 'degraded', message: 'DB unavailable', latencyMs: 0, timestamp: new Date().toISOString() };
    }
    await (db as any).$queryRaw`SELECT 1`;
    return { service: 'database', status: 'healthy', latencyMs: Date.now() - start, timestamp: new Date().toISOString() };
  } catch (err) {
    console.error('[Health] Database check failed:', err instanceof Error ? err.name : 'unknown');
    return { service: 'database', status: 'down', message: 'Database check failed', latencyMs: Date.now() - start, timestamp: new Date().toISOString() };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return { service: 'redis', status: 'degraded', message: 'Redis not configured', latencyMs: 0, timestamp: new Date().toISOString() };
    }
    const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      signal: AbortSignal.timeout(2000),
    });
    return res.ok
      ? { service: 'redis', status: 'healthy', latencyMs: Date.now() - start, timestamp: new Date().toISOString() }
      : { service: 'redis', status: 'down', message: `HTTP ${res.status}`, latencyMs: Date.now() - start, timestamp: new Date().toISOString() };
  } catch (err) {
    console.error('[Health] Redis check failed:', err instanceof Error ? err.name : 'unknown');
    return { service: 'redis', status: 'down', message: 'Redis check failed', latencyMs: Date.now() - start, timestamp: new Date().toISOString() };
  }
}

async function checkLLM(): Promise<HealthCheckResult> {
  const start = Date.now();
  if (!process.env.ZAI_API_KEY) {
    return { service: 'llm', status: 'degraded', message: 'LLM provider not configured', latencyMs: 0, timestamp: new Date().toISOString() };
  }
  return { service: 'llm', status: 'healthy', message: 'Provider configured', latencyMs: Date.now() - start, timestamp: new Date().toISOString() };
}

async function checkMercadoPago(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return { service: 'mercadopago', status: 'degraded', message: 'Mercado Pago not configured', latencyMs: 0, timestamp: new Date().toISOString() };
    }
    const res = await fetch('https://api.mercadopago.com/v1/account', {
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(3000),
    });
    return {
      service: 'mercadopago',
      status: res.ok ? 'healthy' : 'down',
      message: res.ok ? undefined : `HTTP ${res.status}`,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[Health] Mercado Pago check failed:', err instanceof Error ? err.name : 'unknown');
    return { service: 'mercadopago', status: 'down', message: 'Mercado Pago check failed', latencyMs: Date.now() - start, timestamp: new Date().toISOString() };
  }
}

export async function checkSystemHealth(): Promise<SystemHealth> {
  const [database, redis, llm, mercadopago] = await Promise.all([
    checkDatabase(), checkRedis(), checkLLM(), checkMercadoPago(),
  ]);

  const checks = [database, redis, llm, mercadopago];
  const isProd = process.env.NODE_ENV === 'production';
  const isEssentialDown = database.status === 'down' || (isProd && database.status === 'degraded');
  const isRedisDownInProd = isProd && (redis.status === 'down' || redis.status === 'degraded');
  const hasDown = checks.some(c => c.status === 'down') || isEssentialDown || isRedisDownInProd;
  const hasDegraded = checks.some(c => c.status === 'degraded');
  const status: 'healthy' | 'degraded' | 'down' = hasDown ? 'down' : hasDegraded ? 'degraded' : 'healthy';

  return {
    status,
    checks,
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
    uptime: formatUptime(Date.now() - START_TIME),
  };
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

export async function getMetrics(): Promise<{
  timestamp: string;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, number[]>;
}> {
  return {
    timestamp: new Date().toISOString(),
    counters: { requests_total: 0, errors_total: 0, webhooks_received: 0 },
    gauges: { active_connections: 0, db_pool_size: 0, redis_memory_mb: 0 },
    histograms: { response_time_ms: [], llm_latency_ms: [] },
  };
}
