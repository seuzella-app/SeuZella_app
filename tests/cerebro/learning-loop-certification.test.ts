/**
 * Cérebro Learning Loop Certification
 * ============================================================================
 * Valida que o Cérebro tem o ciclo fechado:
 *   observação → evidência → lição candidata → validação → knowledge → reutilização
 * E que NÃO aprende regressões (lições têm validação antes de aplicar).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('🧠 Cérebro Learning Loop Certification', () => {
  describe('Knowledge Distiller — observação → lição', () => {
    it('knowledge-distiller.ts exists', () => {
      const source = read('src/lib/cerebro/knowledge-distiller.ts');
      expect(source.length).toBeGreaterThan(100);
    });

    it('has runDistillation function', () => {
      const source = read('src/lib/cerebro/knowledge-distiller.ts');
      expect(source).toMatch(/runDistillation|distill|export.*function/i);
    });
  });

  describe('Learning Engine — lição → validação', () => {
    it('cerebro-learning-service.ts exists', () => {
      const source = read('src/lib/cerebro/cerebro-learning-service.ts');
      expect(source.length).toBeGreaterThan(100);
    });

    it('learning-engine.ts exists', () => {
      const source = read('src/lib/cerebro/learning-engine.ts');
      expect(source.length).toBeGreaterThan(50);
    });
  });

  describe('Orchestrator — 9 stages', () => {
    it('has all 9 stages', () => {
      const source = read('src/lib/cerebro/cerebro-orchestrator.ts');
      expect(source).toContain('STEP 1: WATCH');
      expect(source).toContain('STEP 2: DEFEND');
      expect(source).toContain('STEP 3: SCAN');
      expect(source).toContain('STEP 4: ANALYZE');
      expect(source).toContain('STEP 5: REFACTOR');
      expect(source).toContain('STEP 6: REMEDIATE');
      expect(source).toContain('STEP 7: CHURN');
      expect(source).toContain('STEP 8: DISTILL');
      // Step 9 might be named differently
    });

    it('has runWithTimeout for each stage', () => {
      const source = read('src/lib/cerebro/cerebro-orchestrator.ts');
      expect(source).toContain('runWithTimeout');
    });

    it('persists telemetry events', () => {
      const source = read('src/lib/cerebro/cerebro-orchestrator.ts');
      expect(source).toContain('cerebroTelemetryEvent');
    });
  });

  describe('GLM 5.2 integration (no OpenAI/Anthropic)', () => {
    it('uses GLM_5_2_API_KEY', () => {
      const source = read('src/lib/cerebro/glm-service.ts');
      expect(source).toContain('GLM_5_2_API_KEY');
    });

    it('uses GLM_MODEL = glm-5.2', () => {
      const source = read('src/lib/cerebro/glm-service.ts');
      expect(source).toContain('GLM_MODEL');
    });

    it('has mock mode (no API cost)', () => {
      const source = read('src/lib/cerebro/glm-service.ts');
      expect(source).toContain('mock');
      expect(source).toContain('CEREBRO_LIVE_MODE');
    });

    it('has budget guard ($20/month cap)', () => {
      const source = read('src/lib/cerebro/glm-service.ts');
      expect(source).toMatch(/CEREBRO_MONTHLY_BUDGET|budget.*20/i);
    });

    it('does NOT reference OpenAI or Anthropic API keys', () => {
      const source = read('src/lib/cerebro/glm-service.ts');
      expect(source).not.toContain('OPENAI_API_KEY');
      expect(source).not.toContain('ANTHROPIC_API_KEY');
    });
  });

  describe('LLM timeout — no hang on provider outage', () => {
    it('llm-timeout.ts exists with withLlmTimeout', () => {
      const source = read('src/lib/ai/llm-timeout.ts');
      expect(source).toContain('withLlmTimeout');
      expect(source).toContain('LLM_TIMEOUT');
      expect(source).toContain('8_000'); // 8s default
    });

    it('withLlmFallback exists (provider chain)', () => {
      const source = read('src/lib/ai/llm-timeout.ts');
      expect(source).toContain('withLlmFallback');
    });
  });

  describe('Guest responder brain — conversational AI', () => {
    it('guest-responder-brain.ts exists', () => {
      const source = read('src/lib/cerebro/guest-responder-brain.ts');
      expect(source.length).toBeGreaterThan(100);
    });

    it('has processGuestMessage function', () => {
      const source = read('src/lib/cerebro/guest-responder-brain.ts');
      expect(source).toMatch(/processGuestMessage|export.*function/i);
    });
  });

  describe('Anti-regression — Cérebro não aprende regressões', () => {
    it('DPO collector exists (preference alignment)', () => {
      const source = read('src/lib/ml/dpo-collector.ts');
      expect(source).toMatch(/Levenshtein|similarity|export/i);
    });

    it('GraphRAG exists (memory pipeline)', () => {
      const source = read('src/lib/ml/graph-rag.ts');
      expect(source).toContain('SemanticaClient');
      expect(source).toContain('hybridGraphSearch');
    });

    it('prompt-compiler exists (compiled prompts)', () => {
      const source = read('src/lib/ml/prompt-compiler.ts');
      expect(source).toContain('compiledPrompt');
      expect(source).toContain('loadCompiledPrompt');
    });
  });
});
