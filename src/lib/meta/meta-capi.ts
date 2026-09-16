// ==============================================================================
// ZÉLLA — Meta Conversions API (Business Messaging): CONTRATO INTERNO
// ==============================================================================
// STATUS: FALTANDO ATIVAÇÃO — DEPENDÊNCIA EXTERNA (auditoria FASE 9).
//
// Este módulo é o ADAPTER/CONTRACT interno da Conversions API. Ele NÃO é
// chamado por nenhum caminho de produção e a flag META_CAPI_ENABLED nasce
// false. Nada aqui ativa integração externa por si só.
//
// O QUE É FATO OFICIAL (documentação Meta, verificada nesta onda):
//   - Existe "Conversions API for Business Messaging" (docs developers.facebook.com,
//     categoria ads-commerce/conversions-api/business-messaging).
//   - Requer um DATASET no Events Manager e system user token com permissão
//     ads_management (fonte: onboarding guide + política citada por parceiros).
//   - A Meta NÃO deduplica eventos desta variante ("does not assist with
//     deduplicating events for Conversions API for Business Messaging") —
//     o event_id DEVE ser determinístico do nosso lado (dedupe própria).
//
// O QUE NÃO ESTÁ CONFIRMADO AQUI (UNVERIFIED — não inventar):
//   - Payload EXATO da variante Business Messaging (campos extras obrigatórios,
//     action_source aceito, user_data exigido para mensagens).
//   - Endpoint exato da variante (o shape genérico CAPI é POST {version}/
//     {dataset_id}/events; a variante Business Messaging pode exigir campos/
//     paths adicionais — confirmar no onboarding guide oficial antes de ativar).
//   - Elegibilidade/limites por conta (aprovação Meta).
//
// ATIVAÇÃO SÓ DEVE ACONTECER DEPOIS DE:
//   1. Credenciais reais (dataset_id + token de system user com ads_management);
//   2. Validação do payload contra o onboarding guide oficial;
//   3. Test event code em ambiente de teste do Events Manager;
//   4. Flag META_CAPI_ENABLED=true deliberada + wiring revisado em PR próprio.
// ==============================================================================

import { META_CAPI_ENABLED } from './meta-config';

/** Fontes de ação aceitas pelo schema CAPI genérico (fact público). */
export type MetaCapiActionSource = 'system_generated' | 'website' | 'app' | 'phone_call' | 'physical_store' | 'other';

export interface MetaCapiUserData {
  /** SHA-256 do telefone E.164 com prefixo '+' (formato CAPI — fact público). */
  ph?: string;
  /** SHA-256 lowercase do e-mail. */
  em?: string;
  /** SHA-256 do nome (lowercase, sem acentos). */
  fn?: string;
  /** SHA-256 do sobrenome. */
  ln?: string;
  /** ID externo (BSUID do hóspede) — RAW, sem hash. */
  external_id?: string;
}

export interface MetaCapiCustomData {
  /** Moeda ISO 4217 — ex.: BRL. */
  currency?: string;
  /** Valor do evento (receita de reserva confirmada — só com evidência determinística). */
  value?: number;
}

export interface MetaCapiEvent {
  /** Nome do evento — UNVERIFIED para Business Messaging; não enviar sem confirmar. */
  event_name: string;
  /** Unix seconds. */
  event_time: number;
  /** DEDUPE PRÓPRIA (Meta não deduplica Business Messaging): determinístico por messageId. */
  event_id: string;
  action_source: MetaCapiActionSource;
  user_data: MetaCapiUserData;
  custom_data?: MetaCapiCustomData;
}

export interface MetaCapiConfig {
  datasetId: string;
  accessToken: string;
  /** Test event code do Events Manager (apenas em teste). */
  testEventCode?: string;
}

/** SHA-256 para user_data CAPI. */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Config presente? (sem valores reais em nenhum log — nunca retornamos o token) */
export function resolveMetaCapiConfig(env: Record<string, string | undefined> = process.env): MetaCapiConfig | null {
  const datasetId = env.META_CAPI_DATASET_ID;
  const accessToken = env.META_CAPI_ACCESS_TOKEN || env.META_ACCESS_TOKEN;
  if (!datasetId || !accessToken) return null;
  return {
    datasetId,
    accessToken,
    testEventCode: env.META_CAPI_TEST_EVENT_CODE || undefined,
  };
}

/**
 * Monta o evento a partir da attribution JÁ REGISTRADA — nunca inferida.
 * `event_id` determinístico = dedupe própria (exigência da variante BM).
 * UNVERIFIED: event_name não tem valor default — o caller deve fornecer
 * somente depois de confirmar o contrato oficial no onboarding guide.
 */
export function buildMetaCapiEvent(params: {
  eventName: string;
  messageId: string;
  eventTime: Date;
  phoneE164?: string | null;
  guestExternalId?: string | null;
  value?: number | null;
  currency?: string | null;
}): MetaCapiEvent {
  return {
    event_name: params.eventName,
    event_time: Math.floor(params.eventTime.getTime() / 1000),
    event_id: `zella-${params.messageId}`, // dedupe própria — determinístico
    action_source: 'system_generated',
    user_data: {
      // hash é aplicado no send (async sha256); aqui deixamos o caller decidir.
      external_id: params.guestExternalId ?? undefined,
    },
    custom_data:
      typeof params.value === 'number' && Number.isFinite(params.value)
        ? { value: params.value, currency: params.currency ?? 'BRL' }
        : undefined,
  };
}

export type MetaCapiSendResult =
  | { sent: false; reason: 'flag_off' | 'config_missing' | 'graph_error'; detail?: string }
  | { sent: true; eventId: string };

/**
 * Envia o evento para a CAPI — porta de saída ÚNICA, flag-gated.
 * Enquanto META_CAPI_ENABLED=false: no-op determinístico ({sent:false, reason:'flag_off'}).
 * NÃO chamado por nenhum caminho de produção nesta onda (contrato apenas).
 */
export async function sendMetaCapiEvent(event: MetaCapiEvent): Promise<MetaCapiSendResult> {
  if (!META_CAPI_ENABLED) return { sent: false, reason: 'flag_off' };
  const config = resolveMetaCapiConfig();
  if (!config) return { sent: false, reason: 'config_missing' };

  // IMPORTANTE: implementação do POST é deliberadamente mantida mínima e só
  // alcançável com flag true + config real. O endpoint genérico CAPI é
  // {version}/{dataset_id}/events — a variante Business Messaging pode exigir
  // ajuste; validar no onboarding guide oficial antes de ativar.
  try {
    const { metaGraphUrl } = await import('./meta-config');
    const body: Record<string, unknown> = { data: [event], access_token: config.accessToken };
    if (config.testEventCode) body.test_event_code = config.testEventCode;
    const res = await fetch(metaGraphUrl(`${config.datasetId}/events`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { sent: false, reason: 'graph_error', detail: `HTTP ${res.status}` };
    }
    return { sent: true, eventId: event.event_id };
  } catch (error) {
    return {
      sent: false,
      reason: 'graph_error',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
