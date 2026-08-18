/**
 * ZCC — Prompt IDE API
 * =====================
 * POST /api/zcc/cerebro/prompt-ide
 * Testa um prompt contra 2 modelos e retorna respostas comparativas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { callOpenAICompatible, type AdapterMessage } from '@/lib/ai/llm-adapters';
import { CerebroWorkflowEngine } from '@/lib/cerebro/workflow-engine';
import { createHash } from 'crypto';

const TestSchema = z.object({
  systemPrompt: z.string().min(1),
  userMessage: z.string().min(1),
  models: z.array(z.string()).optional().default(['glm-4.7-flash', 'glm-5.2']),
});

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const body = await request.json();
    const parsed = TestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', details: parsed.error.issues }, { status: 400 });
    }

    const { systemPrompt, userMessage, models } = parsed.data;
    const apiKey = process.env.GLM_5_2_API_KEY || process.env.ZHIPU_API_KEY || '';
    const baseUrl = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';

    const messages: AdapterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const results = await Promise.all(
      models.map(async (model) => {
        const startTime = Date.now();
        const promptHash = hashPrompt(systemPrompt + userMessage);

        if (!apiKey) {
          return {
            model,
            response: `[MOCK] Resposta simulada para: ${userMessage.slice(0, 80)}...`,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: 0,
            costUsd: 0,
            mode: 'mock',
          };
        }

        try {
          const response = await callOpenAICompatible({
            apiKey, baseUrl, model, messages,
            temperature: 0.3, maxTokens: 500,
          });
          const latencyMs = Date.now() - startTime;
          const costUsd = (response.inputTokens * 0.00140 + response.outputTokens * 0.00440) / 1000;

          await CerebroWorkflowEngine.logLLMCall({
            model, provider: 'zhipu',
            promptTokens: response.inputTokens,
            completionTokens: response.outputTokens,
            latencyMs, costUsd, success: true,
            source: 'prompt_ide', promptHash,
          });

          return {
            model,
            response: response.content,
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            latencyMs,
            costUsd,
            mode: 'live',
          };
        } catch (err: any) {
          const latencyMs = Date.now() - startTime;
          await CerebroWorkflowEngine.logLLMCall({
            model, provider: 'zhipu',
            promptTokens: 0, completionTokens: 0,
            latencyMs, costUsd: 0, success: false,
            errorMessage: err?.message,
            source: 'prompt_ide', promptHash,
          });
          return { model, response: '', error: err?.message, latencyMs, costUsd: 0, mode: 'error' };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}
