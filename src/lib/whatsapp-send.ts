/**
 * Utilitário de envio de mensagens via WhatsApp Cloud API oficial (Meta).
 * ============================================================================
 *
 * CORREÇÕES — onda Meta Foundation (Fase 2 / Fase 20):
 *  1. URL e VERSÃO da Graph API CENTRALIZADAS (meta-config.ts / env.ts).
 *     Nenhuma versão hardcoded aqui. A v21.0 hardcoded foi removida
 *     (encerramento da v21.0 pela Meta em janeiro/2027; v26.0 é a atual).
 *  2. Timeout obrigatório (AbortController) — sem fetch pendente eterno.
 *  3. SEM retry automático: um retry cego de /messages pode cobrar/entregar
 *     mensagens duplicadas. Falha é retornada ao caller (que decide).
 *  4. correlationId + tenantId opcionais para observabilidade (backward
 *     compatible: assinatura antiga continua funcionando).
 *  5. PRODUÇÃO SEM CREDENCIAIS = FALHA OPERACIONAL CLARA (success=false,
 *     isMock=false). O mock DB-only só é permitido explicitamente em
 *     desenvolvimento/teste — mock NUNCA passa como sucesso real em produção.
 *  6. Nenhum token é logado nem retornado.
 * ============================================================================
 */
import { metaGraphUrl, ACTIVE_META_GRAPH_API_VERSION } from '@/lib/meta/meta-config';
import { resolveTenantWhatsAppCredentials } from '@/lib/whatsapp/tenant-whatsapp-credentials';

export interface SendWhatsAppResponse {
  success: boolean;
  messageId?: string;
  isMock: boolean;
  error?: string;
  correlationId?: string;
  graphApiVersion?: string;
}

export interface SendWhatsAppOptions {
  /** Tenant dono da conexão (observabilidade multi-tenant). */
  tenantId?: string;
  /** Correlation id para rastrear o envio nos logs/telemetria. */
  correlationId?: string;
  /** Timeout por chunk (ms). Default 15000. */
  timeoutMs?: number;
}

const SEND_TIMEOUT_MS = 15_000;

/** Resultado do modo de envio — exposto para testes. */
export type SendMode =
  | { mode: 'live' }
  | { mode: 'mock'; reason: 'missing_credentials_in_dev_or_test' }
  | { mode: 'fail'; reason: 'missing_credentials_in_production' };

/**
 * Resolve o modo de envio (Fase 20.10):
 *  - Produção sem credenciais → FALHA OPERACIONAL (nunca mock, nunca sucesso falso).
 *  - Dev/teste sem credenciais → mock permitido explicitamente.
 *  - Mock forçado em produção exige env explícita (não recomendado; apenas
 *    para ambientes de demonstração isolados com ZELLA_ALLOW_WHATSAPP_MOCK=true).
 */
export function resolveSendMode(
  env: Record<string, string | undefined> = process.env
): SendMode {
  const hasCredentials = Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
  if (hasCredentials) return { mode: 'live' };

  if (env.NODE_ENV === 'production' && env.ZELLA_ALLOW_WHATSAPP_MOCK !== 'true') {
    return { mode: 'fail', reason: 'missing_credentials_in_production' };
  }
  return { mode: 'mock', reason: 'missing_credentials_in_dev_or_test' };
}

