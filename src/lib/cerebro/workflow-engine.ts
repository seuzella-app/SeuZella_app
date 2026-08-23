/**
 * Cerebro Workflow Engine — Executor de fluxos de IA personalizáveis
 * =================================================================
 *
 * Inspirado no Dify (langgenius/dify): workflow DAG com nós.
 * Cada pousada pode ter seu próprio fluxo de atendimento.
 *
 * Tipos de nó suportados:
 *   - llm: chama GLM 5.2 com prompt
 *   - tool: chama tool do ToolRegistry
 *   - if-else: condicional baseado em output anterior
 *   - output: resposta final
 *
 * Estrutura do workflow JSON:
 *   {
 *     "nodes": [
 *       { "id": "start", "type": "start", "next": "classify" },
 *       { "id": "classify", "type": "tool", "toolName": "classify_intent", "next": "branch" },
 *       { "id": "branch", "type": "if-else", "condition": "{{classify.intent}} === 'pricing'", "nextTrue": "price", "nextFalse": "general" },
 *       { "id": "price", "type": "llm", "prompt": "Calcule o preço para {{input.message}}", "next": "output" },
 *       { "id": "general", "type": "llm", "prompt": "Responda: {{input.message}}", "next": "output" },
 *       { "id": "output", "type": "output" }
 *     ]
 *   }
 */

import { db } from '@/lib/db';
import { callOpenAICompatible, type AdapterMessage } from '@/lib/ai/llm-adapters';
import { getCerebroMode } from './types';
import { createHash } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  type: 'start' | 'llm' | 'tool' | 'if-else' | 'output';
  next?: string;
  // Para nós LLM
  prompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  // Para nós Tool
  toolName?: string;
  toolArgs?: Record<string, any>;
  // Para nós If-Else
  condition?: string;
  nextTrue?: string;
  nextFalse?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
}

export interface WorkflowExecutionContext {
  tenantId: string;
  input: { message: string; guestName?: string; history?: any[] };
  variables: Record<string, any>; // resultados intermediários
  startTime: number;
}

