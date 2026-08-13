/**
 * ZÉLLA Cérebro — Yield Citation Hook
 * ====================================
 *
 * Hook usado pelo `GuestResponderBrain` e `zella-sales-brain` quando o hóspede
 * pergunta sobre preço, tarifa, ou disponibilidade para datas específicas.
 *
 * Antes de responder "R$ 1.920,00", o Cérebro chama este hook para:
 *   1. Recalcular o yield dinâmico (ocupação + feriado + dias-para-evento)
 *   2. Opcionalmente persistir o lucro extra no banco (se a reserva foi fechada)
 *   3. Retornar a frase pronta para o LLM colar na conversa WhatsApp
 *
 * Exemplo de fluxo:
 *   Hóspede: "Quanto fica pra 30/12 a 02/01?"
 *   Cérebro:
 *     for each noite in [30/12, 31/12, 01/01, 02/01]:
 *       const calc = ZaosYieldEngine.withAutoHolidayDetection({ ... })
 *       frases.push(formatCitationForWhatsApp(calc))
 *     return frases.join('\n')
 *   // => "30/12: Diária ajustada para R$ 1.500,00 (alta demanda confirmada)."
 *   //    "31/12: Diária ajustada para R$ 1.920,00 (escassez máxima — últimos quartos)."
 *   //    "01/01: Diária ajustada para R$ 1.920,00 (escassez máxima — últimos quartos)."
 *   //    "02/01: Diária confirmada: R$ 1.200,00."
 *
 * IMPORTANTE: este hook NÃO cobra nada — apenas cita valores. A persistência
 * do lucro acontece quando a reserva é efetivamente confirmada/paga (via
 * ReservationCreationFlow → YieldProfitTracker.recordYield()).
 */

import {
  ZaosYieldEngine,
  formatCitationForWhatsApp,
  type YieldCalculationInput,
  type YieldCalculationOutput,
  detectBrazilianHighSeasonHoliday,
} from '@/lib/ai/tools/dynamic-yield-engine';
import { isYieldEngineEnabled } from '@/lib/ai/tools/dynamic-yield-engine';

export interface YieldCitationRequest {
  /** Diária base cadastrada pelo pousadeiro */
  baseDailyRate: number;
  /** Total de quartos do estabelecimento */
  totalRooms: number;
  /** Quartos já ocupados para a data (se conhecido; se não, 0) */
  occupiedRooms?: number;
  /** Datas das diárias (uma entrada por noite) */
  dates: Date[];
  /** Forçar detecção de feriado (default true) */
  autoDetectHoliday?: boolean;
  /** Override manual de feriado (raro) */
  forceIsHoliday?: boolean;
  forceHolidayName?: string;
}

export interface YieldCitationResponse {
  /** Frases prontas para o LLM colar no WhatsApp (uma por noite) */
  citations: string[];
  /** Breakdown completo para auditoria/log */
  calculations: YieldCalculationOutput[];
  /** True se alguma noite recebeu surge (Tier 2 ou 3) */
  hasSurgeApplied: boolean;
  /** True se alguma noite foi SCARCITY_LOCK (Tier 3) */
  hasScarcityLock: boolean;
  /** Total a cobrar pela estadia inteira (soma das diárias yield) */
  totalPriceBrl: number;
  /** Total que seria cobrado sem yield (soma das diárias base) */
  baseTotalBrl: number;
  /** Lucro extra gerado nesta estadia (totalPrice - baseTotal) */
  extraProfitBrl: number;
  /** Engine estava ligada? (se false, citations = NOMINAL) */
  engineEnabled: boolean;
}

/**
 * Hook principal — chamado pelo GuestResponderBrain antes de citar preço.
 */
