// ==============================================================================
// ZÉLLA — Internal Endpoint: Flush Message Buffer (QStash Callback)
// ==============================================================================
// Endpoint chamado pelo QStash após o delay de 3s do message-bundler.
// Lê todas as mensagens pendentes no Redis para (tenantId, guestPhone),
// concatena em um único payload e chama o processIncomingMessage da IA.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { handleFlushBufferRequest, type FlushBufferRequest } from '@/lib/message-bundler';
import { processIncomingMessage } from '@/lib/whatsapp-ai-responder';

/**
 * POST /api/internal/flush-buffer
 *
 * Body esperado: { tenantId: string, guestPhone: string }
 *
 * Auth: este endpoint só deve ser acessível via QStash. Em produção,
 * validar o header `Upstash-Signature` para garantir que é o QStash chamando.
 * Para simplicidade nesta iteração, validamos apenas a origem via env var
 * INTERNAL_ENDPOINT_TOKEN (header X-Internal-Token).
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth básica: token interno ──
    // Em produção, prefira validar a assinatura QStash (HMAC).
    const expectedToken = process.env.INTERNAL_ENDPOINT_TOKEN;
    if (expectedToken) {
      const receivedToken = request.headers.get('x-internal-token');
      if (receivedToken !== expectedToken) {
        console.warn('[flush-buffer] Token interno inválido — rejeitando');
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    const body = (await request.json()) as FlushBufferRequest;

    if (!body?.tenantId || !body?.guestPhone) {
      return NextResponse.json(
        { error: 'MISSING_FIELDS', message: 'tenantId e guestPhone são obrigatórios' },
        { status: 400 }
      );
    }

    const result = await handleFlushBufferRequest(body, processIncomingMessage);

    if (!result.success) {
      console.error('[flush-buffer] Falha:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageCount: result.messageCount,
    });
  } catch (error) {
    console.error('[flush-buffer] Erro inesperado:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET — health check para monitoramento.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'flush-buffer',
    timestamp: new Date().toISOString(),
  });
}
