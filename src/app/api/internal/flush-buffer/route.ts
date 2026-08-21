// ==============================================================================
// ZÉLLA — Internal Endpoint: Flush Message Buffer (QStash Callback)
// ==============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { handleFlushBufferRequest, type FlushBufferRequest } from '@/lib/message-bundler';
import { processIncomingMessage } from '@/lib/whatsapp-ai-responder';

function unauthorized() {
  return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
}

export async function POST(request: NextRequest) {
  try {
    const expectedToken = process.env.INTERNAL_ENDPOINT_TOKEN;
    if (!expectedToken) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'INTERNAL_ENDPOINT_NOT_CONFIGURED' }, { status: 503 });
      }
      return unauthorized();
    }

    const receivedToken = request.headers.get('x-internal-token');
    if (!receivedToken || receivedToken.length !== expectedToken.length || receivedToken !== expectedToken) {
      return unauthorized();
    }

    const body = (await request.json()) as FlushBufferRequest;
    if (!body?.tenantId || !body?.guestPhone) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
    }

    const result = await handleFlushBufferRequest(body, processIncomingMessage);
    if (!result.success) {
      console.error('[flush-buffer] Falha:', result.error);
      return NextResponse.json({ success: false, error: 'FLUSH_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageCount: result.messageCount }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[flush-buffer] Erro inesperado:', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'flush-buffer' }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
