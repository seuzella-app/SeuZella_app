// ============================================================================
// JEV — Registro de providers de DECISÃO (RUN22-A — kind=DECISION)
// ============================================================================
// ADITIVO ao registry real da casa: o ZaosNeuroRouter (src/lib/ai/
// zaos-neuro-router.ts) já tem ProviderRegistration + DEFAULT_PROVIDERS +
// registerProvider (convenção confirmada pelo SHAPES RUN21-A, sem typing de
// kind). Este registro ESTENDE ProviderRegistration (não o edita) e adiciona:
//   - kind: 'DECISION' | 'GENERATIVE' (GENERATIVE é REJEITADO — fail-closed);
//   - modes: os modos de decisão atendidos;
//   - shadowOnly: OBRIGATÓRIO true nesta onda (registro recusa false).
// NÃO é um router paralelo (proibido pela diretiva): quem roteia continua
// sendo o zaos; aqui só se catalogam DECISORES.
// Import da casa em caminho RELATIVO de propósito: a onda não pode depender
// do alias '@' dentro do runner de testes (tsc e vitest resolvem relativos
// em qualquer configuração — lição anti-FIADO).
// ============================================================================

import {
  isJevDecisionMode,
  type JevDecisionMode,
  type JevProviderKind,
} from '../../../domain/decision/contracts/JevTypes';
import type { ProviderRegistration } from '../zaos-neuro-router';

/** Extensão JEV do registro canônico da casa (todos os campos de
 * ProviderRegistration continuam obrigatórios — custo/latência/ctx ficam
 * auditáveis pelo mesmo ponto de vista do zaos). */
export interface JevProviderRegistration extends ProviderRegistration {
  kind: JevProviderKind;
  modes: readonly JevDecisionMode[];
  shadowOnly: boolean;
  active: boolean;
}

/** Erro tipado do registro — mensagens estáveis para o digest/auditoria. */
export class JevRegistryError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'JevRegistryError';
    this.code = code;
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Retorna null se a inscrição é válida; senão devolve o código do problema. */
export function validateJevRegistration(r: unknown): string | null {
  if (typeof r !== 'object' || r === null) return 'JEV_REG_NOT_OBJECT';
  const reg = r as Partial<JevProviderRegistration>;
  if (typeof reg.id !== 'string' || reg.id.trim() === '' || reg.id.length > 64) {
    return 'JEV_REG_ID_INVALID';
  }
  if (reg.kind !== 'DECISION') {
    // Inclui kind ausente e kind 'GENERATIVE' — a trilha de decisão NÃO aceita.
    return 'JEV_REG_KIND_MUST_BE_DECISION';
  }
  if (reg.shadowOnly !== true) {
    // Onda SHADOW_ONLY: registro sem shadow é recusado por construção.
    return 'JEV_REG_SHADOW_ONLY_REQUIRED';
  }
  if (typeof reg.active !== 'boolean') return 'JEV_REG_ACTIVE_INVALID';
  if (!Array.isArray(reg.modes) || reg.modes.length === 0 || !reg.modes.every((m) => isJevDecisionMode(m))) {
    return 'JEV_REG_MODES_INVALID';
  }
  if (!isFiniteNumber(reg.tier) || ![1, 2, 3].includes(reg.tier)) return 'JEV_REG_TIER_INVALID';
  if (!isFiniteNumber(reg.costPer1kInput) || reg.costPer1kInput < 0) return 'JEV_REG_COST_INPUT_INVALID';
  if (!isFiniteNumber(reg.costPer1kOutput) || reg.costPer1kOutput < 0) return 'JEV_REG_COST_OUTPUT_INVALID';
  if (!isFiniteNumber(reg.expectedLatencyMs) || reg.expectedLatencyMs <= 0) return 'JEV_REG_LATENCY_INVALID';
  if (!isFiniteNumber(reg.maxContextTokens) || reg.maxContextTokens < 0) return 'JEV_REG_CONTEXT_INVALID';
  if (typeof reg.supportsJson !== 'boolean') return 'JEV_REG_JSON_INVALID';
  if (typeof reg.supportsTools !== 'boolean') return 'JEV_REG_TOOLS_INVALID';
  if (reg.baseUrl !== null && typeof reg.baseUrl !== 'string') return 'JEV_REG_BASEURL_INVALID';
  if (typeof reg.name !== 'string' || reg.name.trim() === '') return 'JEV_REG_NAME_INVALID';
  return null;
}

