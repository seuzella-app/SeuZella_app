'use client';

// =============================================================================
// FINANCEIRO INTEGRADO — módulo financeiro completo do ZCC
// =============================================================================
// Combina em uma única tela:
//   1. Fluxo de Caixa (Receitas vs Custos vs Líquido)
//   2. MRR por Plano (TRIAL, LITE, PRO, MAX, PARCEIRO)
//   3. Projeção 6 meses (cashflow forecast)
//   4. Custos API (WhatsApp por tenant + LLM tokens)
//   5. Integração DDC — link direto para /ddc/pousada e /ddc/airbnb
//
// Hidrata via APIs existentes:
//   - /api/zcc/metrics/financial (MRR, ARPU, churn, planBreakdown)
//   - /api/zcc/burn-rate (custos WhatsApp por tenant)
//   - /api/zcc/metrics (overview)
// =============================================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpRight,
  Building2, Home, Crown, Shield, PieChart, Flame,
  ExternalLink, AlertCircle,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface PlanRow {
  plan: string;
  count: number;
  mrr: number;
  price: number;
  ratio: string;
}

interface MonthForecast {
  month: string;
  value: number;
  positive: boolean;
}

interface BurnRow {
  tenant: string;
  niche: 'pousada' | 'airbnb';
  plan: string;
  whatsappCost: number;
  llmCost: number;
  total: number;
}

interface FinancialData {
  totalMRR: number;
  arpu: number;
  churnRate: number;
  planBreakdown: PlanRow[];
  forecast: MonthForecast[];
  burn: BurnRow[];
  source: 'api' | 'demo';
}

// ── Static fallback ─────────────────────────────────────────────────────────

const FALLBACK: FinancialData = {
  totalMRR: 18450,
  arpu: 147,
  churnRate: 0.8,
  source: 'demo',
  planBreakdown: [
    { plan: 'TRIAL', count: 8, mrr: 0, price: 0, ratio: '0%' },
    { plan: 'LITE', count: 24, mrr: 2328, price: 97, ratio: '12.6%' },
    { plan: 'PRO', count: 48, mrr: 4656, price: 97, ratio: '25.2%' },
    { plan: 'MAX', count: 32, mrr: 3104, price: 97, ratio: '16.8%' },
    { plan: 'PARCEIRO', count: 18, mrr: 846, price: 47, ratio: '4.6%' },
  ],
  forecast: [
    { month: 'SET', value: 18450, positive: true },
    { month: 'OUT', value: 21200, positive: true },
    { month: 'NOV', value: 24800, positive: true },
    { month: 'DEZ', value: 31500, positive: true },
    { month: 'JAN', value: 38900, positive: true },
    { month: 'FEV', value: 45200, positive: true },
  ],
  burn: [
    { tenant: 'Pousada Maravilha', niche: 'pousada', plan: 'PRO', whatsappCost: 48.50, llmCost: 18.20, total: 66.70 },
    { tenant: 'Villa Geribá Búzios', niche: 'airbnb', plan: 'MAX', whatsappCost: 32.10, llmCost: 12.40, total: 44.50 },
    { tenant: 'Pousada Vila Floripa', niche: 'pousada', plan: 'PRO', whatsappCost: 29.80, llmCost: 9.60, total: 39.40 },
  ],
};

const PLAN_ICONS: Record<string, React.ElementType> = {
  TRIAL: PieChart,
  LITE: Building2,
  PRO: TrendingUp,
  MAX: Crown,
  PARCEIRO: Shield,
};

// ── Format helpers ──────────────────────────────────────────────────────────

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

// ── Component ───────────────────────────────────────────────────────────────

