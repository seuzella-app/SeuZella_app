import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { SemanticaClient } from '@/lib/semantica/client';

/**
 * GET /api/zcc/semantica/decisions?tenantId=xxx&limit=50
 *
 * Lista decisões registradas (audit trail) para o painel Semântica.
 *
 * Conexões:
 *   - SemanticaClient.listDecisions()
 *   - Sidecar Python: GET /decisions
 *
 * Em modo mock: retorna decisões demo.
 */
export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'demo-tenant-001';
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    if (!SemanticaClient.isEnabled() || !SemanticaClient.isConfigured()) {
      return NextResponse.json({
        success: true,
        data: buildMockDecisions(),
        meta: { source: 'demo', tenantId },
      });
    }

    const decisions = await SemanticaClient.listDecisions(tenantId, limit, offset);

    return NextResponse.json({
      success: true,
      data: decisions,
      meta: { source: 'semantica', tenantId, count: decisions.length },
    });
  } catch (error) {
    console.error('[ZCC Semantica Decisions] Error:', error);
    return NextResponse.json({
      success: true,
      data: buildMockDecisions(),
      meta: { source: 'fallback', tenantId },
    });
  }
}

function buildMockDecisions() {
  const now = Date.now();
  return [
    {
      id: 'd_demo_1',
      tenantId: 'demo-tenant-001',
      category: 'guest_response',
      scenario: 'Hóspede perguntou sobre check-in antecipado às 11h',
      reasoning: 'Regra check-in antecipado (SUPERSEDES check-in padrão) aplicada. Nó n_checkin_antecipado justificou a resposta.',
      outcome: 'success',
      response: 'Olá! Sim, oferecemos check-in antecipado a partir das 11h00, sujeito à disponibilidade. Posso confirmar a disponibilidade para sua data?',
      confidence: 0.92,
      metadata: {
        providerId: 'glm-4.7-flash',
        tier: 1,
        latencyMs: 1240,
        sessionId: 's_001',
        intent: 'duvida_geral',
        fallbackUsed: false,
      },
      graphNodeIds: ['n_checkin_antecipado', 'n_checkin_padrao'],
      createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
    },
    {
      id: 'd_demo_2',
      tenantId: 'demo-tenant-001',
      category: 'guest_response',
      scenario: 'Hóspede perguntou se aceita pets',
      reasoning: 'Política de pets aplicada. Taxa de higienização R$ 50 mencionada.',
      outcome: 'success',
      response: 'Sim, aceitamos pets de pequeno porte! Há uma taxa de higienização de R$ 50. Posso incluir na sua reserva?',
      confidence: 0.88,
      metadata: {
        providerId: 'glm-4.7-flash',
        tier: 1,
        latencyMs: 980,
        sessionId: 's_002',
        intent: 'duvida_geral',
        fallbackUsed: false,
      },
      graphNodeIds: ['n_pets'],
      createdAt: new Date(now - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 'd_demo_3',
      tenantId: 'demo-tenant-001',
      category: 'tool_calling',
      scenario: 'Hóspede solicitou cotação para 3 diárias em quarto duplo',
      reasoning: 'Tool calling executou consulta de disponibilidade e cálculo de preço.',
      outcome: 'success',
      response: 'Encontrei 2 quartos disponíveis para suas datas. O valor total seria R$ 1.194 (R$ 398/diária). Deseja confirmar a reserva?',
      confidence: 0.95,
      metadata: {
        providerId: 'glm-4.7-flash',
        tier: 2,
        latencyMs: 2340,
        sessionId: 's_003',
        intent: 'cotacao_reserva',
        fallbackUsed: false,
      },
      createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'd_demo_4',
      tenantId: 'demo-tenant-001',
      category: 'human_handover',
      scenario: 'Hóspede pediu reclamação formal sobre limpeza',
      reasoning: 'Intent classificado como human_handover — escalado para atendente humano.',
      outcome: 'escalated',
      response: 'Entendi. Vou chamar um atendente humano para te ajudar com isso agora mesmo. Por favor, aguarde um momento!',
      confidence: 0.91,
      metadata: {
        providerId: 'glm-4.7-flash',
        tier: 2,
        latencyMs: 540,
        sessionId: 's_004',
        intent: 'human_handover',
        fallbackUsed: false,
      },
      createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'd_demo_5',
      tenantId: 'demo-tenant-001',
      category: 'message_blocked',
      scenario: 'Hóspede enviou mensagem com conteúdo suspeito (tentativa de prompt injection)',
      reasoning: 'Guardrails bloquearam a mensagem — conteúdo potencialmente malicioso.',
      outcome: 'blocked',
      response: 'Desculpe, não entendi muito bem. Poderia reformular a sua mensagem?',
      confidence: 0.99,
      metadata: {
        providerId: 'n/a',
        tier: 0,
        latencyMs: 12,
        sessionId: 's_005',
        intent: 'UNKNOWN',
        fallbackUsed: false,
      },
      createdAt: new Date(now - 120 * 60 * 1000).toISOString(),
    },
  ];
}
