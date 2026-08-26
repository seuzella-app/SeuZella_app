// =============================================================================
// SEU ZÉLLA METAGPT — YIELD WAR-ROOM SOP (7% TAXA DE SUCESSO)
// =============================================================================

import { z } from 'zod';
import { MetaAction } from '../core/action';
import { MetaRole } from '../core/role';
import { type SOPDefinition, SOPRunner } from '../core/sop-runner';
import { type MetaMessage } from '../core/message';

// ── Schemas de Ação ─────────────────────────────────────────────────────────

const DemandInputSchema = z.object({
  holidayName: z.string(),
  nights: z.number().min(1),
  currentOccupancyRate: z.number().min(0).max(1),
});

const DemandOutputSchema = z.object({
  demandLevel: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'ALTISSIMA']),
  recommendedIncreasePerNight: z.number().min(0),
  urgencyScore: z.number(),
});

const YieldInputSchema = z.object({
  totalRooms: z.number().min(1),
  nights: z.number().min(1),
  baseDailyPrice: z.number().min(1),
  increasePerNight: z.number().min(0),
});

const YieldOutputSchema = z.object({
  totalExcedentGross: z.number(),
  landlordNetProfit: z.number(), // 93%
  zellaSuccessFee: z.number(), // 7%
  roiMultiplier: z.number(),
});

const AuditInputSchema = z.object({
  totalExcedentGross: z.number(),
  landlordNetProfit: z.number(),
  zellaSuccessFee: z.number(),
});

const AuditOutputSchema = z.object({
  isCompliant: z.boolean(),
  feePercentage: z.number(),
  auditNotes: z.string(),
});

// ── Ações Concretas ──────────────────────────────────────────────────────────

export class AnalyzeDemandAction extends MetaAction<z.infer<typeof DemandInputSchema>, z.infer<typeof DemandOutputSchema>> {
  public readonly name = 'AnalyzeDemand';
  public readonly description = 'Analisa a pressão de demanda de feriados e ocupação';
  public readonly inputSchema = DemandInputSchema;
  public readonly outputSchema = DemandOutputSchema;

  protected async execute(input: z.infer<typeof DemandInputSchema>) {
    let demandLevel: 'BAIXA' | 'MEDIA' | 'ALTA' | 'ALTISSIMA' = 'MEDIA';
    let recommendedIncrease = 150;

    if (input.currentOccupancyRate >= 0.8 || input.holidayName.toLowerCase().includes('reveillon') || input.holidayName.toLowerCase().includes('carnaval')) {
      demandLevel = 'ALTISSIMA';
      recommendedIncrease = 250;
    } else if (input.currentOccupancyRate >= 0.5) {
      demandLevel = 'ALTA';
      recommendedIncrease = 180;
    }

    return {
      output: {
        demandLevel,
        recommendedIncreasePerNight: recommendedIncrease,
        urgencyScore: Math.round(input.currentOccupancyRate * 100),
      },
      tokensUsed: 120,
    };
  }
}

export class CalculateYieldAction extends MetaAction<z.infer<typeof YieldInputSchema>, z.infer<typeof YieldOutputSchema>> {
  public readonly name = 'CalculateYield';
  public readonly description = 'Calcula a receita excedente e o split 93% / 7%';
  public readonly inputSchema = YieldInputSchema;
  public readonly outputSchema = YieldOutputSchema;

  protected async execute(input: z.infer<typeof YieldInputSchema>) {
    const totalExcedentGross = input.totalRooms * input.nights * input.increasePerNight;
    const landlordNetProfit = totalExcedentGross * 0.93;
    const zellaSuccessFee = totalExcedentGross * 0.07;
    const roiMultiplier = totalExcedentGross > 0 ? (landlordNetProfit / (zellaSuccessFee || 1)) : 0;

    return {
      output: {
        totalExcedentGross,
        landlordNetProfit: Math.round(landlordNetProfit * 100) / 100,
        zellaSuccessFee: Math.round(zellaSuccessFee * 100) / 100,
        roiMultiplier: Math.round(roiMultiplier * 10) / 10,
      },
      tokensUsed: 150,
    };
  }
}

export class AuditSuccessFeeAction extends MetaAction<z.infer<typeof AuditInputSchema>, z.infer<typeof AuditOutputSchema>> {
  public readonly name = 'AuditSuccessFee';
  public readonly description = 'Audita e valida a regra estrita de 7% de taxa sobre o excedente';
  public readonly inputSchema = AuditInputSchema;
  public readonly outputSchema = AuditOutputSchema;

