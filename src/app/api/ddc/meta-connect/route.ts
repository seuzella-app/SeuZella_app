// ==============================================================================
// ZÉLLA — DDC META CONNECT API (Fase 10 — READ-ONLY nesta onda)
// ==============================================================================
// Expõe o estado REAL da conexão Meta do tenant. NUNCA fabrica status verde:
// "CONNECTED"/"VERIFIED"/"HEALTHY" só quando comprovado pelo backend
// (credenciais + webhook recente). Esta onda é somente leitura — conexão
// efetiva fica para onda futura com META_CONNECT_ENABLED=true.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { getMetaFeatureFlags, getMetaBusinessAgentCapability, ACTIVE_META_GRAPH_API_VERSION, TARGET_META_GRAPH_API_VERSION, getGraphApiVersionStatus } from '@/lib/meta/meta-config';
import { getMetaHealth } from '@/lib/meta/meta-health';

export async function GET(_req: NextRequest) {
  try {
    // ── Auth (mesma política das demais rotas DDC) ──
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Rate limit ──
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // ── Dados reais: conexão + health + flags ──
    const [connection, health] = await Promise.all([
      db.metaConnection.findFirst({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
      }),
      getMetaHealth(tenantId),
    ]);

    const flags = getMetaFeatureFlags();
    const businessAgent = getMetaBusinessAgentCapability();
    const activeVersionStatus = getGraphApiVersionStatus(ACTIVE_META_GRAPH_API_VERSION);

    return NextResponse.json({
      success: true,
      data: {
        // ── Canal WhatsApp ──
        whatsapp: {
          enabled: flags.META_CONNECT_ENABLED,
          state: health.state, // NUNCA fabricado — vem do health service
          reason: health.reason ?? null,
          displayPhoneNumber: connection?.displayPhoneNumber ?? null,
          wabaId: connection?.wabaId ?? null,
          businessAccountId: connection?.businessAccountId ?? null,
          phoneNumberId: connection?.phoneNumberId ?? null,
          verificationStatus: connection?.verificationStatus ?? 'UNVERIFIED',
          lastWebhookAt: connection?.lastWebhookAt ?? null,
          lastDeliveryAt: connection?.lastDeliveryAt ?? null,
        },
        // ── Instagram (Fase 12 — desligado nesta onda) ──
        instagram: {
          enabled: flags.META_INSTAGRAM_ENABLED,
          state: flags.META_INSTAGRAM_ENABLED ? 'PENDING' : 'NOT_CONFIGURED',
          instagramAccountId: connection?.instagramAccountId ?? null,
        },
        // ── Business Agent (Fase 13 — capability model, SEMPRE off aqui) ──
        businessAgent,
        // ── Webhook / Health ──
        webhook: {
          lastWebhookAt: health.checks.lastWebhookAt,
          lastDeliveryAt: health.checks.lastDeliveryAt,
          webhookRecent: health.checks.webhookRecent,
          lastHealthCheckAt: health.checks.lastHealthCheckAt,
          graphReachable: health.checks.graphReachable,
        },
        // ── Graph API version (Fase 2) ──
        graphApi: {
          activeVersion: ACTIVE_META_GRAPH_API_VERSION,
          targetVersion: TARGET_META_GRAPH_API_VERSION,
          activeVersionStatus: activeVersionStatus?.status ?? 'unknown',
          migrationDoc: 'docs/META_GRAPH_API_VERSION_MIGRATION.md',
        },
        // ── Feature flags (transparência total) ──
        flags,
        // ── Custos (fontes separadas — nunca misturadas) ──
        costTracking: {
          enabled: flags.META_COST_TRACKING_ENABLED,
          authoritativeSource: 'meta_webhook_pricing',
          estimatedSource: 'send_accepted',
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        readOnlyWave: true,
        note: 'META CONNECT é read-only nesta onda. Estados verdes exigem evidência real do backend.',
      },
    });
  } catch (error) {
    console.error('GET /api/ddc/meta-connect error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
