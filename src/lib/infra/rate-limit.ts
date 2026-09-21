/**
 * SEUZELLA RUN11-W2 — rate limiter com semântica fail-closed (cronograma 11B).
 *
 * Regra do cronograma: "rate limit unavailable" NUNCA pode virar proteção
 * falsa. Portanto:
 *   - modo 'closed' (default): loja indisponível => NEGAR (reason=STORE_UNAVAILABLE);
 *   - modo 'open' ....: só com RATE_LIMIT_FAIL_MODE=open explícito (anti-padrão
 *     documentado; emite WARN único no boot do limiter).
 *
 * Janela fixa por chave (tenant|user|ip|route) com poda periódica.
 * Loja é in-process; driver distribuído (Redis) fica para o W3 se o
 * inventário W1 justificar — a semântica fail-closed não muda.
 */
import { warnOnce } from './optional-require';

export interface RateLimitPolicy {
  points: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  reason: 'OK' | 'LIMIT_EXCEEDED' | 'STORE_UNAVAILABLE';
}

export type RateLimitFailMode = 'closed' | 'open';

export function rateLimitKey(parts: { tenantId?: string; userId?: string; ip?: string; route?: string }): string {
  return [
    parts.tenantId ? `t:${parts.tenantId}` : null,
    parts.userId ? `u:${parts.userId}` : null,
    parts.ip ? `ip:${parts.ip}` : null,
    parts.route ? `r:${parts.route}` : null,
  ]
    .filter((x): x is string => x !== null)
    .join('|');
}

const WARN_STATE = new Map<string, boolean>();

interface WindowState {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private windows = new Map<string, WindowState>();
  private storeUnavailable = false;
  private checksSinceSweep = 0;
  readonly failMode: RateLimitFailMode;

  constructor(failMode?: RateLimitFailMode) {
    const fromEnv = process.env.RATE_LIMIT_FAIL_MODE;
    this.failMode = failMode ?? (fromEnv === 'open' ? 'open' : 'closed');
    if (this.failMode === 'open') {
      warnOnce(
        'ratelimit.failmode',
        'RATE_LIMIT_FAIL_MODE=open: loja indisponivel LIBERA trafego (anti-padrao). Prefira closed.',
        WARN_STATE,
      );
    }
  }

  /** Simula/propaga degradação da loja (usado por testes e por falhas internas). */
  setStoreUnavailable(unavailable: boolean): void {
    this.storeUnavailable = unavailable;
  }

  check(key: string, policy: RateLimitPolicy): RateLimitDecision {
    if (policy.points <= 0 || policy.windowMs <= 0) {
      // política inválida é tratada como degradação de configuração: fail-closed
      return this.degradedDecision(0);
    }
    if (this.storeUnavailable) return this.degradedDecision(0);

    try {
      const now = Date.now();
      this.sweepIfNeeded(now);
      const w = this.windows.get(key);
      if (!w || now - w.windowStart >= policy.windowMs) {
        this.windows.set(key, { count: 1, windowStart: now });
        return { allowed: true, remaining: policy.points - 1, resetAt: now + policy.windowMs, reason: 'OK' };
      }
      if (w.count < policy.points) {
        w.count += 1;
        return {
          allowed: true,
          remaining: policy.points - w.count,
          resetAt: w.windowStart + policy.windowMs,
          reason: 'OK',
        };
      }
      return { allowed: false, remaining: 0, resetAt: w.windowStart + policy.windowMs, reason: 'LIMIT_EXCEEDED' };
    } catch {
      this.storeUnavailable = true;
      return this.degradedDecision(0);
    }
  }

  stats(): { keys: number; storeUnavailable: boolean; failMode: RateLimitFailMode } {
    return { keys: this.windows.size, storeUnavailable: this.storeUnavailable, failMode: this.failMode };
  }

  private degradedDecision(resetAt: number): RateLimitDecision {
    if (this.failMode === 'open') {
      return { allowed: true, remaining: -1, resetAt, reason: 'STORE_UNAVAILABLE' };
    }
    return { allowed: false, remaining: 0, resetAt, reason: 'STORE_UNAVAILABLE' };
  }

  private sweepIfNeeded(now: number): void {
    this.checksSinceSweep += 1;
    if (this.checksSinceSweep < 1000) return;
    this.checksSinceSweep = 0;
    for (const [k, w] of this.windows) {
      if (now - w.windowStart > 3600_000) this.windows.delete(k);
    }
  }
}

let singleton: RateLimiter | null = null;
export function getRateLimiter(): RateLimiter {
  if (!singleton) singleton = new RateLimiter();
  return singleton;
}
