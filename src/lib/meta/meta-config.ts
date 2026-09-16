// ==============================================================================
// ZÉLLA — Meta Config (Fase 1 / Fase 2 / Fase 29)
// ==============================================================================
// Configuração central do canal Meta: feature flags, versão da Graph API,
// registro de suporte/deprecação de versões e capacidade do Business Agent.
//
// REGRAS:
//  - Nunca criar duas flags para a mesma capacidade.
//  - META_BUSINESS_AGENT_ENABLED deve permanecer FALSE.
//  - META ONE não é requisito técnico do Zélla.
//  - A versão da Graph API é configurável via META_GRAPH_API_VERSION (env.ts).
// ==============================================================================

import { META_GRAPH_API_VERSION } from '@/lib/env';

// ── Feature Flags (Fase 29 — estado final de produção) ──────────────────────

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return raw.toLowerCase() === 'true';
}

/** Conexão Meta (WABA/Business Account) — default false/somente leitura nesta onda. */
export const META_CONNECT_ENABLED = envFlag('META_CONNECT_ENABLED', false);
/** Instagram como canal — default false nesta onda (Fase 12). */
export const META_INSTAGRAM_ENABLED = envFlag('META_INSTAGRAM_ENABLED', false);
/** Meta Business Agent — DEVE permanecer false (Fase 13). */
export const META_BUSINESS_AGENT_ENABLED = envFlag('META_BUSINESS_AGENT_ENABLED', false);
/** Atribuição Click-to-WhatsApp — true por padrão (somente observabilidade). */
export const META_ATTRIBUTION_ENABLED = envFlag('META_ATTRIBUTION_ENABLED', true);
/** Rastreamento de custo Meta — true por padrão (somente observabilidade). */
export const META_COST_TRACKING_ENABLED = envFlag('META_COST_TRACKING_ENABLED', true);
/** Aprendizagem Meta→ZéLLM — true por padrão (somente observabilidade). */
export const META_LEARNING_ENABLED = envFlag('META_LEARNING_ENABLED', true);

export function getMetaFeatureFlags() {
  return {
    META_CONNECT_ENABLED,
    META_INSTAGRAM_ENABLED,
    META_BUSINESS_AGENT_ENABLED,
    META_ATTRIBUTION_ENABLED,
    META_COST_TRACKING_ENABLED,
    META_LEARNING_ENABLED,
  };
}

// ── Graph API Version (Fase 2) ───────────────────────────────────────────────

/**
 * Versão ATIVA usada em todas as chamadas Graph API.
 * Centralizada em env.ts (META_GRAPH_API_VERSION, default v23.0).
 * NENHUM arquivo de produção pode hardcodar graph.facebook.com/vXX.0.
 */
export const ACTIVE_META_GRAPH_API_VERSION = META_GRAPH_API_VERSION;

/**
 * Versão-alvo da migração controlada.
 * v26.0 é a versão mais recente lançada; a v21.0 tem encerramento em jan/2027.
 * Migração é controlada: ver docs/META_GRAPH_API_VERSION_MIGRATION.md.
 */
export const TARGET_META_GRAPH_API_VERSION = 'v26.0';

export interface GraphApiVersionStatus {
  version: string;
  status: 'supported' | 'deprecating' | 'retired';
  /** Data (ISO) em que a Meta encerra o suporte — quando conhecida. */
  sunsetAt: string | null;
}

/**
 * Registro de suporte por versão (dados de configuração, não lógica espalhada).
 * Fonte: changelog público da Meta — atualizar conforme novos anúncios.
 */
export const GRAPH_API_VERSION_REGISTRY: GraphApiVersionStatus[] = [
  { version: 'v18.0', status: 'retired', sunsetAt: '2025-01-23' },
  { version: 'v20.0', status: 'retired', sunsetAt: '2025-10-29' },
  { version: 'v21.0', status: 'deprecating', sunsetAt: '2027-01-27' },
  { version: 'v22.0', status: 'supported', sunsetAt: null },
  { version: 'v23.0', status: 'supported', sunsetAt: null },
  { version: 'v24.0', status: 'supported', sunsetAt: null },
  { version: 'v25.0', status: 'supported', sunsetAt: null },
  { version: 'v26.0', status: 'supported', sunsetAt: null },
];

export function getGraphApiVersionStatus(version: string): GraphApiVersionStatus | undefined {
  return GRAPH_API_VERSION_REGISTRY.find((v) => v.version === version);
}

/** URL base da Graph API com a versão centralizada. */
export function metaGraphUrl(path: string): string {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `https://graph.facebook.com/${ACTIVE_META_GRAPH_API_VERSION}/${clean}`;
}

// ── Meta Business Agent (Fase 13 — capability model apenas) ─────────────────

/**
 * Modelo de capacidade do Business Agent.
 * NÃO chama API da Meta. NÃO ativa nada. Estado default: disabled.
 */
export function getMetaBusinessAgentCapability() {
  return {
    businessAgentAvailable: false, // sem Meta approval / Meta One — indisponível
    businessAgentEnabled: META_BUSINESS_AGENT_ENABLED, // sempre false nesta onda
    businessAgentProvider: 'none' as const,
    businessAgentBillingModel: 'none' as const,
  };
}
