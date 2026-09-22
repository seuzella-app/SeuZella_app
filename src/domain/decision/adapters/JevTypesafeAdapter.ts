// ============================================================================
// JEV — Adapter REMOTO TypeSafe (System One / Jev) — RUN22-A, INATIVO
// ============================================================================
// Este adapter é o preenchimento do slot que o RECON RUN20-A revelou ausente
// (ProviderAdapter NOT_FOUND). Ele NÃO roda nesta onda: sem TYPESAFE_API_KEY
// ou com JEV_ENABLED != 'true', toda chamada devolve 'unavailable' (fail-
// closed). Quando a onda de integração chegar, o formato exato do endpoint
// será confirmado com a conta do dono (SDK oficial @typesafe-ai/sdk ou
// endpoint compatível) — até lá, o parser espera a forma provisória
// { decisions: [{ label, confidence }] } e recusa QUALQUER desvio.
//
// Reuso da casa confirmado pelo SHAPES (assinaturas exatas no digest):
//   - ssrfGuard() de src/lib/infra/ssrf-guard.ts bloqueia host fora da
//     allowlist (Response != null => indisponível, nunca prossegue);
//   - timeout/retry próprios (JEV_TIMEOUT_MS / JEV_MAX_RETRIES) — a fiação
//     com circuit-breaker/budget-guard reais fica para a onda de integração,
//     com os blocos exatos já extraídos no digest SHAPES.
// ============================================================================

import type {
  JevDecisionMode,
  JevDecisionRequest,
  JevDecisionResponse,
  JevDecisionSource,
  JevUnavailableReason,
} from '../contracts/JevTypes';
import type { IJevDecisionPort } from '../ports/IJevDecisionPort';
import { getJevConfig, readTypesafeKey, type JevConfig } from '../../../lib/ai/jev/jev-config';
import { sanitizeJevPayload } from '../../../lib/ai/jev/jev-pii-firewall';
import { ssrfGuard } from '../../../lib/infra/ssrf-guard';

interface TypesafeDecisionItem {
  label: string;
  confidence: number;
}

interface TypesafeWireResponse {
  decisions?: unknown;
}

type FetchImpl = (input: string, init: RequestInit) => Promise<Response>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDecisions(body: unknown): TypesafeDecisionItem[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = (body as TypesafeWireResponse).decisions;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: TypesafeDecisionItem[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null;
    const rec = item as Record<string, unknown>;
    if (typeof rec.label !== 'string' || rec.label.length === 0) return null;
    if (typeof rec.confidence !== 'number' || !Number.isFinite(rec.confidence)) return null;
    out.push({
      label: rec.label.slice(0, 64),
      confidence: Math.min(1, Math.max(0, rec.confidence)),
    });
  }
  return out;
}

export class JevTypesafeAdapter implements IJevDecisionPort {
  readonly source: JevDecisionSource = 'jev-typesafe';

  private readonly baseUrlOverride: string | null;
  private readonly fetchImpl: FetchImpl;

  constructor(opts?: { baseUrl?: string; fetchImpl?: FetchImpl }) {
    this.baseUrlOverride = typeof opts?.baseUrl === 'string' ? opts.baseUrl : null;
    this.fetchImpl =
      typeof opts?.fetchImpl === 'function'
        ? opts.fetchImpl
        : (input: string, init: RequestInit) => globalThis.fetch(input, init);
  }

  private unavailable(mode: JevDecisionMode, reason: JevUnavailableReason, startedAt: number): JevDecisionResponse {
    return {
      status: 'unavailable',
      mode,
      reason,
      shadowOnly: true,
      latencyMs: Date.now() - startedAt,
    };
  }

  async decide(request: JevDecisionRequest): Promise<JevDecisionResponse> {
    const startedAt = Date.now();
    const cfg: JevConfig = getJevConfig();
    if (!cfg.enabled) return this.unavailable(request.mode, 'JEV_DISABLED', startedAt);
    if (!cfg.typesafeKeyPresent) return this.unavailable(request.mode, 'JEV_KEY_MISSING', startedAt);
    // SHADOW_ONLY é invariante da onda: mesmo que o config mudasse, o contrato
    // tipado (shadowOnly: true) e esta checagem impedem modo vivo.
    if (!cfg.shadowMode) return this.unavailable(request.mode, 'JEV_SHADOW_REQUIRED', startedAt);

    const baseUrl = this.baseUrlOverride ?? cfg.baseUrl;
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/v1/decisions`;

    // Firewall de privacidade: só o allowlist do modo atravessa — e nesta onda
    // nada sai do processo mesmo assim (chave ausente por padrão).
    const minimized = sanitizeJevPayload(request.mode, request.payload);

    // SSRF guard da casa: host fora da allowlist => bloqueio fail-closed.
    const blocked = ssrfGuard(endpoint);
    if (blocked) return this.unavailable(request.mode, 'JEV_SSRF_BLOCKED', startedAt);

    const key = readTypesafeKey();
    if (key === null) return this.unavailable(request.mode, 'JEV_KEY_MISSING', startedAt);

    const attempts = 1 + cfg.maxRetries;
    let lastReason: JevUnavailableReason = 'JEV_REMOTE_ERROR';

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
      try {
        const response = await this.fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: cfg.model,
            mode: request.mode,
            requestId: request.requestId,
            payload: minimized,
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          lastReason = 'JEV_REMOTE_ERROR';
        } else {
          const body: unknown = await response.json();
          const decisions = parseDecisions(body);
          if (decisions === null) {
            // Qualquer desvio do formato => indisponível (nunca adivinhar).
            lastReason = 'JEV_INVALID_RESPONSE';
          } else {
            const top = decisions[0];
            return {
              status: 'ok',
              mode: request.mode,
              source: this.source,
              decision: { label: top.label, confidence: top.confidence },
              shadowOnly: true,
              latencyMs: Date.now() - startedAt,
            };
          }
        }
      } catch (error) {
        lastReason =
          error instanceof Error && error.name === 'AbortError'
            ? 'JEV_TIMEOUT'
            : 'JEV_REMOTE_ERROR';
      } finally {
        clearTimeout(timer);
      }
      if (attempt < attempts - 1) {
        await sleep(200 * (attempt + 1)); // backoff curto e estável
      }
    }
    return this.unavailable(request.mode, lastReason, startedAt);
  }
}
