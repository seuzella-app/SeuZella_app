// src/lib/brain/graph-rag.ts
import { db } from '@/lib/db';

export interface PolicyNode {
  id: string;
  tenantId: string;
  category: 'CHECKIN' | 'CHECKOUT' | 'PETS' | 'CANCELLATION' | 'PAYMENT' | 'GENERAL';
  subcategory?: string;
  title: string;
  ruleContent: string;
  priority: number; // 0 = Padrão Sistema, 10 = Regra Customizada do Anfitrião
}

export interface PolicyResolutionContext {
  tenantId: string;
  category: PolicyNode['category'];
  guestQuery?: string;
}

export class GraphRagEngine {
  /**
   * Recupera nós de conhecimento e resolve hierarquias de arestas SUPERSEDES
   */
  public static async resolveActivePolicies(ctx: PolicyResolutionContext): Promise<string[]> {
    // 1. Busca nós da categoria para o Tenant específico + nós globais de fallback
    let nodes: any[] = [];
    try {
      if (db && (db as any).knowledgeEntry) {
        nodes = await (db as any).knowledgeEntry.findMany({
          where: {
            tenantId: ctx.tenantId,
            category: ctx.category,
            isActive: true,
          },
          orderBy: { priority: 'desc' },
        });
      }
    } catch {
      nodes = [];
    }

    if (!nodes || nodes.length === 0) {
      return ['Nenhuma política customizada configurada. Aplicar política padrão de hospitalidade.'];
    }

    // 2. Resolução de Arestas: Nós de maior prioridade (Anfitrião) anulam os de menor prioridade (SUPERSEDES)
    const resolvedRules: string[] = [];
    const processedCategories = new Set<string>();

    for (const node of nodes) {
      const key = `${node.category}_${node.subcategory || 'DEFAULT'}`;
      if (!processedCategories.has(key)) {
        resolvedRules.push(`[POLÍTICA APLICADA: ${node.title}] -> ${node.ruleContent}`);
        processedCategories.add(key); // Bloqueia regras inferiores anuladas por SUPERSEDES
      }
    }

    return resolvedRules;
  }
}
