import { NextRequest, NextResponse } from 'next/server';
import { getDSPyCompiledSignature, executeDSPyAtendimento } from '@/lib/ai/dspy/dspy-evaluator';
import { AtendimentoHospedeSignature, ValidadorPIXSignature } from '@/lib/ai/dspy/dspy-signatures';

export async function GET() {
  const atendimentoCompiled = getDSPyCompiledSignature('AtendimentoHospede');
  const validadorCompiled = getDSPyCompiledSignature('ValidadorPIX');

  return NextResponse.json({
    success: true,
    data: {
      status: 'ACTIVE',
      engine: 'Stanford DSPy v2.5 (Declarative Self-Improving Framework)',
      compilerVersion: atendimentoCompiled.version,
      metrics: atendimentoCompiled.metrics,
      signatures: {
        AtendimentoHospede: {
          definition: AtendimentoHospedeSignature,
          instruction: atendimentoCompiled.instruction,
          fewShotDemosCount: atendimentoCompiled.fewShotDemos.length,
        },
        ValidadorPIX: {
          definition: ValidadorPIXSignature,
          instruction: validadorCompiled.instruction,
          fewShotDemosCount: validadorCompiled.fewShotDemos.length,
        },
      },
      guardrails: [
        { code: 'WHATSAPP_LENGTH_EXCEEDED', type: 'suggest', description: 'Garante mensagens < 1000 caracteres para evitar banimento' },
        { code: 'ZERO_PIX_AMOUNT_ON_BOOKING', type: 'suggest', description: 'Exige valor numérico PIX positivo em intenção de reserva' },
        { code: 'FORBIDDEN_SPAM_TERM', type: 'assert', description: 'Bloqueia termos apelativos de spam em tempo real' },
        { code: 'PIX_UNDERPAID', type: 'assert', description: 'Impede confirmação de PIX com valor < 90% do total da reserva' },
      ],
      timestamp: new Date().toISOString(),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { perguntaHospede, dadosPropriedade, niche } = body;

    if (!perguntaHospede) {
      return NextResponse.json(
        { success: false, error: 'MISSING_PERGUNTA', message: 'Campo perguntaHospede é obrigatório.' },
        { status: 400 }
      );
    }

    const executionResult = executeDSPyAtendimento({
      perguntaHospede,
      dadosPropriedade: dadosPropriedade || 'Pousada Zélla — R$ 420/noite, Pet Friendly',
      niche: niche || 'pousada',
    });

    return NextResponse.json({
      success: true,
      data: executionResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'DSPY_EXECUTION_ERROR', message: error.message },
      { status: 500 }
    );
  }
}
