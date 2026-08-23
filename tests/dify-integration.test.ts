/**
 * Testes do Dify Integration — Workflow Engine + LLMOps + ToolRegistry
 * ====================================================================
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 1: Estrutura de arquivos
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE 1: Estrutura de arquivos Dify-inspired', () => {
  it('workflow-engine.ts existe', () => {
    const p = path.resolve(process.cwd(), 'src/lib/cerebro/workflow-engine.ts');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('workflow-engine.ts exporta CerebroWorkflowEngine', () => {
    const p = path.resolve(process.cwd(), 'src/lib/cerebro/workflow-engine.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('export class CerebroWorkflowEngine');
  });

  it('workflow-engine.ts tem execute(), loadWorkflow(), saveWorkflow(), logLLMCall(), getLLMOpsStats()', () => {
    const p = path.resolve(process.cwd(), 'src/lib/cerebro/workflow-engine.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('async execute(');
    expect(content).toContain('async loadWorkflow(');
    expect(content).toContain('async saveWorkflow(');
    expect(content).toContain('async logLLMCall(');
    expect(content).toContain('async getLLMOpsStats(');
  });

  it('tool-registry.ts existe e exporta registerTool, executeTool, listTools', () => {
    const p = path.resolve(process.cwd(), 'src/lib/ai/tool-registry.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('export function registerTool');
    expect(content).toContain('executeTool');
    expect(content).toContain('export function listTools');
    expect(content).toContain('export function hasTool');
    expect(content).toContain('export function getToolsForPrompt');
  });

  it('tool-registry.ts auto-registra 7+ tools', () => {
    const p = path.resolve(process.cwd(), 'src/lib/ai/tool-registry.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('check_availability');
    expect(content).toContain('get_room_details');
    expect(content).toContain('calculate_dynamic_price');
    expect(content).toContain('get_policies');
    expect(content).toContain('get_pix_info');
    expect(content).toContain('get_occupancy');
    expect(content).toContain('send_guest_guide');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 2: API routes
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE 2: API routes Dify-inspired', () => {
  it('Prompt IDE API existe', () => {
    const p = path.resolve(process.cwd(), 'src/app/api/zcc/cerebro/prompt-ide/route.ts');
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('verifyZCCAccessOrReject');
    expect(content).toContain('callOpenAICompatible');
    expect(content).toContain('logLLMCall');
  });

  it('LLMOps API existe', () => {
    const p = path.resolve(process.cwd(), 'src/app/api/zcc/cerebro/llmops/route.ts');
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('getLLMOpsStats');
  });

  it('Workflows API existe', () => {
    const p = path.resolve(process.cwd(), 'src/app/api/zcc/cerebro/workflows/route.ts');
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('CerebroWorkflowEngine');
    expect(content).toContain('saveWorkflow');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 3: Modelos Prisma
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE 3: Modelos Prisma Dify-inspired', () => {
  it('CerebroWorkflow existe no schema', () => {
    const p = path.resolve(process.cwd(), 'prisma/schema.prisma');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('model CerebroWorkflow');
    expect(content).toContain('nodesJson');
    expect(content).toContain('cerebro_workflows');
  });

  it('LLMCallLog existe no schema', () => {
    const p = path.resolve(process.cwd(), 'prisma/schema.prisma');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('model LLMCallLog');
    expect(content).toContain('promptTokens');
    expect(content).toContain('completionTokens');
    expect(content).toContain('latencyMs');
    expect(content).toContain('costUsd');
    expect(content).toContain('feedback');
    expect(content).toContain('promptHash');
    expect(content).toContain('llm_call_logs');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 4: Workflow Engine — tipos de nós suportados
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE 4: Workflow Engine suporta 5 tipos de nós', () => {
  it('Suporta nós: start, llm, tool, if-else, output', () => {
    const p = path.resolve(process.cwd(), 'src/lib/cerebro/workflow-engine.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain("'start'");
    expect(content).toContain("'llm'");
    expect(content).toContain("'tool'");
    expect(content).toContain("'if-else'");
    expect(content).toContain("'output'");
  });

  it('Tem resolveTemplate para interpolação de variáveis', () => {
    const p = path.resolve(process.cwd(), 'src/lib/cerebro/workflow-engine.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('resolveTemplate');
    expect(content).toContain('{{');
  });

  it('Tem evaluateCondition para if-else', () => {
    const p = path.resolve(process.cwd(), 'src/lib/cerebro/workflow-engine.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('evaluateCondition');
  });

  it('Tem max 20 nós por execução (anti-loop infinito)', () => {
    const p = path.resolve(process.cwd(), 'src/lib/cerebro/workflow-engine.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('i < 20');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 5: LLMOps — estrutura de stats
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE 5: LLMOps estrutura', () => {
  it('getLLMOpsStats retorna estrutura completa', () => {
    const p = path.resolve(process.cwd(), 'src/lib/cerebro/workflow-engine.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('totalCalls');
    expect(content).toContain('successRate');
    expect(content).toContain('totalCostUsd');
    expect(content).toContain('avgLatencyMs');
    expect(content).toContain('p95LatencyMs');
    expect(content).toContain('byModel');
    expect(content).toContain('bySource');
  });

  it('logLLMCall aceita feedback (thumbs up/down)', () => {
    const p = path.resolve(process.cwd(), 'src/lib/cerebro/workflow-engine.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('feedback');
  });

  it('logLLMCall guarda promptHash (não prompt bruto — LGPD)', () => {
    const p = path.resolve(process.cwd(), 'src/lib/cerebro/workflow-engine.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('promptHash');
    expect(content).toContain('hashPrompt');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 6: ToolRegistry — estrutura
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE 6: ToolRegistry estrutura', () => {
  it('RegisteredTool tem name, description, execute, category', () => {
    const p = path.resolve(process.cwd(), 'src/lib/ai/tool-registry.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('name: string');
    expect(content).toContain('description: string');
    expect(content).toContain('execute:');
    expect(content).toContain('category');
  });

  it('ToolRegistry tem inputSchema (Zod) opcional', () => {
    const p = path.resolve(process.cwd(), 'src/lib/ai/tool-registry.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('inputSchema');
    expect(content).toContain('z.ZodSchema');
  });

  it('getToolsForPrompt retorna descrições para injeção no prompt', () => {
    const p = path.resolve(process.cwd(), 'src/lib/ai/tool-registry.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('getToolsForPrompt');
  });
});
