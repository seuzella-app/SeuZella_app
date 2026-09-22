import { NextResponse } from "next/server";
import type { BrainHealthResponse, RouterProvider } from "@/lib/zcc/types";
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

/**
 * GET /api/zcc/brain
 *
 * Em produção: query Prisma real
 *   const providers = await db.routerProvider.findMany({ where: { isActive: true } });
 *   const budget = await db.budgetGuardState.findFirst({ orderBy: { date: 'desc' } });
 *   const costLogs = await db.costLog.findMany({ where: { createdAt: { gte: today } } });
 *
 * Retorna dados para o Cérebro Zélla:
 *   - RouterProviders com Thompson Sampling (alpha/beta/circuitStatus)
 *   - BudgetGuardState (daily/monthly spend vs budget)
 *   - Learning metrics (patterns, anti-patterns, sentiment)
 */

const MOCK_PROVIDERS: RouterProvider[] = [
  {
    id: "p1", provider: "zai_sdk", modelName: "GLM-4.7-Flash", tier: "1",
    alpha: 847, beta: 23, circuitStatus: "closed",
    lastFailureAt: null, failureCount: 2, successCount: 845,
    avgLatencyMs: 124, costPer1kInput: 0.10, costPer1kOutput: 0.20,
    isActive: true, supportsJson: true, supportsTools: true, maxContextTokens: 32768,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "p2", provider: "zai_sdk", modelName: "GLM-4.7", tier: "2",
    alpha: 412, beta: 18, circuitStatus: "closed",
    lastFailureAt: null, failureCount: 5, successCount: 407,
    avgLatencyMs: 342, costPer1kInput: 0.50, costPer1kOutput: 1.00,
    isActive: true, supportsJson: true, supportsTools: true, maxContextTokens: 65536,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "p3", provider: "groq", modelName: "Groq Llama 3 70B", tier: "1",
    alpha: 623, beta: 31, circuitStatus: "closed",
    lastFailureAt: null, failureCount: 8, successCount: 615,
    avgLatencyMs: 89, costPer1kInput: 0.10, costPer1kOutput: 0.20,
    isActive: true, supportsJson: true, supportsTools: false, maxContextTokens: 8192,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "p4", provider: "gemini", modelName: "Gemini 1.5 Flash", tier: "1",
    alpha: 389, beta: 27, circuitStatus: "closed",
    lastFailureAt: null, failureCount: 12, successCount: 377,
    avgLatencyMs: 156, costPer1kInput: 0.15, costPer1kOutput: 0.30,
    isActive: true, supportsJson: true, supportsTools: true, maxContextTokens: 1000000,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "p5", provider: "openrouter", modelName: "DeepSeek V3", tier: "2",
    alpha: 187, beta: 21, circuitStatus: "half_open",
    lastFailureAt: new Date(Date.now() - 3600000).toISOString(),
    failureCount: 18, successCount: 169,
    avgLatencyMs: 412, costPer1kInput: 0.27, costPer1kOutput: 1.10,
    isActive: true, supportsJson: true, supportsTools: false, maxContextTokens: 16384,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "p6", provider: "openrouter", modelName: "OpenAI GPT-4o-mini", tier: "1",
    alpha: 298, beta: 15, circuitStatus: "closed",
    lastFailureAt: null, failureCount: 3, successCount: 295,
    avgLatencyMs: 287, costPer1kInput: 0.15, costPer1kOutput: 0.60,
    isActive: true, supportsJson: true, supportsTools: true, maxContextTokens: 16384,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "p7", provider: "anthropic", modelName: "Claude 3.5 Sonnet", tier: "3",
    alpha: 145, beta: 9, circuitStatus: "closed",
    lastFailureAt: null, failureCount: 1, successCount: 144,
    avgLatencyMs: 567, costPer1kInput: 3.00, costPer1kOutput: 15.00,
    isActive: true, supportsJson: true, supportsTools: true, maxContextTokens: 200000,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

const MOCK_RESPONSE: BrainHealthResponse = {
  status: "ok",
  service: "ZaosNeuroRouter",
  version: "2.0.1",
  engine: "Thompson + Pareto + SemanticCache",
  budget: {
    spentToday: 2.47,
    dailyLimit: 10.0,
    monthlySpend: 48.32,
    monthlyLimit: 300.0,
    criticalLevel: "nominal",
  },
  cache: {
    hitRate: 78.3,
    totalEntries: 247,
    avgTtlMinutes: 45.2,
  },
  circuitBreakers: Object.fromEntries(
    MOCK_PROVIDERS.map((p) => [p.modelName, p.circuitStatus])
  ),
  providers: MOCK_PROVIDERS,
  learning: {
    totalPatterns: 1247,
    verifiedPatterns: 892,
    antiPatternsCount: 73,
    learningVelocity: 12,
    avgSentimentScore: 0.34,
  },
};

export async function GET(request: Request) {
  // RUN19-A (HYGIENE): anti-flood fail-closed por IP — 60 req/1min (retry com âncoras expandidas).
  const rlDeny = guardRequest(request, 'zcc.brain', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN19-A (HYGIENE): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.brain', what: 'zcc.brain.entry', resource: 'api', result: 'ALLOW' });
  return NextResponse.json({
    success: true,
    data: MOCK_RESPONSE,
    meta: {
      source: "demo",
      timestamp: new Date().toISOString(),
      note: "RouterProvider + BudgetGuardState alinhado com Prisma schema.",
    },
  });
}
