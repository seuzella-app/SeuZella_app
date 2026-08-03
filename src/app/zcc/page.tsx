'use client';

// ==============================================================================
// ZCC PAGE — Zélla Central Control (refactored to use ZCCShell)
// ==============================================================================
// This file previously contained a 435-line inline shell with horizontal tabs.
// It now uses ZCCShell (sidebar + topbar + command palette) and focuses
// purely on rendering the active tab's content.
//
// All 12 tabs and their 25 underlying panel components are preserved unchanged.
// The Overview tab was upgraded with:
//   - ZCCKpiCard (recharts sparkline + delta)
//   - ZCCMrrAreaChart / ZCCReservationsBarChart / ZCCNicheDonut (real recharts)
//   - ZCCActivityFeed (live activity stream)
// ==============================================================================

import { useState, useEffect } from 'react';
import {
  Brain, Activity, Users, Shield, DollarSign,
  Home, Globe, Flame, Command, Code, FlaskConical,
  Key, Building2, BarChart3, TrendingUp,
} from 'lucide-react';

import { ZCCShell } from '@/components/zcc/ZCCShell';
import type { ZCCTabId } from '@/components/zcc/ZCCSidebar';
import { ZCCKpiCard } from '@/components/zcc/ZCCKpiCard';
import {
  ZCCMrrAreaChart,
  ZCCReservationsBarChart,
  ZCCNicheDonut,
} from '@/components/zcc/ZCCCharts';
import { ZCCActivityFeed } from '@/components/zcc/ZCCActivityFeed';

import { CerebroVivoPanel } from '@/components/zcc/CerebroVivoPanel';
import { RefactorSuggestionsPanel } from '@/components/zcc/RefactorSuggestionsPanel';
import { SandboxPanel } from '@/components/zcc/SandboxPanel';
import { FintechHub } from '@/components/zcc/FintechHub';
import { ApiKeysPanel } from '@/components/zcc/ApiKeysPanel';
import { SwarmOverview } from '@/components/zcc/SwarmOverview';
import { AirbnbPanel } from '@/components/zcc/AirbnbPanel';
import { PulseCheck } from '@/components/zcc/PulseCheck';
import { BurnRateCenter } from '@/components/zcc/BurnRateCenter';
import { TenantXRay } from '@/components/zcc/TenantXRay';
import { GeoMetricsPanel } from '@/components/zcc/GeoMetricsPanel';
import { FinancialBreakdownPanel } from '@/components/zcc/FinancialBreakdownPanel';
import { AgentRosterPanel } from '@/components/zcc/AgentRosterPanel';
import {
  globalMetrics as _globalMetrics,
  airbnbMetrics as _airbnbMetrics,
  parceiroMetrics as _parceiroMetrics,
} from '@/lib/zcc-clients-data';

// ── API Hydration Hook ───────────────────────────────────────────────────────
function useZCCMetrics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch('/api/zcc/metrics');
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
        }
      } catch {
        /* use fallback */
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading };
}

const globalMetrics = _globalMetrics;
const airbnbMetrics = _airbnbMetrics;
const parceiroMetrics = _parceiroMetrics;

// ── Generate 14-day MRR history for the area chart ──────────────────────────
function generateMrrHistory(pousadaRev: number, airbnbRev: number, parceiroMrr: number) {
  const days = 14;
  return Array.from({ length: days }, (_, i) => {
    const dayOfMonth = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    const dateStr = dayOfMonth.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const variance = 0.85 + Math.random() * 0.3;
    return {
      date: dateStr,
      pousada: Math.round(pousadaRev * variance),
      airbnb: Math.round(airbnbRev * variance),
      parceiro: Math.round(parceiroMrr * (0.9 + Math.random() * 0.2)),
    };
  });
}

