/**
 * ============================================================================
 * TENANT WHATSAPP CREDENTIALS — resolução de credenciais POR TENANT
 * (MISSÃO RBW — Fase K)
 * ============================================================================
 *
 * Modelo real do projeto (auditado): a MetaConnection guarda o phoneNumberId
 * POR TENANT (com verificationStatus); o ACCESS TOKEN da Cloud API é de
 * sistema (WABA system user) e NUNCA é persistido por tenant (sem coluna,
 * sem metadata, sem log — segredo em banco plaintext é anti-padrão).
 *
 * Autoridade de OUTBOUND correta:
 *   tenantId → MetaConnection(tenantId) → phoneNumberId DO TENANT
 *   + token de sistema (env) para a Graph API.
 *
 * PROIBIDO (era o bug da Fase K): usar WHATSAPP_PHONE_NUMBER_ID global como
 * número de envio quando o tenant tem conexão própria — todas as mensagens
 * sairiam de um número único e as respostas quebrariam o isolamento.
 *
 * Cross-tenant: o resolver consulta SEMPRE por tenantId — não existe caminho
 * que devolva a conexão de outro tenant (A → Phone B = impossível por
 * construção; testes cobrem).
 * ============================================================================
 */

import { db } from '@/lib/db';
import { deriveWhatsAppConnectionState, isOutboundReadyState } from '@/lib/whatsapp/connection-state';

export type TenantWhatsAppResolution =
  | { mode: 'tenant'; phoneNumberId: string; verificationStatus: string; connectionStatus: string }
  | { mode: 'system'; phoneNumberId: string; reason: 'tenant_without_connection_dev_or_test' }
  | { mode: 'none'; reason: 'missing_credentials' }
  | { mode: 'none'; reason: 'tenant_not_connected_in_production' }
  | { mode: 'none'; reason: 'tenant_connection_not_verified_in_production' };

/** Estados que comprovam conexão REAL da Meta (não basta "configurado"). */
export const WHATSAPP_VERIFIED_STATES = new Set(['VERIFIED', 'CONNECTED', 'HEALTHY']);

export function isProductionLike(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Resolve as credenciais de envio de um tenant.
 *  - Produção: EXIGE MetaConnection do PRÓPRIO tenant com estado de outbound
 *    REAL (VERIFIED/HEALTHY — RBW v2, item 3.5). Existir registro com
 *    phoneNumberId NÃO é suficiente: UNVERIFIED/CONNECTING/
 *    PENDING_VERIFICATION/ERROR → fail-closed
 *    (`tenant_connection_not_verified_in_production`). Sem conexão →
 *    `tenant_not_connected_in_production`. NUNCA devolve número global
 *    como autoridade de envio de tenant em produção.
 *  - Dev/teste: mantém compat — cai no env global quando o tenant não tem
 *    conexão (mock/live global, comportamento pré-existente preservado);
 *    conexão existente porém não verificada continua utilizável para
 *    sandbox/teste de integração.
 */
export async function resolveTenantWhatsAppCredentials(
  tenantId?: string | null,
  env: Record<string, string | undefined> = process.env,
): Promise<TenantWhatsAppResolution> {
  const systemToken = Boolean(env.WHATSAPP_ACCESS_TOKEN);
  const systemPhoneId = env.WHATSAPP_PHONE_NUMBER_ID;

  if (tenantId) {
    const connection = await (db as any).metaConnection?.findFirst?.({
      where: { tenantId: String(tenantId), phoneNumberId: { not: null } },
      orderBy: { updatedAt: 'desc' },
    });

    if (connection?.phoneNumberId) {
      // ── RBW v2: GATE DE ESTADO REAL (fonte única: connection-state) ──────
      // "Existe registro" ≠ "conexão pronta". Somente VERIFIED/HEALTHY
      // autorizam outbound de produção.
      const state = deriveWhatsAppConnectionState(
        connection.connectionStatus,
        connection.verificationStatus,
        connection.lastWebhookAt ?? null,
        connection.phoneNumberId ?? null,
      );
      if (isProductionLike(env) && !isOutboundReadyState(state)) {
        return { mode: 'none', reason: 'tenant_connection_not_verified_in_production' };
      }
      return {
        mode: 'tenant',
        phoneNumberId: String(connection.phoneNumberId),
        verificationStatus: String(connection.verificationStatus || 'UNVERIFIED'),
        connectionStatus: String(connection.connectionStatus || 'NOT_CONFIGURED'),
      };
    }

    // Tenant SEM conexão própria:
    if (isProductionLike(env)) {
      return { mode: 'none', reason: 'tenant_not_connected_in_production' };
    }
    if (systemToken && systemPhoneId) {
      return { mode: 'system', phoneNumberId: systemPhoneId, reason: 'tenant_without_connection_dev_or_test' };
    }
    return { mode: 'none', reason: 'missing_credentials' };
  }

  // Chamada legada sem tenantId (compat): env global, dev/teste ou produção
  // já credenciada — o comportamento de fail-closed do whatsapp-send continua.
  if (systemToken && systemPhoneId) {
    return { mode: 'system', phoneNumberId: systemPhoneId, reason: 'tenant_without_connection_dev_or_test' };
  }
  return { mode: 'none', reason: 'missing_credentials' };
}
