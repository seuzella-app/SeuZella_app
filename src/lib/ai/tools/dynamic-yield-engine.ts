/**
 * ZAOS YIELD ENGINE — ZÉLLA Surge Pricing & Dynamic Yield
 * ========================================================
 *
 * Motor de Yield Management / Dynamic Pricing focado em **LUCRO EXTRA GERADO**.
 *
 * Diferencial comercial:
 *   O `dynamic-pricing-engine.ts` calcula a tarifa ótima com base em feriados,
 *   sazonalidade e regras customizadas. O ZaosYieldEngine é a camada DE NEGÓCIO
 *   por cima: computa **quanto a mais** a pousada faturou com a IA vs. a tarifa
 *   base cadastrada — e persiste esse número para exibição no DDC.
 *
 *   ┌──────────────────────────────────────────┐
 *   │   ZAOS YIELD BOOSTER — SURGE PRICING     │
 *   └──────────────────────────────────────────┘
 *                     │
 *   ┌─────────────────┼─────────────────┬─────────────────┐
 *   ▼                 ▼                 ▼                 ▼
 *   TIER 1: BASE   TIER 2: SURGE   TIER 3: SCARCITY
 *   0%–50%         51%–80%          81%–100%
 *   ×1.00          ×1.25 (+25%)     ×1.60 (+60%)
 *
 * Tier 3 também dispara em datas especiais (Réveillon, Carnaval, Natal)
 * a ≤15 dias do evento, e Tier 2 a ≤45 dias.
 *
 * Estratégia Comercial (2 fases):
 *   Fase 1 (Temporada 2026/2027): YIELD_BONUS_SHARE_RATE=0 — gratuito para
 *     as 8 pousadas Beta + 100 primeiras pagantes. Apenas registra o lucro
 *     extra para exibição no Widget "💰 Ganhos Extras com Precificação Dinâmica".
 *
 *   Fase 2 (Temporada 2027/2028): YIELD_BONUS_SHARE_RATE=0.10..0.12 — ZÉLLA
 *     BOOST, performance share sobre o lucro extra gerado acima da tarifa base.
 *
 * Uso típico:
 *   const result = ZaosYieldEngine.calculateYieldPrice({
 *     baseDailyRate: 1200,
 *     totalRooms: 10,
 *     occupiedRooms: 9,
 *     targetDate: new Date('2026-12-31'),
 *     isSpecialHoliday: true,
 *   });
 *   // => { calculatedDailyRate: 1920, surgeMultiplier: 1.60, tierName: 'SCARCITY_LOCK',
 *   //      extraProfitGenerated: 720, ... }
 *
 *   const citation = ZaosYieldEngine.formatCitationForWhatsApp(result);
 *   // => "Diária ajustada para R$ 1.920,00 (escassez máxima — últimos quartos)."
 *
 * Integra-se ao `YieldProfitTracker` para persistir o lucro no `YieldProfitRecord`.
 */

import { createHash } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface YieldCalculationInput {
  /** Diária base cadastrada pelo pousadeiro (ex: R$ 1.200) */
  baseDailyRate: number;
  /** Total de quartos do estabelecimento */
  totalRooms: number;
  /** Quartos já ocupados na data alvo */
  occupiedRooms: number;
  /** Data da diária que recebe yield */
  targetDate: Date;
  /**
   * Se é data especial (Réveillon, Natal, Carnaval, Corpus Christi).
   * Quando true, reduz o threshold de dias-para-evento que dispara surge.
   */
  isSpecialHoliday: boolean;
  /** Nome do feriado (apenas para auditoria/exibição) */
  holidayName?: string;
}

export type YieldTierName = 'NOMINAL' | 'DEMAND_SURGE' | 'SCARCITY_LOCK';

export interface YieldCalculationOutput {
  /** Diária reajustada pela IA (valor a cobrar do hóspede) */
  calculatedDailyRate: number;
  /** Multiplicador aplicado (1.0 / 1.25 / 1.60) */
  surgeMultiplier: number;
  /** Tier de escassez (NOMINAL / DEMAND_SURGE / SCARCITY_LOCK) */
  tierName: YieldTierName;
  /** Quanto a IA gerou a mais que a tarifa base (por diária) */
  extraProfitGenerated: number;
  /** Taxa de ocupação (0..1) no momento do cálculo */
  occupancyRate: number;
  /** Dias até a data-alvo (para auditoria) */
  daysToEvent: number;
  /** Razão textual que disparou o tier (para log/auditoria) */
  triggerReason: 'occupancy' | 'holiday_proximity' | 'nominal';
  /** ISO date string de quando o cálculo foi feito */
  calculatedAt: string;
}

