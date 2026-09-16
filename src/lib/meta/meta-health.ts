// ==============================================================================
// ZÉLLA — Meta Health Service (Fase 11)
// ==============================================================================
// Health real, multi-tenant-safe e sem chamadas agressivas.
//
// CONNECTED só quando existe evidência real de webhook recente e credenciais
// válidas/configuradas. A verificação Graph usa o cliente centralizado e uma
// leitura do próprio phone_number_id; nunca faz HEAD sem autenticação e nunca
// interpreta HTTP 4xx como "Graph saudável".
// ==============================================================================

import { db } from '@/lib/db';
import { META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_WABA_ID } from '@/lib/env';
import { META_CONNECT_ENABLED } from './meta-config';
import { metaGraphFetch } from './meta-client';
import { MetaConnectionStatus } from './meta-types';

const HEALTH_CACHE_TTL_MS = 5 * 60 * 1000;
const WEBHOOK_RECENT_MS = 24 * 60 * 60 * 1000;

interface MetaHealthCache {
  result: MetaHealthResult;
  expiresAt: number;
}

const healthCache = new Map<string, MetaHealthCache>();

export interface MetaHealthResult {
  state: MetaConnectionStatus;
  checks: {
    credentialsConfigured: boolean;
    wabaConfigured: boolean;
    phoneNumberConfigured: boolean;
    webhookRecent: boolean;
    lastWebhookAt: Date | null;
    lastDeliveryAt: Date | null;
    lastHealthCheckAt: Date;
    graphReachable: boolean | null;
  };
  reason?: string;
}

export async function getMetaHealth(tenantId: string, forceRefresh = false): Promise<MetaHealthResult> {
  const cached = healthCache.get(tenantId);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.result;

  // Nesta onda as credenciais são globais/env. Quando Meta Connect virar
  // multi-tenant ativo, este ponto deverá consumir a credencial do tenant a
  // partir do vault/secret store, nunca do frontend.
  const credentialsConfigured = Boolean(META_ACCESS_TOKEN);
  const wabaConfigured = Boolean(META_WABA_ID);
  const phoneNumberConfigured = Boolean(META_PHONE_NUMBER_ID);

  let lastWebhookAt: Date | null = null;
  let lastDeliveryAt: Date | null = null;

  try {
    const conn = await db.metaConnection.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      select: { lastWebhookAt: true, lastDeliveryAt: true },
    });
    if (conn) {
      lastWebhookAt = conn.lastWebhookAt;
      lastDeliveryAt = conn.lastDeliveryAt;
    }
  } catch (error) {
    console.error('[meta-health] metaConnection lookup failed (non-fatal):', error);
  }

  const webhookRecent =
    lastWebhookAt !== null && Date.now() - lastWebhookAt.getTime() < WEBHOOK_RECENT_MS;

  let state: MetaConnectionStatus;
  let reason: string | undefined;

  if (!META_CONNECT_ENABLED) {
    state = 'NOT_CONFIGURED';
    reason = 'META_CONNECT_ENABLED=false — conexão Meta não habilitada nesta onda';
  } else if (!credentialsConfigured || !wabaConfigured || !phoneNumberConfigured) {
    state = 'NOT_CONFIGURED';
    reason = 'META_ACCESS_TOKEN / META_WABA_ID / META_PHONE_NUMBER_ID ausentes';
  } else if (webhookRecent) {
    state = 'CONNECTED';
  } else if (lastWebhookAt !== null) {
    state = 'DISCONNECTED';
    reason = 'Sem webhook nas últimas 24h — verificar assinatura e entrega na Meta';
  } else {
    state = 'PENDING';
    reason = 'Credenciais configuradas, aguardando primeiro webhook da Meta';
  }

  // Não chamamos a Graph API se a integração está desligada.
  // Quando ligada, validamos o próprio phone_number_id com o token configurado.
  let graphReachable: boolean | null = null;
  if (META_CONNECT_ENABLED && credentialsConfigured && phoneNumberConfigured) {
    const graph = await metaGraphFetch<{ id?: string }>({
      path: META_PHONE_NUMBER_ID,
      method: 'GET',
      query: { fields: 'id' },
      timeoutMs: 10_000,
    });
    graphReachable = graph.ok;

    if (!graph.ok && state === 'CONNECTED') {
      state = 'ERROR';
      reason = `Graph API não confirmou o phone_number_id (${graph.error ?? 'erro desconhecido'})`;
    }
  }

  const result: MetaHealthResult = {
    state,
    checks: {
      credentialsConfigured,
      wabaConfigured,
      phoneNumberConfigured,
      webhookRecent,
      lastWebhookAt,
      lastDeliveryAt,
      lastHealthCheckAt: new Date(),
      graphReachable,
    },
    reason,
  };

  healthCache.set(tenantId, { result, expiresAt: Date.now() + HEALTH_CACHE_TTL_MS });

  try {
    await db.metaConnection.updateMany({
      where: { tenantId },
      data: { lastHealthCheckAt: result.checks.lastHealthCheckAt },
    });
  } catch {
    // Health persistence é best-effort; nunca derruba o DDC.
  }

  return result;
}

export function invalidateMetaHealthCache(tenantId: string): void {
  healthCache.delete(tenantId);
}
