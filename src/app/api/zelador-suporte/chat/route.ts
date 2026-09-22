import { NextRequest, NextResponse } from 'next/server';
import { ZeladorSuporteBrain, ZeladorChatMessage } from '@/lib/cerebro/zelador-suporte-brain';
import { PlanTier } from '@/lib/plan-features';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

/**
 * POST `/api/zelador-suporte/chat`
 * Processa mensagens do cliente no Chat do Zelador Zélla no Dashboard (PRO e MAX).
 */
export async function POST(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'zelador-suporte.chat', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zelador-suporte.chat', what: 'zelador-suporte.chat.entry', resource: 'api', result: 'ALLOW' });
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
