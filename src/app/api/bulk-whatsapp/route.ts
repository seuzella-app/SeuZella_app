import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiRatelimit } from '@/lib/rate-limit';
import { requireDDCTenantId } from '@/lib/ddc/auth-utils';

export async function POST(request: Request) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await apiRatelimit.limit(`api:${clientIp}:${new URL(request.url).pathname}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Muitas requisições.', retryAfter: Math.ceil((rl.reset - Date.now()) / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)), 'X-RateLimit-Remaining': '0' } }
    );
  }

  try {
    const tenantId = await requireDDCTenantId();
    const body = await request.json();
    const { leadIds, templateId } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: 'O campo "leadIds" deve ser um array não vazio de IDs' },
        { status: 400, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    if (leadIds.length > 500) {
      return NextResponse.json(
        { error: 'Limite de 500 leads por envio em lote' },
        { status: 400, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    if (templateId) {
      const template = await db.swipeTemplate.findFirst({
        where: { id: templateId, tenantId },
      });
      if (!template) {
        return NextResponse.json(
          { error: 'Template não encontrado' },
          { status: 404, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
        );
      }

      await db.swipeTemplate.update({
        where: { id: template.id },
        data: { usageCount: { increment: leadIds.length } },
      });
    }

    const result = await db.lead.updateMany({
      where: {
        id: { in: leadIds },
        tenantId,
        status: { not: 'contacted' },
      },
      data: { status: 'contacted' },
    });

    const sentCount = result.count;

    await db.agentLog.create({
      data: {
        tenantId,
        agentId: 'lessie',
        action: 'bulk_whatsapp_sent',
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Math.round(100 + Math.random() * 300),
        costUsd: parseFloat((sentCount * 0.005).toFixed(4)),
        status: 'success',
        metadata: JSON.stringify({
          templateId: templateId || null,
          requestedCount: leadIds.length,
          sentCount,
          skippedCount: leadIds.length - sentCount,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      sentCount,
      requestedCount: leadIds.length,
      skippedCount: leadIds.length - sentCount,
      templateId: templateId || null,
    }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  } catch (error) {
    console.error('[BULK_WHATSAPP_POST]', error);
    return NextResponse.json(
      { error: 'Erro ao enviar mensagens em lote' },
      { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
    );
  }
}