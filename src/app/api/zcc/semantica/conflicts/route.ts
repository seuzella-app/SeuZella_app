import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { SemanticaClient } from '@/lib/semantica/client';

/**
 * GET /api/zcc/semantica/conflicts?tenantId=xxx
 *
 * Lista conflitos detectados no grafo do tenant.
 * Conexões: SemanticaClient.listConflicts()
 */
export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'demo-tenant-001';

  try {
    if (!SemanticaClient.isEnabled() || !SemanticaClient.isConfigured()) {
      return NextResponse.json({
        success: true,
        data: buildMockConflicts(),
        meta: { source: 'demo', tenantId },
      });
    }

    const conflicts = await SemanticaClient.listConflicts(tenantId);

    return NextResponse.json({
      success: true,
      data: conflicts,
      meta: { source: 'semantica', tenantId, count: conflicts.length },
    });
  } catch (error) {
    console.error('[ZCC Semantica Conflicts] Error:', error);
    return NextResponse.json({
      success: true,
      data: buildMockConflicts(),
      meta: { source: 'fallback', tenantId },
    });
  }
}

function buildMockConflicts() {
  return [
    {
      id: 'c_demo_1',
      tenantId: 'demo-tenant-001',
      nodeIds: ['n_checkin_antecipado', 'n_checkin_padrao'],
      description: 'Possível conflito entre Check-in Antecipado e Check-in Padrão',
      severity: 'medium',
      status: 'detected',
      suggestedResolution: {
        type: 'SUPERSEDES',
        winnerNodeId: 'n_checkin_antecipado',
        loserNodeId: 'n_checkin_padrao',
        reasoning: 'Check-in Antecipado é mais específico e deve prevalecer quando solicitado',
      },
      detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'c_demo_2',
      tenantId: 'demo-tenant-001',
      nodeIds: ['n_pix_desconto', 'n_cancelamento'],
      description: 'Sobreposição entre desconto PIX e política de cancelamento',
      severity: 'low',
      status: 'acknowledged',
      detectedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
  ];
}
