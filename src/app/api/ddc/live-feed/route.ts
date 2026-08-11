import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId, mapConversation } from '@/lib/ddc/ddc-mapper';
import { createError, apiSuccess } from '@/lib/error-handler';
import { apiRatelimit } from '@/lib/rate-limit';
import { z } from 'zod';

const messageSchema = z.object({
  conversationId: z.string(),
  content: z.string().min(1),
  from: z.enum(['guest', 'ai', 'human']),
});

export async function POST(request: NextRequest) {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return createError(503, 'DB_UNAVAILABLE', 'Banco de dados indisponível no momento');
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) return createError(401, 'UNAUTHORIZED', 'Não autorizado');
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return createError(429, 'RATE_LIMITED', 'Muitas requisições');
    const body = await request.json();
    const data = messageSchema.parse(body);

    const message = await db.conversationMessage.create({
      data: {
        conversationId: data.conversationId,
        content: data.content,
        from: data.from,
        timestamp: new Date(),
      },
    });

    await db.conversationLog.update({
      where: { id: data.conversationId },
      data: { lastUpdate: new Date() },
    });

    return apiSuccess({ message });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createError(400, 'VALIDATION_ERROR', 'Invalid data');
    }
    console.error('[live-feed POST] Error:', error);
    return createError(500, 'CREATE_FAILED', 'Failed to create message');
  }
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  // Check DB availability first
  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    const demoData = [
      {
        id: 'demo-conv-1', guestId: 'demo-g-1', guestName: 'Carlos Mendes',
        phoneNumber: '5541988776655', status: 'in_progress' as const, aiScore: 96,
        needsEscalation: false, metadata: {},
        messages: [
          { id: 'dm1', conversationId: 'demo-conv-1', role: 'user' as const, content: 'Olá, tem quarto disponível?', confidence: undefined, metadata: {}, createdAt: new Date().toISOString() },
          { id: 'dm2', conversationId: 'demo-conv-1', role: 'assistant' as const, content: 'Sim! Temos a Suíte Vista Mar disponível. Deseja reservar?', confidence: undefined, metadata: {}, createdAt: new Date().toISOString() },
        ],
        propertyId: 'demo', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
    ];
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'initial', data: demoData })}\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'https://seuzella.com.br' },
    });
  }

  const tenantId = await resolveTenantId();
  if (!tenantId) {
    return createError(401, 'UNAUTHORIZED', 'Não autorizado');
  }

  const stream = new ReadableStream({
    async start(controller) {
      let lastCheck = new Date();

      // Listener for real-time push events
      const listener = (incomingTenantId: string, sseData: string) => {
        if (incomingTenantId === tenantId) {
          try {
            controller.enqueue(encoder.encode(sseData));
          } catch {
            // Controller might be closed
          }
        }
      };

      // Register listener globally
      (globalThis as any).sseListeners = (globalThis as any).sseListeners || new Set();
      (globalThis as any).sseListeners.add(listener);

      // Initial load
      try {
        const conversations = await db.conversationLog.findMany({
          where: { tenantId, status: 'active' },
          include: { messages: { orderBy: { timestamp: 'asc' } } },
          orderBy: { lastUpdate: 'desc' },
        });
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'initial', data: conversations.map(mapConversation) })}\n\n`));
      } catch (error) {
        console.error('[live-feed] Initial load error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'initial', data: [] })}\n\n`));
      }

      // Polling loop (fallback/redundancy)
      const interval = setInterval(async () => {
        try {
          const newMessages = await db.conversationMessage.findMany({
            where: { createdAt: { gt: lastCheck } },
            include: { conversation: true },
            orderBy: { createdAt: 'desc' },
          });

          if (newMessages.length > 0) {
            const convIds = [...new Set(newMessages.map(m => m.conversationId))];
            const updatedConvs = await db.conversationLog.findMany({
              where: { id: { in: convIds } },
              include: { messages: { orderBy: { timestamp: 'asc' } } },
            });

            for (const conv of updatedConvs) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'update', data: mapConversation(conv) })}\n\n`));
            }
          }
          lastCheck = new Date();
        } catch (error) {
          // Silently continue polling
        }
      }, 5000);

      const cleanup = () => {
        clearInterval(interval);
        if ((globalThis as any).sseListeners) {
          (globalThis as any).sseListeners.delete(listener);
        }
        try {
          controller.close();
        } catch {
          // Ignore if already closed
        }
      };

      // Cleanup on disconnect
      request.signal.addEventListener('abort', cleanup);

      // Auto-close after 10 minutes to prevent resource leak
      setTimeout(cleanup, 10 * 60 * 1000);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'https://seuzella.com.br',
    }
  });
}
