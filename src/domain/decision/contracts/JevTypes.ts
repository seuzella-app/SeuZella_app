// ============================================================================
// JEV — Tipos fundamentais de decisão (RUN22-A — JEV MASTER ARCH/CONTRACT)
// ============================================================================
// Jev/TypeSafe é um DECISION PROVIDER (kind=DECISION) — NÃO é autoridade
// generativa e NÃO é autoridade financeira. Ele classifica, pontua e decide;
// nunca escreve texto livre para o usuário final.
//
// Garantias desta onda (SHADOW_ONLY), gravadas no SISTEMA DE TIPOS:
//  - `shadowOnly: true` é literal — nenhum objeto JEV pode alegar modo vivo.
//  - Falha nunca propaga: toda resposta é um resultado tipado (ok/unavailable/
//    rejected), no padrão fail-closed da casa.
//  - Isolamento por tenant é OBRIGATÓRIO no envelope (tenantId validado no
//    contrato; o buffer de shadow só guarda HASH do tenant — ver jev-shadow).
//  - PII minimizada: o payload só cruza a fronteira após o firewall
//    (jev-pii-firewall, allowlist por modo).
//  - Domínio financeiro PROIBIDO nesta trilha (nenhum modo toca cobrança,
//    estorno ou transação — ver JEV_ARCHITECTURE.md).
// ============================================================================

/** Os 7 modos de decisão do JEV v1 — espelham os sinais ML existentes da casa
 * (flags USE_TF_* do tf-client). PRICE fica fora do v1 por aderência máxima à
 * proibição do domínio de cobrança; pode entrar em onda futura com aprovação
 * explícita do dono. */
export const JEV_DECISION_MODES = [
  'INTENT',
  'SENTIMENT',
  'CHURN',
  'LEAD',
  'ANOMALY',
  'OCCUPANCY',
  'UPSELL',
] as const;

export type JevDecisionMode = (typeof JEV_DECISION_MODES)[number];

export function isJevDecisionMode(value: unknown): value is JevDecisionMode {
  return (
    typeof value === 'string' &&
    (JEV_DECISION_MODES as readonly string[]).includes(value)
  );
}

/** kind do provider. A diretiva JEV MASTER: Jev/TypeSafe é SOMENTE DECISION.
 * 'GENERATIVE' existe no tipo para que o registro possa REJEITAR explicitamente
 * (fail-closed) qualquer tentativa de registrar provider generativo na trilha
 * de decisão. */
export const JEV_PROVIDER_KINDS = ['DECISION', 'GENERATIVE'] as const;
export type JevProviderKind = (typeof JEV_PROVIDER_KINDS)[number];

/** Fontes de decisão v1. A heurística local é o baseline determinístico ($0);
 * o adapter remoto (TypeSafe) só atua com chave presente e fica desativado por
 * padrão. */
export const JEV_DECISION_SOURCES = ['jev-local-heuristic', 'jev-typesafe'] as const;
export type JevDecisionSource = (typeof JEV_DECISION_SOURCES)[number];

/** Motivos tipados de indisponibilidade — fail-closed sempre dá a razão. */
export const JEV_UNAVAILABLE_REASONS = [
  'JEV_DISABLED',
  'JEV_KEY_MISSING',
  'JEV_SHADOW_REQUIRED',
  'JEV_TIMEOUT',
  'JEV_SSRF_BLOCKED',
  'JEV_REMOTE_ERROR',
  'JEV_INVALID_RESPONSE',
] as const;
export type JevUnavailableReason = (typeof JEV_UNAVAILABLE_REASONS)[number];

/** Saída de UMA decisão atômica. confidence é calibrada em [0,1]. */
export interface JevDecisionOutcome {
  label: string;
  confidence: number;
  /** Traço curto e estável da regra/sinal (sem conteúdo do payload). */
  rationale?: string;
}

/** Envelope de pedido. O payload JÁ deve chegar minimizado (firewall). */
export interface JevDecisionRequest {
  requestId: string;
  tenantId: string;
  mode: JevDecisionMode;
  payload: Record<string, unknown>;
  occurredAt: string;
}

/** Decisão produzida. shadowOnly é literal true — garantia de compilador. */
export interface JevDecisionSuccess {
  status: 'ok';
  mode: JevDecisionMode;
  source: JevDecisionSource;
  decision: JevDecisionOutcome;
  shadowOnly: true;
  latencyMs: number;
}

/** JEV indisponível — o chamador continua seu fluxo normal (nunca quebra). */
export interface JevDecisionUnavailable {
  status: 'unavailable';
  mode: JevDecisionMode;
  reason: JevUnavailableReason;
  shadowOnly: true;
  latencyMs: number;
}

/** Pedido recusado pelo contrato/firewall (entrada inválida ou modo ausente). */
export interface JevDecisionRejected {
  status: 'rejected';
  mode: JevDecisionMode;
  reason: string;
  shadowOnly: true;
  latencyMs: number;
}

export type JevDecisionResponse =
  | JevDecisionSuccess
  | JevDecisionUnavailable
  | JevDecisionRejected;

export function isJevDecisionSuccess(r: JevDecisionResponse): r is JevDecisionSuccess {
  return r.status === 'ok';
}

export function isJevDecisionUnavailable(r: JevDecisionResponse): r is JevDecisionUnavailable {
  return r.status === 'unavailable';
}
