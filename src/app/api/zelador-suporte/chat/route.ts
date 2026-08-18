import { NextRequest, NextResponse } from 'next/server';
import { ZeladorSuporteBrain, ZeladorChatMessage } from '@/lib/cerebro/zelador-suporte-brain';
import { PlanTier } from '@/lib/plan-features';

/**
 * POST `/api/zelador-suporte/chat`
 * Processa mensagens do cliente no Chat do Zelador Zélla no Dashboard (PRO e MAX).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [], tier = 'pro', userName = 'Anfitrião' } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensagem inválida' }, { status: 400 });
    }

    const currentTier: PlanTier = (tier || 'pro').toLowerCase() as PlanTier;
    const response = await ZeladorSuporteBrain.processChat(
      message,
      history as ZeladorChatMessage[],
      currentTier,
      userName
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('[zelador-chat-api] Erro inesperado:', error);
    return NextResponse.json(
      {
        success: false,
        reply: 'Olá! Sou o Zélla. Ocorreu um pequeno ruído na conexão, mas estou aqui para te ajudar em qualquer dúvida. Como posso te auxiliar?',
        tier: 'pro',
      },
      { status: 500 }
    );
  }
}