function newCorrelationId(): string {
  return `wa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Envia uma mensagem de texto para o número especificado no WhatsApp via Meta Cloud API.
 * Divide automaticamente a mensagem em partes (chunks) caso ultrapasse o limite de 4096 caracteres da Meta.
 *
 * @param toPhone - Número de telefone do destinatário com DDI (ex: 5511988888888)
 * @param text - Conteúdo da mensagem
 * @param options - tenantId/correlationId/timeoutMs opcionais (observabilidade)
 * @returns Promessa com o resultado do envio
 */
export async function sendWhatsAppMessage(
  toPhone: string,
  text: string,
  options: SendWhatsAppOptions = {}
): Promise<SendWhatsAppResponse> {
  const correlationId = options.correlationId || newCorrelationId();

  // ── RBW Fase K: número de envio POR TENANT ──
  // tenantId presente → MetaConnection do próprio tenant é a autoridade do
  // phoneNumberId (nunca o número global). Sem tenantId → comportamento
  // legado preservado (env global).
  const tenantResolution = options.tenantId
    ? await resolveTenantWhatsAppCredentials(options.tenantId)
    : null;
  const tenantPhoneNumberId = tenantResolution && tenantResolution.mode === 'tenant'
    ? tenantResolution.phoneNumberId
    : null;

  // ── RBW v2 (item 3.5): FAIL-CLOSED DE PRODUÇÃO ANTES DE QUALQUER FALLBACK ──
  // Tenant com tenantId em produção SEM resolução 'tenant' (sem conexão ou
  // conexão não verificada) NUNCA envia pelo número global — o global é de
  // OUTRO dono (plataforma/outro tenant) e quebraria o isolamento de respostas.
  // Em dev/teste o fallback global/mock pré-existente é preservado.
  if (
    tenantResolution &&
    tenantResolution.mode === 'none' &&
    tenantPhoneNumberId === null &&
    process.env.NODE_ENV === 'production'
  ) {
    const errorCode = tenantResolution.reason === 'tenant_connection_not_verified_in_production'
      ? 'WHATSAPP_TENANT_CONNECTION_NOT_VERIFIED_IN_PRODUCTION'
      : 'WHATSAPP_TENANT_NOT_CONNECTED_IN_PRODUCTION';
    console.error(
      `[whatsapp-send] ❌ PRODUÇÃO: tenant ${options.tenantId} SEM conexão própria verificada ` +
      `(${tenantResolution.reason}). Envio bloqueado — nunca enviamos pelo número global de OUTRO dono. correlationId=${correlationId}`
    );
    return {
      success: false,
      isMock: false,
      error: errorCode,
      correlationId,
      graphApiVersion: ACTIVE_META_GRAPH_API_VERSION,
    };
  }

  let sendMode = resolveSendMode();

  // Tenant com conexão própria + token de sistema: envio viável mesmo sem
  // WHATSAPP_PHONE_NUMBER_ID global (produção multi-tenant real).
  if (sendMode.mode === 'fail' && tenantPhoneNumberId && process.env.WHATSAPP_ACCESS_TOKEN) {
    sendMode = { mode: 'live' };
  }

  // ── Modo DB-only / Mock (dev/teste explicitamente permitido) ──
  if (sendMode.mode === 'mock') {
    console.log(
      `[whatsapp-send] [MOCK] Envio de mensagem para ${toPhone} em modo DB-only (motivo: ${sendMode.reason}).`
    );
    console.log(`[whatsapp-send] [MOCK] Conteúdo: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);

    // Simula atraso de rede
    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      success: true,
      messageId: `mock-wamid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      isMock: true,
      correlationId,
      graphApiVersion: ACTIVE_META_GRAPH_API_VERSION,
    };
  }

  // ── Produção sem credenciais: FALHA OPERACIONAL CLARA (Fase 20) ──
  if (sendMode.mode === 'fail') {
    // RBW Fase K/v2: distingue "tenant sem conexão verificada" (falha de
    // provisionamento do tenant) de "sistema sem credenciais" (falha de
    // plataforma). O caso tenant-sem-conexão em produção JÁ retornou acima
    // (fail-closed antes do fallback); aqui sobra apenas plataforma.
    console.error(
      `[whatsapp-send] ❌ PRODUÇÃO SEM CREDENCIAIS WHATSAPP (WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID). ` +
      `Envio bloqueado — mock NÃO é permitido em produção. correlationId=${correlationId}`
    );
    return {
      success: false,
      isMock: false,
      error: 'WHATSAPP_CREDENTIALS_MISSING_IN_PRODUCTION',
      correlationId,
      graphApiVersion: ACTIVE_META_GRAPH_API_VERSION,
    };
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN as string;
  // RBW Fase K: phoneNumberId do TENANT tem prioridade sobre o global.
  const phoneNumberId = (tenantPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID) as string;

  try {
    // Dividir a mensagem em blocos de no máximo 4000 caracteres para segurança
    const MAX_LENGTH = 4000;
    const messageChunks: string[] = [];

    if (text.length <= MAX_LENGTH) {
      messageChunks.push(text);
    } else {
      let remainingText = text;
      while (remainingText.length > 0) {
        if (remainingText.length <= MAX_LENGTH) {
          messageChunks.push(remainingText);
          break;
        }

        // Cortar em um espaço para evitar quebrar palavras
        let cutIndex = remainingText.lastIndexOf(' ', MAX_LENGTH);
        if (cutIndex === -1 || cutIndex < MAX_LENGTH - 200) {
          cutIndex = MAX_LENGTH; // Forçar corte rígido se não achar espaço conveniente
        }

        messageChunks.push(remainingText.substring(0, cutIndex).trim());
        remainingText = remainingText.substring(cutIndex).trim();
      }
    }

    let lastMessageId = '';

    for (const chunk of messageChunks) {
      // URL com versão CENTRALIZADA da Graph API (sem hardcoded — Fase 2)
      const endpoint = metaGraphUrl(`${phoneNumberId}/messages`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? SEND_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: toPhone,
            type: 'text',
            text: {
              preview_url: true,
              body: chunk,
            },
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error(
          '[whatsapp-send-error] Falha ao enviar mensagem no WhatsApp Cloud API:',
          data,
          `correlationId=${correlationId}`,
          options.tenantId ? `tenantId=${options.tenantId}` : ''
        );
        // SEM retry automático: reenvio cego pode duplicar cobrança/entrega.
        return {
          success: false,
          isMock: false,
          error:
            (data as { error?: { message?: string } })?.error?.message ||
            `META_WHATSAPP_SEND_FAILED_${response.status}`,
          correlationId,
          graphApiVersion: ACTIVE_META_GRAPH_API_VERSION,
        };
      }

      lastMessageId = (data as { messages?: Array<{ id?: string }> }).messages?.[0]?.id || '';
    }

    return {
      success: true,
      messageId: lastMessageId,
      isMock: false,
      correlationId,
      graphApiVersion: ACTIVE_META_GRAPH_API_VERSION,
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    console.error(
      '[whatsapp-send-error] Erro inesperado ao disparar fetch para API do WhatsApp:',
      error,
      `correlationId=${correlationId}`
    );
    return {
      success: false,
      isMock: false,
      error: isTimeout ? 'META_WHATSAPP_SEND_TIMEOUT' : 'META_WHATSAPP_SEND_NETWORK_ERROR',
      correlationId,
      graphApiVersion: ACTIVE_META_GRAPH_API_VERSION,
    };
  }
}
