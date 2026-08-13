import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withApiGuard } from '@/lib/security/api-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET/POST /api/ddc/personality
 *
 * Gerencia a personalidade da IA de cada pousada.
 * O dono escolhe o tom de voz: formal, descontraída, divertida, profissional.
 *
 * GET ?tenantId=xxx → retorna personalidade atual
 * POST { tenantId, tone, expressions, greeting } → salva personalidade
 */

const TONE_OPTIONS = ['formal', 'descontraida', 'divertida', 'profissional'] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');

  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'MISSING_TENANT_ID' }, { status: 400 });
  }

  try {
    // Busca personalidade salva no Property.metadata
    if (db) {
      const property = await (db as any).property.findFirst({
        where: { tenantId },
        select: { id: true, name: true, metadata: true },
      });

      if (property) {
        const meta = JSON.parse(property.metadata || '{}');
        return NextResponse.json({
          success: true,
          data: {
            tone: meta.aiTone || 'descontraida',
            expressions: meta.aiExpressions || [],
            greeting: meta.aiGreeting || '',
            assistantName: meta.aiAssistantName || 'Zélla',
            propertyId: property.id,
          },
        });
      }
    }

    // Fallback com defaults
    return NextResponse.json({
      success: true,
      data: {
        tone: 'descontraida',
        expressions: [],
        greeting: '',
        assistantName: 'Zélla',
        propertyId: null,
      },
      meta: { source: 'default' },
    });
  } catch (error) {
    console.error('[Personality GET] Error:', error);
    return NextResponse.json({
      success: true,
      data: { tone: 'descontraida', expressions: [], greeting: '', assistantName: 'Zélla', propertyId: null },
      meta: { source: 'fallback' },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, tone, expressions, greeting, assistantName } = body;

    if (!tenantId || !tone) {
      return NextResponse.json({ success: false, error: 'MISSING_FIELDS' }, { status: 400 });
    }

    if (!TONE_OPTIONS.includes(tone)) {
      return NextResponse.json({ success: false, error: 'INVALID_TONE', message: `Tom deve ser: ${TONE_OPTIONS.join(', ')}` }, { status: 400 });
    }

    // Salva no Property.metadata
    if (db) {
      const property = await (db as any).property.findFirst({
        where: { tenantId },
        select: { id: true, metadata: true },
      });

      if (property) {
        const meta = JSON.parse(property.metadata || '{}');
        meta.aiTone = tone;
        meta.aiExpressions = expressions || [];
        meta.aiGreeting = greeting || '';
        meta.aiAssistantName = assistantName || 'Zélla';
        meta.personalityUpdatedAt = new Date().toISOString();

        await (db as any).property.update({
          where: { id: property.id },
          data: { metadata: JSON.stringify(meta) },
        });

        return NextResponse.json({
          success: true,
          data: { tone, expressions, greeting, assistantName, updatedAt: meta.personalityUpdatedAt },
          message: 'Personalidade da IA atualizada!',
        });
      }
    }

    // Fallback se não tem DB
    return NextResponse.json({
      success: true,
      data: { tone, expressions, greeting, assistantName },
      meta: { source: 'fallback' },
      message: 'Personalidade salva (modo demo)',
    });
  } catch (error) {
    console.error('[Personality POST] Error:', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
