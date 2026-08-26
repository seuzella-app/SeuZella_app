// ==============================================================================
// ZÉLLA — LGPD Consent Module (Lei Geral de Proteção de Dados — Lei 13.709/2018)
// ==============================================================================
// Responsável por registrar e validar consentimento de marketing de hóspedes.
// Refatoração v2: normalização robusta de keywords (acentos, pontuação, prefixo)
// + registro de método de opt-out para auditoria completa.
// ==============================================================================

import { db } from '@/lib/db';

interface ConsentParams {
  tenantId: string;
  guestId: string;
  channel?: string;
  ip?: string;
  userAgent?: string;
  evidence?: string;
}

/**
 * Registra Opt-In ativo de marketing para um hóspede.
 * Atualiza o Guest e loga a evidência do consentimento em ConsentLog.
 * Transação atômica: ou ambos são escritos, ou nenhum.
 */
export async function registerOptIn(params: ConsentParams): Promise<void> {
  const { tenantId, guestId, channel = 'whatsapp', ip, userAgent, evidence = '{}' } = params;
  const now = new Date();

  try {
    await db.$transaction([
      db.guest.update({
        where: { id: guestId },
        data: {
          optInAt: now,
          optInMethod: channel,
          optOutAt: null, // Limpa opt-out anterior se houver
          optOutMethod: null,
        },
      }),
      db.consentLog.create({
        data: {
          tenantId,
          guestId,
          type: 'opt_in',
          channel,
          ip,
          userAgent,
          evidence,
        },
      }),
    ]);
  } catch (error) {
    console.error('[LGPD] registerOptIn falhou:', { tenantId, guestId, channel, error });
    throw error; // Re-lança para caller tratar (não silenciamos falha LGPD)
  }
}

/**
 * Registra Opt-Out (revogação) de marketing para um hóspede.
 * Atualiza Guest e loga a revogação em ConsentLog.
 */
export async function registerOptOut(params: ConsentParams): Promise<void> {
  const { tenantId, guestId, channel = 'whatsapp', ip, userAgent, evidence = '{}' } = params;
  const now = new Date();

  try {
    await db.$transaction([
      db.guest.update({
        where: { id: guestId },
        data: {
          optOutAt: now,
          optOutMethod: channel,
        },
      }),
      db.consentLog.create({
        data: {
          tenantId,
          guestId,
          type: 'opt_out',
          channel,
          ip,
          userAgent,
          evidence,
        },
      }),
    ]);
  } catch (error) {
    console.error('[LGPD] registerOptOut falhou:', { tenantId, guestId, channel, error });
    throw error;
  }
}

/**
 * Keywords de opt-out configuráveis via env.
 * Inclui variantes comuns em PT-BR e EN para atender hóspedes estrangeiros.
 * Configurável via LGPD_OPT_OUT_KEYWORDS (CSV) para flexibilidade sem redeploy.
 */
const OPT_OUT_KEYWORDS: readonly string[] = (
  process.env.LGPD_OPT_OUT_KEYWORDS ||
  'SAIR,STOP,PARAR,CANCELAR,DESCADASTRAR,UNSUBSCRIBE,NAOQUERO,NÃOQUERO,REMOVER,OPTOUT'
)
  .split(',')
  .map((k) => k.trim().toUpperCase())
  .filter((k) => k.length > 0);

/**
 * Detecta se uma mensagem do hóspede é um pedido de opt-out (LGPD).
 *
 * Normalização robusta:
 *  1. Remove acentos (NFD + strip combining marks)
 *  2. Uppercase + trim
 *  3. Remove pontuação final (.!?;,)
 *  4. Match exato OU como primeira palavra (ex: "SAIR por favor")
 *
 * Cobre casos comuns que falhariam com a versão anterior:
 *  - "SAÍR" (com acento)
 *  - "sair!" (com pontuação)
 *  - "Sair." (capitalize + ponto)
 *  - "STOP agora" (palavra + contexto)
 */
export function isOptOutMessage(text: string | undefined | null): boolean {
  if (!text || typeof text !== 'string') return false;

  // 1. Remove acentos: NFD separa base de combining marks, regex strip os marks
  const noAccents = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 2. Uppercase + trim + remove pontuação final
  const normalized = noAccents.toUpperCase().trim().replace(/[.!?,;:]+$/g, '');

  if (!normalized) return false;

  // 3. Match exato OU primeira palavra (permite "SAIR por favor", "STOP agora")
  return OPT_OUT_KEYWORDS.some((kw) => {
    if (normalized === kw) return true;
    if (normalized.startsWith(`${kw } `)) return true;
    if (normalized.startsWith(`${kw },`)) return true;
    return false;
  });
}

/**
 * Processa o opt-out: atualiza Guest, registra em ConsentLog, retorna mensagem de confirmação.
 *
 * Atualiza optOutMethod para permitir auditoria completa (de onde veio o opt-out).
 *
 * @returns Mensagem de confirmação para enviar ao hóspede
 */
export async function handleOptOut(
  tenantId: string,
  guestId: string,
  channel: string = 'whatsapp'
): Promise<string> {
  try {
    await registerOptOut({
      tenantId,
      guestId,
      channel,
      evidence: JSON.stringify({
        source: 'keyword_detection',
        channel,
        timestamp: new Date().toISOString(),
      }),
    });

    return (
      'Entendido! Você foi removido da nossa lista de comunicações de marketing. ' +
      'Se quiser voltar a receber mensagens promocionais, basta nos contatar novamente. ' +
      'Mensagens de serviço (reservas, suporte) continuam sendo enviadas normalmente.'
    );
  } catch (error) {
    console.error('[LGPD] handleOptOut falhou:', { tenantId, guestId, channel, error });
    // Retorno gracioso: hóspede não pode ficar sem confirmação mesmo em erro de DB
    return 'Recebemos seu pedido de cancelamento. Se houver qualquer problema, entre em contato pelo nosso canal de suporte.';
  }
}

/**
 * Verifica se o hóspede tem consentimento de marketing ativo (LGPD Art. 8°).
 *
 * Consentimento é ativo quando:
 *  - optInAt está definido (hóspede optou em algum momento)
 *  - optOutAt é null (não revogou posteriormente)
 *
 * Retorna false em qualquer cenário de dúvida (fail-closed LGPD).
 */
export async function canSendMarketing(tenantId: string, guestId: string): Promise<boolean> {
  try {
    const guest = await db.guest.findFirst({
      where: {
        id: guestId,
        tenantId, // Filtro multi-tenant obrigatório
      },
      select: {
        optInAt: true,
        optOutAt: true,
      },
    });

    if (!guest) return false;
    if (guest.optOutAt) return false; // Revogação tem precedência
    if (!guest.optInAt) return false; // Nunca optou

    return true;
  } catch (error) {
    console.error('[LGPD] canSendMarketing falhou (fail-closed):', { tenantId, guestId, error });
    return false; // Fail-closed: em caso de erro, NÃO envia marketing
  }
}
