/**
 * UPSELL Engine — Comissão Zélla de 6% sobre valores extras por quarto
 * ============================================================================
 *
 * FILOSOFIA:
 *   - Valores NORMAIS das diárias (dia a dia): ZERO taxa para a pousada.
 *     A Zélla não cobra nada sobre o preço base de R$ 350/noite, por exemplo.
 *   - Valores de UPSELL sugeridos pela IA Zélla (late checkout, café premium,
 *     massagem, passeio de barco, etc.): 6% de comissão creditada à seuzella.com.
 *
 * EXEMPLO PRÁTICO:
 *   - Hóspede reserva 3 diárias × R$ 350 = R$ 1.050 (valor normal → 0% taxa)
 *   - Hóspede aceita late checkout +4h: R$ 200 extra (UPSELL → 6% = R$ 12)
 *   - Hóspede aceita café premium 3×: R$ 105 extra (UPSELL → 6% = R$ 6,30)
 *   - Total: R$ 1.355 para a pousada, R$ 18,30 de comissão Zélla
 *
 * COMO É DESCONTADO:
 *   - A cada UPSELL confirmado, o sistema registra o valor e a comissão.
 *   - Mensalmente, a pousada paga a comissão acumulada à seuzella.com.
 *   - O DDC mostra em tempo real o total de comissão acumulada no mês.
 * ============================================================================
 */

import { db } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export type UpsellType =
  | 'late_checkout'           // extensão de horário de check-out (R$ 50/hora extra)
  | 'cafe_premium'           // café da manhã premium (R$ 35/diária)
  | 'massagem'               // massagem relaxante (R$ 150/sessão)
  | 'passeio_barco'          // passeio de barco (R$ 120/pessoa)
  | 'transfer_aeroporto'     // transfer ida/volta aeroporto (R$ 80)
  | 'jantar_romantico'       // jantar romântico montado no quarto (R$ 200)
  | 'decoracao_aniversario'  // decoração quarto para aniversário (R$ 90)
  | 'garrafa_vinho'          // garrafa de vinho (R$ 70)
  | 'aula_surf'              // aula de surf (R$ 100/pessoa)
  | 'passeio_bugue'          // passeio de bugue (R$ 90/pessoa)
  | 'spa_day'                // spa day com hidratação (R$ 250)
  | 'kit_praia'              // kit praia: guarda-sol + cadeiras (R$ 50/diária)
  | 'late_checkin_madrugada' // late check-in madrugada (R$ 30)
  | 'limpeza_diaria_extra'  // limpeza extra (R$ 40)
  | 'outros';                // outros (descrição livre)

export type UpsellStatus = 'pending' | 'confirmed' | 'paid' | 'cancelled';
export type Temporada = 'alta' | 'média' | 'baixa';

