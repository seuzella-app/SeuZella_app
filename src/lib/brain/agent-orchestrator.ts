import { DNAVoiceAdapter } from '../voice/dna-voice-adapter';
import { ProcessPaymentProofUseCase } from './use-cases/ProcessPaymentProofUseCase';
import { ReceiptExtractor } from './receipt-extractor';
import { SecurityProcessor } from './processors/SecurityProcessor';
import { TrialValidator } from './processors/TrialValidator';
import { PromptBuilder, type PropertyData } from './processors/PromptBuilder';
import { classifyIntent, type ClassifiedIntent } from './intent-classifier';
import { executeTool } from './zehla-tools';
import { getCachedResponse, setCachedResponse } from '../ai/legacy-semantic-cache';
import { llmRouter } from '../ai/llm-router';
import { db } from '@/lib/db';

export interface AgentRequest {
  propertyId: string;
  message?: string;
  intent?: string;
  context?: Record<string, unknown>;
  sessionId?: string;
}

export interface AgentResponse {
  success: boolean;
  agent: string;
  intent: string;
  confidence: number;
  response: string;
  tokensUsed: number;
  cost: number;
  duration: number;
  voice?: { enabled: boolean; tier: 'PRO' | 'MAX'; adaptation?: Record<string, unknown>; instruction?: string };
}

export interface ProcessContext {
  request: AgentRequest;
  startTime: number;
  safeMessage: string;
  security: { hasPII: boolean; detectedTypes: string[] };
  classified: ClassifiedIntent;
  property?: Record<string, unknown>;
  response?: AgentResponse;
  receiptData?: { amount: number; raw?: string } | null;
  systemPrompt?: string;
  userPrompt?: string;
}

export abstract class AgentHandler {
  protected next: AgentHandler | null = null;
  setNext(handler: AgentHandler): AgentHandler { this.next = handler; return handler; }
  async handle(ctx: ProcessContext): Promise<ProcessContext> {
    const result = await this.process(ctx);
    if (result.response) return result;
    if (this.next) return this.next.handle(result);
    return result;
  }
  protected abstract process(ctx: ProcessContext): Promise<ProcessContext>;
  protected buildResponse(ctx: ProcessContext, overrides: Partial<AgentResponse> = {}): ProcessContext {
    ctx.response = { success: true, agent: 'SYSTEM', intent: ctx.classified?.intent || 'UNKNOWN', confidence: ctx.classified?.confidence || 0, response: '', tokensUsed: 0, cost: 0, duration: Date.now() - ctx.startTime, ...overrides };
    return ctx;
  }
  protected buildError(ctx: ProcessContext, message: string, agent: string = 'SYSTEM'): ProcessContext {
    ctx.response = { success: false, agent, intent: 'UNKNOWN', confidence: 0, response: message, tokensUsed: 0, cost: 0, duration: Date.now() - ctx.startTime };
    return ctx;
  }
}

class SecurityHandler extends AgentHandler {
  async process(ctx: ProcessContext): Promise<ProcessContext> {
    const { propertyId, message = '' } = ctx.request;
    const securityResult = await SecurityProcessor.validate(message, propertyId);
    if (!securityResult.success) return this.buildError(ctx, securityResult.error || 'Security violation', 'SYSTEM');
    ctx.safeMessage = securityResult.safeMessage!;
    ctx.security = { hasPII: securityResult.hasPII || false, detectedTypes: securityResult.detectedTypes || [] };
    return ctx;
  }
}

class IntentClassifierHandler extends AgentHandler {
  async process(ctx: ProcessContext): Promise<ProcessContext> {
    ctx.classified = await classifyIntent(ctx.safeMessage);
    return ctx;
  }
}

class TrialValidatorHandler extends AgentHandler {
  async process(ctx: ProcessContext): Promise<ProcessContext> {
    const trialResult = await TrialValidator.validate(ctx.request.propertyId);
    if (!trialResult.success) return this.buildError(ctx, 'Trial expired', 'SYSTEM');
    ctx.property = trialResult.property!;
    return ctx;
  }
}

class ReceiptHandler extends AgentHandler {
  async process(ctx: ProcessContext): Promise<ProcessContext> {
    ctx.receiptData = await ReceiptExtractor.extract(ctx.safeMessage);
    if (ctx.receiptData) {
      const msg = `Recebi seu comprovante de R$ ${ctx.receiptData.amount?.toLocaleString('pt-BR')}!`;
      return this.buildResponse(ctx, { agent: 'FINANCIAL', intent: 'PAYMENT_CONFIRMATION', confidence: 1.0, response: msg });
    }
    return ctx;
  }
}

class PromptBuilderHandler extends AgentHandler {
  async process(ctx: ProcessContext): Promise<ProcessContext> {
    const context = (ctx.request.context ?? {}) as Record<string, unknown>;
    const propertyData = ctx.property as PropertyData | undefined;
    const { systemPrompt, userPrompt } = await PromptBuilder.build(propertyData, ctx.classified.intent, ctx.request.message || '', ctx.classified, context);
    ctx.systemPrompt = systemPrompt;
    ctx.userPrompt = userPrompt;
    return ctx;
  }
}

class ToolCallingHandler extends AgentHandler {
  async process(ctx: ProcessContext): Promise<ProcessContext> {
    const toolsToCall: Array<{ name: string; args: Record<string, unknown> }> = [];
    toolsToCall.push({ name: 'zehla_buscar_dados_property', args: { pousada_id: ctx.request.propertyId } });
    const results: Record<string, unknown> = {};
    for (const { name, args } of toolsToCall) {
      try { results[name] = JSON.parse(await executeTool(name, args)); } catch (e) { results[name] = { error: String(e) }; }
    }
    const toolContextBlock = Object.entries(results).filter(([, v]) => !(v as Record<string, unknown>)?.error).map(([k, v]) => `[${k}]\n${JSON.stringify(v, null, 2)}`).join('\n\n');
    if (toolContextBlock) ctx.systemPrompt = `${ctx.systemPrompt || '' }\n\n## DADOS\n${toolContextBlock}`;
    return ctx;
  }
}