export class JevDecisionRegistry {
  private readonly providers = new Map<string, JevProviderRegistration>();

  /** Espelha a convenção do zaos (registerProvider) — mas fail-closed: lança
   * JevRegistryError ante qualquer violação (kind errado, shadow ausente,
   * duplicado, campos sujos). */
  registerProvider(registration: JevProviderRegistration): void {
    const problem = validateJevRegistration(registration);
    if (problem !== null) {
      throw new JevRegistryError(problem, `registro JEV recusado: ${problem}`);
    }
    if (this.providers.has(registration.id)) {
      throw new JevRegistryError('JEV_REG_DUPLICATE', `provider já registrado: ${registration.id}`);
    }
    this.providers.set(registration.id, { ...registration, modes: [...registration.modes] });
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  get(id: string): JevProviderRegistration | null {
    return this.providers.get(id) ?? null;
  }

  listProviders(): JevProviderRegistration[] {
    return [...this.providers.values()];
  }

  providersForMode(mode: JevDecisionMode): JevProviderRegistration[] {
    return this.listProviders().filter((p) => p.modes.includes(mode) && p.active);
  }

  /** Foto do registro para auditoria/digest. shadowOnlyOnly deve ser sempre
   * true nesta onda — se algum dia for false, o digest acende vermelho. */
  snapshot(): { total: number; kinds: Record<JevProviderKind, number>; shadowOnlyOnly: boolean } {
    const all = this.listProviders();
    const kinds: Record<JevProviderKind, number> = { DECISION: 0, GENERATIVE: 0 };
    for (const p of all) kinds[p.kind] += 1;
    return {
      total: all.length,
      kinds,
      shadowOnlyOnly: all.every((p) => p.shadowOnly),
    };
  }
}

/** Defaults v1: baseline local ($0, determinístico) + TypeSafe remoto (tier 2,
 * inativo sem chave). Campos numéricos seguem a semântica do
 * ProviderRegistration do zaos (custo por 1k tokens em USD). */
export const JEV_DEFAULT_PROVIDERS: readonly JevProviderRegistration[] = [
  {
    id: 'jev-local-heuristic',
    name: 'JEV Heurística Local (baseline determinístico)',
    kind: 'DECISION',
    modes: ['INTENT', 'SENTIMENT', 'CHURN', 'LEAD', 'ANOMALY', 'OCCUPANCY', 'UPSELL'],
    shadowOnly: true,
    active: true,
    tier: 1,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    expectedLatencyMs: 1,
    maxContextTokens: 0,
    supportsJson: true,
    supportsTools: false,
    baseUrl: null,
  },
  {
    id: 'jev-typesafe',
    name: 'TypeSafe Jev (System One, remoto)',
    kind: 'DECISION',
    modes: ['INTENT', 'SENTIMENT', 'CHURN', 'LEAD', 'ANOMALY', 'OCCUPANCY', 'UPSELL'],
    shadowOnly: true,
    active: false, // ativa em onda futura com chave presente + allowlist SSRF
    tier: 2,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    expectedLatencyMs: 120,
    maxContextTokens: 8192,
    supportsJson: true,
    supportsTools: false,
    baseUrl: 'https://api.typesafe.ai',
  },
] as const;

export const jevDecisionRegistry = new JevDecisionRegistry();

/** Idempotente: registra os defaults ausentes (nunca duplica, nunca sobrescreve). */
export function seedJevRegistry(registry: JevDecisionRegistry = jevDecisionRegistry): void {
  for (const provider of JEV_DEFAULT_PROVIDERS) {
    if (!registry.has(provider.id)) {
      registry.registerProvider(provider);
    }
  }
}
