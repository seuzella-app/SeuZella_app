/**
 * Gestão de Caução PIX — Depósito de segurança para anfitriões
 *
 * Fluxo:
 * 1. IA solicita caução via PIX no momento da reserva
 * 2. Hóspede paga caução (valor configurável por pousada)
 * 3. Sistema registra caução como "retenção"
 * 4. 24h após check-out, se não houver sinistro, estorna automaticamente
 * 5. Se houver sinistro, anfitrião marca no DDC e retém o valor
 */

import { db } from '@/lib/db';

export interface CautionRecord {
  id: string;
  tenantId: string;
  guestId: string;
  reservationId?: string;
  amount: number;
  pixKey: string;
  pixKeyType: string;
  status: 'pending' | 'collected' | 'held' | 'returned' | 'retained';
  collectedAt?: string;
  scheduledReturnAt?: string;
  returnedAt?: string;
  retainedReason?: string;
  hasIncident: boolean;
  incidentDescription?: string;
  createdAt: string;
}

/**
 * Cria caução pendente para uma reserva.
 */
export async function createCaution(params: {
  tenantId: string;
  guestId: string;
  reservationId?: string;
  amount: number;
  pixKey: string;
  pixKeyType: string;
  checkoutDate?: Date;
}): Promise<CautionRecord> {
  const scheduledReturn = params.checkoutDate
    ? new Date(params.checkoutDate.getTime() + 24 * 60 * 60 * 1000)
    : undefined;

  const caution: CautionRecord = {
    id: `caution_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: params.tenantId,
    guestId: params.guestId,
    reservationId: params.reservationId,
    amount: params.amount,
    pixKey: params.pixKey,
    pixKeyType: params.pixKeyType,
    status: 'pending',
    scheduledReturnAt: scheduledReturn?.toISOString(),
    hasIncident: false,
    createdAt: new Date().toISOString(),
  };

  try {
    if (db && (db as any).transaction) {
      await (db as any).transaction.create({
        data: {
          tenantId: params.tenantId,
          type: 'CHARGE',
          amount: params.amount,
          method: 'PIX',
          status: 'PENDING',
          metadata: JSON.stringify({ type: 'caution', caution }),
        },
      });
    }
  } catch (err) {
    console.warn('[Caution] DB persistence failed:', err);
  }

  return caution;
}

/**
 * Marca caução como coletada (pagamento confirmado).
 */
export async function confirmCautionCollected(cautionId: string): Promise<void> {
  try {
    if (db && (db as any).transaction) {
      const tx = await (db as any).transaction.findFirst({
        where: { metadata: { contains: cautionId } },
      });
      if (!tx) return;

      const meta = JSON.parse(tx.metadata || '{}');
      meta.caution.status = 'collected';
      meta.caution.collectedAt = new Date().toISOString();

      await (db as any).transaction.update({
        where: { id: tx.id },
        data: { status: 'COMPLETED', metadata: JSON.stringify(meta) },
      });
    }
  } catch (err) {
    console.warn('[Caution] Confirm collected failed:', err);
  }
}

/**
 * Registra sinistro (dano) e retém caução.
 */
export async function reportIncident(cautionId: string, description: string): Promise<void> {
  try {
    if (db && (db as any).transaction) {
      const tx = await (db as any).transaction.findFirst({
        where: { metadata: { contains: cautionId } },
      });
      if (!tx) return;

      const meta = JSON.parse(tx.metadata || '{}');
      meta.caution.hasIncident = true;
      meta.caution.incidentDescription = description;
      meta.caution.status = 'retained';
      meta.caution.retainedReason = description;

      await (db as any).transaction.update({
        where: { id: tx.id },
        data: { metadata: JSON.stringify(meta) },
      });
    }
  } catch (err) {
    console.warn('[Caution] Report incident failed:', err);
  }
}

/**
 * Estorna caução automaticamente (24h pós check-out sem sinistro).
 */
export async function autoReturnCautions(): Promise<{ returned: number; retained: number }> {
  let returned = 0;
  let retained = 0;

  try {
    if (!db || !(db as any).transaction) return { returned: 0, retained: 0 };

    // Busca cações com scheduledReturnAt vencido
    const now = new Date().toISOString();
    const txs = await (db as any).transaction.findMany({
      where: {
        type: 'CHARGE',
        status: 'COMPLETED',
        metadata: { contains: '"type":"caution"' },
      },
      take: 100,
    });

    for (const tx of txs) {
      const meta = JSON.parse(tx.metadata || '{}');
      if (meta.type !== 'caution' || !meta.caution) continue;

      const caution = meta.caution as CautionRecord;

      // Se já foi retornada ou retida, pula
      if (caution.status === 'returned' || caution.status === 'retained') continue;

      // Se tem sinistro, retém
      if (caution.hasIncident) {
        caution.status = 'retained';
        meta.caution = caution;
        await (db as any).transaction.update({
          where: { id: tx.id },
          data: { metadata: JSON.stringify(meta) },
        });
        retained++;
        continue;
      }

      // Se scheduledReturn venceu, estorna
      if (caution.scheduledReturnAt && new Date(caution.scheduledReturnAt) < new Date()) {
        caution.status = 'returned';
        caution.returnedAt = new Date().toISOString();
        meta.caution = caution;
        await (db as any).transaction.update({
          where: { id: tx.id },
          data: { status: 'REFUNDED', metadata: JSON.stringify(meta) },
        });
        returned++;
      }
    }
  } catch (err) {
    console.warn('[Caution] Auto-return failed:', err);
  }

  return { returned, retained };
}

/**
 * Gera mensagem WhatsApp solicitando caução.
 */
export function generateCautionMessage(amount: number, pixKey: string, pixKeyType: string): string {
  return `🔒 Caução (depósito de segurança)

Para garantir sua reserva, precisamos de uma caução de R$ ${amount.toFixed(2)}.
Este valor será estornado automaticamente 24h após seu check-out, caso não haja danos.

💳 PIX (${pixKeyType.toUpperCase()}): ${pixKey}

A caução é uma prática comum em hospedagem e protege tanto você quanto o imóvel. 😊`;
}
