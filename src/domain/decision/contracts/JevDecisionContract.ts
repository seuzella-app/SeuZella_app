// ============================================================================
// JEV — Contrato de request/response (RUN22-A — ARCH/CONTRACT, SHADOW_ONLY)
// ============================================================================
// Validação do envelope JEV. Padrão da casa: fail-closed — tudo que não for
// comprovadamente válido é recusado com razão explícita. A validação é PURA
// (sem I/O, sem env na assinatura opcional) para ser testável e reutilizável
// por qualquer chamador (rotas, cron, workers) nas ondas seguintes.
// ============================================================================

import {
  isJevDecisionMode,
  type JevDecisionRequest,
  type JevDecisionMode,
} from './JevTypes';

/** Mesma disciplina de id do middleware da casa (REQUEST_ID_RE). */
export const JEV_REQUEST_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const JEV_TENANT_ID_MAX = 64;
export const JEV_OCCURRED_AT_MAX = 40;

export type JevContractValidation =
  | { ok: true; request: JevDecisionRequest }
  | { ok: false; reason: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Regra da casa (backend-tool-authorizer): tenant 'demo' não roda em produção. */
function isDemoTenantInProduction(tenantId: string): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    tenantId.toLowerCase().includes('demo')
  );
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Valida o envelope bruto de decisão. NUNCA lança — devolve { ok: false }.
 * Campos exigidos: requestId (regex da casa), tenantId (isolamento por tenant
 * é OBRIGATÓRIO), mode (um dos 7), payload (objeto), occurredAt (ISO parseável).
 */
export function validateJevRequest(raw: unknown): JevContractValidation {
  if (!isPlainObject(raw)) {
    return { ok: false, reason: 'JEV_REQUEST_NOT_OBJECT' };
  }
  const requestId = asString(raw.requestId);
  if (!requestId || !JEV_REQUEST_ID_RE.test(requestId)) {
    return { ok: false, reason: 'JEV_REQUEST_ID_INVALID' };
  }
  const tenantId = asString(raw.tenantId);
  if (!tenantId) {
    return { ok: false, reason: 'JEV_TENANT_REQUIRED' };
  }
  if (tenantId.length > JEV_TENANT_ID_MAX) {
    return { ok: false, reason: 'JEV_TENANT_TOO_LONG' };
  }
  if (isDemoTenantInProduction(tenantId)) {
    return { ok: false, reason: 'JEV_TENANT_DEMO_IN_PRODUCTION' };
  }
  if (!isJevDecisionMode(raw.mode)) {
    return { ok: false, reason: 'JEV_MODE_INVALID' };
  }
  const mode: JevDecisionMode = raw.mode;
  if (!isPlainObject(raw.payload)) {
    return { ok: false, reason: 'JEV_PAYLOAD_NOT_OBJECT' };
  }
  const occurredAt = asString(raw.occurredAt);
  if (!occurredAt || occurredAt.length > JEV_OCCURRED_AT_MAX) {
    return { ok: false, reason: 'JEV_OCCURRED_AT_INVALID' };
  }
  if (Number.isNaN(Date.parse(occurredAt))) {
    return { ok: false, reason: 'JEV_OCCURRED_AT_NOT_DATE' };
  }
  return {
    ok: true,
    request: {
      requestId,
      tenantId,
      mode,
      payload: raw.payload,
      occurredAt,
    },
  };
}
