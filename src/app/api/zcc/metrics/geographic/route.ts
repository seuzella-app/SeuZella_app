import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { leads as mockLeads, computeStats } from '@/lib/zcc/mock-data';

// ═══════════════════════════════════════════════════════════════
// ZCC GEOGRAPHIC METRICS — Distribuição geográfica dos leads
//
// CONEXÃO COM LIVE LEADS:
//  - Mesma fonte de dados que LiveLeadsPanel (mock-data.ts)
//  - computeStats() gera agregados por UF/região/status
//  - Em produção (DB disponível): consulta Prisma Lead com groupBy por state
//
// CONEXÕES PRISMA:
//  - Lead → state, city, scoreValid → contagem + MRR estimado
//  - Tenant.property → state, city → contagem pousada/airbnb
//  - Property (pousada) + AirBProperty (airbnb) → distribuição por UF
// ═══════════════════════════════════════════════════════════════

// Mapa UF → Nome do estado
const UF_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins',
};

// Estima MRR por lead convertido (com base no plano sugerido pelo score)
function estimateMrrByScore(score: number): number {
  if (score >= 90) return 797; // MAX
  if (score >= 80) return 397; // PRO
  if (score >= 70) return 247; // PARCEIRO
  if (score >= 50) return 197; // LITE
  return 0;
}

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const dbOk = await isDatabaseAvailable();

    // ── SEMPRE usa leads do mock-data (mesma fonte do LiveLeadsPanel) ──
    // Em produção, complementa com dados do DB se disponível
    const liveLeads = mockLeads;

    // Agrega leads por UF (cidades + contagens + MRR estimado)
    const byUfMap = new Map<
      string,
      {
        uf: string;
        name: string;
        pousadas: number;
        airbnb: number;
        mrr: number;
        leads: number;
        convertedLeads: number;
        hotLeads: number;
        avgScore: number;
        growth: number;
        cities: Map<string, {
          name: string;
          pousadas: number;
          airbnb: number;
          mrr: number;
          leads: number;
        }>;
      }
    >();

    for (const lead of liveLeads as any[]) {
      const uf = lead.uf || 'XX';
      const city = lead.cidade || lead.localPraia || 'Desconhecida';
      const score = lead.avgScore ?? lead.scoreValid ?? 0;
      const isConverted = lead.status === 'convertido';
      const isHot = (lead.avgScore ?? lead.scoreValid ?? 0) >= 85;

      // Estimate MRR (se convertido, soma plano estimado pelo score)
      const leadMrr = isConverted ? estimateMrrByScore(score) : 0;

      if (!byUfMap.has(uf)) {
        byUfMap.set(uf, {
          uf,
          name: UF_NAMES[uf] ?? uf,
          pousadas: 0,
          airbnb: 0,
          mrr: 0,
          leads: 0,
          convertedLeads: 0,
          hotLeads: 0,
          avgScore: 0,
          growth: 0,
          cities: new Map(),
        });
      }

      const state = byUfMap.get(uf)!;
      state.leads++;
      state.mrr += leadMrr;
      if (isConverted) state.convertedLeads++;
      if (isHot) state.hotLeads++;
      state.avgScore += score;

      // Determina niche (padrão: pousada, mas se comportamento="Moderno" ou "Elite" em cidade litorânea → airbnb)
      const niche = lead.comportamentoCompra === 'Moderno' && (lead.localPraia || '').length > 0
        ? 'airbnb'
        : 'pousada';
      if (niche === 'pousada') state.pousadas++;
      else state.airbnb++;

      // Cidade
      if (!state.cities.has(city)) {
        state.cities.set(city, {
          name: city,
          pousadas: 0,
          airbnb: 0,
          mrr: 0,
          leads: 0,
        });
      }
      const cityData = state.cities.get(city)!;
      cityData.leads++;
      cityData.mrr += leadMrr;
      if (niche === 'pousada') cityData.pousadas++;
      else cityData.airbnb++;
    }

    // Calcula growth (mock: baseado em conversões quentes) e finaliza avgScore
    const states = [...byUfMap.values()].map((s) => ({
      ...s,
      avgScore: s.leads > 0 ? Math.round(s.avgScore / s.leads) : 0,
      growth: s.convertedLeads > 0 ? Math.round((s.hotLeads / s.leads) * 100 * 10) / 10 : 0,
      cities: [...s.cities.values()]
        .sort((a, b) => b.mrr - a.mrr || b.leads - a.leads)
        .map((c) => ({
          name: c.name,
          pousadas: c.pousadas,
          airbnb: c.airbnb,
          mrr: c.mrr,
          leads: c.leads,
        })),
    }));

    states.sort((a, b) => b.mrr - a.mrr || b.leads - a.leads);

    const totals = {
      states: states.length,
      pousadas: states.reduce((s, st) => s + st.pousadas, 0),
      airbnb: states.reduce((s, st) => s + st.airbnb, 0),
      mrr: states.reduce((s, st) => s + st.mrr, 0),
      leads: states.reduce((s, st) => s + st.leads, 0),
      convertedLeads: states.reduce((s, st) => s + st.convertedLeads, 0),
      hotLeads: states.reduce((s, st) => s + st.hotLeads, 0),
    };

    // ── Complementa com dados do DB se disponível ─────────────────
    const dbTenantsByState: Record<string, { pousada: number; airbnb: number; mrr: number }> = {};
    if (dbOk) {
      try {
        // Conta tenants ativos por UF + plano
        const tenants = await db.tenant.findMany({
          where: { status: 'active' },
          select: {
            plan: true,
            property: {
              select: { type: true, state: true },
            },
            airbSubscriptions: {
              where: { status: 'active' },
              select: { amount: true },
            },
            subscriptions: {
              where: { status: 'active' },
              select: { amount: true },
            },
          },
        });

        for (const t of tenants) {
          const uf = t.property?.state || 'XX';
          if (!dbTenantsByState[uf]) {
            dbTenantsByState[uf] = { pousada: 0, airbnb: 0, mrr: 0 };
          }
          const isAirbnb = t.property?.type === 'airbnb' || t.airbSubscriptions.length > 0;
          if (isAirbnb) dbTenantsByState[uf].airbnb++;
          else dbTenantsByState[uf].pousada++;

          let amount = 0;
          if (t.subscriptions.length > 0) amount = t.subscriptions[0].amount;
          else if (t.airbSubscriptions.length > 0) amount = t.airbSubscriptions[0].amount;
          dbTenantsByState[uf].mrr += amount;
        }
      } catch {
        // ignore DB errors — keep mock data
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        // Top 10 estados por MRR
        states: states.slice(0, 10),
        totals,
        // Distribuição pousada vs airbnb (para barras split)
        pousadaByState: states.map((s) => ({ state: s.uf, count: s.pousadas })),
        airbnbByState: states.map((s) => ({ state: s.uf, count: s.airbnb })),
        mrrByState: Object.fromEntries(
          states.map((s) => [
            s.uf,
            { pousada: s.pousadas * 397, airbnb: s.airbnb * 797, total: s.mrr },
          ])
        ),
        // Conexão com Live Leads
        sourceLeadsCount: liveLeads.length,
        sourceNote: 'Dados agregados da mesma fonte do LiveLeadsPanel (mock-data.ts) + Tenants ativos do Prisma',
        dbTenantsByState,
      },
      meta: {
        source: dbOk ? 'db+mock' : 'mock',
        liveLeadsCount: liveLeads.length,
      },
    });
  } catch (error) {
    console.error('[ZCC Geographic Metrics] Error:', error);

    // Fallback usando apenas stats do mock-data
    const stats = computeStats(mockLeads);

    return NextResponse.json({
      success: true,
      data: {
        states: [],
        totals: {
          states: stats.porUf.length,
          pousadas: 0,
          airbnb: 0,
          mrr: 0,
          leads: stats.total,
          convertedLeads: stats.porStatus.find((s) => s.status === 'convertido')?.count ?? 0,
          hotLeads: mockLeads.filter((l) => (l.avgScore ?? l.scoreValid) >= 85).length,
        },
        pousadaByState: stats.porUf.map((s) => ({ state: s.uf, count: s.count })),
        airbnbByState: [],
        mrrByState: {},
        sourceLeadsCount: mockLeads.length,
        sourceNote: 'Fallback após erro',
      },
      meta: { source: 'fallback' },
    });
  }
}
