/**
 * Behavioral Analytics + Conditional Triggers — UPSELL Zélla
 * ============================================================================
 *
 * Inspirado no plugin WP Swings Upsell Order Bump Offer for WooCommerce.
 *
 * 5 métricas comportamentais:
 *   - viewCount:      quantas vezes a oferta foi exibida ao hóspede
 *   - acceptCount:    quantas vezes o hóspede aceitou (1 clique)
 *   - removeCount:    quantas vezes o hóspede removeu (desistiu)
 *   - successCount:   quantas vezes a oferta virou reserva confirmada
 *   - totalSalesAmount: receita total acumulada
 *
 * Conversion rate = successCount / viewCount * 100
 *
 * Conditional Triggers:
 *   - Por valor de carrinho (triggerCartMin/Max)
 *   - Por categoria de quarto (triggerCategories)
 *   - Por produto/quarto específico (triggerProducts)
 *   - Por temporada (triggerSeasons)
 *   - Por feriado (triggerFeriados)
 *   - Por dia da semana (triggerWeekdays)
 *   - Por horário (triggerHourStart/End)
 *   - Una vez por hóspede (triggerOncePerGuest)
 * ============================================================================
 */

import { db } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS — Behavioral Analytics
// ─────────────────────────────────────────────────────────────────────────────
export interface BehavioralMetrics {
  viewCount: number;
  acceptCount: number;
  removeCount: number;
  successCount: number;
  totalSalesAmount: number;
  conversionRate: number; // successCount / viewCount * 100
  acceptanceRate: number; // acceptCount / viewCount * 100
  removalRate: number; // removeCount / viewCount * 100
  averageTicket: number; // totalSalesAmount / successCount
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING — incrementa contadores de behavioral analytics
// ─────────────────────────────────────────────────────────────────────────────
export async function trackarView(upsellId: string): Promise<void> {
  try {
    if (!db || !(db as any).upsellRecord) return;
    await (db as any).upsellRecord.update({
      where: { id: upsellId },
      data: { viewCount: { increment: 1 } },
    });
  } catch (err) {
    console.error('[UPSELL_ANALYTICS] trackarView falhou:', err);
  }
}

export async function trackarAccept(upsellId: string): Promise<void> {
  try {
    if (!db || !(db as any).upsellRecord) return;
    await (db as any).upsellRecord.update({
      where: { id: upsellId },
      data: { acceptCount: { increment: 1 } },
    });
  } catch (err) {
    console.error('[UPSELL_ANALYTICS] trackarAccept falhou:', err);
  }
}

export async function trackarRemove(upsellId: string): Promise<void> {
  try {
    if (!db || !(db as any).upsellRecord) return;
    await (db as any).upsellRecord.update({
      where: { id: upsellId },
      data: { removeCount: { increment: 1 } },
    });
  } catch (err) {
    console.error('[UPSELL_ANALYTICS] trackarRemove falhou:', err);
  }
}

export async function trackarSuccess(
  upsellId: string,
  salesAmount: number,
): Promise<void> {
  try {
    if (!db || !(db as any).upsellRecord) return;
    await (db as any).upsellRecord.update({
      where: { id: upsellId },
      data: {
        successCount: { increment: 1 },
        totalSalesAmount: { increment: salesAmount },
      },
    });
  } catch (err) {
    console.error('[UPSELL_ANALYTICS] trackarSuccess falhou:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULO DE MÉTRICAS — para um tipo específico ou agregado
// ─────────────────────────────────────────────────────────────────────────────
export async function calcularBehavioralMetrics(params: {
  tenantId: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<BehavioralMetrics> {
  try {
    if (!db || !(db as any).upsellRecord) {
      return emptyMetrics();
    }

    const where: any = {
      tenantId: params.tenantId,
      isSandbox: false, // exclui ofertas de teste
    };
    if (params.type) where.type = params.type;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const records = await (db as any).upsellRecord.findMany({
      where,
      select: {
        viewCount: true,
        acceptCount: true,
        removeCount: true,
        successCount: true,
        totalSalesAmount: true,
      },
    });

    const viewCount = records.reduce((s: number, r: any) => s + (r.viewCount || 0), 0);
    const acceptCount = records.reduce((s: number, r: any) => s + (r.acceptCount || 0), 0);
    const removeCount = records.reduce((s: number, r: any) => s + (r.removeCount || 0), 0);
    const successCount = records.reduce((s: number, r: any) => s + (r.successCount || 0), 0);
    const totalSalesAmount = records.reduce((s: number, r: any) => s + (r.totalSalesAmount || 0), 0);

    const conversionRate = viewCount > 0 ? (successCount / viewCount) * 100 : 0;
    const acceptanceRate = viewCount > 0 ? (acceptCount / viewCount) * 100 : 0;
    const removalRate = viewCount > 0 ? (removeCount / viewCount) * 100 : 0;
    const averageTicket = successCount > 0 ? totalSalesAmount / successCount : 0;

    return {
      viewCount,
      acceptCount,
      removeCount,
      successCount,
      totalSalesAmount: Number(totalSalesAmount.toFixed(2)),
      conversionRate: Number(conversionRate.toFixed(2)),
      acceptanceRate: Number(acceptanceRate.toFixed(2)),
      removalRate: Number(removalRate.toFixed(2)),
      averageTicket: Number(averageTicket.toFixed(2)),
    };
  } catch (err) {
    console.error('[UPSELL_ANALYTICS] calcularBehavioralMetrics falhou:', err);
    return emptyMetrics();
  }
}

function emptyMetrics(): BehavioralMetrics {
  return {
    viewCount: 0,
    acceptCount: 0,
    removeCount: 0,
    successCount: 0,
    totalSalesAmount: 0,
    conversionRate: 0,
    acceptanceRate: 0,
    removalRate: 0,
    averageTicket: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONDITIONAL TRIGGERS — decide se a oferta deve ser exibida
// ─────────────────────────────────────────────────────────────────────────────
export interface TriggerContext {
  cartTotal: number;
  roomId?: string;
  roomType?: string;
  temporada?: 'alta' | 'média' | 'baixa';
  feriado?: string;
  guestId?: string;
  horaDoDia: number; // 0-23
  diaDaSemana: number; // 0=domingo, 6=sábado
}

export interface TriggerConfig {
  offerActive: boolean;
  offerStartAt?: Date | null;
  offerEndAt?: Date | null;
  isSandbox: boolean;
  triggerCartMin?: number | null;
  triggerCartMax?: number | null;
  triggerCategories?: string | null; // JSON
  triggerProducts?: string | null; // JSON
  triggerSeasons?: string | null; // JSON
  triggerFeriados?: string | null; // JSON
  triggerWeekdays?: string | null; // JSON [0,1,2,3,4,5,6]
  triggerHourStart?: number | null;
  triggerHourEnd?: number | null;
  triggerOncePerGuest: boolean;
}

export interface TriggerResult {
  shouldShow: boolean;
  reason?: string; // motivo se não exibir
}

/**
 * Avalia se uma oferta UPSELL deve ser exibida ao hóspede, conforme
 * conditional triggers configurados.
 */
export function avaliarTriggers(
  config: TriggerConfig,
  context: TriggerContext,
  alreadyShownToGuest: boolean = false,
): TriggerResult {
  // 1. Oferta ativa?
  if (!config.offerActive) {
    return { shouldShow: false, reason: 'Oferta desativada' };
  }

  // 2. Em período válido?
  const now = new Date();
  if (config.offerStartAt && now < config.offerStartAt) {
    return { shouldShow: false, reason: 'Período de exibição ainda não começou' };
  }
  if (config.offerEndAt && now > config.offerEndAt) {
    return { shouldShow: false, reason: 'Período de exibição encerrado' };
  }

  // 3. Valor do carrinho
  if (config.triggerCartMin != null && context.cartTotal < config.triggerCartMin) {
    return { shouldShow: false, reason: `Carrinho abaixo de R$ ${config.triggerCartMin}` };
  }
  if (config.triggerCartMax != null && context.cartTotal > config.triggerCartMax) {
    return { shouldShow: false, reason: `Carrinho acima de R$ ${config.triggerCartMax}` };
  }

  // 4. Categorias (roomType)
  if (config.triggerCategories && context.roomType) {
    const categorias = safeParseArray<string>(config.triggerCategories);
    if (categorias.length > 0 && !categorias.includes(context.roomType)) {
      return { shouldShow: false, reason: `Categoria ${context.roomType} não está na lista` };
    }
  }

  // 5. Produtos/quartos específicos
  if (config.triggerProducts && context.roomId) {
    const products = safeParseArray<string>(config.triggerProducts);
    if (products.length > 0 && !products.includes(context.roomId)) {
      return { shouldShow: false, reason: 'Quarto não está na lista de produtos' };
    }
  }

  // 6. Temporada
  if (config.triggerSeasons && context.temporada) {
    const seasons = safeParseArray<string>(config.triggerSeasons);
    if (seasons.length > 0 && !seasons.includes(context.temporada)) {
      return { shouldShow: false, reason: `Temporada ${context.temporada} não ativa` };
    }
  }

  // 7. Feriado
  if (config.triggerFeriados && context.feriado) {
    const feriados = safeParseArray<string>(config.triggerFeriados);
    if (feriados.length > 0 && !feriados.includes(context.feriado)) {
      return { shouldShow: false, reason: `Feriado ${context.feriado} não ativo` };
    }
  }

  // 8. Dia da semana
  if (config.triggerWeekdays) {
    const weekdays = safeParseArray<number>(config.triggerWeekdays);
    if (weekdays.length > 0 && !weekdays.includes(context.diaDaSemana)) {
      const nomes = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
      return { shouldShow: false, reason: `Não ativa em ${nomes[context.diaDaSemana]}` };
    }
  }

  // 9. Horário
  if (config.triggerHourStart != null && config.triggerHourEnd != null) {
    const hora = context.horaDoDia;
    if (config.triggerHourStart <= config.triggerHourEnd) {
      // Faixa normal (ex: 9-18)
      if (hora < config.triggerHourStart || hora > config.triggerHourEnd) {
        return { shouldShow: false, reason: `Fora do horário (${config.triggerHourStart}h-${config.triggerHourEnd}h)` };
      }
    } else {
      // Faixa overnight (ex: 22-6)
      if (hora > config.triggerHourEnd && hora < config.triggerHourStart) {
        return { shouldShow: false, reason: `Fora do horário overnight` };
      }
    }
  }

  // 10. Once per guest
  if (config.triggerOncePerGuest && alreadyShownToGuest) {
    return { shouldShow: false, reason: 'Já foi exibida a este hóspede' };
  }

  return { shouldShow: true };
}

function safeParseArray<T>(json: string): T[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART SUGGESTION — IA decide qual UPSELL sugerir baseado no contexto
// ─────────────────────────────────────────────────────────────────────────────
export interface SmartSuggestionResult {
  suggestedType: string;
  reason: string;
  estimatedValue: number;
  estimatedComission: number;
}

/**
 * Sugere o melhor UPSELL com base no contexto do hóspede (estilo WP Swings Smart Offers).
 *
 * Algoritmo:
 *   1. Lista ofertas ativas do tenant
 *   2. Filtra por conditional triggers (avaliarTriggers)
 *   3. Ranqueia por successCount (ofertas com maior histórico de conversão primeiro)
 *   4. Se nenhuma com histórico, usa ranking default baseado no contexto
 */
export async function sugerirMelhorUpsell(
  tenantId: string,
  context: TriggerContext,
): Promise<SmartSuggestionResult | null> {
  try {
    if (!db || !(db as any).upsellRecord) {
      // Fallback: sugere late_checkout se for tarde, café_premium se for manhã, etc.
      return sugerirPorHorario(context);
    }

    // Busca ofertas ativas (não-sandbox) ordenadas por successCount
    const ofertas = await (db as any).upsellRecord.findMany({
      where: {
        tenantId,
        offerActive: true,
        isSandbox: false,
      },
      orderBy: { successCount: 'desc' },
      take: 50,
    });

    if (ofertas.length === 0) {
      return sugerirPorHorario(context);
    }

    // Filtra por triggers
    for (const oferta of ofertas) {
      const triggerResult = avaliarTriggers(oferta, context, false);
      if (triggerResult.shouldShow) {
        return {
          suggestedType: oferta.type,
          reason: `Maior taxa de conversão (${oferta.successCount}/${oferta.viewCount} = ${oferta.viewCount > 0 ? (oferta.successCount / oferta.viewCount * 100).toFixed(1) : 0}%)`,
          estimatedValue: oferta.unitPrice,
          estimatedComission: Number((oferta.unitPrice * 0.07).toFixed(2)),
        };
      }
    }

    // Nenhuma passou nos triggers — usa fallback por horário
    return sugerirPorHorario(context);
  } catch (err) {
    console.error('[UPSELL_ANALYTICS] sugerirMelhorUpsell falhou:', err);
    return sugerirPorHorario(context);
  }
}

function sugerirPorHorario(context: TriggerContext): SmartSuggestionResult {
  // Heurística simples baseada no horário
  if (context.horaDoDia >= 8 && context.horaDoDia <= 11) {
    // Manhã: café premium
    return {
      suggestedType: 'cafe_premium',
      reason: 'Manhã — café premium tem alta aceitação',
      estimatedValue: 35,
      estimatedComission: 2.45,
    };
  }
  if (context.horaDoDia >= 14 && context.horaDoDia <= 18) {
    // Tarde: late checkout
    return {
      suggestedType: 'late_checkout',
      reason: 'Tarde — late checkout tem alta aceitação',
      estimatedValue: 200,
      estimatedComission: 14,
    };
  }
  if (context.horaDoDia >= 19) {
    // Noite: jantar romântico ou garrafa de vinho
    return {
      suggestedType: 'garrafa_vinho',
      reason: 'Noite — garrafa de vinho tem alta aceitação',
      estimatedValue: 70,
      estimatedComission: 4.9,
    };
  }
  // Madrugada: late check-in madrugada
  return {
    suggestedType: 'late_checkin_madrugada',
    reason: 'Madrugada — late check-in tem alta aceitação',
    estimatedValue: 30,
    estimatedComission: 2.1,
  };
}
