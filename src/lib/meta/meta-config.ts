// ==============================================================================
// ZÉLLA — Meta Config (Fase 1 / Fase 2 / Fase 29)
// ==============================================================================
// Configuração central do canal Meta: feature flags, versão da Graph API,
// registro de suporte/deprecação de versões e capacidade do Business Agent.
// ==============================================================================

import { META_GRAPH_API_VERSION } from '@/lib/env';

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return raw.toLowerCase() === 'true';
}

export const META_CONNECT_ENABLED = envFlag('META_CONNECT_ENABLED', false);
export const META_INSTAGRAM_ENABLED = envFlag('META_INSTAGRAM_ENABLED', false);
export const META_BUSINESS_AGENT_ENABLED = envFlag('META_BUSINESS_AGENT_ENABLED', false);
export const META_ATTRIBUTION_ENABLED = envFlag('META_ATTRIBUTION_ENABLED', true);
export const META_COST_TRACKING_ENABLED = envFlag('META_COST_TRACKING_ENABLED', true);
export const META_LEARNING_ENABLED = envFlag('META_LEARNING_ENABLED', true);
// Conversions API (Business Messaging) — SEMPRE false até aprovação/credenciais
// Meta reais (DEPENDÊNCIA EXTERNA). O módulo meta-capi.ts é apenas o contrato
// interno; nada no pipeline de produção o chama.
export const META_CAPI_ENABLED = envFlag('META_CAPI_ENABLED', false);

export function getMetaFeatureFlags() {
  return {
    META_CONNECT_ENABLED,
    META_INSTAGRAM_ENABLED,
    META_BUSINESS_AGENT_ENABLED,
    META_ATTRIBUTION_ENABLED,
    META_COST_TRACKING_ENABLED,
    META_LEARNING_ENABLED,
    META_CAPI_ENABLED,
  };
}

// ── Graph API Version ─────────────────────────────────────────────────────────

export const ACTIVE_META_GRAPH_API_VERSION = META_GRAPH_API_VERSION;

/**
 * v26.0 é a versão-alvo desta migração.
 * Importante: permanecer em v23 não evita as mudanças de v26 para sempre;
 * parte das alterações de v26 alcança as versões restantes no ciclo de
 * depreciação. Por isso a certificação deve acontecer antes do cutoff.
 */
export const TARGET_META_GRAPH_API_VERSION = 'v26.0';

export interface GraphApiVersionStatus {
  version: string;
  status: 'supported' | 'deprecating' | 'retired';
  sunsetAt: string | null;
}

export const GRAPH_API_VERSION_REGISTRY: GraphApiVersionStatus[] = [
  { version: 'v18.0', status: 'retired', sunsetAt: '2025-01-23' },
  { version: 'v20.0', status: 'deprecating', sunsetAt: '2026-09-24' },
  { version: 'v21.0', status: 'deprecating', sunsetAt: '2027-01-21' },
  { version: 'v22.0', status: 'supported', sunsetAt: null },
  { version: 'v23.0', status: 'supported', sunsetAt: null },
  { version: 'v24.0', status: 'supported', sunsetAt: null },
  { version: 'v25.0', status: 'supported', sunsetAt: null },
  { version: 'v26.0', status: 'supported', sunsetAt: null },
];

export function getGraphApiVersionStatus(version: string): GraphApiVersionStatus | undefined {
  return GRAPH_API_VERSION_REGISTRY.find((v) => v.version === version);
}

export function metaGraphUrl(path: string): string {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `https://graph.facebook.com/${ACTIVE_META_GRAPH_API_VERSION}/${clean}`;
}

// ── Meta Business Agent ───────────────────────────────────────────────────────

export function getMetaBusinessAgentCapability() {
  return {
    businessAgentAvailable: false,
    businessAgentEnabled: META_BUSINESS_AGENT_ENABLED,
    businessAgentProvider: 'none' as const,
    businessAgentBillingModel: 'none' as const,
  };
}
