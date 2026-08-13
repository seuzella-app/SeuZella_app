/**
 * ZAOS YIELD — Profit Tracker (Persistência)
 * ===========================================
 *
 * Camada que persiste o resultado do `ZaosYieldEngine.calculateYieldPrice()` no
 * modelo Prisma `YieldProfitRecord`. Usada por:
 *   - Reservation creation flow (checkout, booking)
 *   - Cron diário de fechamento de diárias
 *   - Hook do Cérebro quando cita valor no WhatsApp
 *
 * Garante idempotência via `yieldHash` (1 tenantId+reservationId+date = 1 registro).
 * Usa `getTenantDb()` para garantir isolamento BOLA/IDOR.
 *
 * Estratégia comercial 2 fases:
 *   Fase 1: YIELD_BONUS_SHARE_RATE=0 → bonusShareBrl=0 (gratuito)
 *   Fase 2: YIELD_BONUS_SHARE_RATE=0.10..0.12 → ZÉLLA BOOST ativo
 */

import { db } from '@/lib/db';
import { getTenantDb } from '@/lib/db/tenant-prisma';
import {
  type YieldCalculationOutput,
  type YieldProfitSummary,
  computeYieldHash,
  getYieldBonusShareRate,
} from './dynamic-yield-engine';

export interface RecordYieldParams {
  tenantId: string;
  /** Property.id (pousada) — null para Airbnb */
  propertyId?: string | null;
  /** AirBProperty.id — null para pousada */
  airbPropertyId?: string | null;
  /** Reservation.id que gerou o yield — null se ainda sem reserva confirmada */
  reservationId?: string | null;
  /** Room.id (pousada) — opcional */
  roomId?: string | null;
  /** Data da diária reajustada */
  targetDate: Date;
  /** Tarifa base cadastrada pelo pousadeiro */
  baseRate: number;
  /** Output do ZaosYieldEngine.calculateYieldPrice() */
  yield: YieldCalculationOutput;
  /** Se foi feriado especial (já vem do input do engine) */
  isSpecialHoliday?: boolean;
  /** Nome do feriado, se aplicável */
  holidayName?: string | null;
}

export interface RecordYieldResult {
  /** Registro criado OU já existente (idempotência) */
  record: {
    id: string;
    yieldHash: string;
    extraProfit: number;
    bonusShareBrl: number;
    status: string;
  };
  /** True se acabou de criar, false se já existia (idempotência hit) */
  created: boolean;
}

export class YieldProfitTracker {
  /**
   * Persiste um cálculo de yield no banco.
   *
   * IDEMPOTENTE: se já existe registro para (tenantId, reservationId, targetDate),
   * retorna o registro existente sem duplicar.
   *
   * Não lança erro em falha — apenas loga e retorna `created: false` com record
   * vazio. Isso evita que um bug no yield bloqueie o fluxo de reserva.
   */
  public static async recordYield(params: RecordYieldParams): Promise<RecordYieldResult> {
    const {
      tenantId,
      propertyId = null,
      airbPropertyId = null,
      reservationId = null,
      roomId = null,
      targetDate,
      baseRate,
      yield: yieldOutput,
      isSpecialHoliday = false,
      holidayName = null,
    } = params;

    const yieldHash = computeYieldHash(tenantId, reservationId, targetDate);
    const bonusShareRate = getYieldBonusShareRate();
    const bonusShareBrl = Math.round(yieldOutput.extraProfitGenerated * bonusShareRate * 100) / 100;

    try {
      const tenantDb = getTenantDb(db as any, tenantId);

      // Tentativa de upsert — se já existe (yieldHash único), não duplica
      const record = await tenantDb.yieldProfitRecord.upsert({
        where: { yieldHash },
        create: {
          tenantId,
          propertyId,
          airbPropertyId,
          reservationId,
          roomId,
          targetDate,
          baseRate,
          yieldRate: yieldOutput.calculatedDailyRate,
          extraProfit: yieldOutput.extraProfitGenerated,
          surgeMultiplier: yieldOutput.surgeMultiplier,
          tierName: yieldOutput.tierName,
          bonusShareBrl,
          bonusShareRate,
          status: 'confirmed',
          triggerReason: yieldOutput.triggerReason,
          isSpecialHoliday,
          holidayName,
          yieldHash,
        },
        update: {
          // Em re-cálculo, mantemos o status original — não sobrescrevemos.
          // Apenas atualizamos os valores caso tenham mudado (raro).
          baseRate,
          yieldRate: yieldOutput.calculatedDailyRate,
          extraProfit: yieldOutput.extraProfitGenerated,
          surgeMultiplier: yieldOutput.surgeMultiplier,
          tierName: yieldOutput.tierName,
          bonusShareBrl,
          bonusShareRate,
        },
        select: {
          id: true,
          yieldHash: true,
          extraProfit: true,
          bonusShareBrl: true,
          status: true,
          createdAt: true,
        },
      });

      const created = record.createdAt.getTime() > Date.now() - 5_000; // criado nos últimos 5s
      return {
        record: {
          id: record.id,
          yieldHash: record.yieldHash,
          extraProfit: record.extraProfit,
          bonusShareBrl: record.bonusShareBrl,
          status: record.status,
        },
        created,
      };
    } catch (err) {
      console.error('[YIELD_TRACKER] Falha ao persistir yield:', err);
      return {
        record: {
          id: '',
          yieldHash,
          extraProfit: yieldOutput.extraProfitGenerated,
          bonusShareBrl,
          status: 'error',
        },
        created: false,
      };
    }
  }

