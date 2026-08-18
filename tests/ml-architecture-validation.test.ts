/**
 * CI Test — Validação da Arquitetura ML do Cérebro Zélla
 *
 * Baseado no documento "Evolução ML Cérebro Zélla.pdf".
 * Verifica que os 28 componentes descritos no documento existem no código.
 *
 * Este teste garante que a arquitetura de ML contínuo está implementada
 * conforme o planejamento técnico. Falha aqui = componente crítico ausente.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..', 'src');

describe('🧠 Arquitetura ML do Cérebro Zélla — Validação do Documento', () => {
  const PROJECT_ROOT = path.resolve(__dirname, '..');

  // ═══════════════════════════════════════════════════════════════
  // 1. MÓDULOS DO CÉREBRO (28 componentes do documento)
  // ═══════════════════════════════════════════════════════════════

  describe('Módulos do Cérebro (25 arquivos em src/lib/cerebro/)', () => {
    const expectedModules = [
      'cerebro-orchestrator.ts',
      'anomaly-detector.ts',
      'self-defense.ts',
      'vulnerability-scanner.ts',
      'auto-remediator.ts',
      'refactor-suggester.ts',
      'knowledge-distiller.ts',
      'churn-predictor.ts',
      'cerebro-budget-guard.ts',
      'alert-bus.ts',
      'glm-service.ts',
      'learning-engine.ts',
      'semantic-similarity.ts',
      'contextual-bandits.ts',
      'telemetry-bridge.ts',
      'code-indexer.ts',
      'tfidf.ts',
      'best-practices.ts',
      'zella-skills.ts',
      'zella-sales-brain.ts',
      'guest-responder-brain.ts',
      'zelador-suporte-brain.ts',
      'log-sink.ts',
      'error-reporter.ts',
      'types.ts',
    ];

    for (const module of expectedModules) {
      it(`✅ ${module} existe`, () => {
        const filePath = path.join(SRC, 'lib', 'cerebro', module);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. PIPELINE COGNITIVO (cognitive-router + components)
  // ═══════════════════════════════════════════════════════════════

  describe('Pipeline Cognitivo', () => {
    it('✅ cognitive-router.ts existe (orquestrador principal)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'ai', 'cognitive-router.ts'))).toBe(true);
    });

    it('✅ zaos-neuro-router.ts existe (Thompson Sampling + 3 tiers)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'ai', 'zaos-neuro-router.ts'))).toBe(true);
    });

    it('✅ whatsapp-ai-responder.ts existe (entry point do WhatsApp)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'whatsapp-ai-responder.ts'))).toBe(true);
    });

    it('✅ whatsapp-guardrails.ts existe (travas de segurança)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'ai', 'whatsapp-guardrails.ts'))).toBe(true);
    });

    it('✅ intent-router.ts existe (8 tipos de classificação)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'ai', 'intent-router.ts'))).toBe(true);
    });

    it('✅ tool-calling.ts existe (check_availability, get_pix_info, etc.)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'ai', 'tool-calling.ts'))).toBe(true);
    });

    it('✅ semantic-rag.ts existe (RAG vetorial fallback)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'ai', 'semantic-rag.ts'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. ML LAYER (aprendizado contínuo)
  // ═══════════════════════════════════════════════════════════════

  describe('Machine Learning Layer', () => {
    it('✅ conversation-learner.ts existe (padrões Q&A + promotion + decay)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'brain', 'conversation-learner.ts'))).toBe(true);
    });

    it('✅ dpo-collector.ts existe (DPO pairs + Levenshtein)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'ml', 'dpo-collector.ts'))).toBe(true);
    });

    it('✅ graph-rag.ts existe (GraphRAG + SUPERSEDES)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'ml', 'graph-rag.ts'))).toBe(true);
    });

    it('✅ brain-health-optimizer.ts existe (conversionRate, takeoverRate)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'ml', 'brain-health-optimizer.ts'))).toBe(true);
    });

    it('✅ prompt-compiler.ts existe (DSPy)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'ml', 'prompt-compiler.ts'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. SEMANTICA (GraphRAG + Decision Intelligence)
  // ═══════════════════════════════════════════════════════════════

  describe('Semantica Integration (GraphRAG + Decision)', () => {
    it('✅ semantica/types.ts existe', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'semantica', 'types.ts'))).toBe(true);
    });

    it('✅ semantica/client.ts existe (SemanticaClient)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'semantica', 'client.ts'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. CRONS DO CÉREBRO (3 crons críticos do documento)
  // ═══════════════════════════════════════════════════════════════

  describe('Crons do Cérebro (registrados no vercel.json)', () => {
    const vercelJson = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'vercel.json'), 'utf-8')
    );
    const crons = vercelJson.crons || [];
    const cronPaths = crons.map((c: any) => c.path);

    it('✅ /api/cron/cerebro-orchestrator registrado (5 min)', () => {
      expect(cronPaths).toContain('/api/cron/cerebro-orchestrator');
    });

    it('✅ /api/cron/cerebro-churn-predict registrado', () => {
      expect(cronPaths).toContain('/api/cron/cerebro-churn-predict');
    });

    it('✅ /api/cron/cerebro-distill registrado (diário)', () => {
      expect(cronPaths).toContain('/api/cron/cerebro-distill');
    });

    it('✅ Total de crons >= 21', () => {
      expect(crons.length).toBeGreaterThanOrEqual(21);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. ENV VARS (configuração do Cérebro)
  // ═══════════════════════════════════════════════════════════════

  describe('Variáveis de ambiente (.env.example)', () => {
    const envExample = fs.readFileSync(
      path.join(PROJECT_ROOT, '.env.example'),
      'utf-8'
    );

    it('✅ CEREBRO_LIVE_MODE documentado', () => {
      expect(envExample).toContain('CEREBRO_LIVE_MODE');
    });

    it('✅ GLM_5_2_API_KEY documentado', () => {
      expect(envExample).toContain('GLM_5_2_API_KEY');
    });

    it('✅ USE_SEMANTICA_GRAPH documentado', () => {
      expect(envExample).toContain('USE_SEMANTICA_GRAPH');
    });

    it('✅ SEMANTICA_API_KEY documentado', () => {
      expect(envExample).toContain('SEMANTICA_API_KEY');
    });

    it('✅ CEREBRO_LIVE_MODE default é false (offline até VPS)', () => {
      expect(envExample).toContain('CEREBRO_LIVE_MODE=false');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. PRISMA MODELS (tabelas de ML)
  // ═══════════════════════════════════════════════════════════════

  describe('Modelos Prisma (tabelas de ML)', () => {
    const schema = fs.readFileSync(
      path.join(PROJECT_ROOT, 'prisma', 'schema.prisma'),
      'utf-8'
    );

    it('✅ model DpoPreferencePair existe', () => {
      expect(schema).toContain('model DpoPreferencePair');
    });

    it('✅ model KnowledgeChunk existe', () => {
      expect(schema).toContain('model KnowledgeChunk');
    });

    it('✅ model KnowledgeEntry existe', () => {
      expect(schema).toContain('model KnowledgeEntry');
    });

    it('✅ model GraphNode existe (GraphRAG)', () => {
      expect(schema).toContain('model GraphNode');
    });

    it('✅ model GraphEdge existe (GraphRAG)', () => {
      expect(schema).toContain('model GraphEdge');
    });

    it('✅ model CerebroAnalysis existe', () => {
      expect(schema).toContain('model CerebroAnalysis');
    });

    it('✅ model AnomalyEvent existe', () => {
      expect(schema).toContain('model AnomalyEvent');
    });

    it('✅ model RefactorSuggestion existe', () => {
      expect(schema).toContain('model RefactorSuggestion');
    });

    it('✅ model BudgetGuardState existe', () => {
      expect(schema).toContain('model BudgetGuardState');
    });

    it('✅ model CostLog existe', () => {
      expect(schema).toContain('model CostLog');
    });

    it('✅ model RouterProvider existe (Thompson Sampling α/β)', () => {
      expect(schema).toContain('model RouterProvider');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 8. TELEMETRIA (Fase A do documento: landing page tracking)
  // ═══════════════════════════════════════════════════════════════

  describe('Telemetria da Landing Page (Fase A do documento)', () => {
    it('✅ landing-telemetry.ts existe (dwell time, scroll depth)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'telemetry', 'landing-telemetry.ts'))).toBe(true);
    });

    it('✅ /api/zcc/pulse/capture existe', () => {
      expect(fs.existsSync(path.join(SRC, 'app', 'api', 'zcc', 'pulse', 'capture', 'route.ts'))).toBe(true);
    });

    it('✅ /api/zcc/pulse/analyze existe', () => {
      expect(fs.existsSync(path.join(SRC, 'app', 'api', 'zcc', 'pulse', 'analyze', 'route.ts'))).toBe(true);
    });

    it('✅ contextual-bandits.ts existe (Random Forest / Gradient Boosting)', () => {
      expect(fs.existsSync(path.join(SRC, 'lib', 'cerebro', 'contextual-bandits.ts'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 9. APIs DO CÉREBRO (endpoints do ZCC)
  // ═══════════════════════════════════════════════════════════════

  describe('APIs do Cérebro no ZCC', () => {
    it('✅ /api/zcc/cerebro/ml-stats existe', () => {
      expect(fs.existsSync(path.join(SRC, 'app', 'api', 'zcc', 'cerebro', 'ml-stats', 'route.ts'))).toBe(true);
    });

    it('✅ /api/zcc/cerebro/anomalies existe', () => {
      expect(fs.existsSync(path.join(SRC, 'app', 'api', 'zcc', 'cerebro', 'anomalies', 'route.ts'))).toBe(true);
    });

    it('✅ /api/zcc/cerebro/analyses existe', () => {
      expect(fs.existsSync(path.join(SRC, 'app', 'api', 'zcc', 'cerebro', 'analyses', 'route.ts'))).toBe(true);
    });

    it('✅ /api/zcc/cerebro/refactors existe', () => {
      expect(fs.existsSync(path.join(SRC, 'app', 'api', 'zcc', 'cerebro', 'refactors', 'route.ts'))).toBe(true);
    });

    it('✅ /api/zcc/cerebro/status existe (Semantica)', () => {
      expect(fs.existsSync(path.join(SRC, 'app', 'api', 'zcc', 'cerebro', 'status', 'route.ts'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 10. ONTOLOGIA (OWL/SHACL)
  // ═══════════════════════════════════════════════════════════════

  describe('Ontologia Seu Zélla (OWL/SHACL)', () => {
    it('✅ ontology/zella.ttl existe', () => {
      expect(fs.existsSync(path.join(PROJECT_ROOT, 'ontology', 'zella.ttl'))).toBe(true);
    });

    it('✅ Ontologia tem classes (owl:Class)', () => {
      const ttl = fs.readFileSync(path.join(PROJECT_ROOT, 'ontology', 'zella.ttl'), 'utf-8');
      expect(ttl).toContain('owl:Class');
    });

    it('✅ Ontologia tem SHACL constraints (sh:NodeShape)', () => {
      const ttl = fs.readFileSync(path.join(PROJECT_ROOT, 'ontology', 'zella.ttl'), 'utf-8');
      expect(ttl).toContain('sh:NodeShape');
    });

    it('✅ Ontologia tem SUPERSEDES (relationType do GraphRAG)', () => {
      const ttl = fs.readFileSync(path.join(PROJECT_ROOT, 'ontology', 'zella.ttl'), 'utf-8');
      expect(ttl).toContain('supersedes');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 11. STATUS DA FASE E (Cérebro Vivo) — OFFLINE
  // ═══════════════════════════════════════════════════════════════

  describe('Fase E (Cérebro Vivo) — OFFLINE até segunda ordem', () => {
    it('✅ CEREBRO_LIVE_MODE=false no .env.example (offline)', () => {
      const envExample = fs.readFileSync(
        path.join(PROJECT_ROOT, '.env.example'),
        'utf-8'
      );
      expect(envExample).toContain('CEREBRO_LIVE_MODE=false');
    });

    it('✅ USE_SEMANTICA_GRAPH=false no .env.example (offline)', () => {
      const envExample = fs.readFileSync(
        path.join(PROJECT_ROOT, '.env.example'),
        'utf-8'
      );
      expect(envExample).toContain('USE_SEMANTICA_GRAPH=false');
    });

    it('✅ ROADMAP-ML-CEREBRO-ZELLA.md existe (documentação do roadmap)', () => {
      expect(fs.existsSync(path.join(PROJECT_ROOT, 'docs', 'ROADMAP-ML-CEREBRO-ZELLA.md'))).toBe(true);
    });
  });
});
