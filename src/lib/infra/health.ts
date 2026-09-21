/**
 * SEUZELLA RUN11-W2 — health/readiness com exposição controlada (cronograma 11E).
 *
 * Residuais alvo (por evidência do inventário; fiação em W3):
 *   - /api/readiness e /api/brain: telemetria global exposta;
 *   - presença booleana de envs: hoje pode vazar VALORES; aqui só existe
 *     `configured: boolean` — o valor NUNCA entra no payload.
 *
 * Regras:
 *   - envs reportadas somente da ALLOWLIST explícita (default mínimo);
 *   - env fora da lista é omitida (não vira false, é AUSENTE);
 *   - checks com erro viram { ok:false } e derrubam o status para 'degraded'
 *     (nunca exceção para o chamador da rota).
 */

export type CheckFn = () => Promise<{ ok: boolean; detail?: string }>;

export interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface ReadinessPayload {
  status: 'ok' | 'degraded';
  checks: CheckResult[];
  env: Record<string, { configured: boolean }>;
}

const DEFAULT_ENV_ALLOWLIST = ['REDIS_URL', 'DATABASE_URL', 'AI_GATEWAY_TOKEN', 'LLM_API_KEY'];

const checks = new Map<string, CheckFn>();
let envAllowlist: string[] = DEFAULT_ENV_ALLOWLIST.slice();

export function registerCheck(name: string, fn: CheckFn): void {
  checks.set(name, fn);
}

/** Substitui a allowlist (chamado de config central; valores nunca são lidos aqui). */
export function setEnvAllowlist(keys: string[]): void {
  envAllowlist = Array.from(new Set(keys.filter((k) => /^[A-Z0-9_]+$/.test(k)))).sort();
}

export function getEnvAllowlist(): string[] {
  return envAllowlist.slice();
}

export async function readinessPayload(): Promise<ReadinessPayload> {
  const results: CheckResult[] = [];
  for (const [name, fn] of checks) {
    try {
      const r = await fn();
      results.push({ name, ok: r.ok === true, detail: typeof r.detail === 'string' ? r.detail.slice(0, 200) : undefined });
    } catch {
      results.push({ name, ok: false, detail: 'check_error' });
    }
  }
  const env: Record<string, { configured: boolean }> = {};
  for (const key of envAllowlist) {
    const v = process.env[key];
    env[key] = { configured: typeof v === 'string' && v.trim() !== '' };
  }
  return {
    status: results.every((r) => r.ok) ? 'ok' : 'degraded',
    checks: results,
    env,
  };
}

/** Helper para rota: status HTTP coerente com o payload (ok=200, degraded=503). */
export function readinessHttpStatus(p: ReadinessPayload): number {
  return p.status === 'ok' ? 200 : 503;
}
