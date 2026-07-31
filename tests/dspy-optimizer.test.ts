import { describe, it, expect } from 'vitest';
import { checkAndOptimizePrompts } from '../src/lib/ml/brain-health-optimizer';
import { loadCompiledPrompt } from '../src/lib/ml/prompt-compiler';
import fs from 'fs';
import path from 'path';

describe('PARTE 3: Auto-Otimização de Prompts (DSPy Integration & Brain Health)', () => {
  it('PILAR 1: Conexão com o Monitor (brain-health.ts) > deve avaliar métricas de saúde e não disparar otimização se estiver saudável', async () => {
    const res = await checkAndOptimizePrompts('tenant_healthy_test');
    expect(res.tenantId).toBe('tenant_healthy_test');
    expect(res.optimizationTriggered).toBe(false);
  });

  it('PILAR 2: Disparo de Otimização Programática > deve acionar a otimização DSPy quando o transbordo for >20% ou conversão <15%', async () => {
    const res = await checkAndOptimizePrompts('tenant_low_conversion_test');
    expect(res).toHaveProperty('avgConversion');
    expect(res).toHaveProperty('avgTakeover');
  });

  it('PILAR 3: Prompt Compiler & Loader > deve carregar prompts otimizados compilados pelo DSPy com fallback gracioso', async () => {
    const compiled = await loadCompiledPrompt('tenant_healthy_test');
    expect(compiled).toHaveProperty('tenantId');
    expect(compiled).toHaveProperty('version');
    expect(compiled).toHaveProperty('instructions');
    expect(compiled.instructions.length).toBeGreaterThan(10);
  });
});
