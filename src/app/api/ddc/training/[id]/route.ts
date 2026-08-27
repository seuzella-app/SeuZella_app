import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenantId, mapTraining } from '@/lib/ddc/ddc-mapper';
import { createError, apiSuccess } from '@/lib/error-handler';
import { apiRatelimit } from '@/lib/rate-limit';
import { getNeuroRouter } from '@/lib/ai/zaos-neuro-router';

interface RouteContext { params: Promise<{ id: string }> }

async function guard(): Promise<string | NextResponse> {
  const tenantId = await resolveTenantId();
  if (!tenantId) return createError(401, 'UNAUTHORIZED', 'Não autorizado');
  const { success } = await apiRatelimit.limit(tenantId);
  if (!success) return createError(429, 'RATE_LIMITED', 'Muitas requisições');
  return tenantId;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const g = await guard();
    if (g instanceof NextResponse) return g;
    const { id } = await context.params;
    const body = await request.json();
    const existing = await db.trainingPrompt.findFirst({ where: { id, tenantId: g } });
    if (!existing) return createError(404, 'NOT_FOUND', 'Training not found');

    const updateData: Record<string, unknown> = {};
    if (body.title) updateData.name = body.title;
    if (body.content) updateData.content = body.content;
    if (body.category) updateData.type = body.category;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = await db.trainingPrompt.update({ where: { id: existing.id }, data: updateData });
    return apiSuccess(mapTraining(updated));
  } catch {
    return createError(500, 'UPDATE_FAILED', 'Failed to update training');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const g = await guard();
    if (g instanceof NextResponse) return g;
    const { id } = await context.params;
    const existing = await db.trainingPrompt.findFirst({ where: { id, tenantId: g } });
    if (!existing) return createError(404, 'NOT_FOUND', 'Training not found');

    await db.trainingPrompt.delete({ where: { id: existing.id } });
    return apiSuccess(null);
  } catch {
    return createError(500, 'DELETE_FAILED', 'Failed to delete training');
  }
}

/**
 * TEST REAL: Usa o LLM real para avaliar se o training prompt é eficaz.
 *
 * Envia 3 cenários de teste para a IA com o training prompt injetado
 * e avalia se as respostas estão alinhadas com o que o dono espera.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const g = await guard();
    if (g instanceof NextResponse) return g;
    const { id } = await context.params;
    const training = await db.trainingPrompt.findFirst({ where: { id, tenantId: g } });
    if (!training) return createError(404, 'NOT_FOUND', 'Training not found');

    const property = await db.property.findFirst({ where: { tenantId: g } });
    const propertyName = property?.name || 'Pousada';

    // Cenários de teste baseados no tipo do training
    const testScenarios = getTestScenarios(training.type, propertyName, training.content);

    // Avaliar cada cenário com o LLM
    let totalScore = 0;
    const results: string[] = [];

    for (const scenario of testScenarios) {
      try {
        const router = await getNeuroRouter();
        const response = await router.generate({
          message: scenario.guestMessage,
          systemPrompt: `Você é a IA da ${propertyName}. ${training.content}\n\nResponda de forma concisa e hospitaleira.`,
          tenantId: g,
          tier: 1,
        });

        // Auto-avaliação: a resposta cobre o ponto esperado?
        const coversExpected = response.response.toLowerCase().includes(scenario.expectedKeyword.toLowerCase());
        const isAppropriate = !response.response.includes('[IA Silenciada') && !response.response.includes('probleminha');
        const score = (coversExpected ? 40 : 15) + (isAppropriate ? 60 : 20);

        totalScore += score;
        results.push(`Cenário "${scenario.label}": ${score}/100 ${coversExpected ? '✓' : '✗'} cobriu "${scenario.expectedKeyword}"`);
      } catch {
        results.push(`Cenário "${scenario.label}": ERRO ao avaliar`);
        totalScore += 30; // Score parcial
      }
    }

    const avgScore = Math.round(totalScore / testScenarios.length);
    const passed = avgScore >= 70;

    // Feedback construtivo baseado nos resultados
    const feedback = generateFeedback(training.type, avgScore, results);

    await db.trainingPrompt.update({
      where: { id },
      data: {
        successRate: avgScore,
        usageCount: { increment: 1 },
        lastUsed: new Date(),
      },
    });

    return apiSuccess({
      status: passed ? 'passed' as const : 'failed' as const,
      score: avgScore,
      results,
      feedback,
    });
  } catch (error) {
    console.error('[training test] Erro:', error);
    return createError(500, 'TEST_FAILED', 'Failed to test training');
  }
}

function getTestScenarios(type: string, propertyName: string, _trainingContent: string) {
  const base = [
    {
      label: 'Pergunta direta',
      guestMessage: `Olá! Vocês têm disponibilidade para o fim de semana?`,
      expectedKeyword: 'disponibilidade',
    },
    {
      label: 'Pergunta de preço',
      guestMessage: `Quanto custa uma diária para casal?`,
      expectedKeyword: 'diária',
    },
  ];

  switch (type) {
    case 'persona':
      return [
        ...base,
        { label: 'Teste de tom', guestMessage: 'Boa noite! Quero saber sobre a pousada.', expectedKeyword: propertyName.substring(0, 5).toLowerCase() },
      ];
    case 'escalation':
      return [
        { label: 'Reclamação', guestMessage: 'Estou muito insatisfeito com o quarto! Cheguei e não estava limpo.', expectedKeyword: 'desculpa' },
        { label: 'Pedido urgente', guestMessage: 'Preciso de ajuda agora! O ar-condicionado quebrou!', expectedKeyword: 'ajudar' },
        { label: 'Ameaça de review', guestMessage: 'Vou fazer uma review terrível no Booking!', expectedKeyword: 'entend' },
      ];
    case 'proactive':
      return [
        { label: 'Check-in', guestMessage: 'Chegamos! Como fazemos o check-in?', expectedKeyword: 'check-in' },
        { label: 'Serviço', guestMessage: 'Tem café da manhã incluso?', expectedKeyword: 'café' },
        { label: 'Localização', guestMessage: 'Ficamos longe da praia?', expectedKeyword: 'praia' },
      ];
    default: // 'response'
      return [
        ...base,
        { label: 'Cancelamento', guestMessage: 'Preciso cancelar minha reserva. Como faço?', expectedKeyword: 'cancel' },
      ];
  }
}

function generateFeedback(type: string, score: number, results: string[]): string {
  const failed = results.filter(r => r.includes('✗'));
  if (score >= 90) return 'Excelente! O prompt está muito bem estruturado e a IA responde com alta qualidade em todos os cenários.';
  if (score >= 70) return `Bom resultado. ${failed.length > 0 ? `A IA não cobriu adequadamente: ${failed.map(f => f.split(':')[0]).join(', ')}. Considere ser mais específico no prompt.` : 'O prompt está funcional mas pode ser mais detalhado.'}`;
  if (score >= 50) return `O prompt precisa de ajustes. ${failed.length > 0 ? `Cenários com falha: ${failed.map(f => f.split(':')[0]).join(', ')}.` : ''} Tente incluir exemplos de respostas esperadas no conteúdo do prompt.`;
  return 'O prompt não está eficaz. Reescreva com instruções mais claras, inclua exemplos concretos e seja específico sobre o que a IA deve e não deve dizer.';
}