/**
 * Housekeeping Dispatch — Orquestrador de Limpeza
 *
 * Quando hóspede faz check-out (fechadura ou WhatsApp), dispara
 * mensagem automática para equipe de limpeza.
 * Gerencia status: Ocupado → Aguardando Limpeza → Limpo/Liberado
 */

import { db } from '@/lib/db';

export type RoomStatus = 'occupied' | 'checkout_detected' | 'awaiting_cleaning' | 'cleaning' | 'clean' | 'maintenance';

export interface HousekeepingEvent {
  id: string;
  tenantId: string;
  roomId?: string;
  roomName: string;
  guestName?: string;
  event: 'checkout' | 'cleaning_started' | 'cleaning_completed' | 'maintenance';
  status: RoomStatus;
  message: string;
  cleaningTeamPhone?: string;
  nextCheckInTime?: string;
  createdAt: string;
}

/**
 * Detecta check-out via fechadura ou mensagem WhatsApp e dispara limpeza.
 */
export async function handleCheckoutEvent(params: {
  tenantId: string;
  roomId?: string;
  roomName: string;
  guestName?: string;
  nextCheckInTime?: string;
  cleaningTeamPhone?: string;
}): Promise<HousekeepingEvent> {
  const event: HousekeepingEvent = {
    id: `hk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: params.tenantId,
    roomId: params.roomId,
    roomName: params.roomName,
    guestName: params.guestName,
    event: 'checkout',
    status: 'checkout_detected',
    message: `Quarto ${params.roomName} liberado para limpeza!${params.nextCheckInTime ? ` Próximo check-in: ${params.nextCheckInTime}` : ''}`,
    cleaningTeamPhone: params.cleaningTeamPhone,
    nextCheckInTime: params.nextCheckInTime,
    createdAt: new Date().toISOString(),
  };

  // Atualiza status do quarto no DB
  try {
    if (db && (db as any).room) {
      await (db as any).room.updateMany({
        where: {
          tenantId: params.tenantId,
          ...(params.roomId ? { id: params.roomId } : {}),
        },
        data: { status: 'awaiting_cleaning' },
      });
    }
  } catch (err) {
    console.warn('[Housekeeping] Room status update failed:', err);
  }

  // Envia WhatsApp para equipe de limpeza
  if (params.cleaningTeamPhone) {
    try {
      const { sendWhatsAppMessage } = await import('@/lib/whatsapp-send');
      // Onda correção/hardening: assinatura posicional correta
      // (toPhone, text, options) — a forma objeto nunca existiu.
      await sendWhatsAppMessage(
        params.cleaningTeamPhone,
        `🧹 ${event.message}${params.guestName ? `\nHóspede: ${params.guestName}` : ''}`,
        { tenantId: params.tenantId }
      );
      console.log(`[Housekeeping] Mensagem enviada para equipe de limpeza (${params.cleaningTeamPhone})`);
    } catch (err) {
      console.warn('[Housekeeping] WhatsApp send failed:', err);
    }
  }

  return event;
}

/**
 * Marca quarto como limpo/pronto.
 */
export async function markRoomClean(params: {
  tenantId: string;
  roomId?: string;
  roomName: string;
  cleanedBy?: string;
}): Promise<void> {
  try {
    if (db && (db as any).room) {
      await (db as any).room.updateMany({
        where: {
          tenantId: params.tenantId,
          ...(params.roomId ? { id: params.roomId } : {}),
        },
        data: { status: 'available' },
      });
    }
    console.log(`[Housekeeping] Quarto ${params.roomName} marcado como limpo`);
  } catch (err) {
    console.warn('[Housekeeping] Mark clean failed:', err);
  }
}

/**
 * Gera mensagem de confirmação de check-out para o hóspede.
 */
export function generateCheckoutConfirmation(guestName?: string, roomName?: string): string {
  return `Obrigado pela sua estádia${guestName ? `, ${guestName}` : ''}! 🌟

Esperamos que tenha aproveitado! Seu check-out foi registrado${roomName ? ` (Quarto ${roomName})` : ''}.

Avalie sua experiência: 👍 (ótimo) ou 👎 (pode melhorar)

Até a próxima! 🏖️`;
}

/**
 * Verifica se mensagem do hóspede indica check-out.
 */
export function detectCheckoutIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const patterns = [
    /\b(j[áa] sa[ií]|estou indo embora|check[\s-]?out|saindo|liberei o quarto|deixei as chaves)\b/i,
    /\b(vou embora|at[ée] mais|at[ée] logo|obrigad[oa] pela estadia)\b/i,
  ];
  return patterns.some(p => p.test(lower));
}
