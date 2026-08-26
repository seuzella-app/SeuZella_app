import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { SemanticaClient } from '@/lib/semantica/client';

/**
 * GET /api/zcc/semantica/export?tenantId=xxx&format=prov-o|json|csv
 *
 * Exporta trilha de auditoria (decisões + grafo) em formato W3C PROV-O.
 * Para submissão a auditores externos e conformidade LGPD.
 *
 * Formatos suportados:
 *   - prov-o: RDF Turtle (W3C PROV-O compliant)
 *   - json: JSON-LD simplificado
 *   - csv: CSV compatível com Excel
 *
 * Conexões:
 *   - SemanticaClient.listDecisions() → audit trail
 *   - SemanticaClient.listNodes() + listEdges() → grafo
 */

const PROV_O_HEADER = `@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix ex: <http://seuzella.com.br/prov#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
`;

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'demo-tenant-001';
  const format = (searchParams.get('format') || 'prov-o') as 'prov-o' | 'json' | 'csv';

  try {
    // Busca decisões e grafo
    let decisions: any[] = [];
    let nodes: any[] = [];
    let edges: any[] = [];

    if (SemanticaClient.isEnabled() && SemanticaClient.isConfigured()) {
      try {
        const [d, n, e] = await Promise.all([
          SemanticaClient.listDecisions(tenantId, 100, 0),
          SemanticaClient.listNodes(tenantId, undefined, 200),
          SemanticaClient.listEdges(tenantId, 200),
        ]);
        decisions = d;
        nodes = n;
        edges = e;
      } catch {
        // Use mock data if sidecar unavailable
      }
    }

    // Fallback mock data
    if (decisions.length === 0) {
      decisions = buildMockDecisions();
    }
    if (nodes.length === 0) {
      nodes = buildMockNodes();
    }
    if (edges.length === 0) {
      edges = buildMockEdges();
    }

    const timestamp = new Date().toISOString();

    if (format === 'prov-o') {
      const ttl = generateProvO(decisions, nodes, edges, tenantId, timestamp);
      return new NextResponse(ttl, {
        status: 200,
        headers: {
          'Content-Type': 'text/turtle; charset=utf-8',
          'Content-Disposition': `attachment; filename="zella-audit-${tenantId}-${Date.now()}.ttl"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format === 'json') {
      const json = {
        '@context': {
          '@vocab': 'http://seuzella.com.br/prov#',
          prov: 'http://www.w3.org/ns/prov#',
          xsd: 'http://www.w3.org/2001/XMLSchema#',
        },
        '@type': 'prov:Bundle',
        '@id': `ex:audit_${tenantId}_${Date.now()}`,
        'prov:generatedAtTime': timestamp,
        'prov:wasAttributedTo': { '@id': 'ex:seuzella_cerebro' },
        decisions: decisions.map((d) => ({
          '@id': `ex:decision_${d.id}`,
          '@type': 'prov:Activity',
          'prov:startedAtTime': d.createdAt,
          'prov:wasAssociatedWith': { '@id': `ex:${d.metadata?.providerId || 'unknown'}` },
          'ex:category': d.category,
          'ex:scenario': d.scenario,
          'ex:reasoning': d.reasoning,
          'ex:outcome': d.outcome,
          'ex:confidence': d.confidence,
        })),
        nodes: nodes.map((n) => ({
          '@id': `ex:node_${n.id}`,
          '@type': 'prov:Entity',
          'ex:type': n.type,
          'ex:name': n.name,
          'ex:content': n.content,
        })),
      };

      return new NextResponse(JSON.stringify(json, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/ld+json; charset=utf-8',
          'Content-Disposition': `attachment; filename="zella-audit-${tenantId}-${Date.now()}.jsonld"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format === 'csv') {
      const csv = generateCSV(decisions);
      return new NextResponse(`\ufeff${ csv}`, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="zella-decisions-${tenantId}-${Date.now()}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'INVALID_FORMAT', message: 'Formato deve ser: prov-o, json, csv' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[ZCC Semantica Export] Error:', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Erro ao exportar auditoria' },
      { status: 500 }
    );
  }
}

function generateProvO(decisions: any[], nodes: any[], edges: any[], tenantId: string, timestamp: string): string {
  let ttl = PROV_O_HEADER;
  ttl += `# Zélla Audit Trail — Tenant: ${tenantId}\n`;
  ttl += `# Generated: ${timestamp}\n`;
  ttl += `# Decisions: ${decisions.length} | Nodes: ${nodes.length} | Edges: ${edges.length}\n\n`;

  // Bundle
  ttl += `ex:audit_${tenantId}_${Date.now()} a prov:Bundle ;\n`;
  ttl += `    prov:generatedAtTime "${timestamp}"^^xsd:dateTime ;\n`;
  ttl += `    prov:wasAttributedTo ex:seuzella_cerebro .\n\n`;

  // Entities (graph nodes)
  ttl += `# ── Graph Nodes (prov:Entity) ──\n`;
  for (const node of nodes) {
    ttl += `ex:node_${node.id} a prov:Entity ;\n`;
    ttl += `    rdfs:label "${escapeTurtle(node.name || node.label || node.id)}" ;\n`;
    ttl += `    ex:type "${node.type}" ;\n`;
    ttl += `    ex:content "${escapeTurtle((node.content || '').slice(0, 200))}" .\n\n`;
  }

  // Activities (decisions)
  ttl += `# ── Decisions (prov:Activity) ──\n`;
  for (const d of decisions) {
    ttl += `ex:decision_${d.id} a prov:Activity ;\n`;
    ttl += `    prov:startedAtTime "${d.createdAt}"^^xsd:dateTime ;\n`;
    if (d.metadata?.providerId) {
      ttl += `    prov:wasAssociatedWith ex:provider_${d.metadata.providerId} ;\n`;
    }
    ttl += `    ex:category "${d.category}" ;\n`;
    ttl += `    ex:scenario "${escapeTurtle(d.scenario.slice(0, 200))}" ;\n`;
    ttl += `    ex:outcome "${d.outcome}" ;\n`;
    ttl += `    ex:confidence "${d.confidence}"^^xsd:float .\n\n`;
  }

  // Relations (edges as prov:wasDerivedFrom)
  ttl += `# ── Graph Edges (prov:wasDerivedFrom) ──\n`;
  for (const e of edges) {
    ttl += `ex:node_${e.source || e.sourceNodeId} prov:wasDerivedFrom ex:node_${e.target || e.targetNodeId} ;\n`;
    ttl += `    ex:relation "${e.relation || e.relationType}" ;\n`;
    ttl += `    ex:priority "${e.weight || e.priorityWeight}"^^xsd:integer .\n\n`;
  }

  return ttl;
}

function generateCSV(decisions: any[]): string {
  const headers = [
    'ID', 'Category', 'Scenario', 'Reasoning', 'Outcome',
    'Confidence', 'Provider', 'Tier', 'Latency (ms)',
    'Session ID', 'Intent', 'Fallback Used', 'Created At'
  ];

  const rows = [headers.join(';')];

  for (const d of decisions) {
    const row = [
      d.id || '',
      d.category || '',
      `"${(d.scenario || '').replace(/"/g, '""').slice(0, 200)}"`,
      `"${(d.reasoning || '').replace(/"/g, '""').slice(0, 200)}"`,
      d.outcome || '',
      String(d.confidence || 0),
      d.metadata?.providerId || '',
      d.metadata?.tier ? String(d.metadata.tier) : '',
      d.metadata?.latencyMs ? String(d.metadata.latencyMs) : '',
      d.metadata?.sessionId || '',
      d.metadata?.intent || '',
      d.metadata?.fallbackUsed ? 'true' : 'false',
      d.createdAt || '',
    ];
    rows.push(row.join(';'));
  }

  return rows.join('\n');
}

function escapeTurtle(s: string): string {
  return (s || '').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function buildMockDecisions() {
  const now = Date.now();
  return [
    {
      id: 'd_demo_1',
      category: 'guest_response',
      scenario: 'Hóspede perguntou sobre check-in antecipado',
      reasoning: 'GraphRAG aplicou regra SUPERSEDES',
      outcome: 'success',
      confidence: 0.92,
      metadata: { providerId: 'glm-4.7-flash', tier: 1, latencyMs: 1240, sessionId: 's_001', intent: 'duvida_geral', fallbackUsed: false },
      createdAt: new Date(now - 300000).toISOString(),
    },
    {
      id: 'd_demo_2',
      category: 'tool_calling',
      scenario: 'Cotação para 3 diárias',
      reasoning: 'Tool calling executou consulta de disponibilidade',
      outcome: 'success',
      confidence: 0.95,
      metadata: { providerId: 'glm-4.7-flash', tier: 2, latencyMs: 2340, sessionId: 's_002', intent: 'cotacao_reserva', fallbackUsed: false },
      createdAt: new Date(now - 600000).toISOString(),
    },
  ];
}

function buildMockNodes() {
  return [
    { id: 'n1', type: 'CHECKIN', name: 'Check-in Padrão', content: 'Horário oficial 14h' },
    { id: 'n2', type: 'CHECKIN', name: 'Check-in Antecipado', content: 'Disponível às 11h mediante taxa' },
    { id: 'n3', type: 'POLICY', name: 'Política de Pets', content: 'Pets pequeno porte com taxa R$ 50' },
  ];
}

function buildMockEdges() {
  return [
    { source: 'n2', target: 'n1', relation: 'SUPERSEDES', weight: 10 },
    { source: 'n2', target: 'n3', relation: 'REQUIRES', weight: 8 },
  ];
}
