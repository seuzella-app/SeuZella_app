/**
 * GET /api/airb-pro/comparativo
 *
 * Retorna comparativo de performance entre imóveis: receita, despesas,
 * lucro, ocupação, ADR e RevPAR. Usado pelo ComparativoPanel no DDC.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

async function getHandler(_req: NextRequest) {
  // RUN13-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(_req, 'airb-pro.comparativo', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN13-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:airb-pro.comparativo', what: 'airb-pro.comparativo.entry', resource: 'api', result: 'ALLOW' });
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const {tenantId} = (session.user as any);
  if (!tenantId) {
    return NextResponse.json({ error: 'TENANT_CONTEXT_MISSING' }, { status: 400 });
  }

  try {
    const imoveis: any[] = [];

    if (db && (db as any).airBProperty) {
      const properties = await (db as any).airBProperty.findMany({
        where: { tenantId },
        select: { id: true, title: true },
      });

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);

      for (const prop of properties) {
        const reservas = await (db as any).reservation.findMany({
          where: { tenantId, propertyId: prop.id, createdAt: { gte: startDate } },
          select: { totalPrice: true, nights: true },
        }).catch(() => []);

        const despesas = await (db as any).airbExpense.findMany({
          where: { tenantId, propertyId: prop.id, createdAt: { gte: startDate } },
          select: { amount: true },
        }).catch(() => []);

        const receita = reservas?.reduce((s: number, r: any) => s + (r.totalPrice || 0), 0) || 0;
        const despesasTotal = despesas?.reduce((s: number, d: any) => s + (d.amount || 0), 0) || 0;
        const lucro = receita - despesasTotal;
        const totalNoites = reservas?.reduce((s: number, r: any) => s + (r.nights || 1), 0) || 0;
        const diasNoPeriodo = Math.ceil((now.getTime() - startDate.getTime()) / 86400000);
        const ocupacao = diasNoPeriodo > 0 ? Math.min(100, (totalNoites / diasNoPeriodo) * 100) : 0;
        const adr = totalNoites > 0 ? receita / totalNoites : 0;
        const revpar = diasNoPeriodo > 0 ? receita / diasNoPeriodo : 0;

        imoveis.push({
          nome: prop.title || `Imóvel ${prop.id.slice(-6)}`,
          receita,
          despesas: despesasTotal,
          lucro,
          ocupacao,
          adr,
          revpar,
        });
      }
    }

    return NextResponse.json({ success: true, data: imoveis });
  } catch (err) {
    console.error('[COMPARATIVO] erro:', err);
    return NextResponse.json({ success: false, error: 'FETCH_FAILED' }, { status: 500 });
  }
}

export const GET = getHandler;
