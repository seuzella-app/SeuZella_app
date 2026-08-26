// @ts-nocheck — to be fixed in dedicated type refactoring pass
/**
 * UPSELL Engine — Comissão Zélla de 7% sobre valores extras por quarto
 * ============================================================================
 *
 * FILOSOFIA:
 *   - Valores NORMAIS das diárias (dia a dia): ZERO taxa para a pousada.
 *     A Zélla não cobra nada sobre o preço base de R$ 350/noite, por exemplo.
 *   - Valores de UPSELL sugeridos pela IA Zélla (late checkout, café premium,
 *     massagem, passeio de barco, etc.): 7% de comissão creditada à seuzella.com.
 *
 * EXEMPLO PRÁTICO:
 *   - Hóspede reserva 3 diárias × R$ 350 = R$ 1.050 (valor normal → 0% taxa)
 *   - Hóspede aceita late checkout +4h: R$ 200 extra (UPSELL → 7% = R$ 14)
 *   - Hóspede aceita café premium 3×: R$ 105 extra (UPSELL → 7% = R$ 7,35)
 *   - Total: R$ 1.355 para a pousada, R$ 21,35 de comissão Zélla
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
  | 'aumento_diaria_feriado' // aumento de diária em feriado/alta demanda por quarto
  | 'reveillon' // pacote especial réveillon (UPSELL por quarto)
  | 'carnaval' // pacote especial carnaval (UPSELL por quarto)
  | 'alta_demanda_temporada' // tarifa dinâmica por alta procura sazonal
  | 'late_checkout' // extensão de horário de check-out (R$ 50/hora extra)
  | 'cafe_premium' // café da manhã premium (R$ 35/diária)
  | 'massagem' // massagem relaxante (R$ 150/sessão)
  | 'passeio_barco' // passeio de barco (R$ 120/pessoa)
  | 'transfer_aeroporto' // transfer ida/volta aeroporto (R$ 80)
  | 'jantar_romantico' // jantar romântico montado no quarto (R$ 200)
  | 'decoracao_aniversario' // decoração quarto para aniversário (R$ 90)
  | 'garrafa_vinho' // garrafa de vinho (R$ 70)
  | 'aula_surf' // aula de surf (R$ 100/pessoa)
  | 'passeio_bugue' // passeio de bugue (R$ 90/pessoa)
  | 'spa_day' // spa day com hidratação (R$ 250)
  | 'kit_praia' // kit praia: guarda-sol + cadeiras (R$ 50/diária)
  | 'late_checkin_madrugada' // late check-in madrugada (R$ 30)
  | 'limpeza_diaria_extra' // limpeza extra (R$ 40)
  | 'outros'; // outros (descrição livre)

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
  comissionRate: number; // 0.07 = 7%
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
export const COMISSAO_ZELLA_RATE = 0.07; // 7% sobre UPSELL (zero em valores normais)

export const UPSELL_TYPES_CATALOG: Record<UpsellType, {
  label: string;
  description: string;
  defaultPrice: number;
  unitLabel: string;
}> = {
  aumento_diaria_feriado: {
    label: 'Aumento de diária em feriado / alta demanda',
    description: 'Valor adicional cobrado por quarto acima da diária normal em feriados prolongados.',
    defaultPrice: 150,
    unitLabel: 'diária',
  },
  reveillon: {
    label: 'Pacote Réveillon (UPSELL por quarto)',
    description: 'Valor adicional cobrado por quarto no pacote de Réveillon.',
    defaultPrice: 350,
    unitLabel: 'diária',
  },
  carnaval: {
    label: 'Pacote Carnaval (UPSELL por quarto)',
    description: 'Valor adicional cobrado por quarto no pacote de Carnaval.',
    defaultPrice: 280,
    unitLabel: 'diária',
  },
  alta_demanda_temporada: {
    label: 'Alta demanda sazonal / eventos locais',
    description: 'Valor adicional cobrado em festivais, shows e picos locais.',
    defaultPrice: 140,
    unitLabel: 'diária',
  },
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
    defaultPrice: 50,
    unitLabel: 'unidade',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LÓGICA DE NEGÓCIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula o valor da comissão Zélla (7%) sobre um UPSELL.
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

  try {
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
    console.error('[UPSELL_ENGINE] criarUpsell falhou no DB, retornando registro em memória:', err);
    // Fallback robusto: retorna registro em memória para não quebrar o fluxo
    return {
      id: data.id || `upsell_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId: data.tenantId,
      roomId: data.roomId ?? null,
      reservationId: data.reservationId ?? null,
      guestId: data.guestId ?? null,
      type: data.type,
      description: data.description,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      totalPrice: data.totalPrice,
      comissionRate: data.comissionRate,
      comissionAmount: data.comissionAmount,
      status: data.status,
      paidAt: undefined,
      confirmedAt: undefined,
      suggestedByZehla: data.suggestedByZehla,
      feriado: data.feriado ?? null,
      temporada: data.temporada ?? null,
      yieldMultiplier: data.yieldMultiplier ?? null,
      notes: data.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as UpsellRecord;
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
 *   - total_comissao_zehla: comissão Zélla acumulada (7%)
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
      texto = `${hospedeNome}, posso adicionar café da manhã premium (${diarias} diárias × R$ ${catalog.defaultPrice} = R$ ${(catalog.defaultPrice * diarias).toFixed(2)})? Itens especiais: frutas da estação, pães artesanais e sucos naturais.`;
      valorSugerido = catalog.defaultPrice * diarias;
      break;
    case 'massagem':
      texto = `${hospedeNome}, que tal uma massagem relaxante no quarto? R$ ${catalog.defaultPrice} por sessão. Posso agendar pra você.`;
      valorSugerido = catalog.defaultPrice;
      break;
    case 'passeio_barco':
      texto = `${hospedeNome}, posso reservar passeio de barco pra sua família? R$ ${catalog.defaultPrice} por pessoa × ${grupoTamanho} = R$ ${(catalog.defaultPrice * grupoTamanho).toFixed(2)}. Vale muito a pena!`;
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
 * Explicação amigável para o dono da pousada sobre como funciona a comissão de UPSELL.
 */