  /**
   * Marca um yield como "refunded" — hóspede cancelou dentro da janela de cortesia.
   * O lucro extra NÃO conta mais para o total exibido no DDC.
   */
  public static async refundYield(tenantId: string, yieldHash: string): Promise<boolean> {
    try {
      const tenantDb = getTenantDb(db as any, tenantId);
      await tenantDb.yieldProfitRecord.updateMany({
        where: { yieldHash, status: 'confirmed' },
        data: { status: 'refunded' },
      });
      return true;
    } catch (err) {
      console.error('[YIELD_TRACKER] Falha ao reembolsar yield:', err);
      return false;
    }
  }

  /**
   * Marca um yield como "reversed" — chargeback ou estorno.
   */
  public static async reverseYield(tenantId: string, yieldHash: string): Promise<boolean> {
    try {
      const tenantDb = getTenantDb(db as any, tenantId);
      await tenantDb.yieldProfitRecord.updateMany({
        where: { yieldHash, status: { in: ['confirmed', 'refunded'] } },
        data: { status: 'reversed' },
      });
      return true;
    } catch (err) {
      console.error('[YIELD_TRACKER] Falha ao reverter yield:', err);
      return false;
    }
  }

  /**
   * Sumariza o lucro extra gerado em uma janela temporal.
   * Usado pelo Widget DDC "💰 Ganhos Extras com Precificação Dinâmica".
   *
   * Apenas status=confirmed conta para o total exibido.
   */
  public static async getProfitSummary(params: {
    tenantId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<YieldProfitSummary> {
    const { tenantId, startDate, endDate } = params;
    const empty: YieldProfitSummary = {
      tenantId,
      startDate,
      endDate,
      totalExtraProfitBrl: 0,
      totalBonusShareBrl: 0,
      totalYieldNights: 0,
      scarcityLockNights: 0,
      demandSurgeNights: 0,
      nominalNights: 0,
      byHoliday: {},
    };

    try {
      const tenantDb = getTenantDb(db as any, tenantId);

      // Aggregate para somar
      const aggregated = await tenantDb.yieldProfitRecord.aggregate({
        where: {
          status: 'confirmed',
          targetDate: { gte: startDate, lte: endDate },
        },
        _sum: {
          extraProfit: true,
          bonusShareBrl: true,
        },
        _count: true,
      });

      // Group by tierName
      const byTier = await tenantDb.yieldProfitRecord.groupBy({
        by: ['tierName'],
        where: {
          status: 'confirmed',
          targetDate: { gte: startDate, lte: endDate },
        },
        _count: true,
        _sum: { extraProfit: true },
      });

      // Group by holiday (apenas especiais)
      const holidayRecords = await tenantDb.yieldProfitRecord.findMany({
        where: {
          status: 'confirmed',
          isSpecialHoliday: true,
          targetDate: { gte: startDate, lte: endDate },
          holidayName: { not: null },
        },
        select: { holidayName: true, extraProfit: true },
      });

      const byHoliday: Record<string, { nights: number; extraProfitBrl: number }> = {};
      for (const rec of holidayRecords) {
        if (!rec.holidayName) continue;
        if (!byHoliday[rec.holidayName]) {
          byHoliday[rec.holidayName] = { nights: 0, extraProfitBrl: 0 };
        }
        byHoliday[rec.holidayName].nights += 1;
        byHoliday[rec.holidayName].extraProfitBrl += rec.extraProfit;
      }

      const tierCount: Record<string, number> = {};
      for (const tier of byTier) {
        tierCount[tier.tierName] = tier._count;
      }

      return {
        tenantId,
        startDate,
        endDate,
        totalExtraProfitBrl: aggregated._sum.extraProfit ?? 0,
        totalBonusShareBrl: aggregated._sum.bonusShareBrl ?? 0,
        totalYieldNights: aggregated._count ?? 0,
        scarcityLockNights: tierCount['SCARCITY_LOCK'] ?? 0,
        demandSurgeNights: tierCount['DEMAND_SURGE'] ?? 0,
        nominalNights: tierCount['NOMINAL'] ?? 0,
        byHoliday,
      };
    } catch (err) {
      console.error('[YIELD_TRACKER] Falha ao buscar sumário:', err);
      return empty;
    }
  }

  /**
   * Helper: sumariza a temporada atual (definida por env ou default 90 dias).
   * Usado pelo Widget DDC para mostrar "nesta temporada".
   */
  public static async getCurrentSeasonSummary(tenantId: string): Promise<YieldProfitSummary> {
    const now = new Date();
    // Default: últimos 90 dias como "temporada atual" — pode ser overridden por env
    const seasonDays = parseInt(process.env.YIELD_SEASON_WINDOW_DAYS ?? '90', 10);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - seasonDays);

    return this.getProfitSummary({ tenantId, startDate, endDate: now });
  }
}
