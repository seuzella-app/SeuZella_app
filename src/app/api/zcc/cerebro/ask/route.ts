/**
 * ZCC — Cérebro Ask (Delirium Zero)
 * ===================================
 *
 * POST /api/zcc/cerebro/ask
 *
 * Body: { question: string, agentId?: ZellaAgentId }
 *
 * Faz uma pergunta ao Cérebro Zélla com workflow Delirium Zero:
 *   1. Busca fatos relevantes (CerebroKnowledgeFact) via tags
 *   2. Constrói contexto de projeto (estado atual, integrações, audit)
 *   3. Injeta tudo no system prompt do GLM 5.2
 *   4. LLM responde com fatos citados (não alucina)
 *
 * Response:
 *   {
 *     "response": "Resposta PT-BR...",
 *     "factsInjected": 5,
 *     "mode": "live" | "mock",
 *     "costUsd": 0.0024,
 *     "agentId": "cerebro-agent"
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { CerebroLearningService } from '@/lib/cerebro/cerebro-learning-service';
import { getGlmCerebroService } from '@/lib/cerebro/glm-service';
import type { ZellaAgentId } from '@/lib/cerebro/agency-agents-catalog';

const AskSchema = z.object({
  question: z.string().min(1).max(2000),
  agentId: z.string().optional(),
});

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const body = await request.json();
    const parsed = AskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { question, agentId } = parsed.data;

    // Constrói prompt com contexto + fatos (Delirium Zero)
    const { systemPrompt, factsInjected } = await CerebroLearningService.buildDeliriumZeroPrompt(question);

    // Agente padrão: cerebro-agent (security auditor)
    const finalAgentId = (agentId ?? 'cerebro-agent') as ZellaAgentId;

    // Chama GLM 5.2 (ou mock) com agency agent + system prompt enriquecido
    const service = getGlmCerebroService();

    // Modo mock: retorna resposta sintética
    if (service.getStats().mode === 'mock') {
      return NextResponse.json({
        response: `[MODO MOCK — Cérebro]\n\nEm modo live, esta pergunta seria respondida pelo GLM 5.2 com:\n- ${factsInjected} fatos relevantes injetados\n- Contexto do projeto (25 módulos, 239 rotas, 96 modelos)\n- Personalidade do agency-agent "${finalAgentId}"\n\nPergunta: ${question.slice(0, 200)}...\n\nPara ativar modo LIVE: configure CEREBRO_LIVE_MODE=true + GLM_5_2_API_KEY`,
        factsInjected,
        mode: 'mock',
        costUsd: 0,
        agentId: finalAgentId,
      });
    }

    // Modo live
    const result = await service.runWithAgent(finalAgentId, {
      userMessage: question,
    });

    return NextResponse.json({
      response: result.content,
      factsInjected,
      mode: result.mode,
      costUsd: result.costUsd,
      agentId: finalAgentId,
      tokensUsed: {
        input: result.inputTokens,
        output: result.outputTokens,
      },
    });
  } catch (error: any) {
    console.error('[ZCC_CEREBRO_ASK] Erro:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Falha ao processar pergunta' },
      { status: 500 },
    );
  }
}
