import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { SemanticaClient } from '@/lib/semantica/client';

/**
 * POST /api/zcc/semantica/ingest
 *
 * Ingesta regulamento/FAQ/texto no grafo do tenant.
 * Body: { tenantId, text?, url?, sourceType, force? }
 *
 * Pipeline: parse → extract → conflict detection → build graph
 * Conexões: SemanticaClient.ingest() → Python sidecar
 */
export async function POST(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const body = await request.json();
    const { tenantId, text, url, sourceType, force } = body;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'MISSING_TENANT_ID', message: 'tenantId é obrigatório' },
        { status: 400 }
      );
    }

    if (!text && !url) {
      return NextResponse.json(
        { success: false, error: 'MISSING_CONTENT', message: 'text ou url é obrigatório' },
        { status: 400 }
      );
    }

    if (!SemanticaClient.isEnabled() || !SemanticaClient.isConfigured()) {
      return NextResponse.json({
        success: true,
        data: {
          tenantId,
          nodesCreated: 0,
          edgesCreated: 0,
          conflictsDetected: 0,
          durationMs: 0,
          nodeIds: [],
          edgeIds: [],
          conflictIds: [],
        },
        meta: {
          source: 'demo',
          message: 'USE_SEMANTICA_GRAPH=false ou SEMANTICA_API_KEY não configurada',
        },
      });
    }

    const result = await SemanticaClient.ingest({
      tenantId,
      text,
      url,
      sourceType: sourceType || 'manual',
      force: force || false,
    });

    return NextResponse.json({
      success: true,
      data: result,
      meta: { source: 'semantica', tenantId },
    });
  } catch (error) {
    console.error('[ZCC Semantica Ingest] Error:', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Erro ao ingestar conteúdo' },
      { status: 500 }
    );
  }
}