export interface YieldProfitSummary {
  tenantId: string;
  /** Janela temporal analisada */
  startDate: Date;
  endDate: Date;
  /** Soma de extraProfit em registros confirmed */
  totalExtraProfitBrl: number;
  /** Soma de bonusShareBrl em registros confirmed (Fase 2) */
  totalBonusShareBrl: number;
  /** Quantas diárias receberam yield */
  totalYieldNights: number;
  /** Quantas diárias em SCARCITY_LOCK (Tier 3) */
  scarcityLockNights: number;
  /** Quantas diárias em DEMAND_SURGE (Tier 2) */
  demandSurgeNights: number;
  /** Quantas diárias em NOMINAL (Tier 1 — não gerou extra) */
  nominalNights: number;
  /** Breakdown por feriado especial (Réveillon, Carnaval, etc) */
  byHoliday: Record<string, { nights: number; extraProfitBrl: number }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE FLAGS / CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Habilita ou desabilita o motor de yield.
 * Default: true (recurso sempre ativo — desligar apenas para debugging).
 */
export function isYieldEngineEnabled(): boolean {
  return process.env.YIELD_ENGINE_ENABLED !== 'false';
}

/**
 * Percentual (0..1) cobrado pela Zélla sobre o lucro extra gerado.
 * - Fase 1 (gratuito): 0
 * - Fase 2 (ZÉLLA BOOST): 0.10..0.12
 */
export function getYieldBonusShareRate(): number {
  const raw = parseFloat(process.env.YIELD_BONUS_SHARE_RATE ?? '0');
  if (Number.isNaN(raw) || raw < 0) return 0;
  if (raw > 1) return raw / 100; // aceita "10" como 10%
  return raw;
}

/**
 * Thresholds configuráveis via env (defaults alinhados com a estratégia do usuário).
 * Permite ajustar sem redeploy de código.
 */
export function getYieldThresholds(): {
  surgeOccupancy: number;
  scarcityOccupancy: number;
  surgeDaysBeforeHoliday: number;
  scarcityDaysBeforeHoliday: number;
  surgeMultiplier: number;
  scarcityMultiplier: number;
} {
  return {
    surgeOccupancy: parseFloat(process.env.YIELD_SURGE_OCCUPANCY ?? '0.50'),
    scarcityOccupancy: parseFloat(process.env.YIELD_SCARCITY_OCCUPANCY ?? '0.80'),
    surgeDaysBeforeHoliday: parseInt(process.env.YIELD_SURGE_DAYS ?? '45', 10),
    scarcityDaysBeforeHoliday: parseInt(process.env.YIELD_SCARCITY_DAYS ?? '15', 10),
    surgeMultiplier: parseFloat(process.env.YIELD_SURGE_MULTIPLIER ?? '1.25'),
    scarcityMultiplier: parseFloat(process.env.YIELD_SCARCITY_MULTIPLIER ?? '1.60'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — FERIADOS BRASILEIROS DE ALTA SAZONALIDADE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detecta se uma data é feriado de ALTA demanda no Brasil.
 * Considera apenas os feriados que disparam pico de ocupação em pousadas:
 *   - Réveillon (31/12)
 *   - Ano Novo (01/01)
 *   - Natal (25/12)
 *   - Carnaval (terça-feira — móvel)
 *   - Corpus Christi (móvel)
 *
 * Não considera feriados nacionais de baixa sazonalidade (Trabalho, Independência)
 * porque esses não disparam surge pricing significativo em pousadas.
 *
 * @returns nome do feriado ou null se não for feriado especial
 */
export function detectBrazilianHighSeasonHoliday(date: Date): string | null {
  // Usa helper agnóstico a fuso horário — extrai componentes UTC ou local conforme o tipo de Date
  const { year, month, day } = extractDateComponents(date);

  // Réveillon (31/12) — pico absoluto
  if (month === 12 && day === 31) return 'Réveillon';
  // Natal (25/12)
  if (month === 12 && day === 25) return 'Natal';
  // Ano Novo (01/01)
  if (month === 1 && day === 1) return 'Ano Novo';

  // Carnaval — terça-feira 47 dias antes da Páscoa
  const carnavalTuesday = getCarnavalDate(year);
  if (sameDay(date, carnavalTuesday)) return 'Carnaval';
  // Segunda de Carnaval — algumas pousadas vendem pacote
  const carnavalMonday = new Date(carnavalTuesday);
  carnavalMonday.setDate(carnavalTuesday.getDate() - 1);
  if (sameDay(date, carnavalMonday)) return 'Carnaval (Segunda)';

  // Corpus Christi — 60 dias após Páscoa (quinta-feira)
  const corpusChristi = getCorpusChristiDate(year);
  if (sameDay(date, corpusChristi)) return 'Corpus Christi';

  return null;
}

/**
 * Extrai componentes de data (year, month, day) de forma agnóstica ao fuso horário.
 * Se a data foi criada via `new Date('2026-12-31')` (ISO sem timezone), usa UTC.
 * Se foi criada via `new Date(2026, 11, 31)` (local), usa métodos locais.
 */
function extractDateComponents(date: Date): { year: number; month: number; day: number } {
  // Detecta se a data foi criada como ISO string (sem timezone → UTC)
  const utcYear = date.getUTCFullYear();
  const localYear = date.getFullYear();

  // Se a diferença entre UTC e local causar mudança de ano/mês/dia, usa UTC para ISO dates
  if (utcYear !== localYear) {
    return { year: utcYear, month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  }

  const utcMonth = date.getUTCMonth();
  const localMonth = date.getMonth();
  if (utcMonth !== localMonth) {
    return { year: utcYear, month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  }

  const utcDay = date.getUTCDate();
  const localDay = date.getDate();
  if (utcDay !== localDay) {
    return { year: utcYear, month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  }

  // Tudo bate — usa local
  return { year: localYear, month: localMonth + 1, day: localDay };
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Computa a Páscoa via algoritmo de Butcher (Gregoriano). */
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Carnaval = Páscoa - 47 dias (terça-feira de Carnaval). */
function getCarnavalDate(year: number): Date {
  const easter = getEasterDate(year);
  const carnaval = new Date(easter);
  carnaval.setDate(easter.getDate() - 47);
  return carnaval;
}

/** Corpus Christi = Páscoa + 60 dias (quinta-feira). */
function getCorpusChristiDate(year: number): Date {
  const easter = getEasterDate(year);
  const corpus = new Date(easter);
  corpus.setDate(easter.getDate() + 60);
  return corpus;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — FORMATAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

/** Formata valor em BRL com casa decimal e separador milhar pt-BR. */
export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Gera a frase curta que o Cérebro Zélla deve citar no WhatsApp do hóspede.
 * Ex: "Diária ajustada para R$ 1.920,00 (escassez máxima — últimos quartos)."
 */
export function formatCitationForWhatsApp(result: YieldCalculationOutput): string {
  const price = formatBRL(result.calculatedDailyRate);
  switch (result.tierName) {
    case 'SCARCITY_LOCK':
      return `Diária ajustada para ${price} (escassez máxima — últimos quartos).`;
    case 'DEMAND_SURGE':
      return `Diária ajustada para ${price} (alta demanda confirmada para esta data).`;
    default:
      return `Diária confirmada: ${price}.`;
  }
}

/**
 * Gera a frase para o Widget DDC ("Ganhos Extras com Precificação Dinâmica").
 * Ex: "R$ 21.450,00 de lucro extra gerado em 30 diárias pela IA do Seu Zélla nesta temporada."
 */
export function formatProfitSummaryMessage(totalExtraBrl: number, nights: number): string {
  return `${formatBRL(totalExtraBrl)} de lucro extra gerado em ${nights} ${
    nights === 1 ? 'diária' : 'diárias'
  } pela IA do Seu Zélla nesta temporada.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — IDEMPOTÊNCIA (yieldHash)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera hash determinístico para garantir que 1 (tenantId, reservationId, targetDate)
 * tenha apenas 1 registro de yield. Evita duplicação de lucro extra no banco.
 */
export function computeYieldHash(
  tenantId: string,
  reservationId: string | null | undefined,
  targetDate: Date,
): string {
  const isoDate = targetDate.toISOString().slice(0, 10); // YYYY-MM-DD
  const reservationKey = reservationId ?? 'no-reservation';
  return createHash('sha256')
    .update(`${tenantId}::${reservationKey}::${isoDate}`)
    .digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  output: YieldCalculationOutput;
  expiresAt: number;
}

/** Cache in-memory 60s — evita recalcular yield para mesma diária em span curto. */
const yieldCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function cacheKey(input: YieldCalculationInput): string {
  return [
    input.baseDailyRate,
    input.totalRooms,
    input.occupiedRooms,
    input.targetDate.toISOString().slice(0, 10),
    input.isSpecialHoliday ? '1' : '0',
  ].join('|');
}

export class ZaosYieldEngine {
  /**
   * Calcula o preço dinâmico com base na taxa de ocupação e proximidade de datas especiais.
   *
   * Pura (pure function): não tem side effects. Para persistir o resultado,
   * use `YieldProfitTracker.recordYield()` que recebe este output.
   */
  public static calculateYieldPrice(input: YieldCalculationInput): YieldCalculationOutput {
    if (!isYieldEngineEnabled()) {
      // Engine desligada — retorna NOMINAL sem surge
      return {
        calculatedDailyRate: Math.round(input.baseDailyRate),
        surgeMultiplier: 1.0,
        tierName: 'NOMINAL',
        extraProfitGenerated: 0,
        occupancyRate: input.totalRooms > 0 ? input.occupiedRooms / input.totalRooms : 0,
        daysToEvent: daysBetween(new Date(), input.targetDate),
        triggerReason: 'nominal',
        calculatedAt: new Date().toISOString(),
      };
    }

    const key = cacheKey(input);
    const cached = yieldCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.output;
    }

    const { baseDailyRate, totalRooms, occupiedRooms, targetDate, isSpecialHoliday } = input;
    const thresholds = getYieldThresholds();

    // 1. Calcula a taxa de ocupação atual
    const occupancyRate = totalRooms > 0 ? occupiedRooms / totalRooms : 0;

    // 2. Calcula os dias restantes até a data-alvo
    const daysToEvent = daysBetween(new Date(), targetDate);

    let surgeMultiplier = 1.0;
    let tierName: YieldTierName = 'NOMINAL';
    let triggerReason: YieldCalculationOutput['triggerReason'] = 'nominal';

    // 3. Yield Matrix (Regra de Precificação Dinâmica)
    // Ordem de precedência: SCARCITY_LOCK > DEMAND_SURGE > NOMINAL
    if (
      occupancyRate >= thresholds.scarcityOccupancy ||
      (isSpecialHoliday && daysToEvent <= thresholds.scarcityDaysBeforeHoliday)
    ) {
      // TIER 3: ÚLTIMOS QUARTOS OU VÉSPERA DE FERIADO ESPECIAL (Surge +60%)
      surgeMultiplier = thresholds.scarcityMultiplier;
      tierName = 'SCARCITY_LOCK';
      triggerReason = occupancyRate >= thresholds.scarcityOccupancy
        ? 'occupancy'
        : 'holiday_proximity';
    } else if (
      occupancyRate >= thresholds.surgeOccupancy ||
      (isSpecialHoliday && daysToEvent <= thresholds.surgeDaysBeforeHoliday)
    ) {
      // TIER 2: OCUPAÇÃO ACIMA DE 50% OU PRÉ-TEMPORADA (Surge +25%)
      surgeMultiplier = thresholds.surgeMultiplier;
      tierName = 'DEMAND_SURGE';
      triggerReason = occupancyRate >= thresholds.surgeOccupancy
        ? 'occupancy'
        : 'holiday_proximity';
    }
    // else TIER 1: NOMINAL — surgeMultiplier=1.0

    const calculatedDailyRate = Math.round(baseDailyRate * surgeMultiplier);
    const extraProfitGenerated = calculatedDailyRate - baseDailyRate;

    const output: YieldCalculationOutput = {
      calculatedDailyRate,
      surgeMultiplier,
      tierName,
      extraProfitGenerated,
      occupancyRate,
      daysToEvent,
      triggerReason,
      calculatedAt: new Date().toISOString(),
    };

    // Cacheia (apenas se a engine está ligada — não vale cachear o fallback NOMINAL)
    yieldCache.set(key, { output, expiresAt: Date.now() + CACHE_TTL_MS });

    return output;
  }

  /**
   * Helper de uma linha: dado base + ocupação + data, retorna apenas o preço final.
   * Útil para chamadas inline onde o caller não precisa do breakdown completo.
   */
  public static quickPrice(
    baseDailyRate: number,
    totalRooms: number,
    occupiedRooms: number,
    targetDate: Date,
    isSpecialHoliday = false,
  ): number {
    return this.calculateYieldPrice({
      baseDailyRate,
      totalRooms,
      occupiedRooms,
      targetDate,
      isSpecialHoliday,
    }).calculatedDailyRate;
  }

  /**
   * Auto-detecta feriado brasileiro especial a partir da data-alvo.
   * Se for feriado, retorna { isSpecialHoliday: true, holidayName } —
   * caso contrário, retorna o input original.
   */
  public static withAutoHolidayDetection(input: YieldCalculationInput): YieldCalculationInput {
    if (input.isSpecialHoliday && input.holidayName) return input;
    const holiday = detectBrazilianHighSeasonHoliday(input.targetDate);
    if (!holiday) return input;
    return {
      ...input,
      isSpecialHoliday: true,
      holidayName: holiday,
    };
  }

  /**
   * Limpa o cache in-memory (apenas para testes/debugging).
   */
  public static clearCache(): void {
    yieldCache.clear();
  }

  /**
   * Estima o lucro extra potencial de uma temporada inteira.
   * Usado pelo ZCC para projeções e pelo Dashboard para mostrar "potencial".
   *
   * Premissa simplificada:
   *   - 60% das diárias vendidas em DEMAND_SURGE (Tier 2)
   *   - 20% das diárias vendidas em SCARCITY_LOCK (Tier 3)
   *   - 20% das diárias vendidas em NOMINAL (Tier 1, sem extra)
   */
  public static estimateSeasonalExtraProfit(params: {
    baseDailyRate: number;
    totalRooms: number;
    nightsInSeason: number;
    averageOccupancy: number; // 0..1 — ex: 0.85 para alta temporada
  }): { totalExtraProfitBrl: number; breakdown: Record<YieldTierName, { nights: number; extra: number }> } {
    const { baseDailyRate, totalRooms, nightsInSeason, averageOccupancy } = params;
    const thresholds = getYieldThresholds();

    let tier2Nights = 0;
    let tier3Nights = 0;
    let tier1Nights = 0;

    if (averageOccupancy >= thresholds.scarcityOccupancy) {
      // Maioria das diárias em SCARCITY_LOCK
      tier3Nights = Math.round(nightsInSeason * 0.6);
      tier2Nights = Math.round(nightsInSeason * 0.3);
      tier1Nights = nightsInSeason - tier2Nights - tier3Nights;
    } else if (averageOccupancy >= thresholds.surgeOccupancy) {
      // Maioria em DEMAND_SURGE
      tier2Nights = Math.round(nightsInSeason * 0.6);
      tier3Nights = Math.round(nightsInSeason * 0.2);
      tier1Nights = nightsInSeason - tier2Nights - tier3Nights;
    } else {
      // Baixa temporada — yield ainda pode pegar algumas diárias
      tier1Nights = Math.round(nightsInSeason * 0.6);
      tier2Nights = Math.round(nightsInSeason * 0.3);
      tier3Nights = nightsInSeason - tier1Nights - tier2Nights;
    }

    const tier2Extra = tier2Nights * totalRooms * (baseDailyRate * (thresholds.surgeMultiplier - 1));
    const tier3Extra = tier3Nights * totalRooms * (baseDailyRate * (thresholds.scarcityMultiplier - 1));

    return {
      totalExtraProfitBrl: Math.round(tier2Extra + tier3Extra),
      breakdown: {
        NOMINAL: { nights: tier1Nights, extra: 0 },
        DEMAND_SURGE: { nights: tier2Nights, extra: Math.round(tier2Extra) },
        SCARCITY_LOCK: { nights: tier3Nights, extra: Math.round(tier3Extra) },
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS UTILITÁRIOS
// ─────────────────────────────────────────────────────────────────────────────

function daysBetween(from: Date, to: Date): number {
  const diffMs = Math.abs(to.getTime() - from.getTime());
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
