// ==============================================================================
// ZÉLLA — API Rate Limiter (Serverless-Safe, Upstash Redis Required in Prod)
// ==============================================================================
// Em ambiente Vercel Serverless, Map em memória NÃO FUNCIONA: cada lambda tem
// sua própria instância do Map, então 1000 requisições paralelas verão 1000
// Map's diferentes, cada um aprovando a primeira request.
//
// CORREÇÃO CRÍTICA v2:
//  - Em produção: SE Redis não configurado, rate-limit falha CLOSED (bloqueia tudo).
//    Sinaliza claramente que a configuração está quebrada.
//  - Em dev: mantém fallback em memória para DX.
//  - Usa @upstash/ratelimit pattern (INCR + PEXPIRE atômico).
// ==============================================================================

interface RatelimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export interface RatelimitInstance {
  limit: (key: string) => Promise<RatelimitResult>;
}

const CLEANUP_INTERVAL_MS = 60_000;

// ── In-memory cache (DEV ONLY — não funciona em Vercel Serverless) ──
const cache = new Map<string, { count: number; reset: number }>();
let lastCleanup = Date.now();

function parseWindow(s: string): number {
  const match = s.match(/^(\d+)\s*(ms|s|m|h)$/);
  if (!match) return 60000;
  const n = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { ms: 1, s: 1000, m: 60000, h: 3600000 };
  return n * (multipliers[unit] ?? 60000);
}

function lazyCleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of cache.entries()) {
    if (now > entry.reset) {
      cache.delete(key);
    }
  }
}

function createLocalRatelimit(requests: number, window: string): RatelimitInstance {
  const windowMs = parseWindow(window);
  return {
    limit: async (key: string): Promise<RatelimitResult> => {
      lazyCleanup();
      const now = Date.now();
      const entry = cache.get(key);
      if (!entry || now > entry.reset) {
        cache.set(key, { count: 1, reset: now + windowMs });
        return { success: true, limit: requests, remaining: requests - 1, reset: now + windowMs };
      }
      entry.count++;
      if (entry.count > requests) {
        return { success: false, limit: requests, remaining: 0, reset: entry.reset };
      }
      return { success: true, limit: requests, remaining: requests - entry.count, reset: entry.reset };
    },
  };
}

