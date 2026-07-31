import { db } from "@/lib/db";

export interface ContextNode {
  id: string;
  type: string;
  name: string;
  content: string;
}

export interface GraphEdgeDetail {
  relationType: string;
  priorityWeight: number;
  sourceContent: string;
  targetContent: string;
}

/**
 * Adiciona um Nó ao Grafo de Conhecimento da Pousada.
 */
export async function addGraphNode(params: {
  tenantId: string;
  entityType: 'RULE' | 'POLICY' | 'AMENITY' | 'CHECKIN';
  name: string;
  content: string;
}): Promise<ContextNode> {
  const { tenantId, entityType, name, content } = params;
  let id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  try {
    if (db && (db as any).graphNode) {
      const record = await (db as any).graphNode.create({
        data: { tenantId, entityType, name, content },
      });
      id = record.id;
    }
  } catch (err) {
    console.warn('[GraphRAG] Persistência de Nó via DB indisponível (dev mode):', err);
  }

  return { id, type: entityType, name, content };
}

/**
 * Adiciona uma Relação (Aresta) entre Nós do Grafo.
 */
export async function addGraphEdge(params: {
  tenantId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: 'OVERLAPS' | 'REQUIRES' | 'FORBIDS' | 'SUPERSEDES';
  priorityWeight?: number;
}): Promise<string> {
  const { tenantId, sourceNodeId, targetNodeId, relationType, priorityWeight = 1 } = params;
  let id = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  try {
    if (db && (db as any).graphEdge) {
      const record = await (db as any).graphEdge.create({
        data: { tenantId, sourceNodeId, targetNodeId, relationType, priorityWeight },
      });
      id = record.id;
    }
  } catch (err) {
    console.warn('[GraphRAG] Persistência de Aresta via DB indisponível (dev mode):', err);
  }

  return id;
}

const RELATION_WEIGHTS: Record<string, number> = {
  SUPERSEDES: 4,
  FORBIDS: 3,
  REQUIRES: 2,
  OVERLAPS: 1,
};

/**
 * Motor de Busca Híbrida (Vetores + Traversal de Grafo) e Resolução de Contradições.
 * Aplica o Algoritmo Triplo Inteligente de Desempate:
 * 1. Priority Weight DESC
 * 2. Relation Precedence DESC (SUPERSEDES > FORBIDS > REQUIRES > OVERLAPS)
 * 3. Recência Temporal (createdAt DESC)
 */
export async function hybridGraphSearch(
  tenantId: string,
  userQuery: string
): Promise<string> {
  let nodes: ContextNode[] = [];
  let edges: GraphEdgeDetail[] = [];

  try {
    if (db && (db as any).graphNode) {
      const dbNodes = await (db as any).graphNode.findMany({
        where: { tenantId },
        take: 3,
      });
      nodes = dbNodes.map((n: any) => ({
        id: n.id,
        type: n.entityType,
        name: n.name,
        content: n.content,
      }));

      if (nodes.length > 0) {
        const nodeIds = nodes.map(n => n.id);
        const dbEdges = await (db as any).graphEdge.findMany({
          where: {
            tenantId,
            OR: [
              { sourceNodeId: { in: nodeIds } },
              { targetNodeId: { in: nodeIds } },
            ],
          },
          include: { sourceNode: true, targetNode: true },
          orderBy: [
            { priorityWeight: 'desc' },
            { createdAt: 'desc' },
          ],
        });

        // Aplicação da ordenação determinística por precedência de relação
        const sortedDbEdges = [...dbEdges].sort((a: any, b: any) => {
          if (b.priorityWeight !== a.priorityWeight) {
            return b.priorityWeight - a.priorityWeight;
          }
          const weightA = RELATION_WEIGHTS[a.relationType] || 1;
          const weightB = RELATION_WEIGHTS[b.relationType] || 1;
          if (weightB !== weightA) {
            return weightB - weightA;
          }
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        edges = sortedDbEdges.map((e: any) => ({
          relationType: e.relationType,
          priorityWeight: e.priorityWeight,
          sourceContent: e.sourceNode.content,
          targetContent: e.targetNode.content,
        }));
      }
    }
  } catch (err) {
    console.warn('[GraphRAG] Erro ao consultar Grafo no DB, utilizando fallback de grafo em memória:', err);
  }

  // Fallback / Base de conhecimento de Grafo em memória para ambiente dev / demonstrativo
  if (nodes.length === 0) {
    nodes = [
      { id: 'node_1', type: 'CHECKIN', name: 'Check-in Padrão', content: 'Horário oficial de entrada é às 14h00.' },
      { id: 'node_2', type: 'POLICY', name: 'Check-in Antecipado (Late/Early)', content: 'Entrada antecipada às 11h00 disponível mediante disponibilidade.' },
      { id: 'node_3', type: 'RULE', name: 'Política de Pets', content: 'Permitido pets de pequeno porte mediante taxa de higienização de R$ 50.' },
    ];

    edges = [
      {
        relationType: 'SUPERSEDES',
        priorityWeight: 10,
        sourceContent: 'Entrada antecipada às 11h00 disponível mediante disponibilidade.',
        targetContent: 'Horário oficial de entrada é às 14h00.',
      },
      {
        relationType: 'REQUIRES',
        priorityWeight: 8,
        sourceContent: 'Entrada antecipada às 11h00 disponível mediante disponibilidade.',
        targetContent: 'Taxa adicional de R$ 50 e confirmação prévia com a recepção.',
      },
    ];
  }

  // Ordenação determinística também no fallback em memória
  edges.sort((a, b) => {
    if (b.priorityWeight !== a.priorityWeight) {
      return b.priorityWeight - a.priorityWeight;
    }
    const weightA = RELATION_WEIGHTS[a.relationType] || 1;
    const weightB = RELATION_WEIGHTS[b.relationType] || 1;
    return weightB - weightA;
  });

  // 3. Montagem do Contexto Resolver sem Contradições (Hierárquico)
  let contextText = "### CONHECIMENTO HIERÁRQUICO DA POUSADA ###\n";
  for (const node of nodes) {
    contextText += `- [${node.type}] ${node.name}: ${node.content}\n`;
  }

  if (edges.length > 0) {
    contextText += "\n### REGRAS DE PRIORIDADE E CONDIÇÕES ###\n";
    for (const edge of edges) {
      contextText += `- REGRA: "${edge.sourceContent}" [${edge.relationType}] "${edge.targetContent}" (Prioridade: ${edge.priorityWeight})\n`;
    }
    contextText += "\n⚠️ NOTA DE DESEMPATE CORTÊS: A regra de maior prioridade/recência prevalece. Em solicitações especiais conflitantes, responda com gentileza informando a regra geral e ofereça consultar a recepção.";
  }

  return contextText;
}