export function FinanceiroIntegrado() {
  const [data, setData] = useState<FinancialData>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function hydrate() {
      try {
        const [finRes, burnRes] = await Promise.all([
          fetch('/api/zcc/metrics/financial'),
          fetch('/api/zcc/burn-rate'),
        ]);

        const next: FinancialData = { ...FALLBACK };

        if (finRes.ok) {
          const json = await finRes.json();
          if (json.data) {
            const d = json.data;
            next.totalMRR = d.totalMRR ?? 0;
            next.arpu = d.arpu ?? 0;
            next.churnRate = d.churnRate ?? 0;
            next.source = json.meta?.source === 'demo' ? 'demo' : 'api';

            if (d.planBreakdown) {
              next.planBreakdown = Object.entries(d.planBreakdown).map(([plan, info]: [string, any]) => {
                const priceMap: Record<string, number> = { TRIAL: 0, LITE: 197, PRO: 397, MAX: 797, PARCEIRO: 247 };
                const price = priceMap[plan] ?? 0;
                const ratio = next.totalMRR > 0 ? (info.mrr / next.totalMRR) * 100 : 0;
                return {
                  plan,
                  count: info.count ?? 0,
                  mrr: info.mrr ?? 0,
                  price,
                  ratio: `${ratio.toFixed(1)}%`,
                };
              });
            }
          }
        }

        if (burnRes.ok) {
          const json = await burnRes.json();
          if (Array.isArray(json.tenants)) {
            next.burn = json.tenants.slice(0, 6).map((t: any) => ({
              tenant: t.name,
              niche: t.niche,
              plan: t.plan,
              whatsappCost: t.whatsappCostMonth ?? 0,
              llmCost: (t.tokensOut ?? 0) * 0.00002,
              total: (t.whatsappCostMonth ?? 0) + (t.tokensOut ?? 0) * 0.00002,
            }));
          }
        }

        // Forecast — simple linear projection based on current MRR
        const baseMRR = next.totalMRR || 0;
        const monthlyGrowth = 0.10; // 10% MoM assumption
        const monthLabels = ['SET', 'OUT', 'NOV', 'DEZ', 'JAN', 'FEV'];
        let cumulative = baseMRR;
        const totalCost = next.burn.reduce((s, b) => s + b.total, 0);
        next.forecast = monthLabels.map((month) => {
          cumulative = cumulative * (1 + monthlyGrowth);
          const net = cumulative - totalCost;
          return { month, value: net, positive: net >= 0 };
        });

        setData(next);
      } catch {
        /* keep fallback */
      } finally {
        setLoading(false);
      }
    }
    hydrate();
    const interval = setInterval(hydrate, 60000);
    return () => clearInterval(interval);
  }, []);

  const totalBurn = data.burn.reduce((s, b) => s + b.total, 0);
  const net = data.totalMRR - totalBurn;
  const maxBurn = Math.max(...data.burn.map(b => b.total), 1);

  return (
    <div className="operator-console">
      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <section>
        <div className="section-h">
          <span className="title">
            <DollarSign size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            FINANCEIRO INTEGRADO · VISÃO 360°
          </span>
          <span className={`monolith-tag ${data.source === 'api' ? 'ok' : 'warn'}`}>
            {data.source === 'api' ? 'LIVE' : 'DEMO'}
          </span>
        </div>

        {/* ─── 1. FLUXO DE CAIXA ────────────────────────────────────── */}
        <div className="fin-flow">
          <div className="row in">
            <span className="label">RECEITAS (MRR total)</span>
            <span className="value">{fmtBRL(data.totalMRR)}</span>
            <div className="bar" style={{ ['--w' as any]: '100%' }} />
          </div>
          <div className="row out">
            <span className="label">CUSTOS API (WhatsApp + LLM)</span>
            <span className="value">−{fmtBRL(totalBurn)}</span>
            <div className="bar" style={{ ['--w' as any]: `${(totalBurn / Math.max(data.totalMRR, 1)) * 100}%` }} />
          </div>
          <div className="row net">
            <span className="label">LÍQUIDO MENSAL</span>
            <span className="value">{net >= 0 ? '+' : '−'}{fmtBRL(Math.abs(net))}</span>
            <div className="bar" style={{ ['--w' as any]: `${(Math.abs(net) / Math.max(data.totalMRR, 1)) * 100}%` }} />
          </div>
        </div>
      </section>

      {/* ─── MRR POR PLANO + ARPU/CHURN ─────────────────────────────── */}
      <section>
        <div className="section-h">
          <span className="title">MRR POR PLANO · BREAKDOWN</span>
          <span className="meta">ARPU {fmtBRL(data.arpu)} · CHURN {fmtPct(data.churnRate)}</span>
        </div>

        <div className="fin-plans">
          <div className="head">PLANO</div>
          <div className="head">CLIENTES</div>
          <div className="head">MRR</div>
          <div className="head">% TOTAL</div>

          {data.planBreakdown.map((row) => {
            const Icon = PLAN_ICONS[row.plan] ?? PieChart;
            return (
              <>
                <div className="row plan" key={`${row.plan}-name`}>
                  <Icon size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                  {row.plan}
                  <span style={{ color: 'var(--text-3)', marginLeft: 6, fontSize: 9 }}>
                    {fmtBRL(row.price)}/mês
                  </span>
                </div>
                <div className="row count" key={`${row.plan}-count`}>{row.count}</div>
                <div className="row mrr" key={`${row.plan}-mrr`}>{fmtBRL(row.mrr)}</div>
                <div className="row ratio" key={`${row.plan}-ratio`}>{row.ratio}</div>
              </>
            );
          })}
        </div>
      </section>

      {/* ─── CUSTOS API POR TENANT ──────────────────────────────────── */}
      <section>
        <div className="section-h">
          <span className="title">
            <Flame size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            CUSTOS API · TOP TENANTS
          </span>
          <span className="meta">
            TOTAL: {fmtBRL(totalBurn)}/mês · {data.burn.length} TENANTS
          </span>
        </div>

        {data.burn.length === 0 ? (
          <div style={{
            padding: 20,
            textAlign: 'center',
            color: 'var(--text-3)',
            fontSize: 11,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}>
            <AlertCircle size={20} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>Sem dados de custos API disponíveis.</div>
            <div style={{ marginTop: 4, fontSize: 10 }}>
              Custos aparecerão aqui quando tenants começarem a usar WhatsApp + LLM.
            </div>
          </div>
        ) : (
          <div className="fin-plans">
            <div className="head">TENANT</div>
            <div className="head">NICHE</div>
            <div className="head">WHATSAPP</div>
            <div className="head">TOTAL</div>

            {data.burn.map((b, i) => (
              <>
                <div className="row plan" key={`burn-${i}-name`}>
                  {b.tenant}
                  <span style={{ color: 'var(--text-3)', marginLeft: 6, fontSize: 9 }}>{b.plan}</span>
                </div>
                <div className="row count" key={`burn-${i}-niche`}>
                  {b.niche === 'pousada' ? <Building2 size={10} /> : <Home size={10} />}
                </div>
                <div className="row mrr" key={`burn-${i}-wa`} style={{ color: 'var(--err)' }}>
                  −{fmtBRL(b.whatsappCost)}
                </div>
                <div className="row ratio" key={`burn-${i}-total`}>
                  −{fmtBRL(b.total)}
                  <div style={{
                    height: 2,
                    background: 'var(--err)',
                    marginTop: 4,
                    width: `${(b.total / maxBurn) * 100}%`,
                  }} />
                </div>
              </>
            ))}
          </div>
        )}
      </section>

      {/* ─── PROJEÇÃO 6 MESES ───────────────────────────────────────── */}
      <section>
        <div className="section-h">
          <span className="title">
            <TrendingUp size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            CASHFLOW · PROJEÇÃO 6 MESES
          </span>
          <span className="meta">ASSUMINDO +10% MoM</span>
        </div>

        <div className="fin-cashflow">
          {data.forecast.map((m, i) => (
            <div className={`month ${m.positive ? 'positive' : 'negative'}`} key={i}>
              <div className="month-label">{m.month}</div>
              <div className="month-value">
                {m.value >= 0 ? '+' : '−'}{fmtBRL(Math.abs(m.value))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── INTEGRAÇÃO DDC ─────────────────────────────────────────── */}
      <section>
        <div className="section-h">
          <span className="title">INTEGRAÇÃO DDC · DASHBOARDS DE CLIENTES</span>
          <span className="meta">ACESSO DIRETO</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 1,
          background: 'var(--border)',
          border: '1px solid var(--border)',
        }}>
          <Link
            href="/ddc/pousada"
            style={{
              background: 'var(--surface)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              color: 'var(--text)',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>
                <Building2 size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                DDC POUSADA
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4 }}>
                Dashboard do cliente pousada
              </div>
            </div>
            <ExternalLink size={12} style={{ color: 'var(--accent)' }} />
          </Link>

          <Link
            href="/ddc/airbnb"
            style={{
              background: 'var(--surface)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              color: 'var(--text)',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>
                <Home size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                DDC AIRBNB
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4 }}>
                Dashboard do anfitrião Airbnb
              </div>
            </div>
            <ExternalLink size={12} style={{ color: 'var(--accent)' }} />
          </Link>

          <Link
            href="/ddc"
            style={{
              background: 'var(--surface)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              color: 'var(--text)',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>
                <ArrowUpRight size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                DDC OVERVIEW
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4 }}>
                Visão geral de todos os clientes
              </div>
            </div>
            <ExternalLink size={12} style={{ color: 'var(--accent)' }} />
          </Link>
        </div>
      </section>
    </div>
  );
}