export interface UpsellRecord {
  id: string;
  tenantId: string;
  roomId?: string;
  reservationId?: string;
  guestId?: string;
  type: UpsellType;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  comissionRate: number;  // 0.06 = 6%
  comissionAmount: number; // totalPrice * comissionRate
  status: UpsellStatus;
  paidAt?: Date;
  confirmedAt?: Date;
  suggestedByZehla: boolean;
  feriado?: string;
  temporada?: Temporada;
  yieldMultiplier?: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES — Taxa Zélla e tipos padrão
// ─────────────────────────────────────────────────────────────────────────────
export const COMISSAO_ZELLA_RATE = 0.06; // 6% sobre UPSELL (zero em valores normais)

export const UPSELL_TYPES_CATALOG: Record<UpsellType, {
  label: string;
  description: string;
  defaultPrice: number;
  unitLabel: string;
}> = {
  late_checkout: {
    label: 'Check-out estendido (late checkout)',
    description: 'Extensão do horário de check-out. R$ 50 por hora extra.',
    defaultPrice: 50,
    unitLabel: 'hora',
  },
  cafe_premium: {
    label: 'Café da manhã premium',
    description: 'Café da manhã premium com itens especiais. R$ 35 por diária.',
    defaultPrice: 35,
    unitLabel: 'diária',
  },
  massagem: {
    label: 'Massagem relaxante',
    description: 'Massagem relaxante no quarto ou no spa. R$ 150 por sessão.',
    defaultPrice: 150,
    unitLabel: 'sessão',
  },
  passeio_barco: {
    label: 'Passeio de barco',
    description: 'Passeio de barco pela região. R$ 120 por pessoa.',
    defaultPrice: 120,
    unitLabel: 'pessoa',
  },
  transfer_aeroporto: {
    label: 'Transfer aeroporto',
    description: 'Transfer ida ou volta ao aeroporto. R$ 80 por trajeto.',
    defaultPrice: 80,
    unitLabel: 'trajeto',
  },
  jantar_romantico: {
    label: 'Jantar romântico',
    description: 'Jantar romântico montado no quarto. R$ 200.',
    defaultPrice: 200,
    unitLabel: 'evento',
  },
  decoracao_aniversario: {
    label: 'Decoração de aniversário',
    description: 'Decoração do quarto para comemoração de aniversário. R$ 90.',
    defaultPrice: 90,
    unitLabel: 'evento',
  },
  garrafa_vinho: {
    label: 'Garrafa de vinho',
    description: 'Garrafa de vinho no quarto. R$ 70.',
    defaultPrice: 70,
    unitLabel: 'garrafa',
  },
  aula_surf: {
    label: 'Aula de surf',
    description: 'Aula de surf com instrutor. R$ 100 por pessoa.',
    defaultPrice: 100,
    unitLabel: 'pessoa',
  },
  passeio_bugue: {
    label: 'Passeio de bugue',
    description: 'Passeio de bugue pelas dunas. R$ 90 por pessoa.',
    defaultPrice: 90,
    unitLabel: 'pessoa',
  },
  spa_day: {
    label: 'Spa day (hidratação)',
    description: 'Dia completo de spa com hidratação. R$ 250 por pessoa.',
    defaultPrice: 250,
    unitLabel: 'pessoa',
  },
  kit_praia: {
    label: 'Kit praia (guarda-sol + cadeiras)',
    description: 'Kit praia: guarda-sol + 2 cadeiras. R$ 50 por diária.',
    defaultPrice: 50,
    unitLabel: 'diária',
  },
  late_checkin_madrugada: {
    label: 'Late check-in (madrugada)',
    description: 'Check-in na madrugada (após 23h). R$ 30.',
    defaultPrice: 30,
    unitLabel: 'evento',
  },
  limpeza_diaria_extra: {
    label: 'Limpeza diária extra',
    description: 'Limpeza extra do quarto. R$ 40.',
    defaultPrice: 40,
    unitLabel: 'evento',
  },
  outros: {
    label: 'Outros',
    description: 'Outro tipo de UPSELL. Descrição livre.',
    defaultPrice: 0,
    unitLabel: 'unidade',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LÓGICA DE NEGÓCIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula o valor da comissão Zélla (6%) sobre um UPSELL.
 * ZERO sobre valores normais das diárias.
 */
export function calcularComissaoZehla(totalPrice: number, rate: number = COMISSAO_ZELLA_RATE): number {
  if (totalPrice <= 0) return 0;
  return Number((totalPrice * rate).toFixed(2));
}

/**
 * Cria um registro de UPSELL.
 *
 * @example
 * await criarUpsell({
 *   tenantId: 'cli_xxx',
 *   roomId: 'room_yyy',
 *   reservationId: 'res_zzz',
 *   guestId: 'guest_www',
 *   type: 'late_checkout',
 *   quantity: 4,  // 4 horas extras
 *   unitPrice: 50, // R$ 50/hora
 *   suggestedByZehla: true,
 *   feriado: 'Réveillon',
 *   temporada: 'alta',
 * });
 */
export async function criarUpsell(params: {
  tenantId: string;
  roomId?: string;
  reservationId?: string;
  guestId?: string;
  type: UpsellType;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  suggestedByZehla?: boolean;
  feriado?: string;
  temporada?: Temporada;
  yieldMultiplier?: number;
  notes?: string;
}): Promise<UpsellRecord | null> {
  try {
    const catalog = UPSELL_TYPES_CATALOG[params.type];
    const quantity = params.quantity ?? 1;
    const unitPrice = params.unitPrice ?? catalog.defaultPrice;
    const totalPrice = Number((unitPrice * quantity).toFixed(2));
    const comissionAmount = calcularComissaoZehla(totalPrice);

    const data = {
      tenantId: params.tenantId,
      roomId: params.roomId ?? null,
      reservationId: params.reservationId ?? null,
      guestId: params.guestId ?? null,
      type: params.type,
      description: params.description ?? catalog.description,
      quantity,
      unitPrice,
      totalPrice,
      comissionRate: COMISSAO_ZELLA_RATE,
      comissionAmount,
      status: 'pending' as const,
      suggestedByZehla: params.suggestedByZehla ?? true,
      feriado: params.feriado ?? null,
      temporada: params.temporada ?? null,
      yieldMultiplier: params.yieldMultiplier ?? null,
      notes: params.notes ?? '',
    };

    if (!db || !(db as any).upsellRecord) {
      // Sem banco — retorna objeto em memória
      return {
        id: `upsell_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ...data,
        paidAt: undefined,
        confirmedAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UpsellRecord;
    }

    const record = await (db as any).upsellRecord.create({ data });
    return record as UpsellRecord;
  } catch (err) {
    console.error('[UPSELL_ENGINE] criarUpsell falhou:', err);
    return null;
  }
}

/**
 * Lista UPSELLs do tenant no período especificado.
 */
export async function listarUpsells(params: {
  tenantId: string;
  startDate?: Date;
  endDate?: Date;
  status?: UpsellStatus;
  type?: UpsellType;
  roomId?: string;
  limit?: number;
}): Promise<UpsellRecord[]> {
  try {
    if (!db || !(db as any).upsellRecord) return [];

    const where: any = { tenantId: params.tenantId };
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;
    if (params.roomId) where.roomId = params.roomId;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const records = await (db as any).upsellRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 100,
    });
    return records as UpsellRecord[];
  } catch (err) {
    console.error('[UPSELL_ENGINE] listarUpsells falhou:', err);
    return [];
  }
}

/**
 * Calcula as métricas mensais de UPSELL para o DDC.
 *
 * Retorna:
 *   - total_aceitos: número de UPSELLs aceitos no período
 *   - total_receita_extra: receita extra gerada para a pousada
 *   - total_comissao_zehla: comissão Zélla acumulada (6%)
 *   - por_tipo: breakdown por tipo de UPSELL
 *   - por_quarto: breakdown por quarto (roomId)
 *   - por_status: pendente / confirmado / pago / cancelado
 */
export async function calcularMetricasUpsell(params: {
  tenantId: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  total_aceitos: number;
  total_receita_extra: number;
  total_comissao_zehla: number;
  total_comissao_pendente: number;
  total_comissao_paga: number;
  por_tipo: Array<{ type: UpsellType; count: number; total_receita: number; comissao: number }>;
  por_status: Record<UpsellStatus, { count: number; comissao: number }>;
  media_por_reserva: number;
}> {
  try {
    const records = await listarUpsells({
      tenantId: params.tenantId,
      startDate: params.startDate,
      endDate: params.endDate,
      limit: 10000,
    });

    const aceitos = records.filter(r => r.status !== 'cancelled');
    const totalReceitaExtra = aceitos.reduce((s, r) => s + r.totalPrice, 0);
    const totalComissaoZehla = aceitos.reduce((s, r) => s + r.comissionAmount, 0);
    const totalComissaoPendente = aceitos
      .filter(r => r.status === 'pending' || r.status === 'confirmed')
      .reduce((s, r) => s + r.comissionAmount, 0);
    const totalComissaoPaga = aceitos
      .filter(r => r.status === 'paid')
      .reduce((s, r) => s + r.comissionAmount, 0);

    // Por tipo
    const porTipoMap = new Map<UpsellType, { count: number; total_receita: number; comissao: number }>();
    for (const r of aceitos) {
      const existing = porTipoMap.get(r.type) || { count: 0, total_receita: 0, comissao: 0 };
      existing.count += 1;
      existing.total_receita += r.totalPrice;
      existing.comissao += r.comissionAmount;
      porTipoMap.set(r.type, existing);
    }
    const por_tipo = Array.from(porTipoMap.entries())
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.comissao - a.comissao);

    // Por status
    const por_status: Record<UpsellStatus, { count: number; comissao: number }> = {
      pending: { count: 0, comissao: 0 },
      confirmed: { count: 0, comissao: 0 },
      paid: { count: 0, comissao: 0 },
      cancelled: { count: 0, comissao: 0 },
    };
    for (const r of records) {
      por_status[r.status].count += 1;
      por_status[r.status].comissao += r.comissionAmount;
    }

    // Reservas únicas
    const reservasUnicas = new Set(aceitos.map(r => r.reservationId).filter(Boolean));
    const media_por_reserva = reservasUnicas.size > 0 ? totalReceitaExtra / reservasUnicas.size : 0;

    return {
      total_aceitos: aceitos.length,
      total_receita_extra: Number(totalReceitaExtra.toFixed(2)),
      total_comissao_zehla: Number(totalComissaoZehla.toFixed(2)),
      total_comissao_pendente: Number(totalComissaoPendente.toFixed(2)),
      total_comissao_paga: Number(totalComissaoPaga.toFixed(2)),
      por_tipo,
      por_status,
      media_por_reserva: Number(media_por_reserva.toFixed(2)),
    };
  } catch (err) {
    console.error('[UPSELL_ENGINE] calcularMetricasUpsell falhou:', err);
    return {
      total_aceitos: 0,
      total_receita_extra: 0,
      total_comissao_zehla: 0,
      total_comissao_pendente: 0,
      total_comissao_paga: 0,
      por_tipo: [],
      por_status: {
        pending: { count: 0, comissao: 0 },
        confirmed: { count: 0, comissao: 0 },
        paid: { count: 0, comissao: 0 },
        cancelled: { count: 0, comissao: 0 },
      },
      media_por_reserva: 0,
    };
  }
}

/**
 * Confirma um UPSELL (após check-out do hóspede).
 * Passa de 'pending' para 'confirmed'.
 */
export async function confirmarUpsell(upsellId: string, tenantId: string): Promise<boolean> {
  try {
    if (!db || !(db as any).upsellRecord) return false;
    await (db as any).upsellRecord.updateMany({
      where: { id: upsellId, tenantId, status: 'pending' },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });
    return true;
  } catch (err) {
    console.error('[UPSELL_ENGINE] confirmarUpsell falhou:', err);
    return false;
  }
}

/**
 * Marca a comissão de UPSELL como paga à seuzella.com.
 * Passa de 'confirmed' para 'paid'.
 */
export async function marcarComoPago(upsellIds: string[], tenantId: string): Promise<number> {
  try {
    if (!db || !(db as any).upsellRecord || upsellIds.length === 0) return 0;
    const result = await (db as any).upsellRecord.updateMany({
      where: { id: { in: upsellIds }, tenantId, status: 'confirmed' },
      data: { status: 'paid', paidAt: new Date() },
    });
    return result?.count ?? 0;
  } catch (err) {
    console.error('[UPSELL_ENGINE] marcarComoPago falhou:', err);
    return 0;
  }
}

/**
 * Cancela um UPSELL (por exemplo, se o hóspede desistiu).
 * Passa para 'cancelled' — não conta na comissão.
 */
export async function cancelarUpsell(upsellId: string, tenantId: string, motivo?: string): Promise<boolean> {
  try {
    if (!db || !(db as any).upsellRecord) return false;
    await (db as any).upsellRecord.updateMany({
      where: { id: upsellId, tenantId },
      data: { status: 'cancelled', notes: motivo ?? 'Cancelado pelo dono' },
    });
    return true;
  } catch (err) {
    console.error('[UPSELL_ENGINE] cancelarUpsell falhou:', err);
    return false;
  }
}

/**
 * Helpers para gerar sugestões de UPSELL pela IA Zélla.
 *
 * Quando o hóspede pergunta sobre late checkout, a IA sugere automaticamente
 * o UPSELL correspondente. Esta função retorna o texto da sugestão.
 */
export function gerarSugestaoUpsell(
  type: UpsellType,
  hospedeNome: string,
  context?: { diarias?: number; grupoTamanho?: number }
): { texto: string; type: UpsellType; valorSugerido: number } {
  const catalog = UPSELL_TYPES_CATALOG[type];
  const diarias = context?.diarias ?? 1;
  const grupoTamanho = context?.grupoTamanho ?? 1;

  let valorSugerido = catalog.defaultPrice;
  let texto = '';

  switch (type) {
    case 'late_checkout':
      texto = `Que tal estender seu check-out em até 4 horas? Fica R$ ${catalog.defaultPrice} por hora extra — você aproveita mais o dia sem correr.`;
      valorSugerido = catalog.defaultPrice * 4;
      break;
    case 'cafe_premium':
      texto = `Posso adicionar café da manhã premium (${diarias} diárias)? São itens especiais como frutas da estação, pães artesanais e sucos naturais. R$ ${catalog.defaultPrice} por diária.`;
      valorSugerido = catalog.defaultPrice * diarias;
      break;
    case 'massagem':
      texto = `${hospedeNome}, que tal uma massagem relaxante no quarto? R$ ${catalog.defaultPrice} por sessão. Posso agendar pra você.`;
      valorSugerido = catalog.defaultPrice;
      break;
    case 'passeio_barco':
      texto = `Posso reservar passeio de barco pra sua família? R$ ${catalog.defaultPrice} por pessoa (${grupoTamanho} pessoas). Vale muito a pena!`;
      valorSugerido = catalog.defaultPrice * grupoTamanho;
      break;
    case 'transfer_aeroporto':
      texto = `Posso reservar transfer pro aeroporto? R$ ${catalog.defaultPrice}. Mais confortável que Uber e o motorista conhece o caminho.`;
      valorSugerido = catalog.defaultPrice;
      break;
    case 'jantar_romantico':
      texto = `Que tal um jantar romântico montado no quarto? Vinho, petiscos, decoração. R$ ${catalog.defaultPrice}.`;
      valorSugerido = catalog.defaultPrice;
      break;
    case 'decoracao_aniversario':
      texto = `Vocês estão comemorando aniversário? Posso decorar o quarto com balões, bolo e champagne. R$ ${catalog.defaultPrice}.`;
      valorSugerido = catalog.defaultPrice;
      break;
    case 'garrafa_vinho':
      texto = `Posso deixar uma garrafa de vinho gelada no quarto? R$ ${catalog.defaultPrice}.`;
      valorSugerido = catalog.defaultPrice;
      break;
    case 'kit_praia':
      texto = `Temos kit praia (guarda-sol + 2 cadeiras) pra você não precisar alugar lá fora. R$ ${catalog.defaultPrice} por diária (${diarias} diárias).`;
      valorSugerido = catalog.defaultPrice * diarias;
      break;
    default:
      texto = `Posso oferecer: ${catalog.label}. ${catalog.description}`;
      valorSugerido = catalog.defaultPrice;
  }

  return { texto, type, valorSugerido };
}

/**
 * Explicação amigável para o dono da pousada sobre como funciona a comissão.
 */
export const EXPLICACAO_UPSELL = {
  titulo: 'Como funciona a comissão Zélla?',
  o_que_e: `UPSELL é qualquer serviço extra que o hóspede aceita além da diária normal: 
late checkout, café da manhã premium, massagem, passeio de barco, transfer, etc. 
A IA Zélla sugere esses serviços automaticamente durante a conversa com o hóspede.`,
  zero_taxa: `Para valores NORMAIS das diárias (dia a dia, feriados comuns, alta temporada) 
a Zélla cobra ZERO taxa. Você fica com 100% do valor da reserva.`,
  comissao_6: `Para valores de UPSELL (serviços extras sugeridos pela IA Zélla) a Zélla 
cobre 6% de comissão, creditada à seuzella.com. Por exemplo: se o hóspede aceita 
um late checkout de R$ 200, a Zélla recebe R$ 12 (6%).`,
  como_descontado: `A comissão é acumulada mensalmente. Você paga a seuzella.com o total 
de UPSELLs confirmados no mês anterior. O DDC mostra em tempo real o total acumulado.`,
  exemplo: `Exemplo: Hóspede reserva 3 diárias × R$ 350 = R$ 1.050 (valor normal → 0% taxa).
Aceita late checkout +4h: R$ 200 (UPSELL → 6% = R$ 12). Aceita café premium 3×: R$ 105 
(UPSELL → 6% = R$ 6,30). Total: R$ 1.355 para a pousada, R$ 18,30 de comissão Zélla.`,
};
