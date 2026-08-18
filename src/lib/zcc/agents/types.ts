// =============================================================================
// ZCC AGENT RUNTIME — Tipos compartilhados
// =============================================================================
// Inspirado no architecture "larp-first, real-ready" do FounderOS, adaptado
// para a realidade multi-tenant do Zélla.
//
// Cada agente tem:
//   - id único (slug)
//   - name + description
//   - department (Sales/Marketing/Finance/Operations/Tech/Comms)
//   - run() que executa trabalho REAL contra connectors
//   - respond()? que atende broadcast do Conductor
//   - chatTools()? que expõe tools para o LLM usar durante chat
//
// O LLM embarcado é o z-ai-web-dev-sdk (GLM-4.7-flash por padrão,
// GLM-4.7 para agentes que exigem raciocínio mais profundo).
// =============================================================================

import type { z } from 'zod';

// ── Status do agente ────────────────────────────────────────────────────────

export type AgentStatus = 'active' | 'idle' | 'training' | 'planned';
export type AgentTier = 'lead' | 'specialist' | 'worker';

export type AgentDepartment =
  | 'command'
  | 'sales'
  | 'marketing'
  | 'finance'
  | 'operations'
  | 'tech'
  | 'comms';

// ── Modelo LLM a usar (roteia para o custo certo) ───────────────────────────

export type LlmModel = 'glm-4.7-flash' | 'glm-4.7' | 'glm-5.2';

export const MODEL_BY_PURPOSE: Record<string, LlmModel> = {
  routing: 'glm-4.7-flash',        // Conductor — alto volume, baixa complexidade
  retrieval: 'glm-4.7-flash',      // Data Agent — retrieve + sumarize
  analysis: 'glm-4.7',             // Finance/Cerebro — exige raciocínio
  scoring: 'glm-4.7-flash',        // Leads Agent — classificação
  summary: 'glm-4.7-flash',        // Comms Agent — sumarização
  decision: 'glm-4.7-flash',       // Operations — decisão binária
  code: 'glm-4.7',                 // Refactor — código exige raciocínio
  reasoning: 'glm-4.7',            // Cérebro anomalias
};

// ── Tool definition (Function Calling) ──────────────────────────────────────

export type LlmToolSpec = {
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
};

export type LlmToolCall = { name: string; args: unknown; result: unknown };

// ── Mensagens para o LLM ────────────────────────────────────────────────────

export type LlmRole = 'system' | 'user' | 'assistant' | 'tool';
export type LlmMessage = { role: LlmRole; content: string };

// ── Resultado de uma execução de agente ─────────────────────────────────────

export type AgentRunResult = {
  ok: boolean;
  summary: string;
  data?: unknown;
  /** Quando o run chamou LLM: usage para pricing */
  model?: LlmModel;
  tokensIn?: number;
  tokensOut?: number;
  /** Latência total em ms (para observabilidade) */
  durationMs?: number;
};

// ── O agente runtime ────────────────────────────────────────────────────────

export interface RuntimeAgent {
  id: string;
  name: string;
  description: string;
  department: AgentDepartment;
  tier: AgentTier;
  /** Modelo padrão para esse agente */
  defaultModel: LlmModel;
  /** Emoji/icone para UI (lucide name) */
  icon: string;
  /** Executa o trabalho principal do agente contra connectors */
  run(ctx: AgentRunContext): Promise<AgentRunResult>;
  /** Atende broadcast do Conductor (opcional) */
  respond?(message: string, ctx: AgentRunContext): Promise<AgentRunResult>;
  /** Tools que o LLM pode chamar durante chat (opcional) */
  chatTools?(ctx: AgentRunContext): LlmToolSpec[];
}

// ── Contexto multi-tenant ───────────────────────────────────────────────────

export interface AgentRunContext {
  tenantId: string;
  /** Indica se está rodando em Vercel serverless (sem SQLite local) */
  isServerless: boolean;
  /** Indica se DB está disponível (mock mode detection) */
  dbAvailable: boolean;
  /** Locale para respostas (default pt-BR) */
  locale?: string;
  /** Request ID para tracing */
  requestId?: string;
}

// ── Run persistido (espelha AirbReport pattern) ─────────────────────────────

export type AgentRun = {
  id: string;
  agentId: string;
  tenantId: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  summary: string;
  model: LlmModel | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  durationMs: number | null;
};

// ── Broadcast (falar com todos de uma vez) ──────────────────────────────────

export type BroadcastReply = {
  id: string;
  broadcastId: string;
  agentId: string;
  ok: boolean;
  reply: string;
  finishedAt: string;
};

export type Broadcast = {
  id: string;
  tenantId: string;
  message: string;
  createdAt: string;
  replies: BroadcastReply[];
};

// ── Conductor routing result ────────────────────────────────────────────────

export type ConductorResult = {
  routedTo: string;
  agentName: string;
  text: string;
  toolCalls: LlmToolCall[];
  model: LlmModel;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
};

// ── Pricing tabela (USD por 1M tokens, valores Jun/2026) ────────────────────

export const LLM_PRICING_USD_PER_1M: Record<LlmModel, { input: number; output: number }> = {
  'glm-4.7-flash': { input: 0.10, output: 0.20 },
  'glm-4.7':       { input: 0.50, output: 1.00 },
  'glm-5.2':       { input: 1.50, output: 3.00 },
};

export function runCostUsd(tokensIn: number, tokensOut: number, model?: LlmModel | null): number | null {
  if (!model) return null;
  const p = LLM_PRICING_USD_PER_1M[model];
  return (tokensIn / 1_000_000) * p.input + (tokensOut / 1_000_000) * p.output;
}
