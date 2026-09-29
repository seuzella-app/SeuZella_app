/**
 * ============================================================================
 * WHATSAPP CONNECTION STATE — autoridade server-side do estado REAL
 * (MISSÃO RBW — Fase L)
 * ============================================================================
 *
 * Problema que fecha: o wizard de onboarding gravava `whatsappConnected=true`
 * porque o CLIENTE mandou `data.connected=true` — auto-declarado, sem prova.
 * A partir de agora o estado é derivado do banco (MetaConnection), nunca do
 * cliente. O passo 'whatsapp' do wizard no máximo marca intenção
 * (PENDING_VERIFICATION) — VERIFIED só vem de evidência server-side.
 *
 * Estados canônicos (coerentes com MetaConnection.connectionStatus/
 * verificationStatus existentes — sem inventar integração Meta):
 *   NOT_CONFIGURED       — nenhuma conexão registrada
 *   CONNECTING           — registro em andamento, sem verificação
 *   PENDING_VERIFICATION — configurado, aguardando prova da Meta
 *   VERIFIED             — verificação server-side registrada
 *   HEALTHY              — verificado E com tráfego recente (lastWebhookAt)
 *   ERROR                — última evidência é de falha
 *
 * Validação ativa contra a Graph API NÃO é executada aqui (dependência
 * externa): onde fosse necessária, o resultado é marcado
 * BLOCKED_EXTERNAL_DEPENDENCY em vez de fingir verificação.
 * ============================================================================
 */

import { db } from '@/lib/db';

export type WhatsAppConnectionState =
  | 'NOT_CONFIGURED'
  | 'CONNECTING'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'HEALTHY'
  | 'ERROR';

export interface WhatsAppConnectionResolution {
  tenantId: string;
  state: WhatsAppConnectionState;
  /** Fonte da evidência — nunca 'client_self_report'. */
  source: 'meta_connection' | 'none';
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  /**true quando a validação real exigir rede Meta (não executada localmente). */
  externalValidation: 'BLOCKED_EXTERNAL_DEPENDENCY' | 'not_required';
  lastWebhookAt: string | null;
}

const VERIFICATION_VERIFIED = new Set(['VERIFIED', 'CONNECTED', 'HEALTHY']);

/**
 * RBW v2 (item 3.5): derivação PURA e EXPORTADA do estado canônico a partir
 * das evidências do banco. Fonte ÚNICA da semântica de estado — usada tanto
 * pela resolução de estado (onboarding/observabilidade) quanto pelo gate de
 * outbound de produção do resolver de credenciais. Nunca deriva "conectado"
 * de auto-declaração do cliente.
 */
export function deriveWhatsAppConnectionState(
  connectionStatusRaw: string | null | undefined,
  verificationStatusRaw: string | null | undefined,
  lastWebhookAt?: Date | string | null,
  phoneNumberId?: string | null,
): WhatsAppConnectionState {
  const connectionStatus = String(connectionStatusRaw || 'NOT_CONFIGURED').toUpperCase();
  const verificationStatus = String(verificationStatusRaw || 'UNVERIFIED').toUpperCase();

  if (connectionStatus === 'ERROR' || verificationStatus === 'ERROR' || verificationStatus === 'FAILED') {
    return 'ERROR';
  }
  if (verificationStatus === 'VERIFIED' || VERIFICATION_VERIFIED.has(verificationStatus)) {
    const healthy =
      lastWebhookAt &&
      Date.now() - new Date(lastWebhookAt).getTime() < 7 * 24 * 60 * 60 * 1000;
    return healthy ? 'HEALTHY' : 'VERIFIED';
  }
  if (connectionStatus === 'NOT_CONFIGURED') return 'NOT_CONFIGURED';
  if (phoneNumberId) return 'PENDING_VERIFICATION';
  return 'CONNECTING';
}

/** Estados que autorizam OUTBOUND DE PRODUÇÃO (missão RBW item 3.5). */
export function isOutboundReadyState(state: WhatsAppConnectionState): boolean {
  return state === 'VERIFIED' || state === 'HEALTHY';
}

export async function resolveWhatsAppConnectionState(
  tenantId: string,
): Promise<WhatsAppConnectionResolution> {
  const base: WhatsAppConnectionResolution = {
    tenantId,
    state: 'NOT_CONFIGURED',
    source: 'none',
    phoneNumberId: null,
    displayPhoneNumber: null,
    externalValidation: 'not_required',
    lastWebhookAt: null,
  };

  try {
    const connection = await (db as any).metaConnection?.findFirst?.({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) return base;

    const lastWebhookAt = connection.lastWebhookAt ? new Date(connection.lastWebhookAt).toISOString() : null;

    // RBW v2: derivação via fonte única (deriveWhatsAppConnectionState).
    const state = deriveWhatsAppConnectionState(
      connection.connectionStatus,
      connection.verificationStatus,
      connection.lastWebhookAt ?? null,
      connection.phoneNumberId ?? null,
    );

    return {
      tenantId,
      state,
      source: 'meta_connection',
      phoneNumberId: connection.phoneNumberId ? String(connection.phoneNumberId) : null,
      displayPhoneNumber: connection.displayPhoneNumber ? String(connection.displayPhoneNumber) : null,
      // Uma validação ativa contra a Graph API (ex.: GET /{phone-number-id})
      // exigiria rede Meta — fora do escopo local. Nunca fingimos verificação.
      externalValidation: state === 'PENDING_VERIFICATION' ? 'BLOCKED_EXTERNAL_DEPENDENCY' : 'not_required',
      lastWebhookAt,
    };
  } catch {
    // DB indisponível → estado honesto desconhecido-configurado, nunca "conectado".
    return { ...base, state: 'CONNECTING', source: 'none' };
  }
}

/**
 * Converte o estado canônico para o flag legado `whatsappConnected`.
 * "Conectado" de verdade exige VERIFIED/HEALTHY — auto-declaração do cliente
 * NUNCA produz true.
 */
export function whatsappConnectedFromState(state: WhatsAppConnectionState): boolean {
  return state === 'VERIFIED' || state === 'HEALTHY';
}
