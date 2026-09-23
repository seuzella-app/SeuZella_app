// ============================================================================
// JEV — Rate-limit do caminho remoto (RUN25-A — INTEGRAÇÃO TYPESAFE)
// ============================================================================
// 6ª onda da diretiva "SEU ZÉLLA — JEV MASTER IMPLEMENTATION": a onda que
// ACENDE o caminho remoto com PROTEÇÃO. O adapter TypeSafe (RUN22-A) já é
// fail-closed por chamada; esta onda adiciona a proteção de VOLUME e a
// fábrica que monta o remotePort pronto para produção:
//
//   - JevRemoteRateLimiter — janela deslizante em memória + cooldown pós-429,
//     clock INJETÁVEL (determinismo em teste). Puro: NÃO lê env, NÃO faz I/O.
//   - JevRateLimitedPort — decorator de IJevDecisionPort: sem permissão do
//     limiter, NEM chama o inner (fail-closed; resposta tipada 'unavailable').
//   - createRateLimitedTypesafePort — fábrica que só devolve porta quando
//     jevAvailable() é true (flag + chave + shadow); envolve o fetch para
//     detectar 429 e alimentar o cooldown. null = remoto inerte.
//
// NOTA DE CONTRATO: a união JevUnavailableReason (JevTypes.ts, RUN22-A) é
// FECHADA e NÃO é editada nesta onda (princípio aditivo). Quando o limiter
// recusa, a resposta usa 'JEV_REMOTE_ERROR' — semântica correta (o remoto
// não atendeu) — e a CAUSA real fica nos stats do limiter (deniedByLimiter),
// expostos no relatório da onda e futuramente no ledger.
//
// NÃO lê variáveis de ambiente (a leitura de config continua centralizada em
// jev-config.ts, onda RUN22-A). Nada em produção chama esta onda ainda: a
// fiação no Cérebro usará createActiveShadowRunner (jev-integration.ts).
// ============================================================================

import type {
  JevDecisionRequest,
  JevDecisionResponse,
  JevDecisionSource,
} from '../../../domain/decision/contracts/JevTypes';
import type { IJevDecisionPort } from '../../../domain/decision/ports/IJevDecisionPort';
import { jevAvailable } from './jev-config';
import { JevTypesafeAdapter } from '../../../domain/decision/adapters/JevTypesafeAdapter';

// ---------------------------------------------------------------------------
// Limiter — janela deslizante + cooldown (clock injetável)
// ---------------------------------------------------------------------------

export interface JevRemoteRateLimitOptions {
  /** Chamadas admitidas por janela (default 30, clamp [1..1000]). */
  maxPerWindow?: number;
  /** Tamanho da janela em ms (default 60_000, clamp [1_000..3_600_000]). */
  windowMs?: number;
  /** Cooldown aplicado após um 429 do endpoint (default 60_000, clamp [0..600_000]). */
  cooldownMs?: number;
  /** Clock injetável — default Date.now (testes passam relógio fake). */
  now?: () => number;
}

export interface JevRemoteRateLimitStats {
  admitted: number;
  deniedByLimiter: number;
  limitedResponses: number;
  cooldownUntil: number | null;
  cooldownActive: boolean;
}

export interface JevRemoteRateLimitDecision {
  allowed: boolean;
  /** Quanto esperar para tentar de novo (>0 quando denied). */
  retryAfterMs: number;
}

const CLAMPS = {
  minPerWindow: 1,
  maxPerWindowCap: 1000,
  minWindowMs: 1000,
  maxWindowMs: 3_600_000,
  minCooldownMs: 0,
  maxCooldownMs: 600_000,
  maxRetryAfterHintMs: 300_000,
} as const;

