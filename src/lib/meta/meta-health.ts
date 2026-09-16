// ==============================================================================
// ZÉLLA — Meta Health Service (Fase 11)
// ==============================================================================
// Verifica saúde da conexão Meta SEM chamadas agressivas à Graph API:
//  - Sem polling contínuo. Cache com TTL.
//  - lastHealthCheckAt registrado.
//  - NUNCA fabrica status verde: CONNECTED só com credenciais + evidência
//    real (webhook recente). Estados: NOT_CONFIGURED | PENDING | CONNECTED |
//    ERROR | DISCONNECTED.
// ==============================================================================

import { db } from '@/lib/db';
import { META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_WABA_ID } from '@/lib/env';
import { META_CONNECT_ENABLED } from './meta-config';
import { MetaConnectionStatus } from './meta-types';

const HEALTH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — sem polling agressivo

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
    graphReachable: boolean | null; // null = não verificado nesta checagem (cache/TTL)
  };
  reason?: string;
}

const WEBHOOK_RECENT_MS = 24 * 60 * 60 * 1000; // webhook nas últimas 24h = evidência de vida

/**
 * Executa o health check de um tenant (com cache TTL).
 * graphReachable só é verificado quando há credenciais E o cache expirou —
 * e apenas um GET leve de debug token metadata, sem custo de conversa.
 */
export async function getMetaHealth(tenantId: string, forceRefresh = false): Promise<MetaHealthResult> {
  const cached = healthCache.get(tenantId);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const credentialsConfigured = Boolean(META_ACCESS_TOKEN);
  const wabaConfigured = Boolean(META_WABA_ID);
  const phoneNumberConfigured = Boolean(META_PHONE_NUMBER_ID);

  // Evidência de webhook: MetaConnection do tenant (lastWebhookAt) OU qualquer
  // conexão com webhook recente (fallback single-tenant via env).
  let lastWebhookAt: Date | null = null;
  let lastDeliveryAt: Date | null = null;
  try {
    const conn = await db.metaConnection.findFirst({
      where: { OR: [{ tenantId }, { tenantId: 'shared' }] },
      orderBy: { updatedAt: 'desc' },
      select: { lastWebhookAt: true, lastDeliveryAt: true, connectionStatus: true },
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
    reason = 'Sem webhook nas últimas 24h — verificar assinatura do webhook na Meta';
  } else {
    state = 'PENDING';
    reason = 'Credenciais configuradas, aguardando primeiro webhook da Meta';
  }

  // Verificação de reachability Graph API — leve, com TTL, só se habilitado.
  let graphReachable: boolean | null = null;
  if (META_CONNECT_ENABLED && credentialsConfigured && state !== 'NOT_CONFIGURED') {
    try {
      const res = await fetch(`https://graph.facebook.com/debug_token`, { method: 'HEAD' });
      graphReachable = res.status < 500;
    } catch {
      graphReachable = false;
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

  // Persistir lastHealthCheckAt (best-effort, non-fatal)
  try {
    await db.metaConnection.updateMany({
      where: { OR: [{ tenantId }, { tenantId: 'shared' }] },
      data: { lastHealthCheckAt: result.checks.lastHealthCheckAt },
    });
  } catch {
    // non-fatal
  }

  return result;
}

/** Invalida cache (ex: após webhook recebido). */
export function invalidateMetaHealthCache(tenantId: string): void {
  healthCache.delete(tenantId);
}
