/**  
 * Cognitive Router — Orquestrador Central da Fase 2  
 *  
 * Coordena todo o fluxo cognitivo de recebimento de mensagens:  
 * 1. Executa Guardrails para segurança (se inseguro, bloqueia ou escala)  
 * 2. Classifica a intenção (se human_handover, escala imediatamente)  
 * 3. Se duvida_geral → Executa busca semântica RAG e invoca o ZaosNeuroRouter  
 * 4. Se cotacao_reserva → Executa loop de Tool Calling  
 */

import { guardWhatsAppMessage, logGuardrailAlert } from './whatsapp-guardrails';
import { classifyIntent, type IntentResult } from './intent-router';
import { retrieveRelevantKnowledge, formatRAGContext } from './semantic-rag';
import { executeToolCallingLoop, AVAILABLE_TOOLS } from './tool-calling';
import { getNeuroRouter, type LLMResponse } from './zaos-neuro-router';
import { db } from '@/lib/db';
import { hybridGraphSearch } from '@/lib/ml/graph-rag';
import { SemanticaClient } from '@/lib/semantica/client';
import { logSink } from '@/lib/cerebro/log-sink';

// ── V11-P0.6: DSPy CompiledPrompt loader ──────────────────────────────────
// Feature flag: USE_DSPY_COMPILED_PROMPTS=true ativa o carregamento de prompts
// otimizados pelo DSPy MIPROv2 a partir da tabela CompiledPrompt.
// Fallback hierárquico: se desativado ou falha, usa o systemPrompt legado.

const USE_DSPY_COMPILED_PROMPTS = process.env.USE_DSPY_COMPILED_PROMPTS === 'true';

interface CompiledPromptLookup {
  systemPrompt: string;
  version: string;
  source: 'dspy_compiled' | 'legacy_fallback';
}

/**
 * Resolve o system prompt final, priorizando prompts compilados pelo DSPy
 * (V11-P0.6 — ativação de ML morto). Fallback hierárquico para o prompt
 * legado passado pelo caller em caso de falha ou feature flag desligada.
 *
 * Lookup: CompiledPrompt WHERE tenantId = ? AND niche = ? AND active = true
 *         ORDER BY successRate DESC LIMIT 1
 */
async function resolveSystemPrompt(
  tenantId: string,
  niche: string,
  legacyPrompt: string,
): Promise<CompiledPromptLookup> {
  if (!USE_DSPY_COMPILED_PROMPTS) {
    return { systemPrompt: legacyPrompt, version: 'legacy', source: 'legacy_fallback' };
  }

  try {
    if (!db || !(db as any).compiledPrompt) {
      return { systemPrompt: legacyPrompt, version: 'legacy', source: 'legacy_fallback' };
    }

    const compiled = await (db as any).compiledPrompt.findFirst({
      where: { tenantId, niche, active: true },
      orderBy: { successRate: 'desc' },
    });

    if (compiled && compiled.promptText) {
      console.log(
        `[HARNESS_DSP_PROMPT_LOADED] tenant=${tenantId} niche=${niche} version=${compiled.version} successRate=${compiled.successRate}`
      );
      return {
        systemPrompt: compiled.promptText,
        version: compiled.version,
        source: 'dspy_compiled',
      };
    }
  } catch (err) {
    console.error('[HARNESS_DSP_PROMPT_FALLBACK] Erro ao buscar prompt compilado, recorrendo ao legado:', err);
  }

  return { systemPrompt: legacyPrompt, version: 'legacy-fallback', source: 'legacy_fallback' };
}

export interface CognitivePipelineRequest {  
  message: string;  
  tenantId: string;  
  sessionId?: string;  
  systemPrompt: string;
  preClassifiedIntent?: IntentResult; // Pass pre-classified intent to avoid double classification
}

export interface CognitivePipelineResult {  
  success: boolean;  
  response: string;  
  intent: string;  
  confidence: number;  
  providerId?: string;  
  tierUsed?: number;  
  isMock?: boolean;  
  requiresHumanHandover: boolean;  
  securityAlerts: any[];  
  toolCalls?: any[];  
  searchStats?: {  
    totalKnowledgeEntries: number;  
    vocabSize: number;  
    searchTimeMs: number;  
  };  
}

export const HUMAN_HANDOVER_RESPONSES = [  
  'Entendi. Vou chamar um atendente humano para te ajudar com isso agora mesmo. Por favor, aguarde um momento!',  
  'Certo, vou te transferir para um de nossos atendentes reais para que possam te dar o suporte necessário. Só um instante.',  
  'Com certeza. Um de nossos atendentes humanos já está ciente e falará com você em instantes.',  
];