  protected async execute(input: z.infer<typeof AuditInputSchema>) {
    const calculatedPercentage = input.totalExcedentGross > 0 ? (input.zellaSuccessFee / input.totalExcedentGross) * 100 : 7;
    const isCompliant = Math.abs(calculatedPercentage - 7) < 0.1;

    return {
      output: {
        isCompliant,
        feePercentage: Math.round(calculatedPercentage),
        auditNotes: isCompliant
          ? 'Auditoria Aprovada: Split 93% Proprietário / 7% Seu Zélla estritamente verificado.'
          : 'Alerta: Divergência na taxa de sucesso.',
      },
      tokensUsed: 90,
    };
  }
}

// ── Roles Especializados ────────────────────────────────────────────────────

export class DemandAnalystRole extends MetaRole {
  constructor() {
    super({
      name: 'DemandAnalyst',
      profile: 'Especialista em Demanda Turística e Feriados Canônicos',
      goal: 'Identificar picos de procura e recomendar aumentos justos de diária',
      constraints: ['Nunca subestimar feriados de réveillon e carnaval'],
    });
    this.registerAction(new AnalyzeDemandAction());
  }

  public async handleMessage(msg: MetaMessage) {
    return null;
  }
}

export class YieldStrategistRole extends MetaRole {
  constructor() {
    super({
      name: 'YieldStrategist',
      profile: 'Estrategista de Yield Management e Revenue Multiplier',
      goal: 'Maximizar o lucro extra líquido do proprietário com base na capacidade de quartos',
      constraints: ['Garantir cálculo transparente de excedente por quarto'],
    });
    this.registerAction(new CalculateYieldAction());
  }

  public async handleMessage(msg: MetaMessage) {
    return null;
  }
}

export class FinancialAuditorRole extends MetaRole {
  constructor() {
    super({
      name: 'FinancialAuditor',
      profile: 'Auditor Financeiro de Compliance Contratual',
      goal: 'Garantir que a taxa do Seu Zélla seja rigorosamente de 7% sobre o lucro extra',
      constraints: ['Cobrança ZERO sobre a diária base normal'],
    });
    this.registerAction(new AuditSuccessFeeAction());
  }

  public async handleMessage(msg: MetaMessage) {
    return null;
  }
}

// ── Definição do SOP de Yield War-Room ───────────────────────────────────────

export function createYieldWarRoomSOP(): SOPDefinition {
  const demandAnalyst = new DemandAnalystRole();
  const yieldStrategist = new YieldStrategistRole();
  const financialAuditor = new FinancialAuditorRole();

  return {
    name: 'YieldWarRoomSOP',
    description: 'Procedimento Operacional Padronizado de Precificação Dinâmica e UPSELL 7%',
    steps: [
      {
        role: demandAnalyst,
        actionName: 'AnalyzeDemand',
        inputTransformer: (ctx) => ({
          holidayName: ctx.holidayName || 'Feriado Prolongado',
          nights: ctx.nights || 3,
          currentOccupancyRate: ctx.occupancyRate || 0.75,
        }),
        outputSaver: (out, ctx) => {
          ctx.demandLevel = out.demandLevel;
          ctx.increasePerNight = ctx.customIncrease || out.recommendedIncreasePerNight;
        },
      },
      {
        role: yieldStrategist,
        actionName: 'CalculateYield',
        inputTransformer: (ctx) => ({
          totalRooms: ctx.totalRooms || 6,
          nights: ctx.nights || 3,
          baseDailyPrice: ctx.baseDailyPrice || 450,
          increasePerNight: ctx.increasePerNight || 200,
        }),
        outputSaver: (out, ctx) => {
          ctx.yieldResult = out;
        },
      },
      {
        role: financialAuditor,
        actionName: 'AuditSuccessFee',
        inputTransformer: (ctx) => ({
          totalExcedentGross: ctx.yieldResult.totalExcedentGross,
          landlordNetProfit: ctx.yieldResult.landlordNetProfit,
          zellaSuccessFee: ctx.yieldResult.zellaSuccessFee,
        }),
        outputSaver: (out, ctx) => {
          ctx.auditResult = out;
        },
      },
    ],
  };
}

export async function runYieldWarRoom(params: {
  holidayName: string;
  nights: number;
  totalRooms: number;
  baseDailyPrice: number;
  customIncrease?: number;
  occupancyRate?: number;
}) {
  const sop = createYieldWarRoomSOP();
  return SOPRunner.execute(sop, params);
}
