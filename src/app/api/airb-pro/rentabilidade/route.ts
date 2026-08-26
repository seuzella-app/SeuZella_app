/**
 * GET /api/airb-pro/rentabilidade?periodo=mes|trimestre|ano
 *
 * Retorna dados de rentabilidade por imóvel: receita, despesas, lucro,
 * margem, ocupação e ADR. Usado pelo RentabilidadePanel no DDC anfitrião.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

async function getHandler(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const {tenantId} = (session.user as any);
  if (!tenantId) {
    return NextResponse.json({ error: 'TENANT_CONTEXT_MISSING' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const periodo = searchParams.get('periodo') || 'mes';

  const now = new Date();
  let startDate: Date;
  if (periodo === 'trimestre') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  } else if (periodo === 'ano') {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  try {
    // Busca imóveis do tenant
    const imoveis: any[] = [];
    if (db && (db as any).airBProperty) {
      const properties = await (db as any).airBProperty.findMany({
        where: { tenantId },
        select: { id: true, title: true },
      });

      for (const prop of properties) {
        // Busca receitas (reservas)
        const reservas = await (db as any).reservation.findMany({
          where: { tenantId, propertyId: prop.id, createdAt: { gte: startDate } },
          select: { totalPrice: true, nights: true },
        }).catch(() => []);

        // Busca despesas
        const despesas = await (db as any).airbExpense.findMany({
          where: { tenantId, propertyId: prop.id, createdAt: { gte: startDate } },
          select: { amount: true },
        }).catch(() => []);

        const receita = reservas?.reduce((s: number, r: any) => s + (r.totalPrice || 0), 0) || 0;
        const despesasTotal = despesas?.reduce((s: number, d: any) => s + (d.amount || 0), 0) || 0;
        const lucro = receita - despesasTotal;
        const margem = receita > 0 ? (lucro / receita) * 100 : 0;
        const totalNoites = reservas?.reduce((s: number, r: any) => s + (r.nights || 1), 0) || 0;
        const diasNoPeriodo = Math.ceil((now.getTime() - startDate.getTime()) / 86400000);
        const ocupacao = diasNoPeriodo > 0 ? (totalNoites / diasNoPeriodo) * 100 : 0;
        const adr = totalNoites > 0 ? receita / totalNoites : 0;

        imoveis.push({
          nome: prop.title || `Imóvel ${prop.id.slice(-6)}`,
          receita,
          despesas: despesasTotal,
          lucro,
          margem,
          ocupacao: Math.min(100, ocupacao),
          adr,
        });
      }
    }

    // Totais
    const totals = imoveis.reduce((acc, i) => ({
      receita: acc.receita + i.receita,
      despesas: acc.despesas + i.despesas,
      lucro: acc.lucro + i.lucro,
      ocupacao: acc.ocupacao + i.ocupacao,
      adr: acc.adr + i.adr,
    }), { receita: 0, despesas: 0, lucro: 0, ocupacao: 0, adr: 0 });

    totals.margem = totals.receita > 0 ? (totals.lucro / totals.receita) * 100 : 0;
    totals.ocupacao = imoveis.length > 0 ? totals.ocupacao / imoveis.length : 0;
    totals.adr = imoveis.length > 0 ? totals.adr / imoveis.length : 0;

    return NextResponse.json({ success: true, data: { imoveis, totals } });
  } catch (err) {
    console.error('[RENTABILIDADE] erro:', err);
    return NextResponse.json({ success: false, error: 'FETCH_FAILED' }, { status: 500 });
  }
}

export const GET = getHandler;
