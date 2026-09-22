/**
 * GET /api/admin/upsell-analytics
 *
 * Retorna Behavioral Analytics consolidado de TODAS as pousadas.
 * 5 métricas por tipo de UPSELL:
 *   - view_count (oferta exibida)
 *   - accept_count (1 clique)
 *   - remove_count (desistiu)
 *   - success_count (virou reserva)
 *   - total_sales_amount (receita total)
 *
 * Calculado a partir dos UpsellRecords de todos os tenants.
 * RBAC: somente ADMIN global.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { calcularBehavioralMetrics } from '@/lib/upsell/upsell-analytics';
import { db } from '@/lib/db';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

async function getHandler(req: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(req, 'admin.upsell-analytics', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:admin.upsell-analytics', what: 'admin.upsell-analytics.entry', resource: 'api', result: 'ALLOW' });
  // RUN 6B (R6B-05b): antes comparava role a 'ADMIN' (uppercase, nunca
  // ocorre) — deny-all com role string morta. Gate canônico do plano ZCC
  // agora autoriza de fato o admin da plataforma.
  const zcc = await verifyZCCAccessOrReject(req);
  if (!zcc.allowed) return zcc.response!;

  try {
    // Lista todos os tipos distintos de UPSELL
    let tipos: string[] = [];
    if (db && (db as any).upsellRecord) {
      const result = await (db as any).upsellRecord.findMany({
        where: { isSandbox: false },
        select: { type: true },
        distinct: ['type'],
      });
      tipos = result.map((r: any) => r.type);
    }

    // Calcula métricas agregadas por tipo
    const por_tipo = [];
    for (const type of tipos) {
      // Busca agregado de TODOS os tenants (usa tenantId vazio para pegar tudo)
      const allRecords = await (db as any).upsellRecord.findMany({
        where: { type, isSandbox: false },
        select: {
          viewCount: true,
          acceptCount: true,
          removeCount: true,
          successCount: true,
          totalSalesAmount: true,
        },
      });

      const view_count = allRecords.reduce((s: number, r: any) => s + (r.viewCount || 0), 0);
      const accept_count = allRecords.reduce((s: number, r: any) => s + (r.acceptCount || 0), 0);
      const remove_count = allRecords.reduce((s: number, r: any) => s + (r.removeCount || 0), 0);
      const success_count = allRecords.reduce((s: number, r: any) => s + (r.successCount || 0), 0);
      const total_sales_amount = allRecords.reduce((s: number, r: any) => s + (r.totalSalesAmount || 0), 0);
      const average_ticket = success_count > 0 ? total_sales_amount / success_count : 0;

      por_tipo.push({
        type,
        view_count,
        accept_count,
        remove_count,
        success_count,
        total_sales_amount: Number(total_sales_amount.toFixed(2)),
        average_ticket: Number(average_ticket.toFixed(2)),
      });
    }

    // Ordena por success_count (maior primeiro)
    por_tipo.sort((a, b) => b.success_count - a.success_count);

    // Totais
    const totais = {
      view_count: por_tipo.reduce((s, t) => s + t.view_count, 0),
      accept_count: por_tipo.reduce((s, t) => s + t.accept_count, 0),
      remove_count: por_tipo.reduce((s, t) => s + t.remove_count, 0),
      success_count: por_tipo.reduce((s, t) => s + t.success_count, 0),
      total_sales_amount: por_tipo.reduce((s, t) => s + t.total_sales_amount, 0),
      conversion_rate:
        por_tipo.reduce((s, t) => s + t.view_count, 0) > 0
          ? Number(((por_tipo.reduce((s, t) => s + t.success_count, 0) /
              por_tipo.reduce((s, t) => s + t.view_count, 0)) * 100).toFixed(2))
          : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        por_tipo,
        totais,
      },
    });
  } catch (err: any) {
    console.error('[UPSSELL_ANALYTICS] erro:', err);
    return NextResponse.json(
      { error: 'ANALYTICS_ERROR', message: err.message },
      { status: 500 },
    );
  }
}

export const GET = getHandler;
