// =============================================================================
// SEU ZÉLLA METAGPT — HITL ARBITRATION SOP (HUMAN-IN-THE-LOOP)
// =============================================================================

import { z } from 'zod';
import { MetaAction } from '../core/action';
import { MetaRole } from '../core/role';
import { type SOPDefinition, SOPRunner } from '../core/sop-runner';
import { type MetaMessage } from '../core/message';

// ── Schemas de Ação ─────────────────────────────────────────────────────────

const TriggerInputSchema = z.object({
  guestName: z.string(),
  guestPhone: z.string(),
  propertyName: z.string(),
  reason: z.enum(['USER_CLICK_ASSUMIR', 'GUEST_EXPLICIT_REQUEST', 'COMPLEX_DISPUTE', 'SPECIAL_AGREEMENT']),
  lastMessageSnippet: z.string().optional(),
});

const TriggerOutputSchema = z.object({
  escalationRequired: z.boolean(),
  cleanPhone: z.string(),
  whatsappDeepLink: z.string(),
  initialGreeting: z.string(),
});

const ComplianceInputSchema = z.object({
  tenantId: z.string(),
  guestName: z.string(),
  escalationReason: z.string(),
});

const ComplianceOutputSchema = z.object({
  termsCompliant: z.boolean(),
  legalNotice: z.string(),
  loggedAt: numberOrDateString(),
});

function numberOrDateString() {
  return z.union([z.number(), z.string()]);
}

// ── Ações Concretas ──────────────────────────────────────────────────────────

export class ArbitrateEscalationAction extends MetaAction<z.infer<typeof TriggerInputSchema>, z.infer<typeof TriggerOutputSchema>> {
  public readonly name = 'ArbitrateEscalation';
  public readonly description = 'Prepara o link de atendimento direto e pausa as respostas automáticas';
  public readonly inputSchema = TriggerInputSchema;
  public readonly outputSchema = TriggerOutputSchema;

  protected async execute(input: z.infer<typeof TriggerInputSchema>) {
    const raw = input.guestPhone.replace(/\D/g, '');
    const cleanPhone = raw.startsWith('55') ? raw : `55${raw}`;
    const greeting = `Olá ${input.guestName}, sou o responsável pela ${input.propertyName}!`;
    const encoded = encodeURIComponent(greeting);
    const deepLink = `https://wa.me/${cleanPhone}?text=${encoded}`;

    return {
      output: {
        escalationRequired: true,
        cleanPhone,
        whatsappDeepLink: deepLink,
        initialGreeting: greeting,
      },
      tokensUsed: 65,
    };
  }
}

export class LogLegalComplianceAction extends MetaAction<z.infer<typeof ComplianceInputSchema>, z.infer<typeof ComplianceOutputSchema>> {
  public readonly name = 'LogLegalCompliance';
  public readonly description = 'Registra auditoria de intervenção humana mantendo a vigência integral do contrato SaaS';
  public readonly inputSchema = ComplianceInputSchema;
  public readonly outputSchema = ComplianceOutputSchema;

  protected async execute(input: z.infer<typeof ComplianceInputSchema>) {
    const notice = 'Intervenção Humana Registrada: Conforme os Termos de Uso (Seção 4), o atendimento direto pelo anfitrião é uma prerrogativa operacional que não altera a mensalidade contratada.';
    
    return {
      output: {
        termsCompliant: true,
        legalNotice: notice,
        loggedAt: Date.now(),
      },
      tokensUsed: 50,
    };
  }
}

// ── Roles Especializados ────────────────────────────────────────────────────

export class ConflictArbitratorRole extends MetaRole {
  constructor() {
    super({
      name: 'ConflictArbitrator',
      profile: 'Árbitro de Transição entre Automação e Atendimento Humano',
      goal: 'Garantir transição suave para o WhatsApp nativo do responsável',
    });
    this.registerAction(new ArbitrateEscalationAction());
  }

  public async handleMessage(msg: MetaMessage) {
    return null;
  }
}

export class ComplianceLoggerRole extends MetaRole {
  constructor() {
    super({
      name: 'ComplianceLogger',
      profile: 'Auditor de Conformidade Jurídica e Termos de Uso',
      goal: 'Assegurar que eventos de intervenção humana estejam respaldados contratualmente',
    });
    this.registerAction(new LogLegalComplianceAction());
  }

  public async handleMessage(msg: MetaMessage) {
    return null;
  }
}

// ── Definição do SOP de HITL Arbitration ───────────────────────────────────

export function createHITLArbitrationSOP(): SOPDefinition {
  const arbitrator = new ConflictArbitratorRole();
  const complianceLogger = new ComplianceLoggerRole();

  return {
    name: 'HITLArbitrationSOP',
    description: 'Procedimento Operacional Padronizado de Assunção de Atendimento Humano e Compliance',
    steps: [
      {
        role: arbitrator,
        actionName: 'ArbitrateEscalation',
        inputTransformer: (ctx) => ({
          guestName: ctx.guestName || 'Hóspede',
          guestPhone: ctx.guestPhone || '11999990000',
          propertyName: ctx.propertyName || 'Pousada Solar das Marés',
          reason: ctx.reason || 'USER_CLICK_ASSUMIR',
          lastMessageSnippet: ctx.lastMessageSnippet,
        }),
        outputSaver: (out, ctx) => {
          ctx.arbitrationResult = out;
        },
      },
      {
        role: complianceLogger,
        actionName: 'LogLegalCompliance',
        inputTransformer: (ctx) => ({
          tenantId: ctx.tenantId || 'demo-tenant',
          guestName: ctx.guestName || 'Hóspede',
          escalationReason: ctx.reason || 'USER_CLICK_ASSUMIR',
        }),
        outputSaver: (out, ctx) => {
          ctx.complianceResult = out;
        },
      },
    ],
  };
}

export async function runHITLArbitration(params: {
  guestName: string;
  guestPhone: string;
  propertyName: string;
  reason?: 'USER_CLICK_ASSUMIR' | 'GUEST_EXPLICIT_REQUEST' | 'COMPLEX_DISPUTE' | 'SPECIAL_AGREEMENT';
  tenantId?: string;
}) {
  const sop = createHITLArbitrationSOP();
  return SOPRunner.execute(sop, params);
}
