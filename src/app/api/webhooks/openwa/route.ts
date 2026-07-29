import { NextRequest, NextResponse } from 'next/server';
import { processIncomingMessage } from '@/lib/whatsapp-ai-responder';
import { bufferMessage } from '@/lib/message-bundler';
import { resolveTenantByPhone } from '@/lib/resolve-tenant-by-phone';

/**
 * OpenWA Webhook Receiver Endpoint (`/api/webhooks/openwa`).
 * Recebe e processa mensagens em tempo real enviadas pelo servidor HTTP OpenWA.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json({ status: 'ignored', reason: 'empty_body' }, { status: 400 });
    }

    const data = JSON.parse(rawBody);

    // Validação de Secret Token (se configurado)
    const secret = process.env.OPENWA_WEBHOOK_SECRET;
    if (secret) {
      const headerSecret = request.headers.get('x-openwa-secret') || request.nextUrl.searchParams.get('secret');
      if (headerSecret !== secret) {
        console.warn('[openwa-webhook] Secret inválido ou ausente.');
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    // Suporte a diferentes formatos de payload do OpenWA
    const payload = data.payload || data;
    const event = data.event || data.type || 'message';

    // Ignorar eventos que não sejam de mensagem de entrada
    if (event !== 'message' && event !== 'onMessage' && event !== 'message.create' && !payload.body) {
      return NextResponse.json({ status: 'ignored', reason: 'non_message_event' });
    }

    // Extrair dados do remetente
    const rawFrom = payload.from || payload.sender?.id || payload.chatId || '';
    const guestPhone = rawFrom.replace(/\D/g, '');
    const guestName = payload.sender?.name || payload.pushname || payload.notifyName || payload.name || 'Hóspede WhatsApp';
    const messageContent = payload.body || payload.text || payload.content || '';

    if (!guestPhone || !messageContent) {
      return NextResponse.json({ status: 'ignored', reason: 'missing_phone_or_content' });
    }

    // Identificar telefone do receptor/pousada (se fornecido no evento ou sessão)
    const recipientPhone = payload.to ? payload.to.replace(/\D/g, '') : '';
    const tenantResult = await resolveTenantByPhone(recipientPhone);
    const tenantId = tenantResult.tenantId || 'default-tenant';

    // Despachar mensagem para o Message Bundler do Zélla
    bufferMessage(
      {
        tenantId,
        guestPhone,
        guestName,
        messageContent,
        messageFrom: 'whatsapp-openwa',
      },
      processIncomingMessage
    ).catch((err) => {
      console.error('[openwa-webhook] Erro ao processar mensagem via bundler:', err);
    });

    return NextResponse.json({
      success: true,
      processed: true,
      provider: 'openwa',
      phone: guestPhone,
    });
  } catch (error) {
    console.error('[openwa-webhook-error] Erro inesperado ao processar webhook OpenWA:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    gateway: 'OpenWA HTTP Webhook Ingress',
    timestamp: new Date().toISOString(),
  });
}