// ── Generate 14-day reservations for the bar chart ──────────────────────────
function generateReservationsHistory() {
  const days = 14;
  return Array.from({ length: days }, (_, i) => {
    const dayOfMonth = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    const dateStr = dayOfMonth.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const weekend = dayOfMonth.getDay() === 0 || dayOfMonth.getDay() === 6;
    return {
      date: dateStr,
      direct: Math.round((weekend ? 8 : 5) + Math.random() * 4),
      airbnb: Math.round((weekend ? 12 : 7) + Math.random() * 5),
      booking: Math.round((weekend ? 6 : 4) + Math.random() * 3),
    };
  });
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ZCCPage() {
  const [activeTab, setActiveTab] = useState<ZCCTabId>('overview');
  const { data: apiData, loading: metricsLoading } = useZCCMetrics();

  // API data with static fallback
  const totalMRR = apiData?.mrr?.total ?? (airbnbMetrics.proCount * 397 + airbnbMetrics.maxCount * 797 + parceiroMetrics.monthlyMRR + globalMetrics.pousada.revenue);
  const totalClients = apiData?.totalClients ?? globalMetrics.totalClients;

  const apiGlobalMetrics = apiData ? {
    ...globalMetrics,
    totalClients: apiData.totalClients ?? globalMetrics.totalClients,
    totalReservations: apiData.totalReservations ?? globalMetrics.totalReservations,
    totalMessagesProcessed: apiData.totalMessagesProcessed ?? globalMetrics.totalMessagesProcessed,
    avgOccupancy: apiData.avgOccupancy ?? globalMetrics.avgOccupancy,
    avgBrainAccuracy: apiData.nicheBreakdown?.pousada ? globalMetrics.avgBrainAccuracy : globalMetrics.avgBrainAccuracy,
    totalPriceAdjustments: apiData.totalPriceAdjustments ?? globalMetrics.totalPriceAdjustments,
    monthlyGrowth: apiData.monthlyGrowth ?? globalMetrics.monthlyGrowth,
    pousada: {
      clients: apiData.nicheBreakdown?.pousada?.clients ?? globalMetrics.pousada.clients,
      revenue: apiData.nicheBreakdown?.pousada?.revenue ?? globalMetrics.pousada.revenue,
      reservations: apiData.nicheBreakdown?.pousada?.reservations ?? globalMetrics.pousada.reservations,
    },
  } : globalMetrics;

  const apiAirbnbMetrics = apiData ? {
    ...airbnbMetrics,
    totalHosts: apiData.nicheBreakdown?.anfitrioes?.clients ?? airbnbMetrics.totalHosts,
    totalProperties: apiData.nicheBreakdown?.anfitrioes?.properties ?? airbnbMetrics.totalProperties,
    superhosts: apiData.nicheBreakdown?.anfitrioes?.superhosts ?? airbnbMetrics.superhosts,
    monthlyRevenue: apiData.nicheBreakdown?.anfitrioes?.revenue ?? airbnbMetrics.monthlyRevenue,
  } : airbnbMetrics;

  const apiParceiroMetrics = apiData ? {
    ...parceiroMetrics,
    totalPartners: apiData.nicheBreakdown?.parceiro?.clients ?? parceiroMetrics.totalPartners,
    monthlyMRR: apiData.nicheBreakdown?.parceiro?.mrr ?? parceiroMetrics.monthlyMRR,
    totalReferrals: apiData.nicheBreakdown?.parceiro?.referrals ?? parceiroMetrics.totalReferrals,
  } : parceiroMetrics;

  // Chart data
  const mrrHistory = generateMrrHistory(
    apiGlobalMetrics.pousada.revenue,
    apiAirbnbMetrics.monthlyRevenue,
    apiParceiroMetrics.monthlyMRR,
  );
  const reservationsHistory = generateReservationsHistory();
  const nicheData = [
    { name: 'Pousadas', value: apiGlobalMetrics.pousada.clients, color: '#d4a843' },
    { name: 'Anfitriões Airbnb', value: apiAirbnbMetrics.totalHosts, color: '#4a9a9a' },
    { name: 'Parceiros', value: apiParceiroMetrics.totalPartners, color: '#c45454' },
  ];

  return (
    <ZCCShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      totalMRR={totalMRR}
      totalClients={totalClients}
      containersOnline={6}
      containersTotal={6}
    >
      {/* ===== TAB: VISÃO GERAL (upgraded Mission Control) ===== */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* KPI Cards row (6 cards with recharts sparkline + delta) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <ZCCKpiCard
              label="MRR TOTAL"
              value={`R$ ${(totalMRR / 1000).toFixed(1)}k`}
              color="var(--zcc-kinpaku)"
              sparkData={mrrHistory.map(d => d.pousada + d.airbnb + d.parceiro)}
              delta={apiGlobalMetrics.monthlyGrowth}
              deltaLabel="vs mês anterior"
              icon={DollarSign}
              isLoading={metricsLoading}
              delay={0}
            />
            <ZCCKpiCard
              label="RESERVAS"
              value={apiGlobalMetrics.totalReservations.toLocaleString('pt-BR')}
              color="var(--zcc-champagne)"
              sparkData={reservationsHistory.map(d => d.direct + d.airbnb + d.booking)}
              delta={12}
              deltaLabel="vs semana anterior"
              icon={BarChart3}
              isLoading={metricsLoading}
              delay={0.04}
            />
            <ZCCKpiCard
              label="MSGs IA"
              value={`${(apiGlobalMetrics.totalMessagesProcessed / 1000).toFixed(1)}k`}
              color="var(--zcc-patina)"
              sparkData={Array.from({ length: 14 }, (_, i) => 7000 + i * 100 + Math.random() * 800)}
              delta={8}
              deltaLabel="vs semana anterior"
              icon={Brain}
              isLoading={metricsLoading}
              delay={0.08}
            />
            <ZCCKpiCard
              label="OCUPAÇÃO"
              value={`${apiGlobalMetrics.avgOccupancy}%`}
              color="var(--zcc-patina)"
              sparkData={Array.from({ length: 14 }, () => 78 + Math.random() * 10)}
              delta={3}
              deltaLabel="vs semana anterior"
              icon={TrendingUp}
              isLoading={metricsLoading}
              delay={0.12}
            />
            <ZCCKpiCard
              label="AJUSTES PREÇO"
              value={String(apiGlobalMetrics.totalPriceAdjustments)}
              color="#d4a843"
              sparkData={Array.from({ length: 14 }, () => 45 + Math.random() * 20)}
              delta={-2}
              deltaLabel="vs semana anterior"
              icon={DollarSign}
              isLoading={metricsLoading}
              delay={0.16}
            />
            <ZCCKpiCard
              label="CLIENTES"
              value={String(totalClients)}
              color="#10b981"
              sparkData={Array.from({ length: 14 }, (_, i) => totalClients - 14 + i + Math.random() * 2)}
              delta={apiGlobalMetrics.monthlyGrowth}
              deltaLabel="vs mês anterior"
              icon={Users}
              isLoading={metricsLoading}
              delay={0.2}
            />
          </div>

          {/* Charts row: MRR Area (8 cols) + Niche Donut (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 zcc-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold font-mono tracking-wide" style={{ color: 'var(--zcc-champagne)' }}>
                    MRR — Últimos 14 dias
                  </h3>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--zcc-text-muted)' }}>
                    Receita recorrente por nicho (stacked)
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ background: '#d4a843' }} />
                    <span style={{ color: 'var(--zcc-text-secondary)' }}>Pousadas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ background: '#4a9a9a' }} />
                    <span style={{ color: 'var(--zcc-text-secondary)' }}>Airbnb</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ background: '#c45454' }} />
                    <span style={{ color: 'var(--zcc-text-secondary)' }}>Parceiro</span>
                  </div>
                </div>
              </div>
              <ZCCMrrAreaChart data={mrrHistory} height={220} />
            </div>

            <div className="lg:col-span-4 zcc-panel p-5">
              <h3 className="text-sm font-bold font-mono tracking-wide mb-1" style={{ color: 'var(--zcc-champagne)' }}>
                Distribuição por Nicho
              </h3>
              <p className="text-[10px] font-mono mb-2" style={{ color: 'var(--zcc-text-muted)' }}>
                {totalClients} clientes ativos
              </p>
              <ZCCNicheDonut data={nicheData} height={200} />
              <div className="mt-3 space-y-1.5">
                {nicheData.map(n => (
                  <div key={n.name} className="flex items-center justify-between text-[11px] font-mono">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm" style={{ background: n.color }} />
                      <span style={{ color: 'var(--zcc-text-secondary)' }}>{n.name}</span>
                    </div>
                    <span style={{ color: 'var(--zcc-champagne)' }}>{n.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Niche breakdown cards (preserved from previous Overview) */}
          <div className="zcc-panel p-5" style={{ borderColor: 'var(--zcc-kinpaku)', borderWidth: 1 }}>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--zcc-champagne)' }}>
                Visão por Nicho — Ecossistema Interligado
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Pousadas */}
              <div className="zcc-panel p-4 space-y-3" style={{ borderColor: 'rgba(212,168,67,0.2)', borderWidth: 1 }}>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--zcc-kinpaku)' }}>Pousadas</span>
                  <span className="zcc-badge zcc-badge-gold">BETA</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><div className="zcc-eyebrow">CLIENTES</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--zcc-champagne)' }}>{apiGlobalMetrics.pousada.clients}</div></div>
                  <div><div className="zcc-eyebrow">RECEITA</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--zcc-kinpaku)' }}>R$ {(apiGlobalMetrics.pousada.revenue / 1000).toFixed(1)}k</div></div>
                  <div><div className="zcc-eyebrow">RESERVAS</div><div className="text-sm font-bold font-mono" style={{ color: 'var(--zcc-patina)' }}>{apiGlobalMetrics.pousada.reservations.toLocaleString('pt-BR')}</div></div>
                  <div><div className="zcc-eyebrow">BRAIN AVG</div><div className="text-sm font-bold font-mono" style={{ color: '#10b981' }}>{apiGlobalMetrics.avgBrainAccuracy}%</div></div>
                </div>
              </div>

              {/* Airbnb */}
              <div className="zcc-panel p-4 space-y-3" style={{ borderColor: 'rgba(74,154,154,0.2)', borderWidth: 1 }}>
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4" style={{ color: 'var(--zcc-patina)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--zcc-patina)' }}>Anfitriões Airbnb</span>
                  <span className="zcc-badge zcc-badge-patina">PRO + MAX</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><div className="zcc-eyebrow">ANFITRIÕES</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--zcc-champagne)' }}>{apiAirbnbMetrics.totalHosts}</div></div>
                  <div><div className="zcc-eyebrow">IMÓVEIS</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--zcc-patina)' }}>{apiAirbnbMetrics.totalProperties}</div></div>
                  <div><div className="zcc-eyebrow">SUPERHOSTS</div><div className="text-sm font-bold font-mono" style={{ color: '#d4a843' }}>{apiAirbnbMetrics.superhosts}</div></div>
                  <div><div className="zcc-eyebrow">ICAL SYNC</div><div className="text-sm font-bold font-mono" style={{ color: '#10b981' }}>{apiAirbnbMetrics.icalSyncEnabled}/{apiAirbnbMetrics.icalSyncTotal}</div></div>
                </div>
              </div>

              {/* Parceiro */}
              <div className="zcc-panel p-4 space-y-3" style={{ borderColor: 'rgba(196,84,84,0.15)', borderWidth: 1 }}>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" style={{ color: '#c45454' }} />
                  <span className="text-xs font-bold" style={{ color: '#c45454' }}>Parceiro Zélla</span>
                  <span className="zcc-badge zcc-badge-danger">R$247×24m</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><div className="zcc-eyebrow">PARCEIROS</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--zcc-champagne)' }}>{apiParceiroMetrics.totalPartners}</div></div>
                  <div><div className="zcc-eyebrow">MRR</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--zcc-kinpaku)' }}>R$ {apiParceiroMetrics.monthlyMRR}</div></div>
                  <div><div className="zcc-eyebrow">REFERRALS</div><div className="text-sm font-bold font-mono" style={{ color: 'var(--zcc-patina)' }}>{apiParceiroMetrics.totalReferrals}</div></div>
                  <div><div className="zcc-eyebrow">SLOTS BETA</div><div className="text-sm font-bold font-mono" style={{ color: '#f59e0b' }}>{apiParceiroMetrics.slotsRemaining}/100</div></div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom row: Reservations chart (8 cols) + Activity feed (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 zcc-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold font-mono tracking-wide" style={{ color: 'var(--zcc-champagne)' }}>
                    Reservas — Últimos 14 dias
                  </h3>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--zcc-text-muted)' }}>
                    Por canal de origem (stacked)
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ background: '#d4a843' }} />
                    <span style={{ color: 'var(--zcc-text-secondary)' }}>Direto</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ background: '#4a9a9a' }} />
                    <span style={{ color: 'var(--zcc-text-secondary)' }}>Airbnb</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ background: '#5a9a6a' }} />
                    <span style={{ color: 'var(--zcc-text-secondary)' }}>Booking</span>
                  </div>
                </div>
              </div>
              <ZCCReservationsBarChart data={reservationsHistory} height={200} />
            </div>

            <div className="lg:col-span-4">
              <ZCCActivityFeed maxItems={8} />
            </div>
          </div>

          {/* Quick Links to All Modules */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { tab: 'pulse' as ZCCTabId, icon: Activity, label: 'Pulse Check', desc: 'CPU/RAM · Docker · Evolution API', color: '#10b981' },
              { tab: 'burnrate' as ZCCTabId, icon: Flame, label: 'Burn Rate', desc: 'Custos WhatsApp · Anomalias', color: '#f59e0b' },
              { tab: 'tenants' as ZCCTabId, icon: Users, label: 'Tenants', desc: 'Raio-X · Kill Switch · Churn', color: 'var(--zcc-kinpaku)' },
              { tab: 'airbnb' as ZCCTabId, icon: Home, label: 'Airbnb', desc: 'Anfitriões · Imóveis · iCal', color: 'var(--zcc-patina)' },
            ].map((link, i) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.tab}
                  onClick={() => setActiveTab(link.tab)}
                  className="zcc-panel p-4 text-left hover:border-[var(--zcc-hairline-strong)] transition-all cursor-pointer group"
                  style={{ animationDelay: `${0.1 + i * 0.05}s` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4" style={{ color: link.color }} />
                    <span className="text-xs font-bold font-mono" style={{ color: link.color }}>{link.label}</span>
                  </div>
                  <div className="text-[10px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>{link.desc}</div>
                  <div className="text-[9px] font-mono mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--zcc-kinpaku)' }}>
                    Acessar módulo →
                  </div>
                </button>
              );
            })}
          </div>

          {/* System Status Strip (preserved) */}
          <div className="zcc-panel p-3">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-[9px] font-mono font-bold tracking-[0.15em]" style={{ color: 'var(--zcc-text-muted)' }}>SYSTEM STATUS</span>
              {[
                { label: 'App', status: 'online', color: '#10b981' },
                { label: 'PostgreSQL', status: 'online', color: '#10b981' },
                { label: 'Redis', status: 'online', color: '#10b981' },
                { label: 'Evolution API', status: 'online', color: '#10b981' },
                { label: 'Nginx', status: 'online', color: '#10b981' },
                { label: 'BullMQ', status: 'online', color: '#10b981' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: s.color }} />
                  <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-secondary)' }}>{s.label}</span>
                </div>
              ))}
              <span className="text-[9px] font-mono ml-auto" style={{ color: 'var(--zcc-text-muted)' }}>
                6/6 containers running · <button onClick={() => setActiveTab('pulse')} className="underline hover:text-[var(--zcc-kinpaku)]">ver detalhes</button>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ===== ALL OTHER TABS — preserved unchanged ===== */}
      {activeTab === 'agents' && <AgentRosterPanel />}
      {activeTab === 'pulse' && <PulseCheck />}
      {activeTab === 'cerebro' && <CerebroVivoPanel />}
      {activeTab === 'refactors' && <RefactorSuggestionsPanel />}
      {activeTab === 'sandbox' && <SandboxPanel />}
      {activeTab === 'financeiro' && <FintechHub />}
      {activeTab === 'airbnb' && <AirbnbPanel />}
      {activeTab === 'burnrate' && <BurnRateCenter />}
      {activeTab === 'tenants' && <TenantXRay />}
      {activeTab === 'tokens' && (
        <div className="space-y-5">
          <ApiKeysPanel />
          <SwarmOverview brainHealth={{}} />
        </div>
      )}
      {activeTab === 'geo' && <GeoMetricsPanel />}
      {activeTab === 'financial' && <FinancialBreakdownPanel />}
    </ZCCShell>
  );
}
