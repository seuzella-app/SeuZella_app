import { checkRateLimit, rateLimitResponse } from '../../../../lib/cerebro/rate-limit';
import { NextResponse } from 'next/server';
import { ZellaSalesBrain, ZellaSalesChatMessage } from '@/lib/cerebro/zella-sales-brain';

export async function POST(req: Request) {
  // [RUN10-W2 10B] rate-limit fail-closed (in-memory; Redis opcional no RUN11)
  {
    const __rl = checkRateLimit(req, 'api/landing/chat#POST');
    if (!__rl.ok) return rateLimitResponse(__rl);
  }

  try {
    const body = await req.json();
    const { message, history } = body as { message?: string; history?: ZellaSalesChatMessage[] };

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Mensagem inválida ou vazia.' },
        { status: 400 }
      );
    }

    const res = await ZellaSalesBrain.processMessage(message.trim(), history || []);
    return NextResponse.json(res);
  } catch (error) {
    console.error('[API Landing Chat Error]:', error);
    return NextResponse.json(
      {
        success: true,
        reply: 'Olá, meu amigo anfitrião! Sou o Seu Zélla! Tive um pequeno sobressalto de rede aqui, mas tô a postos! Como posso te ajudar com sua pousada ou imóveis hoje?',
      },
      { status: 200 }
    );
  }
}
