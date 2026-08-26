// =============================================================================
// SEU ZÉLLA METAGPT — EXPERIENCE & LEARNING DISTILLER SOP
// =============================================================================

import { z } from 'zod';
import { MetaAction } from '../core/action';
import { MetaRole } from '../core/role';
import { type SOPDefinition, SOPRunner } from '../core/sop-runner';
import { type MetaMessage } from '../core/message';

// ── Schemas de Ação ─────────────────────────────────────────────────────────

const NPSFeedbackInputSchema = z.object({
  guestName: z.string(),
  roomName: z.string(),
  npsScore: z.number().min(0).max(10),
  feedbackText: z.string().optional(),
});

const NPSFeedbackOutputSchema = z.object({
  category: z.enum(['PROMOTOR', 'NEUTRO', 'DETRATOR']),
  highlightedPraise: z.string().optional(),
  improvementOpportunity: z.string().optional(),
});

const DistillKnowledgeInputSchema = z.object({
  roomName: z.string(),
  category: z.string(),
  feedbackText: z.string().optional(),
});

const DistillKnowledgeOutputSchema = z.object({
  learnedRule: z.string(),
  confidence: z.number(),
  targetTopic: z.string(),
});

// ── Ações Concretas ──────────────────────────────────────────────────────────

export class AnalyzeNPSFeedbackAction extends MetaAction<z.infer<typeof NPSFeedbackInputSchema>, z.infer<typeof NPSFeedbackOutputSchema>> {
  public readonly name = 'AnalyzeNPSFeedback';
  public readonly description = 'Classifica a satisfação do hóspede e extrai elogios e oportunidades';
  public readonly inputSchema = NPSFeedbackInputSchema;
  public readonly outputSchema = NPSFeedbackOutputSchema;

  protected async execute(input: z.infer<typeof NPSFeedbackInputSchema>) {
    let category: 'PROMOTOR' | 'NEUTRO' | 'DETRATOR' = 'PROMOTOR';
    if (input.npsScore < 7) {
      category = 'DETRATOR';
    } else if (input.npsScore < 9) {
      category = 'NEUTRO';
    }

    const text = input.feedbackText || '';
    const praise = 'Hospedagem perfeita e atendimento acolhedor.';
    let opportunity: string | undefined = undefined;

    if (text.toLowerCase().includes('travesseiro') || text.toLowerCase().includes('cama')) {
      opportunity = 'Verificar maciez dos travesseiros adicionais.';
    } else if (text.toLowerCase().includes('barulho') || text.toLowerCase().includes('som')) {
      opportunity = 'Reforçar aviso de horário de silêncio após às 22h.';
    }

    return {
      output: {
        category,
        highlightedPraise: praise,
        improvementOpportunity: opportunity,
      },
      tokensUsed: 80,
    };
  }
}

export class DistillKnowledgeAction extends MetaAction<z.infer<typeof DistillKnowledgeInputSchema>, z.infer<typeof DistillKnowledgeOutputSchema>> {
  public readonly name = 'DistillKnowledge';
  public readonly description = 'Destila aprendizados para auto-atualizar a base de conhecimento do Seu Zélla';
  public readonly inputSchema = DistillKnowledgeInputSchema;
  public readonly outputSchema = DistillKnowledgeOutputSchema;

  protected async execute(input: z.infer<typeof DistillKnowledgeInputSchema>) {
    const rule = input.feedbackText
      ? `Aprendizado extraído para ${input.roomName}: "${input.feedbackText}"`
      : `Padrão de excelência mantido em ${input.roomName}.`;

    return {
      output: {
        learnedRule: rule,
        confidence: 0.95,
        targetTopic: 'housekeeping.preferences',
      },
      tokensUsed: 65,
    };
  }
}

// ── Roles Especializados ────────────────────────────────────────────────────

export class NPSCollectorRole extends MetaRole {
  constructor() {
    super({
      name: 'NPSCollector',
      profile: 'Especialista em Experiência do Hóspede e Métricas de Satisfação',
      goal: 'Identificar promotores da marca e pontos de atrito na estadia',
    });
    this.registerAction(new AnalyzeNPSFeedbackAction());
  }

  public async handleMessage(msg: MetaMessage) {
    return null;
  }
}

export class FeedbackDistillerRole extends MetaRole {
  constructor() {
    super({
      name: 'FeedbackDistiller',
      profile: 'Destilador de Conhecimento e Auto-Aprimoramento',
      goal: 'Transformar feedbacks em regras acionáveis na base de conhecimento',
    });
    this.registerAction(new DistillKnowledgeAction());
  }

  public async handleMessage(msg: MetaMessage) {
    return null;
  }
}

// ── Definição do SOP de Experience Distiller ─────────────────────────────────

export function createExperienceDistillerSOP(): SOPDefinition {
  const collector = new NPSCollectorRole();
  const distiller = new FeedbackDistillerRole();

  return {
    name: 'ExperienceDistillerSOP',
    description: 'Procedimento Operacional Padronizado de Pós-Checkout e Auto-Aprendizado',
    steps: [
      {
        role: collector,
        actionName: 'AnalyzeNPSFeedback',
        inputTransformer: (ctx) => ({
          guestName: ctx.guestName || 'Hóspede',
          roomName: ctx.roomName || 'Suíte Master 101',
          npsScore: ctx.npsScore ?? 10,
          feedbackText: ctx.feedbackText,
        }),
        outputSaver: (out, ctx) => {
          ctx.npsCategory = out.category;
          ctx.praise = out.highlightedPraise;
          ctx.opportunity = out.improvementOpportunity;
        },
      },
      {
        role: distiller,
        actionName: 'DistillKnowledge',
        inputTransformer: (ctx) => ({
          roomName: ctx.roomName || 'Suíte Master 101',
          category: ctx.npsCategory,
          feedbackText: ctx.opportunity || ctx.feedbackText,
        }),
        outputSaver: (out, ctx) => {
          ctx.distilledResult = out;
        },
      },
    ],
  };
}

export async function runExperienceDistiller(params: {
  guestName: string;
  roomName: string;
  npsScore: number;
  feedbackText?: string;
}) {
  const sop = createExperienceDistillerSOP();
  return SOPRunner.execute(sop, params);
}