// ── Upstash Redis REST rate limiter (atomic sliding window) ──
function createUpstashRatelimit(requests: number, window: string): RatelimitInstance {
  const windowMs = parseWindow(window);
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'createUpstashRatelimit: UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN são obrigatórios. ' +
      'Configure-os no Vercel para habilitar rate limiting em produção.'
    );
  }

  return {
    limit: async (key: string): Promise<RatelimitResult> => {
      const redisKey = `rl:${key}`;

      try {
        // Pipeline atomic: INCR + PEXPIRE (set TTL apenas se for a primeira chamada)
        // Usamos pipeline para garantir atomicidade e reduzir round-trips.
        const res = await fetch(`${url}/pipeline`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            ['INCR', redisKey],
            ['PTTL', redisKey],
          ]),
          signal: AbortSignal.timeout(3000),
        });

        if (!res.ok) {
          throw new Error(`Upstash HTTP ${res.status}: ${await res.text().catch(() => 'unknown')}`);
        }

        const results = (await res.json()) as Array<{ result: number }>;
        const count = results[0]?.result ?? 1;
        const ttl = results[1]?.result ?? -1;

        // Set expiry on first request (TTL will be -1 for new keys)
        if (ttl < 0) {
          await fetch(`${url}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(['PEXPIRE', redisKey, windowMs]),
            signal: AbortSignal.timeout(2000),
          }).catch((err) => {
            // Non-fatal: a chave ainda vai expirar via lazy cleanup do Redis
            console.warn('[rate-limit] PEXPIRE falhou (non-fatal):', err);
          });
        }

        const reset = Date.now() + (ttl > 0 ? ttl : windowMs);
        const remaining = Math.max(0, requests - count);
        return {
          success: count <= requests,
          limit: requests,
          remaining,
          reset,
        };
      } catch (error) {
        // CRITICAL: em produção, fail-closed para evitar bypass.
        // Em dev, fallback gracioso para não bloquear DX.
        if (process.env.NODE_ENV === 'production') {
          console.error('[rate-limit] CRÍTICO: Upstash Redis indisponível em produção. Fail-closed.', error);
          return { success: false, limit: requests, remaining: 0, reset: Date.now() + windowMs };
        }
        console.warn('[rate-limit] Upstash indisponível em dev, usando fallback local:', error);
        return createLocalRatelimit(requests, parseWindowToWindowStr(windowMs)).limit(key);
      }
    },
  };
}

function parseWindowToWindowStr(windowMs: number): string {
  if (windowMs >= 3600000) return `${windowMs / 3600000} h`;
  if (windowMs >= 60000) return `${windowMs / 60000} m`;
  if (windowMs >= 1000) return `${windowMs / 1000} s`;
  return `${windowMs} ms`;
}

// ── Factory com fail-loud em produção ──
const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !hasRedis) {
  // Log crítico no boot — não derruba o processo mas sinaliza fortemente
  console.error(
    '═'.repeat(80) + '\n' +
    '[RATE-LIMIT] CRÍTICO: Produção sem UPSTASH_REDIS_REST_URL/TOKEN configurados.\n' +
    'Rate limiting está operando em modo DENY-ALL. Configure Upstash Redis imediatamente.\n' +
    'Docs: https://docs.upstash.com/redis/serverless-databases\n' +
    '═'.repeat(80)
  );
}

function createRatelimit(requests: number, window: string): RatelimitInstance {
  if (hasRedis) {
    return createUpstashRatelimit(requests, window);
  }
  if (isProduction) {
    // Fail-closed: bloqueia TUDO até Redis ser configurado
    return {
      limit: async (): Promise<RatelimitResult> => ({
        success: false,
        limit: 0,
        remaining: 0,
        reset: Date.now() + 60_000,
      }),
    };
  }
  // Dev mode sem Redis: fallback em memória (DX ok, sem isolamento real)
  return createLocalRatelimit(requests, window);
}

// ── Instâncias canônicas ──
// API rate: 60 req / 60s por IP (cobertura para anon)
// Auth rate: 5 req / 60s por IP (anti-brute-force de login)
// Webhook rate: 100 req / 60s por tenant (limite Meta-side é maior)
export const apiRatelimit: RatelimitInstance = createRatelimit(60, '60 s');
export const authRatelimit: RatelimitInstance = createRatelimit(5, '15 m');
export const webhookRatelimit: RatelimitInstance = createRatelimit(100, '60 s');

// ── Security alert hook (Gap 5) ──────────────────────────────────────────────
// When authRatelimit blocks a key (5 failed attempts), call bridgeSecurityAlert
// so the tenant sees a notification in their DDC. Non-blocking: errors swallowed.
//
// Usage in route handler:
//   const result = await authRatelimit.limit(key);
//   if (!result.success) await notifyRateLimitBlocked(key, 'login', request);
//
export async function notifyRateLimitBlocked(
  key: string,
  scope: 'login' | 'api' | 'webhook',
  context?: { ip?: string; tenantId?: string; reason?: string }
): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency at module load time
    const { bridgeSecurityAlert } = await import('@/lib/notifications/bridges');
    bridgeSecurityAlert({
      niche: 'all',
      ip: context?.ip ?? 'unknown',
      reason:
        context?.reason ??
        `Rate limit exceeded (${scope}) — key: ${key.slice(0, 32)}...`,
      tenantId: context?.tenantId,
    });
  } catch (err) {
    console.error('[rate-limit] notifyRateLimitBlocked error:', err);
  }
}
