// ============================================================================
// JEV — Pulso shadow do Cérebro no CRON (RUN27-A — USO REAL NO CRON)
// ============================================================================
// Primeiro chamador de PRODUÇÃO do ciclo shadow (RUN26-A): uma rota de cron
// NOVA (src/app/api/cron/jev-shadow-pulse/route.ts) aplica as proteções da
// casa com as assinaturas EXATAS extraídas pelas shapes-2 (RUN26-A):
//   - auth: requireInternalSecret (internal-secret, RUN19-A) — devolve a
//     resposta de recusa da casa INTACTA quando não autorizado;
//   - budget: tenantBudgetGuard.canUseTier(...) — chave SINTÉTICA de sistema
//     (JEV_PULSE_BUDGET_KEY; NÃO é tenant real e nunca sai do processo),
//     tier 0 e custo estimado 0 (shadow);
//   - fusível: CircuitBreaker da casa montado por SONDA fail-closed
//     (probeHouseBreaker) — a sonda NUNCA presume construtor/config; se a
//     forma real não expuser allow/recordSuccess/recordFailure, o gate fica
//     'indisponivel' e o pulso é RECUSADO (fail-closed, nunca lança);
//   - teto de tempo: timer próprio do pulso (Promise.race + clock do teste).
//     withLlmTimeout/withLlmFallback da casa EXISTEM (shapes-2), mas os
//     parâmetros não vieram nas shapes — NÃO são usados aqui (lição
//     RUN25-A: nunca adivinhar assinatura interna de módulo da casa);
//   - flags USE_TF_*: presentes no projeto (shapes-2), porém o módulo de
//     origem não foi identificado pelas shapes — NÃO são importadas aqui
//     (mesma lição). O opt-in do pulso é o parâmetro ?src= do chamador
//     autenticado apontando para o export JSONL que o DONO gerar.
//
// INVARIANTES (herdadas das ondas RUN22..RUN26):
//  - SHADOW_ONLY: shadowOnly literal true em TODA resposta;
//  - resposta só contagens — zero payload, zero tenant real, zero segredo;
//  - fail-closed em TODOS os gates; NUNCA lança (exceção vira resposta
//    tipada http 500 com reason curta — sem stack/message do erro);
//  - sem leitura direta de variáveis de ambiente (config central é
//    jev-config, lida dentro dos módulos das ondas 22/25); sem banco;
//    sem rede própria (o remoto, quando aceso, é o remotePort protegido
//    da RUN25-A, com rate-limit + cooldown 429).
// ============================================================================

import { createFileSampleSource } from './jev-cerebro-file-source';
import {
  runCerebroShadowCycle,
  type JevShadowCycleReport,
} from './jev-cerebro-shadow-loop';
import type { ActiveShadowRunnerBundle } from './jev-integration';

/** Assinatura EXATA da shapes-2 (budget-guard, TenantBudgetGuard.canUseTier). */
export interface JevBudgetGate {
  canUseTier(tenantId: string, tier: number, estimatedCost?: number, plan?: string): boolean;
}

