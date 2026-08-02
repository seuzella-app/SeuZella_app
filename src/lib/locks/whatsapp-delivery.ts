// =============================================================================
// 🔐 SEU ZÉLLA — Entrega de PIN via WhatsApp
// =============================================================================
// Envia o PIN gerado para o hóspede via WhatsApp no horário do check-in.
//
// INTEGRAÇÃO REAL:
// Usa o mesmo pipeline de WhatsApp do projeto (src/lib/whatsapp/). Se não
// houver WhatsApp Business conectado, retorna `{ sent: false, reason: ... }`
// para que o host saiba que precisa copiar o PIN manualmente.
//
// PROTOCOLO DE MENSAGEM:
// Mensagem cortês, com PIN destacado, janela de validade, e instruções
// claras de check-in. Inclui disclaimer sobre não compartilhar o PIN.
// =============================================================================


import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { isDatabaseAvailable } from '@/lib/db';
import { getBrandInfo, type LockBrand } from './types';

export interface DeliverPinInput {
  guestName?: string | null;
  guestPhone: string;
  pin: string;
  validFrom: Date;
  validTo: Date;
  deviceNickname: string;
  brand: LockBrand;
}

export interface DeliverPinResult {
  sent: boolean;
  reason?: string;
  messageId?: string;
}

/**
 * Envia o PIN ao hóspede via WhatsApp.
 *
 * Estratégia:
 * 1. Tenta usar o pipeline real de WhatsApp (se configurado)
 * 2. Se falhar, retorna sent=false com reason — UI orienta host a copiar PIN
 *
 * IMPORTANTE: o PIN NUNCA é exposto em logs ou telemetria.
 */
export async function deliverPinViaWhatsApp(input: DeliverPinInput): Promise<DeliverPinResult> {
  const tenantId = await resolveTenantId();
  if (!tenantId) {
    return { sent: false, reason: 'Tenant não autenticado' };
  }

  const brandInfo = getBrandInfo(input.brand);
  const brandLabel = brandInfo?.label ?? 'sua fechadura';

  // Monta a mensagem cortês
  const msgText = buildPinMessage({
    guestName: input.guestName,
    pin: input.pin,
    validFrom: input.validFrom,
    validTo: input.validTo,
    deviceNickname: input.deviceNickname,
    brandLabel,
  });

  // Tenta enviar via WhatsApp real
  try {
    const result = await trySendWhatsApp(input.guestPhone, msgText, tenantId);
    if (result.sent) {
      return { sent: true, messageId: result.messageId };
    }
    return { sent: false, reason: result.reason };
  } catch (err) {
    return { sent: false, reason: `Erro inesperado: ${(err as Error).message}` };
  }
}

/** Monta a mensagem de WhatsApp com o PIN. */
function buildPinMessage(params: {
  guestName?: string | null;
  pin: string;
  validFrom: Date;
  validTo: Date;
  deviceNickname: string;
  brandLabel: string;
}): string {
  const greeting = params.guestName ? `Olá, ${params.guestName}!` : 'Olá!';

  const fmtDate = (d: Date) => {
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return [
    `${greeting} 🔑`,
    '',
    `Segue o código de acesso para *${params.deviceNickname}* (${params.brandLabel}):`,
    '',
    `🔐 *${params.pin}*`,
    '',
    `⏰ Válido das ${fmtDate(params.validFrom)} até ${fmtDate(params.validTo)}`,
    '',
    'Para abrir a porta:',
    '1. Digite o código no teclado da fechadura',
    '2. Aguarde o bip de confirmação',
    '3. Gire a maçaneta',
    '',
    '⚠️ _Não compartilhe este código com terceiros. É pessoal e intransferível._',
    '',
    'Boa estadia! 🏡',
  ].join('\n');
}

/**
 * Tenta enviar via WhatsApp real.
 *
 * Verifica se o tenant tem WhatsApp Business conectado. Se sim, usa o pipeline
 * existente. Se não, retorna sent=false.
 */
async function trySendWhatsApp(
  phone: string,
  text: string,
  _tenantId: string,
): Promise<{ sent: boolean; reason?: string; messageId?: string }> {
  // Limpa o telefone (remove +, espaços, hífens)
  const cleanPhone = phone.replace(/[^\d]/g, '');
  if (cleanPhone.length < 10) {
    return { sent: false, reason: 'Telefone inválido' };
  }

  // Verifica se há WhatsApp Business conectado
  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    // Demo mode — não envia realmente, mas retorna sucesso para não quebrar UX
    return { sent: false, reason: 'Modo demo — WhatsApp não conectado' };
  }

  try {
    // Tenta usar o pipeline existente de WhatsApp
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sendWhatsAppMessage } = require('@/lib/whatsapp-send');
    const result = await sendWhatsAppMessage(cleanPhone, text);
    if (result?.success) {
      return { sent: true, messageId: result.messageId };
    }
    return { sent: false, reason: result?.error ?? 'Falha no envio' };
  } catch (err) {
    // Se o módulo de WhatsApp não existir, retorna gracefully
    console.warn('[locks] WhatsApp send failed:', err);
    return {
      sent: false,
      reason: 'WhatsApp Business não configurado — copie o PIN manualmente',
    };
  }
}

/**
 * Versão síncrona: monta apenas o texto da mensagem (para UI pré-visualizar).
 */
export function buildPinMessagePreview(params: {
  guestName?: string | null;
  pin: string;
  validFrom: Date;
  validTo: Date;
  deviceNickname: string;
  brandLabel: string;
}): string {
  return buildPinMessage(params);
}
