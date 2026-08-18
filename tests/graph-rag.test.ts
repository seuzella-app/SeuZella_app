import { describe, it, expect } from 'vitest';
import {
  addGraphNode,
  addGraphEdge,
  hybridGraphSearch,
} from '../src/lib/ml/graph-rag';

describe('PARTE 2: Memória em Grafo (GraphRAG & Busca Híbrida)', () => {
  it('PILAR 1: Criação de Nós de Entidades > deve registrar nós com tipo, nome e conteúdo', async () => {
    const node = await addGraphNode({
      tenantId: 'tenant_graph_test',
      entityType: 'CHECKIN',
      name: 'Horário de Check-in Padrão',
      content: 'O check-in oficial é a partir das 14h.',
    });

    expect(node).toHaveProperty('id');
    expect(node.type).toBe('CHECKIN');
    expect(node.name).toBe('Horário de Check-in Padrão');
  });

  it('PILAR 2: Conexão de Relações/Arestas > deve criar relacionamentos com tipos SUPERSEDES, REQUIRES, FORBIDS', async () => {
    const node1 = await addGraphNode({
      tenantId: 'tenant_graph_test',
      entityType: 'CHECKIN',
      name: 'Check-in 14h',
      content: 'Entrada padrão às 14h.',
    });

    const node2 = await addGraphNode({
      tenantId: 'tenant_graph_test',
      entityType: 'POLICY',
      name: 'Early Check-in',
      content: 'Entrada antecipada às 11h.',
    });

    const edgeId = await addGraphEdge({
      tenantId: 'tenant_graph_test',
      sourceNodeId: node2.id,
      targetNodeId: node1.id,
      relationType: 'SUPERSEDES',
      priorityWeight: 10,
    });

    expect(edgeId).toBeDefined();
  });

  it('PILAR 3: Motor de Busca Híbrida e Resolução de Contradições > deve gerar contexto estruturado sem ambiguidades', async () => {
    const context = await hybridGraphSearch('tenant_graph_test', 'Posso fazer check-in mais cedo?');

    expect(context).toContain('### CONHECIMENTO HIERÁRQUICO DA POUSADA ###');
    expect(context).toContain('### REGRAS DE PRIORIDADE E CONDIÇÕES ###');
    expect(context).toContain('SUPERSEDES');
  });
});