/** Métodos EXATOS da shapes-2 (circuit-breaker) usados pelo pulso. */
export interface JevBreakerGate {
  allow(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
}

/** Chave de budget SINTÉTICA do pulso (sistema; nunca é tenant real). */
export const JEV_PULSE_BUDGET_KEY = 'jev-shadow-pulse';
/** Tier mais conservador (custo estimado zero — o pulso é shadow). */
export const JEV_PULSE_TIER = 0;
/** Teto de duração do pulso (ms) — abaixo do maxDuration=60 da rota. */
export const JEV_PULSE_TIMEOUT_MS = 25_000;
/** Cap/default de amostras por pulso (espelha os limites do ciclo RUN26-A). */
export const JEV_PULSE_MAX_SAMPLES_CAP = 500;
export const JEV_PULSE_MAX_SAMPLES_DEFAULT = 50;

// ---------------------------------------------------------------------------
// Sonda do fusível da casa (fail-closed, nunca lança, nunca presume forma)
// ---------------------------------------------------------------------------
function breakerOf(mod: unknown): JevBreakerGate | null {
  try {
    if (typeof mod !== 'object' || mod === null) return null;
    const ctor = (mod as Record<string, unknown>)['CircuitBreaker'];
    if (typeof ctor !== 'function') return null;
    const inst = new (ctor as new () => unknown)();
    if (typeof inst !== 'object' || inst === null) return null;
    const candidate = inst as Partial<JevBreakerGate>;
    if (
      typeof candidate.allow === 'function' &&
      typeof candidate.recordSuccess === 'function' &&
      typeof candidate.recordFailure === 'function'
    ) {
      return inst as JevBreakerGate;
    }
    return null;
  } catch {
    return null; // construtor divergiu => fusível indisponível (fail-closed)
  }
}

/**
 * Sonda o fusível da casa (circuit-breaker) SEM presumir o construtor:
 * dinamicamente importa o módulo, tenta construir sem argumentos e só
 * devolve o gate se os 3 métodos esperados existirem. Qualquer desvio
 * => null (o chamador recusa o pulso com reason tipado). Nunca lança.
 * modOverride: injeção para testes (nunca usado em produção).
 */
export async function probeHouseBreaker(modOverride?: unknown): Promise<JevBreakerGate | null> {
  try {
    if (modOverride !== undefined) return breakerOf(modOverride);
    const mod: unknown = await import('../../ai/circuit-breaker');
    return breakerOf(mod);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Teto de tempo do pulso (timer próprio; clock fica por conta do scheduler)
// ---------------------------------------------------------------------------
export type JevCycleOutcome =
  | { ok: true; value: JevShadowCycleReport }
  | { ok: false; timedOut: boolean };

export function withJevCycleTimeout(
  p: Promise<JevShadowCycleReport>,
  ms: number,
): Promise<JevCycleOutcome> {
  return new Promise<JevCycleOutcome>((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, timedOut: true }), ms);
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve({ ok: true, value });
      },
      () => {
        clearTimeout(timer);
        resolve({ ok: false, timedOut: false });
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Corpo/resposta do pulso — SÓ contagens (zero tenant/payload/segredo)
// ---------------------------------------------------------------------------
export interface JevShadowPulseBody {
  ok: boolean;
  wave: 'RUN27-A';
  shadowOnly: true;
  status: 'ran' | 'inert' | 'skipped';
  reason: string | null;
  breaker: 'aplicado' | 'aberto' | 'indisponivel' | null;
  budget: 'aplicado' | 'indisponivel' | 'nao-aplicado' | null;
  remoteActive: boolean | null;
  read: number | null;
  accepted: number | null;
  rejected: number | null;
  evaluated: number | null;
  remoteOk: number | null;
  agreements: number | null;
  mismatches: number | null;
  ledgerAppended: number | null;
  ledgerDuplicates: number | null;
  ledgerTotal: number | null;
  sinkWritten: number | null;
  maxSamplesCap: number;
  durationMs: number;
  timestamp: string;
}

export interface JevShadowPulseOutcome {
  http: 200 | 500;
  body: JevShadowPulseBody;
}

export interface JevShadowPulseOptions {
  /** Caminho do export JSONL (opt-in explícito do chamador autenticado). */
  src?: string | null;
  /** Teto de amostras (número ou texto cru da query; lixo => default). */
  maxSamples?: string | number | null;
  /** Gate de budget da casa (rota passa o singleton; ausente => não aplicado). */
  budget?: JevBudgetGate | null;
  /** Fusível (sonda da casa em produção; injeção nos testes). */
  breaker?: JevBreakerGate | null;
  /** Bundle pré-montado do ciclo (injeção nos testes; default: ambiente). */
  bundle?: ActiveShadowRunnerBundle | null;
  /** Ciclo alternativo (injeção nos testes; default: runCerebroShadowCycle). */
  cycle?: typeof runCerebroShadowCycle;
  /** Clock do timestamp da resposta (determinismo nos testes). */
  now?: () => number;
}

function parseMaxSamples(raw: string | number | null | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(JEV_PULSE_MAX_SAMPLES_CAP, Math.max(1, Math.floor(raw)));
  }
  if (typeof raw === 'string' && /^[0-9]{1,4}$/.test(raw.trim())) {
    return Math.min(JEV_PULSE_MAX_SAMPLES_CAP, Math.max(1, parseInt(raw.trim(), 10)));
  }
  return JEV_PULSE_MAX_SAMPLES_DEFAULT;
}

function baseBody(now: () => number): JevShadowPulseBody {
  return {
    ok: true,
    wave: 'RUN27-A',
    shadowOnly: true,
    status: 'inert',
    reason: null,
    breaker: null,
    budget: null,
    remoteActive: null,
    read: null,
    accepted: null,
    rejected: null,
    evaluated: null,
    remoteOk: null,
    agreements: null,
    mismatches: null,
    ledgerAppended: null,
    ledgerDuplicates: null,
    ledgerTotal: null,
    sinkWritten: null,
    maxSamplesCap: JEV_PULSE_MAX_SAMPLES_DEFAULT,
    durationMs: 0,
    timestamp: new Date(now()).toISOString(),
  };
}

function reportToBody(
  start: number,
  body: JevShadowPulseBody,
  report: JevShadowCycleReport,
): JevShadowPulseBody {
  return {
    ...body,
    status: report.status === 'ran' ? 'ran' : 'inert',
    reason: report.reason,
    remoteActive: report.remoteActive,
    read: report.read,
    accepted: report.accepted,
    rejected: report.rejected,
    evaluated: report.evaluated,
    remoteOk: report.remoteOk,
    agreements: report.agreements,
    mismatches: report.mismatches,
    ledgerAppended: report.ledger.appended,
    ledgerDuplicates: report.ledger.duplicates,
    ledgerTotal: report.ledger.total,
    sinkWritten: report.sink && report.sink.ok ? report.sink.written : 0,
    durationMs: Math.max(0, Date.now() - start),
  };
}

/**
 * Executa UM pulso shadow com TODOS os gates da casa. NUNCA lança.
 * Ordem dos gates (fail-closed, do mais barato ao mais caro):
 *   1. src ausente/vazio           => inert 'fonte-nao-indicada'
 *   2. fonte recusada pela fábrica => inert 'fonte-ausente'
 *   3. budget recusado             => skipped 'budget-indisponivel'
 *   4. fusível indisponível/aberto => skipped 'breaker-indisponivel'/'breaker-aberto'
 *   5. ciclo com teto de tempo     => ran | inert 'ciclo-timeout' | http 500
 */
export async function runJevShadowPulse(
  opts: JevShadowPulseOptions = {},
): Promise<JevShadowPulseOutcome> {
  const start = Date.now();
  const now = opts.now ?? (() => Date.now());
  const body = baseBody(now);
  body.maxSamplesCap = parseMaxSamples(opts.maxSamples);
  try {
    const srcRaw = typeof opts.src === 'string' ? opts.src.trim() : '';
    if (srcRaw === '') {
      return { http: 200, body: { ...body, reason: 'fonte-nao-indicada' } };
    }
    const source = createFileSampleSource(srcRaw);
    if (source === null) {
      return { http: 200, body: { ...body, reason: 'fonte-ausente' } };
    }

    // Gate de budget (assinatura exata da shapes-2; custo estimado zero).
    if (opts.budget) {
      body.budget = opts.budget.canUseTier(JEV_PULSE_BUDGET_KEY, JEV_PULSE_TIER, 0)
        ? 'aplicado'
        : 'indisponivel';
      if (body.budget === 'indisponivel') {
        return {
          http: 200,
          body: { ...body, status: 'skipped', reason: 'budget-indisponivel' },
        };
      }
    } else {
      body.budget = 'nao-aplicado';
    }

    // Gate do fusível (sonda fail-closed quando produção não injeta).
    const breaker = opts.breaker !== undefined ? opts.breaker : await probeHouseBreaker();
    if (breaker === null) {
      return {
        http: 200,
        body: { ...body, status: 'skipped', reason: 'breaker-indisponivel' },
      };
    }
    body.breaker = 'aplicado';
    if (!breaker.allow()) {
      return {
        http: 200,
        body: { ...body, status: 'skipped', reason: 'breaker-aberto' },
      };
    }

    // Ciclo shadow (RUN26-A) com teto de tempo próprio.
    const cycleFn = opts.cycle ?? runCerebroShadowCycle;
    const outcome = await withJevCycleTimeout(
      cycleFn({
        source,
        bundle: opts.bundle ?? undefined,
        maxSamples: body.maxSamplesCap,
      }),
      JEV_PULSE_TIMEOUT_MS,
    );

    if (!outcome.ok) {
      breaker.recordFailure();
      return outcome.timedOut
        ? { http: 200, body: { ...body, status: 'inert', reason: 'ciclo-timeout' } }
        : {
            http: 500,
            body: { ...body, ok: false, status: 'inert', reason: 'excecao-no-ciclo' },
          };
    }
    breaker.recordSuccess();
    return { http: 200, body: reportToBody(start, body, outcome.value) };
  } catch {
    return {
      http: 500,
      body: { ...body, ok: false, status: 'inert', reason: 'excecao-no-pulso' },
    };
  }
}
