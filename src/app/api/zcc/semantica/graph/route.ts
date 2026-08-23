import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { SemanticaClient } from '@/lib/semantica/client';

/**
 * GET /api/zcc/semantica/graph?tenantId=xxx
 *
 * Retorna todos os nós e arestas do grafo do tenant para visualização.
 * Usado pelo painel Semântica no ZCC para renderizar o grafo visual.
 *
 * Conexões:
 *   - SemanticaClient.listNodes() + listEdges()
 *   - Sidecar Python: GET /graph/nodes + /graph/edges
 *
 * Em modo mock (sem sidecar ativo): retorna dados demo.
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
        data: buildMockGraphData(),
        meta: {
          source: 'demo',
          message: 'USE_SEMANTICA_GRAPH=false ou SEMANTICA_API_KEY não configurada',
        },
      });
    }

    const [nodes, edges] = await Promise.all([
      SemanticaClient.listNodes(tenantId, undefined, 200),
      SemanticaClient.listEdges(tenantId, 200),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        nodes: nodes.map((n) => ({
          id: n.id,
          label: n.name,
          type: n.type,
          content: n.content,
          confidence: n.confidence,
          forgotten: n.forgotten,
          createdAt: n.createdAt,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.sourceNodeId,
          target: e.targetNodeId,
          relation: e.relationType,
          weight: e.priorityWeight,
          condition: e.condition,
        })),
      },
      meta: { source: 'semantica', tenantId },
    });
  } catch (error) {
    console.error('[ZCC Semantica Graph] Error:', error);
    return NextResponse.json({
      success: true,
      data: buildMockGraphData(),
      meta: { source: 'fallback', error: 'Semantica unavailable' },
    });
  }
}

function buildMockGraphData() {
  return {
    nodes: [
      { id: 'n_checkin_padrao', label: 'Check-in Padrão', type: 'CHECKIN', content: 'Horário oficial de check-in é a partir das 14h00.', confidence: 0.9, forgotten: false, createdAt: new Date().toISOString() },
      { id: 'n_checkin_antecipado', label: 'Check-in Antecipado', type: 'CHECKIN', content: 'Check-in antecipado disponível a partir das 11h00, mediante disponibilidade.', confidence: 0.9, forgotten: false, createdAt: new Date().toISOString() },
      { id: 'n_checkout', label: 'Check-out Padrão', type: 'CHECKOUT', content: 'Horário de check-out até às 12h00.', confidence: 0.9, forgotten: false, createdAt: new Date().toISOString() },
      { id: 'n_pets', label: 'Política de Pets', type: 'POLICY', content: 'Permitido pets de pequeno porte mediante taxa de R$ 50.', confidence: 0.9, forgotten: false, createdAt: new Date().toISOString() },
      { id: 'n_cafe_manha', label: 'Café da Manhã', type: 'SERVICE', content: 'Café da manhã servido das 7h às 10h.', confidence: 0.9, forgotten: false, createdAt: new Date().toISOString() },
      { id: 'n_piscina', label: 'Piscina Aquecida', type: 'AMENITY', content: 'Piscina aquecida disponível das 8h às 22h.', confidence: 0.9, forgotten: false, createdAt: new Date().toISOString() },
      { id: 'n_pix_desconto', label: 'PIX com Desconto', type: 'PAYMENT', content: 'Pagamento via PIX tem 5% de desconto.', confidence: 0.9, forgotten: false, createdAt: new Date().toISOString() },
      { id: 'n_cancelamento', label: 'Cancelamento', type: 'CANCEL', content: 'Cancelamento gratuito até 48h antes.', confidence: 0.9, forgotten: false, createdAt: new Date().toISOString() },
      { id: 'n_estacionamento', label: 'Estacionamento', type: 'AMENITY', content: 'Estacionamento gratuito.', confidence: 0.9, forgotten: false, createdAt: new Date().toISOString() },
      { id: 'n_wifi', label: 'Wi-Fi', type: 'AMENITY', content: 'Wi-Fi gratuito em todas as áreas.', confidence: 0.9, forgotten: false, createdAt: new Date().toISOString() },
    ],
    edges: [
      { id: 'e1', source: 'n_checkin_antecipado', target: 'n_checkin_padrao', relation: 'SUPERSEDES', weight: 10, condition: 'Quando solicitado check-in antecipado' },
      { id: 'e2', source: 'n_checkin_antecipado', target: 'n_pets', relation: 'REQUIRES', weight: 8, condition: 'Check-in antecipado requer confirmação' },
      { id: 'e3', source: 'n_pets', target: 'n_checkin_padrao', relation: 'OVERLAPS', weight: 3 },
      { id: 'e4', source: 'n_cafe_manha', target: 'n_checkin_padrao', relation: 'REQUIRES', weight: 5 },
      { id: 'e5', source: 'n_pix_desconto', target: 'n_cancelamento', relation: 'OVERLAPS', weight: 2 },
      { id: 'e6', source: 'n_piscina', target: 'n_wifi', relation: 'OVERLAPS', weight: 1 },
    ],
  };
}