export const EXPLICACAO_UPSELL = {
  titulo: 'Como funciona a taxa de UPSELL do Seu Zélla?',
  o_que_e: `UPSELL é qualquer serviço ou comodidade adicional por quarto que o hóspede adquire além da diária normal: 
late check-out (saída estendida), early check-in (entrada antecipada), café da manhã especial/premium, 
upgrade de quarto ou suíte, massagem relaxante, kit praia, passeios locais de barco/bugue ou decoração romântica. 
O UPSELL aumenta o seu faturamento por hóspede sem a necessidade de gastar com novos clientes.`,
  zero_taxa: `Para valores NORMAIS das diárias (dia a dia, fins de semana comuns e alta temporada), 
o Seu Zélla cobra ZERO taxa (0%). Você fica com 100% do valor da diária da pousada.`,
  comissao_7: `A taxa de 7% de sucesso incide EXCLUSIVAMENTE sobre o faturamento EXTRA que o Zélla gerou 
em serviços de UPSELL por quarto durante períodos de alta procura, feriados prolongados e festas locais. 
Se o Zélla não vender nenhum upsell no mês, a taxa é R$ 0,00.`,
  comissao_6: `7% de taxa de sucesso sobre UPSELL (diárias normais = ZERO taxa).`,
  notificacao_previa: `O Cérebro Zélla monitora o calendário de feriados e festas locais da sua cidade. 
Quando detecta que o fluxo de mensagens vai aumentar, ele calcula e sugere os valores de upsell 
para cada quarto da pousada e NOTIFICA o dono da pousada com antecedência no DDC e DDC Mobile.`,
  como_descontado: `Sua fatura mensal = Valor Fixo do Pacote Escolhido (ex: PRO R$ 397) + 7% das vendas extras de UPSELL. 
A comissão é exibida em tempo real no seu painel DDC com total transparência.`,
  exemplo: `Exemplo real: Pacote PRO (R$ 397) + R$ 1.000 em serviços extras de Upsell vendidos no feriado. 
Taxa de 7% = R$ 70. Fatura mensal final = R$ 467. A pousada fica com R$ 930 de lucro limpo adicional.`,
  anfitriao_airbnb: `Para Anfitriões de Imóveis (Airbnb), o Seu Zélla opera com 100% de mensalidade fixa e 
ZERO taxa sobre reservas e ZERO taxa sobre upsell, eliminando as taxas pesadas de 15% a 20% das OTAs.`,
};

/**
 * Retorna a explicação resumida de faturamento e UPSELL conforme o nicho.
 */
export function obterExplicacaoFaturamentoUpsell(niche: 'pousada' | 'airbnb'): {
  titulo: string;
  regraComissao: string;
  detalheFatura: string;
  taxaPercentual: number;
} {
  if (niche === 'airbnb') {
    return {
      titulo: '100% Preço Fixo — Zero Taxas Adicionais',
      regraComissao: 'Zero comissão sobre reservas e zero comissão sobre upsell. Você economiza 15% a 20% das OTAs.',
      detalheFatura: 'Sua fatura mensal é estritamente o valor fixo do pacote contratado.',
      taxaPercentual: 0,
    };
  }

  return {
    titulo: 'Diárias 0% Taxa + 7% apenas sobre o ganho EXTRA de Upsell',
    regraComissao: '7% de taxa de sucesso cobrada apenas quando houver venda extra de upsell em datas de alta procura, com notificação prévia no DDC.',
    detalheFatura: 'Fatura Mensal = Valor do Pacote Base + 7% sobre os upsells confirmados por quarto.',
    taxaPercentual: 7,
  };
}

/**
 * Detecta feriados e eventos com alta demanda e prepara sugestões proativas de upsell
 * com notificação ao proprietário no DDC / DDC Mobile.
 */
export function preverDemandaENotificarPousadeiro(params: {
  tenantId: string;
  nomePousada: string;
  proximoEvento: string;
  dataEvento: string;
  estimativaAumentoFluxo: string;
}): {
  notificacaoDDC: {
    titulo: string;
    mensagem: string;
    sugestoesQuarto: Array<{ servico: string; precoSugerido: number; comissaoZella: number }>;
  };
} {
  const sugestoes = [
    { servico: 'Late Check-out (+4 horas)', precoSugerido: 200, comissaoZella: 14 },
    { servico: 'Café da Manhã Gourmet Especial', precoSugerido: 105, comissaoZella: 7.35 },
    { servico: 'Kit Praia & Passeio Local', precoSugerido: 180, comissaoZella: 12.60 },
  ];

  return {
    notificacaoDDC: {
      titulo: `🚨 Alta Demanda Prevista: ${params.proximoEvento} (${params.dataEvento})`,
      mensagem: `Olá, ${params.nomePousada}! O Cérebro Zélla detectou aumento de ${params.estimativaAumentoFluxo} no fluxo de cotações para o período de ${params.proximoEvento}. Sugerimos ativar as ofertas de UPSELL por quarto para maximizar sua diária. Fatura com 7% apenas sobre o valor extra vendido.`,
      sugestoesQuarto: sugestoes,
    },
  };
}
