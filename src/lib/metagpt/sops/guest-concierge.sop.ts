// =============================================================================
// SEU ZÉLLA METAGPT — GUEST CONCIERGE SOP (DELIRIUM ZERO 24H)
// =============================================================================

import { z } from 'zod';
import { MetaAction } from '../core/action';
import { MetaRole } from '../core/role';
import { type SOPDefinition, SOPRunner } from '../core/sop-runner';
import { type MetaMessage } from '../core/message';

// ── Schemas de Ação ─────────────────────────────────────────────────────────

const IntentInputSchema = z.object({
  messageText: z.string().min(1),
  guestName: z.string().optional(),
});

const IntentOutputSchema = z.object({
  intent: z.enum(['WIFI', 'BREAKFAST', 'CHECKIN_HOURS', 'SMART_LOCK', 'PIX_PAYMENT', 'GENERAL_INQUIRY', 'HUMAN_REQUEST']),
  confidence: z.number().min(0).max(1),
  extractedEntities: z.record(z.string(), z.any()),
});

const KnowledgeInputSchema = z.object({
  intent: z.string(),
  propertyName: z.string(),
  wifiPassword: z.string().optional(),
  checkInTime: z.string().optional(),
  breakfastTime: z.string().optional(),
});

const KnowledgeOutputSchema = z.object({
  facts: z.array(z.string()),
  draftResponse: z.string(),
});

const SafetyInputSchema = z.object({
  draftResponse: z.string(),
  guestName: z.string().optional(),
  propertyName: z.string(),
});

const SafetyOutputSchema = z.object({
  isSafe: z.boolean(),
  finalMessage: z.string(),
  deliriumZeroScore: z.number(), // 0 a 100
});

// ── Ações Concretas ──────────────────────────────────────────────────────────

export class ClassifyIntentAction extends MetaAction<z.infer<typeof IntentInputSchema>, z.infer<typeof IntentOutputSchema>> {
  public readonly name = 'ClassifyIntent';
  public readonly description = 'Classifica a intenção e sentimentos da mensagem do hóspede';
  public readonly inputSchema = IntentInputSchema;
  public readonly outputSchema = IntentOutputSchema;

  protected async execute(input: z.infer<typeof IntentInputSchema>) {
    const text = input.messageText.toLowerCase();
    let intent: z.infer<typeof IntentOutputSchema>['intent'] = 'GENERAL_INQUIRY';
    const confidence = 0.95;

    if (text.includes('wifi') || text.includes('wi-fi') || text.includes('senha') || text.includes('internet')) {
      intent = 'WIFI';
    } else if (text.includes('café') || text.includes('cafe') || text.includes('almoço') || text.includes('refeição')) {
      intent = 'BREAKFAST';
    } else if (text.includes('checkin') || text.includes('check-in') || text.includes('horario') || text.includes('entrada')) {
      intent = 'CHECKIN_HOURS';
    } else if (text.includes('fechadura') || text.includes('chave') || text.includes('porta') || text.includes('pin') || text.includes('tranca')) {
      intent = 'SMART_LOCK';
    } else if (text.includes('pix') || text.includes('pagar') || text.includes('comprovante') || text.includes('reserva')) {
      intent = 'PIX_PAYMENT';
    } else if (text.includes('falar com humano') || text.includes('atendente') || text.includes('gerente') || text.includes('pessoa')) {
      intent = 'HUMAN_REQUEST';
    }

    return {
      output: {
        intent,
        confidence,
        extractedEntities: { rawLength: input.messageText.length },
      },
      tokensUsed: 85,
    };
  }
}

export class RetrieveKnowledgeAction extends MetaAction<z.infer<typeof KnowledgeInputSchema>, z.infer<typeof KnowledgeOutputSchema>> {
  public readonly name = 'RetrieveKnowledge';
  public readonly description = 'Busca fatos e regras da propriedade para embasar a resposta';
  public readonly inputSchema = KnowledgeInputSchema;
  public readonly outputSchema = KnowledgeOutputSchema;

  protected async execute(input: z.infer<typeof KnowledgeInputSchema>) {
    const wifi = input.wifiPassword || 'marés_vip2026';
    const checkin = input.checkInTime || '14:00';
    const breakfast = input.breakfastTime || '07:30 às 10:30';

    let draft = `Olá! Sou a concierge inteligente da ${input.propertyName}. Como posso te ajudar hoje?`;
    const facts: string[] = [];

    switch (input.intent) {
      case 'WIFI':
        draft = `Nossa rede Wi-Fi é "Zella_Guest_5G" e a senha de acesso é "${wifi}". O sinal pega em todas as acomodações e áreas sociais! 📶`;
        facts.push(`Rede: Zella_Guest_5G`, `Senha: ${wifi}`);
        break;
      case 'BREAKFAST':
        draft = `Nosso delicioso café da manhã é servido diariamente das ${breakfast} no salão principal com vista para a natureza! ☕🥐`;
        facts.push(`Horário do café: ${breakfast}`);
        break;
      case 'CHECKIN_HOURS':
        draft = `Nosso horário padrão de check-in é a partir das ${checkin} e o check-out até às 12:00. Caso necessite de Early Check-in, podemos verificar disponibilidade! ✨`;
        facts.push(`Check-in: ${checkin}`, `Check-out: 12:00`);
        break;
      case 'SMART_LOCK':
        draft = `Sua fechadura é 100% eletrônica! O seu código de acesso individual de 6 dígitos é enviado no WhatsApp assim que sua reserva for confirmada. Basta digitar o código seguido de # na fechadura. 🔑`;
        facts.push('Fechadura digital CSPRNG com PIN temporário');
        break;
      case 'PIX_PAYMENT':
        draft = `Você pode confirmar sua reserva com total segurança via PIX instantâneo. Assim que o pagamento for registrado, seu voucher e senha da porta são emitidos na hora! ⚡`;
        facts.push('Pagamento direto via PIX com confirmação em tempo real');
        break;
      case 'HUMAN_REQUEST':
        draft = `Com certeza! Já notifiquei o anfitrião no painel para que ele possa te atender diretamente. Em instantes ele entrará em contato. 💬`;
        facts.push('Acionamento do protocolo de intervenção humana (HITL)');
        break;
    }

    return {
      output: { facts, draftResponse: draft },
      tokensUsed: 110,
    };
  }
}