function clampInt(raw: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

export class JevRemoteRateLimiter {
  private readonly maxPerWindow: number;
  private readonly windowMs: number;
  private readonly cooldownMs: number;
  private readonly nowFn: () => number;
  private readonly window: number[] = [];
  private cooldownUntil = 0;
  private admittedCount = 0;
  private deniedCount = 0;
  private limitedResponses = 0;

  constructor(opts?: JevRemoteRateLimitOptions) {
    this.maxPerWindow = clampInt(
      opts?.maxPerWindow,
      CLAMPS.minPerWindow,
      CLAMPS.maxPerWindowCap,
      30,
    );
    this.windowMs = clampInt(opts?.windowMs, CLAMPS.minWindowMs, CLAMPS.maxWindowMs, 60_000);
    this.cooldownMs = clampInt(opts?.cooldownMs, CLAMPS.minCooldownMs, CLAMPS.maxCooldownMs, 60_000);
    this.nowFn = typeof opts?.now === 'function' ? opts.now : () => Date.now();
  }

  /** Pede permissão para UMA chamada remota. Nunca lança. */
  admit(): JevRemoteRateLimitDecision {
    const now = this.nowFn();
    // 1) cooldown pós-429 tem precedência sobre a janela.
    if (now < this.cooldownUntil) {
      this.deniedCount += 1;
      return { allowed: false, retryAfterMs: this.cooldownUntil - now };
    }
    // 2) janela deslizante: descarta timestamps fora da janela.
    const cutoff = now - this.windowMs;
    while (this.window.length > 0 && this.window[0] <= cutoff) {
      this.window.shift();
    }
    if (this.window.length >= this.maxPerWindow) {
      this.deniedCount += 1;
      const oldest = this.window[0];
      return { allowed: false, retryAfterMs: Math.max(1, oldest + this.windowMs - now) };
    }
    this.window.push(now);
    this.admittedCount += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  /** Registra que o endpoint devolveu 429 (Retry-After respeitado se válido). */
  noteRemoteLimited(retryAfterHintMs?: number): void {
    this.limitedResponses += 1;
    const now = this.nowFn();
    const hint =
      typeof retryAfterHintMs === 'number' &&
      Number.isFinite(retryAfterHintMs) &&
      retryAfterHintMs > 0
        ? Math.min(retryAfterHintMs, CLAMPS.maxRetryAfterHintMs)
        : this.cooldownMs;
    const candidate = now + hint;
    this.cooldownUntil = Math.max(this.cooldownUntil, candidate);
  }

  stats(): JevRemoteRateLimitStats {
    const now = this.nowFn();
    return {
      admitted: this.admittedCount,
      deniedByLimiter: this.deniedCount,
      limitedResponses: this.limitedResponses,
      cooldownUntil: this.cooldownUntil > 0 ? this.cooldownUntil : null,
      cooldownActive: now < this.cooldownUntil,
    };
  }
}

// ---------------------------------------------------------------------------
// Decorator — IJevDecisionPort protegido pelo limiter
// ---------------------------------------------------------------------------

export class JevRateLimitedPort implements IJevDecisionPort {
  readonly source: JevDecisionSource;
  readonly limiter: JevRemoteRateLimiter;
  private readonly inner: IJevDecisionPort;

  constructor(inner: IJevDecisionPort, limiter: JevRemoteRateLimiter) {
    this.inner = inner;
    this.limiter = limiter;
    this.source = inner.source;
  }

  async decide(request: JevDecisionRequest): Promise<JevDecisionResponse> {
    const startedAt = Date.now();
    const gate = this.limiter.admit();
    if (!gate.allowed) {
      // Fail-closed: sem permissão, o inner NEM é chamado. A razão usa a
      // união FECHADA existente (nada é editado em JevTypes.ts); a causa
      // real fica nos stats do limiter.
      return {
        status: 'unavailable',
        mode: request.mode,
        reason: 'JEV_REMOTE_ERROR',
        shadowOnly: true,
        latencyMs: Date.now() - startedAt,
      };
    }
    return this.inner.decide(request);
  }
}

// ---------------------------------------------------------------------------
// Fábrica — remotePort TypeSafe PROTEGIDO (ou null = inerte, fail-closed)
// ---------------------------------------------------------------------------

type FetchImpl = (input: string, init: RequestInit) => Promise<Response>;

function parseRetryAfterMs(headers: Headers | undefined): number | undefined {
  try {
    const raw = headers?.get('retry-after');
    if (typeof raw !== 'string' || raw.trim() === '') return undefined;
    const seconds = Number.parseInt(raw, 10);
    if (Number.isNaN(seconds) || seconds <= 0) return undefined;
    return seconds * 1000;
  } catch {
    return undefined;
  }
}

export interface JevRateLimitedPortBundle {
  port: IJevDecisionPort;
  limiter: JevRemoteRateLimiter;
}

export interface CreateRateLimitedTypesafePortOptions {
  /** Reusa um limiter existente (senão um novo é criado). */
  limiter?: JevRemoteRateLimiter;
  /** Opções para o limiter criado internamente (ignorado se `limiter` dado). */
  limiterOptions?: JevRemoteRateLimitOptions;
  /** Override da base URL do endpoint (default: config da casa). */
  baseUrl?: string;
  /** Fetch injetável — testes NUNCA usam rede real. Default: globalThis.fetch. */
  fetchImpl?: FetchImpl;
}

/**
 * Monta o remotePort TypeSafe COM proteção de volume. Fail-closed estrutural:
 * sem JEV_ENABLED=true + TYPESAFE_API_KEY + shadow ativo, devolve null — o
 * runner trata null como "sem remoto" e nada muda no comportamento atual.
 * O fetch é envolvido para detectar 429 e alimentar o cooldown do limiter.
 */
export function createRateLimitedTypesafePort(
  opts?: CreateRateLimitedTypesafePortOptions,
): JevRateLimitedPortBundle | null {
  if (!jevAvailable()) return null;
  const limiter = opts?.limiter ?? new JevRemoteRateLimiter(opts?.limiterOptions);
  const baseFetch: FetchImpl =
    typeof opts?.fetchImpl === 'function'
      ? opts.fetchImpl
      : (input: string, init: RequestInit) => globalThis.fetch(input, init);
  // Wrapper 429: o adapter colapsa 429 em JEV_REMOTE_ERROR; aqui a resposta
  // passa INTACTA (o corpo não é consumido) e o limiter registra o cooldown.
  const fetchWith429: FetchImpl = async (input, init) => {
    const response = await baseFetch(input, init);
    if (response && response.status === 429) {
      limiter.noteRemoteLimited(parseRetryAfterMs(response.headers));
    }
    return response;
  };
  const adapterOpts: { baseUrl?: string; fetchImpl?: FetchImpl } = { fetchImpl: fetchWith429 };
  if (typeof opts?.baseUrl === 'string' && opts.baseUrl.length > 0) {
    adapterOpts.baseUrl = opts.baseUrl;
  }
  const adapter = new JevTypesafeAdapter(adapterOpts);
  return { port: new JevRateLimitedPort(adapter, limiter), limiter };
}
