// ============================================================================
// JEV — Fiação de integração do caminho remoto (RUN25-A — INTEGRAÇÃO TYPESAFE)
// ============================================================================
// Peça que FALTA para o remotePort acender com segurança: um único ponto que
// (a) expõe o ESTADO da integração (só booleanos/config — NUNCA o valor da
// chave), e (b) monta um JevShadowRunner com remotePort PROTEGIDO
// (rate-limit + 429 cooldown, ver jev-remote-rate-limit.ts) QUANDO o ambiente
// está aceso, ou com remotePort null (comportamento atual, fail-closed)
// quando não está.
//
// COMO ACENDER (decisão do DONO, no .env.local do iMac — a chave NUNCA
// transitou por chat/kit/log):
//   TYPESAFE_API_KEY=<chave do dono>   (presença vira booleano em jev-config)
//   JEV_ENABLED=true
//   SSRF_ALLOWLIST=api.typesafe.ai     (host do endpoint precisa estar liberado
//                                       no guard da casa — JEV_ENV_CONTRACT)
// Sem as três: remoto inerte (JEV_DISABLED/JEV_KEY_MISSING/JEV_SSRF_BLOCKED),
// heurística local segue decidindo em shadow — NADA quebra.
//
// NÃO lê variáveis de ambiente diretamente (usa getJevConfig/jevAvailable de
// jev-config.ts). Nada em produção chama este módulo ainda — a onda de
// FIAÇÃO no Cérebro passará a chamar createActiveShadowRunner num arquivo
// novo, sem editar código existente. SHADOW_ONLY é invariante: shadowOnly
// é literal true em toda resposta (tipos da RUN22-A).
// ============================================================================

import type { IJevDecisionPort } from '../../../domain/decision/ports/IJevDecisionPort';
import { JevShadowRunner, type JevShadowRunnerOptions } from './jev-shadow';
import { getJevConfig, jevAvailable, type JevConfig } from './jev-config';
import {
  createRateLimitedTypesafePort,
  JevRemoteRateLimiter,
  type JevRemoteRateLimitOptions,
  type JevRemoteRateLimitStats,
} from './jev-remote-rate-limit';

/** As 3 chaves do acendimento (contrato RUN25-A). O VALOR de nenhuma delas
 * é lido/coletado por kits ou digest — presença apenas. */
export const JEV_INTEGRATION_ENV_KEYS = [
  'TYPESAFE_API_KEY',
  'JEV_ENABLED',
  'SSRF_ALLOWLIST',
] as const;

export interface JevIntegrationStatus {
  /** JEV_ENABLED === 'true' (jev-config). */
  enabled: boolean;
  /** TYPESAFE_API_KEY presente (valor nunca sai de jev-config). */
  keyPresent: boolean;
  /** SHADOW_ONLY é invariante — sempre true (guard RUN22-A). */
  shadowMode: boolean;
  /** enabled && keyPresent && shadowMode — o remoto pode ser montado. */
  remoteActive: boolean;
  /** Host da base URL (não é segredo) — para o dono conferir a allowlist. */
  baseUrlHost: string | null;
  /** Config efetiva do limiter de saída. */
  limiter: { maxPerWindow: number; windowMs: number; cooldownMs: number };
}

function hostOfUrl(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

/** Estado da integração — puro/injetável (nada de segredo no retorno). */
export function getJevIntegrationStatus(
  cfg: JevConfig = getJevConfig(),
  limiterOptions?: JevRemoteRateLimitOptions,
): JevIntegrationStatus {
  return {
    enabled: cfg.enabled,
    keyPresent: cfg.typesafeKeyPresent,
    shadowMode: cfg.shadowMode,
    remoteActive: jevAvailable(cfg),
    baseUrlHost: hostOfUrl(cfg.baseUrl),
    limiter: {
      maxPerWindow: clampOf(limiterOptions?.maxPerWindow, 1, 1000, 30),
      windowMs: clampOf(limiterOptions?.windowMs, 1000, 3_600_000, 60_000),
      cooldownMs: clampOf(limiterOptions?.cooldownMs, 0, 600_000, 60_000),
    },
  };
}

export interface ActiveShadowRunnerBundle {
  runner: JevShadowRunner;
  status: JevIntegrationStatus;
  /** IJevDecisionPort | null — null = remoto inerte (fail-closed estrutural). */
  remotePort: IJevDecisionPort | null;
  /** Limiter do caminho remoto (null quando o remoto está inerte). */
  limiter: JevRemoteRateLimiter | null;
}

export interface CreateActiveShadowRunnerOptions {
  /** Limiter pré-montado (senão um novo com limiterOptions). */
  limiter?: JevRemoteRateLimiter;
  /** Opções do limiter interno (default da casa: 30/min, cooldown 60s). */
  limiterOptions?: JevRemoteRateLimitOptions;
  /** Opções repassadas ao runner (localPort/capacity — testes). */
  runnerOptions?: Omit<JevShadowRunnerOptions, 'remotePort'>;
  /** Override da base URL do endpoint remoto (default: config da casa). */
  baseUrl?: string;
  /** Fetch injetável — testes NUNCA usam rede real. */
  fetchImpl?: (input: string, init: RequestInit) => Promise<Response>;
}

/**
 * Monta o runner shadow do estado ATUAL do ambiente:
 *  - aceso  -> runner com remotePort protegido (limiter + 429 cooldown);
 *  - apagado-> runner só-local (remotePort null) — comportamento idêntico
 *              ao das ondas RUN22..RUN24.
 * Nunca lança. O chamador decide QUANDO usar (nada chama em produção ainda).
 */
export function createActiveShadowRunner(
  opts?: CreateActiveShadowRunnerOptions,
): ActiveShadowRunnerBundle {
  const cfg: JevConfig = getJevConfig();
  const remoteActive = jevAvailable(cfg);
  const status: JevIntegrationStatus = {
    enabled: cfg.enabled,
    keyPresent: cfg.typesafeKeyPresent,
    shadowMode: cfg.shadowMode,
    remoteActive,
    baseUrlHost: hostOfUrl(cfg.baseUrl),
    limiter: {
      maxPerWindow: clampOf(opts?.limiterOptions?.maxPerWindow, 1, 1000, 30),
      windowMs: clampOf(opts?.limiterOptions?.windowMs, 1000, 3_600_000, 60_000),
      cooldownMs: clampOf(opts?.limiterOptions?.cooldownMs, 0, 600_000, 60_000),
    },
  };
  const runnerOpts: JevShadowRunnerOptions = { ...(opts?.runnerOptions ?? {}) };
  if (!remoteActive) {
    return { runner: new JevShadowRunner({ ...runnerOpts, remotePort: null }), status, remotePort: null, limiter: null };
  }
  const bundle = createRateLimitedTypesafePort({
    limiter: opts?.limiter,
    limiterOptions: opts?.limiterOptions,
    baseUrl: opts?.baseUrl,
    fetchImpl: opts?.fetchImpl,
  });
  // remoteActive true => bundle não é null (mesma config); guard defensivo.
  if (bundle === null) {
    return { runner: new JevShadowRunner({ ...runnerOpts, remotePort: null }), status, remotePort: null, limiter: null };
  }
  const runner = new JevShadowRunner({ ...runnerOpts, remotePort: bundle.port });
  return { runner, status, remotePort: bundle.port, limiter: bundle.limiter };
}

function clampOf(raw: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

/** Tipo utilitário p/ consumidores futuros (fiação): stats do limiter. */
export type JevIntegrationLimiterStats = JevRemoteRateLimitStats;