export function computeYieldCitationForStay(
  req: YieldCitationRequest,
): YieldCitationResponse {
  const engineEnabled = isYieldEngineEnabled();

  if (!engineEnabled || req.dates.length === 0) {
    // Engine desligada ou sem datas — retorna NOMINAL
    const baseTotalBrl = req.dates.length * req.baseDailyRate;
    const citations = req.dates.map(
      (date) =>
        `${formatDateBR(date)}: Diária confirmada: ${req.baseDailyRate.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })}.`,
    );
    return {
      citations,
      calculations: [],
      hasSurgeApplied: false,
      hasScarcityLock: false,
      totalPriceBrl: baseTotalBrl,
      baseTotalBrl,
      extraProfitBrl: 0,
      engineEnabled,
    };
  }

  const citations: string[] = [];
  const calculations: YieldCalculationOutput[] = [];
  let totalPriceBrl = 0;
  let baseTotalBrl = 0;
  let hasSurgeApplied = false;
  let hasScarcityLock = false;

  for (const date of req.dates) {
    // Auto-detecção de feriado brasileiro
    let isSpecialHoliday = req.forceIsHoliday ?? false;
    let holidayName = req.forceHolidayName;

    if (req.autoDetectHoliday !== false && !isSpecialHoliday) {
      const detected = detectBrazilianHighSeasonHoliday(date);
      if (detected) {
        isSpecialHoliday = true;
        holidayName = detected;
      }
    }

    const input: YieldCalculationInput = {
      baseDailyRate: req.baseDailyRate,
      totalRooms: req.totalRooms,
      occupiedRooms: req.occupiedRooms ?? 0,
      targetDate: date,
      isSpecialHoliday,
      holidayName,
    };

    const calc = ZaosYieldEngine.calculateYieldPrice(input);
    calculations.push(calc);

    const dateLabel = formatDateBR(date);
    const citation = `${dateLabel}: ${formatCitationForWhatsApp(calc)}`;
    citations.push(citation);

    totalPriceBrl += calc.calculatedDailyRate;
    baseTotalBrl += req.baseDailyRate;

    if (calc.tierName === 'SCARCITY_LOCK') {
      hasScarcityLock = true;
      hasSurgeApplied = true;
    } else if (calc.tierName === 'DEMAND_SURGE') {
      hasSurgeApplied = true;
    }
  }

  return {
    citations,
    calculations,
    hasSurgeApplied,
    hasScarcityLock,
    totalPriceBrl,
    baseTotalBrl,
    extraProfitBrl: totalPriceBrl - baseTotalBrl,
    engineEnabled,
  };
}

/**
 * Helper: gera uma única frase sumarizada para conversas WhatsApp,
 * útil quando o hóspede pergunta "qual o total?" de pacote multi-noite.
 *
 * Ex: "Pacote 4 noites (30/12 a 02/01): R$ 5.580,00 — incluindo R$ 780,00
 *      de ajuste dinâmico por alta demanda de Réveillon."
 */
export function summarizeCitationForWhatsApp(
  dates: Date[],
  response: YieldCitationResponse,
): string {
  if (dates.length === 0) return '';

  const startLabel = formatDateBR(dates[0]);
  const endLabel = formatDateBR(dates[dates.length - 1]);
  const totalLabel = response.totalPriceBrl.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  if (!response.hasSurgeApplied) {
    return `Pacote ${dates.length} ${dates.length === 1 ? 'noite' : 'noites'} (${startLabel}${
      dates.length > 1 ? ` a ${endLabel}` : ''
    }): ${totalLabel}.`;
  }

  const extraLabel = response.extraProfitBrl.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const reasonLabel = response.hasScarcityLock
    ? 'escassez máxima (últimos quartos / véspera de feriado)'
    : 'alta demanda confirmada';

  return `Pacote ${dates.length} ${dates.length === 1 ? 'noite' : 'noites'} (${startLabel}${
    dates.length > 1 ? ` a ${endLabel}` : ''
  }): ${totalLabel} — incluindo ${extraLabel} de ajuste dinâmico por ${reasonLabel}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatDateBR(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}`;
}
