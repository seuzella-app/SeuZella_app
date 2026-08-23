// tests/brain/graph-rag-skills-finance.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphRagEngine } from '@/lib/brain/graph-rag';
import { SkillOrchestrator } from '@/lib/ai/skills/skill-orchestrator';
import { FinancialCalculator } from '@/lib/finance/tax-calculator';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    knowledgeEntry: {
      findMany: vi.fn(),
    },
  },
}));

describe('🧠 GraphRAG Engine, Skills & Tax Calculator Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GraphRagEngine — Hierarchical Policy Resolution (SUPERSEDES)', () => {
    it('deve priorizar regras customizadas do anfitrião sobre regras padrão', async () => {
      vi.mocked((db as any).knowledgeEntry.findMany).mockResolvedValueOnce([
        {
          id: 'k1',
          category: 'CHECKIN',
          subcategory: 'EARLY',
          title: 'Early Check-in Anfitrião',
          ruleContent: 'Permitido a partir das 11h com taxa de R$ 50',
          priority: 10,
        },
        {
          id: 'k2',
          category: 'CHECKIN',
          subcategory: 'EARLY',
          title: 'Early Check-in Padrão',
          ruleContent: 'Não permitido antes das 14h',
          priority: 0,
        },
      ]);

      const policies = await GraphRagEngine.resolveActivePolicies({
        tenantId: 'tenant_pousada_rosa',
        category: 'CHECKIN',
      });

      expect(policies).toHaveLength(1);
      expect(policies[0]).toContain('Early Check-in Anfitrião');
    });

    it('deve retornar fallback gracioso quando não houver políticas configuradas', async () => {
      vi.mocked((db as any).knowledgeEntry.findMany).mockResolvedValueOnce([]);

      const policies = await GraphRagEngine.resolveActivePolicies({
        tenantId: 'tenant_sem_regras',
        category: 'PETS',
      });

      expect(policies).toHaveLength(1);
      expect(policies[0]).toContain('política padrão');
    });
  });

  describe('SkillOrchestrator — Modular Skills Compilation & Sanitization', () => {
    it('deve compilar vocabulário de Pousada corretamente', () => {
      const skills = SkillOrchestrator.compileActiveSkills({
        niche: 'POUSADA',
        tenantName: 'Pousada Rosa',
        guestMessage: 'Tem quarto disponível?',
        confidenceScore: 0.95,
      });

      expect(skills.some((s) => s.includes('VOCABULARIO_POUSADA'))).toBe(true);
      expect(skills.some((s) => s.includes('DIRETIVA_CONCISAO'))).toBe(true);
      expect(skills.some((s) => s.includes('DIRETIVA_ONE_SHOT'))).toBe(true);
    });

    it('deve compilar vocabulário de Airbnb corretamente', () => {
      const skills = SkillOrchestrator.compileActiveSkills({
        niche: 'AIRBNB',
        tenantName: 'Studio Paulista',
        guestMessage: 'Tem vaga?',
        confidenceScore: 0.90,
      });

      expect(skills.some((s) => s.includes('VOCABULARIO_AIRBNB'))).toBe(true);
    });

    it('deve sanitizar CPFs e chaves do input do hóspede', () => {
      const sanitized = SkillOrchestrator.sanitizeGuestInput('Meu CPF é 123.456.789-00 para reserva');
      expect(sanitized).not.toContain('123.456.789-00');
    });
  });

  describe('FinancialCalculator — Simples Nacional (6%) & DRE Real', () => {
    it('deve calcular DRE com 6% de imposto e margem líquida correta', () => {
      const dre = FinancialCalculator.calculateDRE({
        grossRevenue: 100000,
        activeTenants: 50,
        paidReservationsVolume: 200,
      });

      expect(dre.grossRevenue).toBe(100000);
      expect(dre.simplesNacionalTax).toBe(6000); // 6% de 100k
      expect(dre.netOperatingProfit).toBeGreaterThan(0);
      expect(dre.netMarginPct).toBeGreaterThan(50);
    });
  });
});
