import { NextResponse } from 'next/server';
import { ZellaSalesBrain, ZellaSalesChatMessage } from '@/lib/cerebro/zella-sales-brain';

export async function POST(req: Request) {
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
