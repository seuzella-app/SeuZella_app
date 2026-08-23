// =============================================================================
// ZCC AGENT RUNTIME — Registry + executor
// =============================================================================
// Cria o registry singleton com os 12 agentes, expõe run/broadcast/conductor.
// =============================================================================

import { randomUUID } from 'node:crypto';
import { isDatabaseAvailable } from '@/lib/db';
import { realAgents } from './real';
import { conductorRoute } from './real';
import { runCostUsd, type AgentRun, type AgentRunContext, type AgentRunResult, type Broadcast, type BroadcastReply, type RuntimeAgent } from './types';

// ── Helper: contexto multi-tenant ───────────────────────────────────────────

export async function buildRunContext(tenantId: string): Promise<AgentRunContext> {
  const isServerless = !!(process.env.VERCEL || process.env.VERCEL_ENV);
  const dbAvailable = await isDatabaseAvailable().catch(() => false);
  return {
    tenantId,
    isServerless,
    dbAvailable,
    locale: 'pt-BR',
    requestId: randomUUID(),
  };
}

// ── Registry ────────────────────────────────────────────────────────────────

const registry = new Map<string, RuntimeAgent>(realAgents.map(a => [a.id, a]));

export function listAgents(): RuntimeAgent[] {
  return [...registry.values()];
}

export function getAgent(id: string): RuntimeAgent | undefined {
  return registry.get(id);
}

// ── Run single agent ────────────────────────────────────────────────────────

export async function runAgent(id: string, ctx: AgentRunContext): Promise<AgentRun> {
  const agent = registry.get(id);
  if (!agent) throw new Error(`unknown agent: ${id}`);

  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  let result: AgentRunResult;

  try {
    result = await agent.run(ctx);
  } catch (err) {
    result = {
      ok: false,
      summary: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startMs,
    };
  }

  const priced = result.tokensIn != null || result.tokensOut != null;
  const run: AgentRun = {
    id: randomUUID(),
    agentId: id,
    tenantId: ctx.tenantId,
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: result.ok,
    summary: result.summary,
    model: result.model ?? null,
    tokensIn: result.tokensIn ?? null,
    tokensOut: result.tokensOut ?? null,
    costUsd: priced ? runCostUsd(result.tokensIn ?? 0, result.tokensOut ?? 0, result.model) : null,
    durationMs: result.durationMs ?? null,
  };

  // Persistência opcional em DB poderia ir aqui (reusa AirbReport ou novo model).
  // Por ora, mantemos em memória apenas — caller pode logar/console.
  // Quando criarmos um model AgentRun dedicado, reativamos a persistência.

  return run;
}

// ── Broadcast: fala com todos os agentes ────────────────────────────────────

export async function broadcastMessage(message: string, ctx: AgentRunContext): Promise<Broadcast> {
  const broadcastId = randomUUID();
  const createdAt = new Date().toISOString();

  const replies = await Promise.all(
    listAgents()
      .filter(a => a.id !== 'conductor' && a.respond)
      .map(async (agent) => {
        let result: AgentRunResult;
        try {
          result = await agent.respond!(message, ctx);
        } catch (err) {
          result = {
            ok: false,
            summary: err instanceof Error ? err.message : String(err),
          };
        }
        const reply: BroadcastReply = {
          id: randomUUID(),
          broadcastId,
          agentId: agent.id,
          ok: result.ok,
          reply: result.summary,
          finishedAt: new Date().toISOString(),
        };
        return reply;
      }),
  );

  return {
    id: broadcastId,
    tenantId: ctx.tenantId,
    message,
    createdAt,
    replies,
  };
}

// ── Conductor route ─────────────────────────────────────────────────────────

export async function routeConductor(message: string, ctx: AgentRunContext): Promise<AgentRunResult> {
  return conductorRoute(message, ctx);
}

// ── Mock mode helper (para UI funcionar em serverless sem DB) ───────────────

export function isAgentMockMode(ctx: AgentRunContext): boolean {
  return ctx.isServerless && !ctx.dbAvailable;
}
