// ============================================================================
// JEV — Contrato de variáveis de ambiente (RUN22-A — JEV_ENV_CONTRACT v1)
// ============================================================================
// 7 chaves contratuais da diretiva JEV MASTER + 1 opcional documentada:
//   TYPESAFE_API_KEY (opcional p/ shadow; presença booleana — valor NUNCA
//     logado nem exposto), JEV_ENABLED (default false — fail-closed),
//     JEV_SHADOW_MODE (default true; 'false' é IGNORADO nesta onda — SHADOW
//     é invariante de compilação), JEV_MODEL, JEV_TIMEOUT_MS, JEV_MAX_RETRIES,
//     JEV_DEFAULT_CONFIDENCE_THRESHOLD, JEV_TYPESAFE_BASE_URL (opcional).
// Toda leitura é defensiva: valor sujo/fora de faixa -> default seguro.
// A função readJevConfig é PURA (env injetável) — testável sem tocar process.
// ============================================================================

export interface JevConfig {
  enabled: boolean;
  shadowMode: boolean;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  confidenceThreshold: number;
  /** true apenas se TYPESAFE_API_KEY estiver presente (valor nunca sai daqui). */
  typesafeKeyPresent: boolean;
  baseUrl: string;
}

export const JEV_DEFAULTS = {
  model: 'jev-1',
  timeoutMs: 8000,
  maxRetries: 1,
  confidenceThreshold: 0.7,
  baseUrl: 'https://api.typesafe.ai',
  minTimeoutMs: 100,
  maxTimeoutMs: 60000,
  minRetries: 0,
  maxRetriesCap: 5,
} as const;

function clampInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampFloat(raw: string | undefined, min: number, max: number, fallback: number): number {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback;
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Versão pura/injetável — use em testes e workers com env própria. */
export function readJevConfig(env: Record<string, string | undefined> = process.env): JevConfig {
  const enabled = env.JEV_ENABLED === 'true';
  // SHADOW_ONLY (onda RUN22-A): shadowMode só pode ser true. JEV_SHADOW_MODE
  // 'false' NÃO desliga o shadow — a flag é ignorada e a onda permanece shadow.
  const shadowMode = true;
  const model =
    typeof env.JEV_MODEL === 'string' && env.JEV_MODEL.trim() !== ''
      ? env.JEV_MODEL.trim().slice(0, 64)
      : JEV_DEFAULTS.model;
  const timeoutMs = clampInt(
    env.JEV_TIMEOUT_MS,
    JEV_DEFAULTS.minTimeoutMs,
    JEV_DEFAULTS.maxTimeoutMs,
    JEV_DEFAULTS.timeoutMs,
  );
  const maxRetries = clampInt(
    env.JEV_MAX_RETRIES,
    JEV_DEFAULTS.minRetries,
    JEV_DEFAULTS.maxRetriesCap,
    JEV_DEFAULTS.maxRetries,
  );
  const confidenceThreshold = clampFloat(
    env.JEV_DEFAULT_CONFIDENCE_THRESHOLD,
    0,
    1,
    JEV_DEFAULTS.confidenceThreshold,
  );
  const typesafeKeyPresent =
    typeof env.TYPESAFE_API_KEY === 'string' && env.TYPESAFE_API_KEY.length > 0;
  const baseUrl =
    typeof env.JEV_TYPESAFE_BASE_URL === 'string' && env.JEV_TYPESAFE_BASE_URL.trim() !== ''
      ? env.JEV_TYPESAFE_BASE_URL.trim()
      : JEV_DEFAULTS.baseUrl;
  return {
    enabled,
    shadowMode,
    model,
    timeoutMs,
    maxRetries,
    confidenceThreshold,
    typesafeKeyPresent,
    baseUrl,
  };
}

let cached: JevConfig | null = null;

/** Singleton memoizado para uso em runtime (rotas/cron). */
export function getJevConfig(): JevConfig {
  if (cached === null) {
    cached = readJevConfig();
  }
  return cached;
}

/** Apenas para testes — invalida o cache do singleton. */
export function resetJevConfigCache(): void {
  cached = null;
}

/** Valor da chave SOMENTE para uso interno do adapter remoto no momento da
 * chamada. NUNCA logar, NUNCA serializar, NUNCA retornar em resposta. */
export function readTypesafeKey(env: Record<string, string | undefined> = process.env): string | null {
  const key = env.TYPESAFE_API_KEY;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

/** JEV está utilizável? Fail-closed por construção: exige flag ligada, chave
 * presente E shadow ativo (nesta onda, shadow é sempre true — ver acima). */
export function jevAvailable(cfg: JevConfig = getJevConfig()): boolean {
  return cfg.enabled && cfg.typesafeKeyPresent && cfg.shadowMode;
}
