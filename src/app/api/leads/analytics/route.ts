// @ts-nocheck — to be fixed in dedicated type refactoring pass
import { NextResponse } from "next/server";
import { leads as mockLeads, computeStats } from "@/lib/zcc/mock-data";
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

/**
 * GET /api/leads/analytics
 * Analytics detalhados: distribuição por UF/região/status, score distribution.
 */
export async function GET(request: Request) {
  // RUN19-A (HYGIENE): anti-flood fail-closed por IP — 60 req/1min (retry com âncoras expandidas).
  const rlDeny = guardRequest(request, 'leads.analytics', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN19-A (HYGIENE): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:leads.analytics', what: 'leads.analytics.entry', resource: 'api', result: 'ALLOW' });
  const stats = computeStats(mockLeads);

  // Score distribution (buckets)
  const scoreBuckets = [
    { range: "0-50", count: 0 },
    { range: "51-70", count: 0 },
    { range: "71-85", count: 0 },
    { range: "86-100", count: 0 },
  ];
  for (const l of mockLeads) {
    if (l.scoreQual <= 50) scoreBuckets[0].count++;
    else if (l.scoreQual <= 70) scoreBuckets[1].count++;
    else if (l.scoreQual <= 85) scoreBuckets[2].count++;
    else scoreBuckets[3].count++;
  }

  // Comportamento de compra
  const porComportamento = new Map<string, number>();
  for (const l of mockLeads) {
    const c = l.comportamentoCompra ?? "—";
    porComportamento.set(c, (porComportamento.get(c) ?? 0) + 1);
  }

  // Validação
  const porValidacao = new Map<string, number>();
  for (const l of mockLeads) {
    porValidacao.set(l.validacao, (porValidacao.get(l.validacao) ?? 0) + 1);
  }

  return NextResponse.json({
    stats,
    scoreBuckets,
    porComportamento: [...porComportamento.entries()].map(([k, v]) => ({
      comportamento: k,
      count: v,
    })),
    porValidacao: [...porValidacao.entries()].map(([k, v]) => ({
      validacao: k,
      count: v,
    })),
  });
}