export interface WorkflowExecutionResult {
  success: boolean;
  output: string;
  nodesExecuted: string[];
  variables: Record<string, any>;
  durationMs: number;
  costUsd: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export class CerebroWorkflowEngine {
  /**
   * Carrega o workflow ativo de um tenant.
   */
  public static async loadWorkflow(tenantId: string): Promise<WorkflowDefinition | null> {
    try {
      const workflow = await (db as any).cerebroWorkflow?.findFirst({
        where: { tenantId, status: 'active' },
        orderBy: { updatedAt: 'desc' },
      });
      if (!workflow) return null;
      return JSON.parse(workflow.nodesJson);
    } catch {
      return null;
    }
  }

  /**
   * Salva um novo workflow para um tenant.
   */
  public static async saveWorkflow(params: {
    tenantId: string;
    name: string;
    description?: string;
    nodes: WorkflowNode[];
    status?: string;
  }): Promise<string> {
    const workflow = await (db as any).cerebroWorkflow?.create({
      data: {
        tenantId: params.tenantId,
        name: params.name,
        description: params.description ?? null,
        nodesJson: JSON.stringify({ nodes: params.nodes }),
        status: params.status ?? 'draft',
      },
    });
    return workflow?.id ?? '';
  }

  /**
   * Executa um workflow completo.
   */
  public static async execute(
    workflow: WorkflowDefinition,
    context: WorkflowExecutionContext
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const nodesExecuted: string[] = [];
    const variables: Record<string, any> = { ...context.input };
    let totalCostUsd = 0;
    let output = '';

    try {
      // Encontra nó start
      let current = workflow.nodes.find(n => n.type === 'start');
      if (!current) {
        return {
          success: false,
          output: '',
          nodesExecuted: [],
          variables,
          durationMs: Date.now() - startTime,
          costUsd: 0,
          error: 'Nó "start" não encontrado no workflow',
        };
      }

      // Executa nós em sequência (max 20 nós para evitar loops infinitos)
      for (let i = 0; i < 20 && current; i++) {
        nodesExecuted.push(current.id);

        switch (current.type) {
          case 'start':
            // Apenas passa para o próximo
            break;

          case 'llm':
            const llmResult = await this.executeLLMNode(current, variables, context);
            variables[current.id] = llmResult.output;
            totalCostUsd += llmResult.costUsd;
            output = llmResult.output;
            break;

          case 'tool':
            const toolResult = await this.executeToolNode(current, variables, context);
            variables[current.id] = toolResult;
            break;

          case 'if-else':
            const conditionMet = this.evaluateCondition(current.condition ?? 'false', variables);
            current = workflow.nodes.find(n => n.id === (conditionMet ? current!.nextTrue : current!.nextFalse));
            continue; // pula o next normal

          case 'output':
            output = this.resolveTemplate(current.prompt ?? '{{output}}', variables);
            break;
        }

        // Próximo nó
        if (!current.next) break;
        current = workflow.nodes.find(n => n.id === current!.next);
      }

      return {
        success: true,
        output,
        nodesExecuted,
        variables,
        durationMs: Date.now() - startTime,
        costUsd: totalCostUsd,
      };
    } catch (err: any) {
      return {
        success: false,
        output: output || 'Erro durante execução do workflow',
        nodesExecuted,
        variables,
        durationMs: Date.now() - startTime,
        costUsd: totalCostUsd,
        error: err?.message ?? 'erro desconhecido',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXECUTORES DE NÓS
  // ─────────────────────────────────────────────────────────────────────────

  private static async executeLLMNode(
    node: WorkflowNode,
    variables: Record<string, any>,
    context: WorkflowExecutionContext
  ): Promise<{ output: string; costUsd: number }> {
    const apiKey = process.env.GLM_5_2_API_KEY || process.env.ZHIPU_API_KEY || '';
    const baseUrl = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
    const model = node.model || process.env.GLM_MODEL || 'glm-4.7-flash';
    const mode = getCerebroMode();

    // Resolve template do prompt
    const resolvedPrompt = this.resolveTemplate(node.prompt ?? '{{input.message}}', variables);

    const messages: AdapterMessage[] = [
      { role: 'system', content: 'Você é o assistente inteligente da pousada. Responda em PT-BR com hospitalidade brasileira.' },
      { role: 'user', content: resolvedPrompt },
    ];

    if (mode === 'mock' || !apiKey) {
      return { output: `[MOCK] Resposta para: ${resolvedPrompt.slice(0, 100)}`, costUsd: 0 };
    }

    try {
      const response = await callOpenAICompatible({
        apiKey,
        baseUrl,
        model,
        messages,
        temperature: node.temperature ?? 0.3,
        maxTokens: node.maxTokens ?? 500,
      });

      const costUsd = (response.inputTokens * 0.00140 + response.outputTokens * 0.00440) / 1000;

      // Loga em LLMCallLog
      await this.logLLMCall({
        tenantId: context.tenantId,
        model,
        provider: 'zhipu',
        promptTokens: response.inputTokens,
        completionTokens: response.outputTokens,
        latencyMs: 0, // calculado pelo caller
        costUsd,
        success: true,
        source: 'workflow_engine',
        promptHash: hashPrompt(resolvedPrompt),
      });

      return { output: response.content, costUsd };
    } catch (err: any) {
      await this.logLLMCall({
        tenantId: context.tenantId,
        model,
        provider: 'zhipu',
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: 0,
        costUsd: 0,
        success: false,
        errorMessage: err?.message,
        source: 'workflow_engine',
        promptHash: hashPrompt(resolvedPrompt),
      });
      return { output: '', costUsd: 0 };
    }
  }

  private static async executeToolNode(
    node: WorkflowNode,
    variables: Record<string, any>,
    context: WorkflowExecutionContext
  ): Promise<any> {
    // Tool registry dinâmico (lazy import)
    try {
      const { executeTool } = await import('@/lib/ai/tool-registry');
      const args = Object.fromEntries(
        Object.entries(node.toolArgs ?? {}).map(([k, v]) => [
          k,
          this.resolveTemplate(String(v), variables),
        ])
      );
      const result = await executeTool(node.toolName ?? 'unknown', args, context.tenantId);
      return result;
    } catch {
      // Fallback: retorna placeholder
      return { error: `Tool ${node.toolName} não encontrada ou falhou` };
    }
  }

  private static evaluateCondition(
    condition: string,
    variables: Record<string, any>
  ): boolean {
    try {
      const resolved = this.resolveTemplate(condition, variables);
      // Avaliação simples: verifica se resultado é "true" ou "1"
      return resolved === 'true' || resolved === '1';
    } catch {
      return false;
    }
  }

  private static resolveTemplate(
    template: string,
    variables: Record<string, any>
  ): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const parts = path.trim().split('.');
      let value: any = variables;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) return '';
      }
      return String(value ?? '');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LLM CALL LOGGER (LLMOps)
  // ─────────────────────────────────────────────────────────────────────────

  public static async logLLMCall(params: {
    tenantId?: string;
    model: string;
    provider: string;
    promptTokens: number;
    completionTokens: number;
    latencyMs: number;
    costUsd: number;
    success: boolean;
    errorMessage?: string;
    source: string;
    agentId?: string;
    promptHash?: string;
    feedback?: string; // thumbs_up | thumbs_down | null (for LLMOps)
  }): Promise<void> {
    try {
      await (db as any).lLMCallLog?.create({
        data: {
          tenantId: params.tenantId ?? null,
          model: params.model,
          provider: params.provider,
          promptTokens: params.promptTokens,
          completionTokens: params.completionTokens,
          totalTokens: params.promptTokens + params.completionTokens,
          latencyMs: params.latencyMs,
          costUsd: params.costUsd,
          success: params.success,
          errorMessage: params.errorMessage ?? null,
          source: params.source,
          agentId: params.agentId ?? null,
          promptHash: params.promptHash ?? null,
        },
      });
    } catch {
      // Silencioso — não bloqueia execução
    }
  }

  /**
   * Retorna estatísticas de LLM (para ZCC > LLMOps).
   */
  public static async getLLMOpsStats(days = 7): Promise<{
    totalCalls: number;
    successRate: number;
    totalCostUsd: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    byModel: Record<string, { calls: number; costUsd: number; avgLatency: number }>;
    bySource: Record<string, number>;
  }> {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const logs = await (db as any).lLMCallLog?.findMany({
        where: { createdAt: { gte: since } },
        select: {
          model: true,
          provider: true,
          success: true,
          costUsd: true,
          latencyMs: true,
          source: true,
        },
      }) ?? [];

      const total = logs.length;
      const successCount = logs.filter((l: any) => l.success).length;
      const totalCost = logs.reduce((s: number, l: any) => s + (l.costUsd ?? 0), 0);
      const latencies = logs.map((l: any) => l.latencyMs ?? 0).sort((a: number, b: number) => a - b);
      const avgLatency = total > 0 ? latencies.reduce((s: number, l: number) => s + l, 0) / total : 0;
      const p95Index = Math.floor(total * 0.95);
      const p95Latency = latencies[p95Index] ?? 0;

      const byModel: Record<string, any> = {};
      const bySource: Record<string, number> = {};

      for (const log of logs) {
        if (!byModel[log.model]) {
          byModel[log.model] = { calls: 0, costUsd: 0, totalLatency: 0 };
        }
        byModel[log.model].calls++;
        byModel[log.model].costUsd += log.costUsd ?? 0;
        byModel[log.model].totalLatency += log.latencyMs ?? 0;

        bySource[log.source] = (bySource[log.source] ?? 0) + 1;
      }

      // Finaliza avg latency por modelo
      for (const model of Object.keys(byModel)) {
        byModel[model].avgLatency = byModel[model].calls > 0
          ? Math.round(byModel[model].totalLatency / byModel[model].calls)
          : 0;
        delete byModel[model].totalLatency;
      }

      return {
        totalCalls: total,
        successRate: total > 0 ? (successCount / total) * 100 : 0,
        totalCostUsd: totalCost,
        avgLatencyMs: Math.round(avgLatency),
        p95LatencyMs: p95Latency,
        byModel,
        bySource,
      };
    } catch {
      return {
        totalCalls: 0,
        successRate: 0,
        totalCostUsd: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        byModel: {},
        bySource: {},
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}
