/**
 * Testes do GraphRAG Thin Wrapper
 *
 * Valida que graph-rag.ts mantém a API legada (addGraphNode, addGraphEdge,
 * hybridGraphSearch) mas delega para SemanticaClient quando habilitado.
 *
 * Cenários:
 *   1. USE_SEMANTICA_GRAPH=false → usa fallback legado (Prisma + in-memory)
 *   2. hybridGraphSearch retorna contexto formatado para prompt
 *   3. addGraphNode retorna objeto com id, type, name, content
 *   4. addGraphEdge retorna string (id da aresta)
 *   5. Contexto contém hierarquia SUPERSEDES
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { addGraphNode, addGraphEdge, hybridGraphSearch } from '@/lib/ml/graph-rag';

describe('GraphRAG Thin Wrapper', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.USE_SEMANTICA_GRAPH = 'false';
    process.env.SEMANTICA_API_KEY = '';
    process.env.SEMANTICA_BASE_URL = 'http://127.0.0.1:9999';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════
  // 1. ADD GRAPH NODE
  // ═══════════════════════════════════════════════════════════════

  describe('addGraphNode()', () => {
    it('cria nó com tipo, nome e conteúdo', async () => {
      const node = await addGraphNode({
        tenantId: 'test-tenant-001',
        entityType: 'CHECKIN',
        name: 'Check-in Padrão',
        content: 'Horário oficial de check-in é às 14h00.',
      });

      expect(node).toHaveProperty('id');
      expect(node.type).toBe('CHECKIN');
      expect(node.name).toBe('Check-in Padrão');
      expect(node.content).toBe('Horário oficial de check-in é às 14h00.');
    });

    it('gera ID único para cada nó', async () => {
      const node1 = await addGraphNode({
        tenantId: 'test-tenant-001',
        entityType: 'CHECKIN',
        name: 'Node 1',
        content: 'Content 1',
      });
      const node2 = await addGraphNode({
        tenantId: 'test-tenant-001',
        entityType: 'CHECKIN',
        name: 'Node 2',
        content: 'Content 2',
      });

      expect(node1.id).not.toBe(node2.id);
    });

    it('aceita todos os entityTypes válidos', async () => {
      const types = ['RULE', 'POLICY', 'AMENITY', 'CHECKIN'] as const;
      for (const type of types) {
        const node = await addGraphNode({
          tenantId: 'test-tenant-001',
          entityType: type,
          name: `Test ${type}`,
          content: `Content for ${type}`,
        });
        expect(node.type).toBe(type);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. ADD GRAPH EDGE
  // ═══════════════════════════════════════════════════════════════

  describe('addGraphEdge()', () => {
    it('cria aresta entre dois nós', async () => {
      const node1 = await addGraphNode({
        tenantId: 'test-tenant-001',
        entityType: 'CHECKIN',
        name: 'Source',
        content: 'Source content',
      });
      const node2 = await addGraphNode({
        tenantId: 'test-tenant-001',
        entityType: 'CHECKIN',
        name: 'Target',
        content: 'Target content',
      });

      const edgeId = await addGraphEdge({
        tenantId: 'test-tenant-001',
        sourceNodeId: node1.id,
        targetNodeId: node2.id,
        relationType: 'SUPERSEDES',
        priorityWeight: 10,
      });

      expect(edgeId).toBeTruthy();
      expect(typeof edgeId).toBe('string');
    });

    it('aceita todos os relationTypes válidos', async () => {
      const node1 = await addGraphNode({
        tenantId: 'test-tenant-001',
        entityType: 'CHECKIN',
        name: 'Source',
        content: 'Source',
      });
      const node2 = await addGraphNode({
        tenantId: 'test-tenant-001',
        entityType: 'CHECKIN',
        name: 'Target',
        content: 'Target',
      });

      const relations = ['OVERLAPS', 'REQUIRES', 'FORBIDS', 'SUPERSEDES'] as const;
      for (const rel of relations) {
        const edgeId = await addGraphEdge({
          tenantId: 'test-tenant-001',
          sourceNodeId: node1.id,
          targetNodeId: node2.id,
          relationType: rel,
        });
        expect(edgeId).toBeTruthy();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. HYBRID GRAPH SEARCH (FALLBACK MODE)
  // ═══════════════════════════════════════════════════════════════

  describe('hybridGraphSearch() — fallback mode', () => {
    it('retorna string de contexto formatado', async () => {
      const context = await hybridGraphSearch('test-tenant-001', 'check-in antecipado');
      expect(typeof context).toBe('string');
      expect(context.length).toBeGreaterThan(0);
    });

    it('contém seção de CONHECIMENTO HIERÁRQUICO', async () => {
      const context = await hybridGraphSearch('test-tenant-001', 'horário check-in');
      expect(context).toContain('CONHECIMENTO HIERÁRQUICO');
    });

    it('contém nós do grafo em memória (fallback demo)', async () => {
      const context = await hybridGraphSearch('test-tenant-001', 'check-in');
      expect(context).toContain('Check-in');
    });

    it('contém regras de prioridade quando há arestas', async () => {
      const context = await hybridGraphSearch('test-tenant-001', 'check-in antecipado');
      // O fallback em memória tem arestas SUPERSEDES e REQUIRES
      expect(context).toContain('REGRAS DE PRIORIDADE');
    });

    it('contém nota de desempate cortês', async () => {
      const context = await hybridGraphSearch('test-tenant-001', 'check-in antecipado');
      expect(context).toContain('DESEMPATE');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. FALLBACK GRACIOSO QUANDO SEMANTICA FALHA
  // ═══════════════════════════════════════════════════════════════

  describe('Fallback gracioso', () => {
    it('quando USE_SEMANTICA_GRAPH=true mas sidecar down, cai em fallback', async () => {
      process.env.USE_SEMANTICA_GRAPH = 'true';
      process.env.SEMANTICA_API_KEY = 'test-key';
      process.env.SEMANTICA_BASE_URL = 'http://127.0.0.1:9999'; // porta não usada

      // Deve cair no fallback legado (não lançar erro)
      const context = await hybridGraphSearch('test-tenant-001', 'check-in antecipado');
      expect(typeof context).toBe('string');
      expect(context).toContain('CONHECIMENTO');
    });
  });
});