class SemanticCacheHandler extends AgentHandler {
  async process(ctx: ProcessContext): Promise<ProcessContext> {
    const cached = await getCachedResponse(ctx.userPrompt!, ctx.request.propertyId);
    if (cached) return this.buildResponse(ctx, { agent: getAgentName(ctx.classified.intent), response: cached, tokensUsed: 0, cost: 0 });
    return ctx;
  }
}

class LLMExecutionHandler extends AgentHandler {
  async process(ctx: ProcessContext): Promise<ProcessContext> {
    const llmResponse = await llmRouter.generate({
      model: ctx.classified.intent === 'PRICE_INQUIRY' || ctx.classified.intent === 'RESERVATION_CREATE' ? 'reasoning' : 'general',
      messages: [
        { role: 'system', content: ctx.systemPrompt! },
        { role: 'user', content: ctx.userPrompt! }
      ],
      temperature: 0.7,
      maxTokens: 2048
    });
    await setCachedResponse(ctx.userPrompt!, ctx.request.propertyId, llmResponse.content);
    ctx.response = { success: true, agent: getAgentName(ctx.classified.intent), intent: ctx.classified.intent, confidence: ctx.classified.confidence, response: llmResponse.content, tokensUsed: llmResponse.tokensUsed, cost: llmResponse.cost, duration: Date.now() - ctx.startTime };
    return ctx;
  }
}

class LoggingHandler extends AgentHandler {
  async process(ctx: ProcessContext): Promise<ProcessContext> {
    if (ctx.response && ctx.response.tokensUsed !== undefined) {
      try {
        const property = await db.property.findUnique({
          where: { id: ctx.request.propertyId },
          select: { tenantId: true }
        });
        const tenantId = property?.tenantId || 'unknown';

        await db.agentLog.create({
          data: {
            tenantId,
            agentName: ctx.response.agent,
            action: 'RESPOND',
            intent: ctx.classified.intent,
            confidence: ctx.classified.confidence,
            input: ctx.request.message || '',
            output: ctx.response.response,
            tokensUsed: ctx.response.tokensUsed || 0,
            cost: ctx.response.cost || 0,
            duration: Date.now() - ctx.startTime,
            status: 'SUCCESS'
          }
        });
      } catch (err) {
        console.error('[LoggingHandler] Failed to persist agent log:', err);
      }
    }
    return ctx;
  }
}

class VoiceHandler extends AgentHandler {
  async process(ctx: ProcessContext): Promise<ProcessContext> {
    if (!ctx.response || ctx.response.tokensUsed === undefined) return ctx;
    const context = (ctx.request.context ?? {}) as Record<string, unknown>;
    if (context.useNeuralVoice === true) {
      const adaptation = await DNAVoiceAdapter.getAdaptiveParams(ctx.request.sessionId || ctx.request.propertyId);
      ctx.response.voice = { enabled: true, tier: 'MAX', adaptation, instruction: DNAVoiceAdapter.getSystemInstruction(adaptation) };
    }
    return ctx;
  }
}

function getAgentName(intent: string): string {
  const map: Record<string, string> = {
    RESERVATION_CREATE: 'RECEPTIONIST', RESERVATION_MODIFY: 'RECEPTIONIST', RESERVATION_CANCEL: 'RECEPTIONIST',
    ROOM_AVAILABILITY: 'RECEPTIONIST', PRICE_INQUIRY: 'RECEPTIONIST', CHECK_IN: 'RESERVATIONS', CHECK_OUT: 'RESERVATIONS',
    HOUSEKEEPING_REQUEST: 'HOUSEKEEPING', AMENITIES_INQUIRY: 'CONCIERGE', LOCAL_INFO: 'CONCIERGE',
    PAYMENT_STATUS: 'FINANCIAL', CANCELATION_POLICY: 'FINANCIAL', GREETING: 'RECEPTIONIST', FAREWELL: 'RECEPTIONIST',
    SUPPLIER_INQUIRY: 'SYSTEM', UNKNOWN: 'RECEPTIONIST'
  };
  return map[intent] || 'RECEPTIONIST';
}

export class AgentOrchestrator {
  private chain: AgentHandler;
  constructor() {
    this.chain = new SecurityHandler();
    this.chain.setNext(new IntentClassifierHandler()).setNext(new TrialValidatorHandler()).setNext(new ReceiptHandler()).setNext(new PromptBuilderHandler()).setNext(new ToolCallingHandler()).setNext(new SemanticCacheHandler()).setNext(new LLMExecutionHandler()).setNext(new LoggingHandler()).setNext(new VoiceHandler());
  }
  async process(request: AgentRequest): Promise<AgentResponse> {
    const ctx: ProcessContext = { request, startTime: Date.now(), safeMessage: '', security: { hasPII: false, detectedTypes: [] }, classified: { intent: 'UNKNOWN', confidence: 0, entities: {}, rawMessage: request.message || '' } };
    const result = await this.chain.handle(ctx);
    if (!result.response) {
      return { success: false, response: '', agent: 'SYSTEM', intent: 'UNKNOWN', confidence: 0, duration: Date.now() - ctx.startTime, tokensUsed: 0, cost: 0 };
    }
    return result.response;
  }
}

export const orchestrator = new AgentOrchestrator();
