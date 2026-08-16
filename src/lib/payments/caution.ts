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
  status: 'pending' | 'collected' | 'held' | 'returned' | 'retained' | 'disabled';
  collectedAt?: string;
  scheduledReturnAt?: string;
  returnedAt?: string;
  retainedReason?: string;
  hasIncident: boolean;
  incidentDescription?: string;
  createdAt: string;
}

export interface CautionSettings {
  habilitada: boolean;
  valorPadrao: number;
  janelaEstornoH: number;
  mensagemCustom?: string;
}

/**
 * Lê as configurações de Caução PIX do Property do tenant.
 * Se db não disponível ou property não encontrado, retorna defaults habilitados.
 */
export async function getCautionSettings(tenantId: string): Promise<CautionSettings> {
  try {
    if (!db) {
      return { habilitada: true, valorPadrao: 200, janelaEstornoH: 24 };
    }
    const property = await (db as any).property.findFirst({
      where: { tenantId },
      select: {
        caucaoHabilitada: true,
        caucaoValorPadrao: true,
        caucaoJanelaEstornoH: true,
        caucaoMensagemCustom: true,
      },
    });
    if (!property) {
      return { habilitada: true, valorPadrao: 200, janelaEstornoH: 24 };
    }
    return {
      habilitada: property.caucaoHabilitada ?? true,
      valorPadrao: property.caucaoValorPadrao ?? 200,
      janelaEstornoH: property.caucaoJanelaEstornoH ?? 24,
      mensagemCustom: property.caucaoMensagemCustom ?? '',
    };
  } catch {
    return { habilitada: true, valorPadrao: 200, janelaEstornoH: 24 };
  }
}

/**
 * Atualiza as configurações de Caução PIX do Property do tenant.
 * Chamada pela API PATCH /api/ddc/caution/settings (RBAC: owner/admin).
 */
export async function updateCautionSettings(
  tenantId: string,
  settings: Partial<CautionSettings>
): Promise<CautionSettings> {
  try {
    if (!db) {
      return { habilitada: settings.habilitada ?? true, valorPadrao: settings.valorPadrao ?? 200, janelaEstornoH: settings.janelaEstornoH ?? 24, mensagemCustom: settings.mensagemCustom };
    }
    const data: Record<string, unknown> = {};
    if (typeof settings.habilitada === 'boolean') data.caucaoHabilitada = settings.habilitada;
    if (typeof settings.valorPadrao === 'number') data.caucaoValorPadrao = settings.valorPadrao;
    if (typeof settings.janelaEstornoH === 'number') data.caucaoJanelaEstornoH = settings.janelaEstornoH;
    if (typeof settings.mensagemCustom === 'string') data.caucaoMensagemCustom = settings.mensagemCustom;

    if (Object.keys(data).length > 0) {
      await (db as any).property.updateMany({ where: { tenantId }, data });
    }
    return getCautionSettings(tenantId);
  } catch (err) {
    console.warn('[Caution] update settings failed:', err);
    return getCautionSettings(tenantId);
  }
}

/**
 * Cria caução pendente para uma reserva.
 * RESPEITA O TOGGLE: se caucaoHabilitada=false no Property do tenant,
 * retorna early com status 'disabled' (não cria transação, não cobra hóspede).
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
  // ─────────────────────────────────────────────────────────────────────────
  // GUARDA DE TOGGLE: se a pousada desabilitou caução, retorna registro 'disabled'
  // sem persistir transação, sem enviar mensagem ao hóspede, sem criar retenção.
  // ─────────────────────────────────────────────────────────────────────────
  const settings = await getCautionSettings(params.tenantId);
  if (!settings.habilitada) {
    return {
      id: `caution_disabled_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId: params.tenantId,
      guestId: params.guestId,
      reservationId: params.reservationId,
      amount: 0,
      pixKey: '',
      pixKeyType: '',
      status: 'disabled',
      hasIncident: false,
      createdAt: new Date().toISOString(),
    };
  }

  // Respeita valor default configurado pelo dono, se amount não informado
  const effectiveAmount = params.amount > 0 ? params.amount : settings.valorPadrao;
  const janelaEstornoH = settings.janelaEstornoH > 0 ? settings.janelaEstornoH : 24;

  const scheduledReturn = params.checkoutDate
    ? new Date(params.checkoutDate.getTime() + janelaEstornoH * 60 * 60 * 1000)
    : undefined;

  const caution: CautionRecord = {
    id: `caution_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: params.tenantId,
    guestId: params.guestId,
    reservationId: params.reservationId,
    amount: effectiveAmount,
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
          amount: effectiveAmount,
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
 * Se o dono cadastrou uma mensagem customizada, usa ela (substituindo placeholders).
 * Placeholders: {valor}, {pixKey}, {pixKeyType}, {janelaEstornoH}
 */
export function generateCautionMessage(
  amount: number,
  pixKey: string,
  pixKeyType: string,
  customMessage?: string,
  janelaEstornoH: number = 24
): string {
  if (customMessage && customMessage.trim().length > 10) {
    return customMessage
      .replace(/\{valor\}/gi, amount.toFixed(2))
      .replace(/\{pixKey\}/gi, pixKey)
      .replace(/\{pixKeyType\}/gi, pixKeyType.toUpperCase())
      .replace(/\{janelaEstornoH\}/gi, String(janelaEstornoH));
  }

  // Mensagem padrão: máxima 2 emojis, linguagem simples PT-BR
  return `Oi! Para concluir sua reserva, precisamos de uma caução de R$ ${amount.toFixed(2)}.

🔒 Esse valor é devolvido automaticamente ${janelaEstornoH}h após seu check-out, caso não tenha nenhum dano no quarto.

PIX (${pixKeyType.toUpperCase()}): ${pixKey}

É uma prática comum em hotéis e pousadas do Brasil — protege você e o imóvel. Qualquer dúvida, é só chamar aqui!`;
}