export const BLOCKED_RESPONSE = 'Desculpe, não entendi muito bem. Poderia reformular a sua mensagem?';

/**  
 * Executa o pipeline cognitivo completo para uma mensagem recebida.  
 */  
export async function executeCognitivePipeline(
  request: CognitivePipelineRequest,
): Promise<CognitivePipelineResult> {
  const { message, tenantId, sessionId } = request;
  const startTime = Date.now();

  // ── V11-P0.6: Resolve system prompt via DSPy CompiledPrompt (com fallback) ──
  // niche='pousada' é o padrão do Seu Zélla; em P1 pode ser parametrizado por tenant.
  const promptResolution = await resolveSystemPrompt(tenantId, 'pousada', request.systemPrompt);
  const {systemPrompt} = promptResolution;

  // Etapa 1: Guardrails  
  const guardResult = guardWhatsAppMessage(message);  
  if (guardResult.alerts.length > 0) {  
    logGuardrailAlert(tenantId, 'WhatsApp', guardResult).catch(err =>  
      console.error('[CognitiveRouter] Error logging guardrail alert:', err),  
    );  
  }

  if (!guardResult.safe) {  
    return {  
      success: false,  
      response: guardResult.requiresHumanHandover ? HUMAN_HANDOVER_RESPONSES[0] : BLOCKED_RESPONSE,  
      intent: 'UNKNOWN',  
      confidence: 0,  
      requiresHumanHandover: guardResult.requiresHumanHandover,  
      securityAlerts: guardResult.alerts,  
    };  
  }

  // Etapa 2: Intent Classification (skip if already classified by caller)
  const intentResult = request.preClassifiedIntent || await classifyIntent(guardResult.sanitizedContent);  
  if (intentResult.intent === 'human_handover') {  
    const randomIndex = Math.floor(Math.random() * HUMAN_HANDOVER_RESPONSES.length);  
    return {  
      success: true,  
      response: HUMAN_HANDOVER_RESPONSES[randomIndex],  
      intent: intentResult.intent,  
      confidence: intentResult.confidence,  
      requiresHumanHandover: true,  
      securityAlerts: guardResult.alerts,  
    };  
  }

  // Etapa 3a: Cotação / Reservas (Tool Calling Pipeline)  
  if (intentResult.intent === 'cotacao_reserva' || intentResult.intent === 'reserva_direta') {  
    try {  
      const toolRes = await executeToolCallingLoop(guardResult.sanitizedContent, {  
        tools: AVAILABLE_TOOLS,  
        tenantId,  
        systemPrompt,  
        maxIterations: 3,  
      });  

      return {  
        success: true,  
        response: toolRes.response,  
        intent: intentResult.intent,  
        confidence: intentResult.confidence,  
        providerId: toolRes.providerId,  
        tierUsed: toolRes.tier,  
        isMock: toolRes.isMock,  
        requiresHumanHandover: false,  
        securityAlerts: guardResult.alerts,  
        toolCalls: toolRes.toolCalls,  
      };  
    } catch (err) {  
      console.error('[CognitiveRouter] Tool calling execution failed, falling back to RAG:', err);  
    }  
  }

  // Etapa 3b: Dúvida Geral (GraphRAG + RAG Pipeline com fallback gracioso)
  //
  // ESTRATÉGIA:
  //   1. Tenta GraphRAG (Semantica sidecar) primeiro — retorna contexto
  //      hierárquico resolvido com SUPERSEDES aplicado.
  //   2. Se Semantica falhar/timeout → cai em retrieveRelevantKnowledge()
  //      (RAG vetorial TF-IDF/Gemini, legado).
  //   3. Combina ambos quando GraphRAG retorna contexto (preferido)
  //      e adiciona entries do RAG vetorial como complemento.
  //
  // FEATURE FLAGS:
  //   USE_SEMANTICA_GRAPH=true  → ativa GraphRAG (com fallback)
  //   USE_SEMANTICA_GRAPH=false → só RAG vetorial (legado, default)
  //
  let graphRagContext = '';
  let graphRagSource: 'semantica' | 'fallback' | 'disabled' = 'disabled';
  let graphRagLatencyMs = 0;

  if (SemanticaClient.isEnabled() && SemanticaClient.isConfigured()) {
    const graphRagStart = Date.now();
    try {
      graphRagContext = await hybridGraphSearch(tenantId, guardResult.sanitizedContent);
      graphRagLatencyMs = Date.now() - graphRagStart;
      graphRagSource = 'semantica';
      logSink.info({
        module: 'cognitive-router',
        event: 'graphrag_hit',
        message: `GraphRAG retornou contexto (${graphRagLatencyMs}ms)`,
        context: { tenantId, latencyMs: graphRagLatencyMs, source: graphRagSource },
      });
    } catch (err) {
      graphRagLatencyMs = Date.now() - graphRagStart;
      graphRagSource = 'fallback';
      logSink.warn({
        module: 'cognitive-router',
        event: 'graphrag_fallback',
        message: `GraphRAG falhou, usando RAG vetorial apenas`,
        context: { tenantId, error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  // RAG vetorial (sempre executa — complementa GraphRAG)
  const ragResult = await retrieveRelevantKnowledge(tenantId, guardResult.sanitizedContent);
  const vectorContextBlock = formatRAGContext(ragResult);

  // Monta contexto final: GraphRAG (preferido) + RAG vetorial (complemento)
  let contextBlock = '';
  if (graphRagContext) {
    contextBlock = graphRagContext;
    if (vectorContextBlock) {
      contextBlock += `\n\n### CONHECIMENTO ADICIONAL (vetorial) ###\n${vectorContextBlock}`;
    }
  } else {
    contextBlock = vectorContextBlock;
  }

  const enrichedPrompt = contextBlock
    ? `${systemPrompt}\n\n${contextBlock}`
    : systemPrompt;

  const router = await getNeuroRouter();
  const aiResult = await router.generate({
    message: guardResult.sanitizedContent,
    systemPrompt: enrichedPrompt,
    sessionId,
    tier: 2,
    tenantId, // Per-tenant budget isolation
  });

  // ── AUDIT-PATH (async, não bloqueia resposta) ─────────────────────
  // Registra decisão no Semantica para auditabilidade (cadeia causal).
  // Erro aqui NÃO afeta a resposta ao hóspede.
  if (SemanticaClient.isEnabled() && SemanticaClient.isConfigured()) {
    recordDecisionAsync(tenantId, {
      category: 'guest_response',
      scenario: guardResult.sanitizedContent.slice(0, 500),
      reasoning: graphRagContext
        ? `GraphRAG (${graphRagSource}) retornou contexto hierárquico. RAG vetorial: ${ragResult.totalKnowledgeEntries} entries.`
        : `RAG vetorial apenas (${ragResult.totalKnowledgeEntries} entries). GraphRAG desabilitado.`,
      outcome: 'success',
      response: aiResult.response.slice(0, 500),
      confidence: aiResult.confidence || intentResult.confidence,
      metadata: {
        providerId: aiResult.providerId,
        tier: aiResult.tier,
        latencyMs: Date.now() - startTime,
        sessionId,
        intent: intentResult.intent,
        fallbackUsed: graphRagSource === 'fallback',
      },
    }).catch(() => {
      // Silent fail — auditoria não pode bloquear resposta
    });
  }

  return {
    success: true,
    response: aiResult.response,
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    providerId: aiResult.providerId,
    tierUsed: aiResult.tier,
    isMock: aiResult.isMock,
    requiresHumanHandover: false,
    securityAlerts: guardResult.alerts,
    searchStats: {
      totalKnowledgeEntries: ragResult.totalKnowledgeEntries,
      vocabSize: ragResult.vocabSize,
      searchTimeMs: ragResult.searchTimeMs + graphRagLatencyMs,
    },
  };
}

/**
 * Registra uma decisão no Semantica de forma assíncrona (não-bloqueante).
 * Usado para auditabilidade — toda resposta da IA fica rastreável.
 */
async function recordDecisionAsync(
  tenantId: string,
  decision: {
    category: 'guest_response' | 'intent_classification' | 'tool_calling' | 'human_handover' | 'message_blocked';
    scenario: string;
    reasoning: string;
    outcome: 'success' | 'failure' | 'escalated' | 'blocked' | 'pending';
    response?: string;
    confidence: number;
    metadata?: any;
  }
): Promise<void> {
  try {
    await SemanticaClient.recordDecision({
      tenantId,
      ...decision,
    });
  } catch (err) {
    // Silent fail — auditoria não pode quebrar o fluxo principal
    console.warn('[CognitiveRouter] Falha ao registrar decisão (não-bloqueante):', err);
  }
}

/**  
 * Formata o histórico recente de mensagens.  
 */  
export function formatConversationHistory(recentMessages: Array<{ from: 'guest' | 'ai' | 'human'; content: string }>): string {  
  if (recentMessages.length === 0) return '';  
  const history = recentMessages  
    .slice(-6)  
    .map(msg => {  
      const sender = msg.from === 'guest' ? 'Hóspede' : msg.from === 'ai' ? 'IA' : 'Atendente Humano';  
      return `[${sender}]: ${msg.content}`;  
    })  
    .join('\n');  
  return `Histórico recente da conversa:\n${history}\n\n`;  
}  