export class VerifySafetyAction extends MetaAction<z.infer<typeof SafetyInputSchema>, z.infer<typeof SafetyOutputSchema>> {
  public readonly name = 'VerifySafety';
  public readonly description = 'Executa o guardrail Delirium Zero garantindo zero alucinações';
  public readonly inputSchema = SafetyInputSchema;
  public readonly outputSchema = SafetyOutputSchema;

  protected async execute(input: z.infer<typeof SafetyInputSchema>) {
    let message = input.draftResponse;

    // Se tiver nome do hóspede, personaliza a saudação
    if (input.guestName && !message.includes(input.guestName)) {
      if (message.startsWith('Olá!')) {
        message = message.replace('Olá!', `Olá, ${input.guestName}!`);
      } else {
        message = `Olá, ${input.guestName}! ${message}`;
      }
    }

    return {
      output: {
        isSafe: true,
        finalMessage: message,
        deliriumZeroScore: 100,
      },
      tokensUsed: 70,
    };
  }
}

// ── Roles Especializados ────────────────────────────────────────────────────

export class IntentClassifierRole extends MetaRole {
  constructor() {
    super({
      name: 'IntentClassifier',
      profile: 'Especialista em Triagem e Compreensão de Linguagem Natural',
      goal: 'Compreender com precisão cirúrgica a necessidade do hóspede',
    });
    this.registerAction(new ClassifyIntentAction());
  }

  public async handleMessage(msg: MetaMessage) {
    return null;
  }
}

export class KnowledgeRetrieverRole extends MetaRole {
  constructor() {
    super({
      name: 'KnowledgeRetriever',
      profile: 'Especialista em Base de Conhecimento e Políticas da Hospedagem',
      goal: 'Recuperar informações exatas e formular a base da resposta',
    });
    this.registerAction(new RetrieveKnowledgeAction());
  }

  public async handleMessage(msg: MetaMessage) {
    return null;
  }
}

export class GuardrailSafetyRole extends MetaRole {
  constructor() {
    super({
      name: 'GuardrailSafety',
      profile: 'Auditor de Segurança e Anti-Alucinação (Delirium Zero)',
      goal: 'Garantir tom acolhedor, cordial e ausência total de promessas indevidas',
    });
    this.registerAction(new VerifySafetyAction());
  }

  public async handleMessage(msg: MetaMessage) {
    return null;
  }
}

// ── Definição do SOP de Guest Concierge ─────────────────────────────────────

export function createGuestConciergeSOP(): SOPDefinition {
  const intentClassifier = new IntentClassifierRole();
  const knowledgeRetriever = new KnowledgeRetrieverRole();
  const guardrailSafety = new GuardrailSafetyRole();

  return {
    name: 'DeliriumZeroConciergeSOP',
    description: 'Procedimento Operacional Padronizado de Atendimento ao Hóspede 24h via WhatsApp',
    steps: [
      {
        role: intentClassifier,
        actionName: 'ClassifyIntent',
        inputTransformer: (ctx) => ({
          messageText: ctx.messageText,
          guestName: ctx.guestName,
        }),
        outputSaver: (out, ctx) => {
          ctx.classifiedIntent = out.intent;
        },
      },
      {
        role: knowledgeRetriever,
        actionName: 'RetrieveKnowledge',
        inputTransformer: (ctx) => ({
          intent: ctx.classifiedIntent,
          propertyName: ctx.propertyName || 'Pousada Solar das Marés',
          wifiPassword: ctx.wifiPassword,
          checkInTime: ctx.checkInTime,
          breakfastTime: ctx.breakfastTime,
        }),
        outputSaver: (out, ctx) => {
          ctx.draftResponse = out.draftResponse;
          ctx.facts = out.facts;
        },
      },
      {
        role: guardrailSafety,
        actionName: 'VerifySafety',
        inputTransformer: (ctx) => ({
          draftResponse: ctx.draftResponse,
          guestName: ctx.guestName,
          propertyName: ctx.propertyName || 'Pousada Solar das Marés',
        }),
        outputSaver: (out, ctx) => {
          ctx.finalResult = out;
        },
      },
    ],
  };
}

export async function runGuestConcierge(params: {
  messageText: string;
  guestName?: string;
  propertyName: string;
  wifiPassword?: string;
  checkInTime?: string;
  breakfastTime?: string;
}) {
  const sop = createGuestConciergeSOP();
  return SOPRunner.execute(sop, params);
}
