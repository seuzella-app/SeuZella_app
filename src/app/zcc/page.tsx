'use client';

import { useState, useEffect } from 'react';
import {
  Brain, ArrowLeft, Bell, Building2, Activity,
  Users, Shield, DollarSign, Key, TrendingUp,
  Home, Globe, Flame, Command, Code, FlaskConical, GitPullRequest,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

import { CerebroVivoPanel } from '@/components/zcc/CerebroVivoPanel';
import { ZeCodePanel } from '@/components/zcc/ZeCodePanel';
import { SandboxPanel } from '@/components/zcc/SandboxPanel';
import { FintechHub } from '@/components/zcc/FintechHub';
import { ApiKeysPanel } from '@/components/zcc/ApiKeysPanel';
import { SwarmOverview } from '@/components/zcc/SwarmOverview';
import { AirbnbPanel } from '@/components/zcc/AirbnbPanel';
import { PulseCheck } from '@/components/zcc/PulseCheck';
import { BurnRateCenter } from '@/components/zcc/BurnRateCenter';
import { TenantXRay } from '@/components/zcc/TenantXRay';
import { ClientOverview } from '@/components/zcc/ClientOverview';
import { GeoMetricsPanel } from '@/components/zcc/GeoMetricsPanel';
import { FinancialBreakdownPanel } from '@/components/zcc/FinancialBreakdownPanel';
import { CodeReviewerPanel } from '@/components/zcc/CodeReviewerPanel';
import { globalMetrics as _globalMetrics, airbnbMetrics as _airbnbMetrics, parceiroMetrics as _parceiroMetrics } from '@/lib/zcc-clients-data';

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

// Static fallbacks (renamed with underscore prefix)
const globalMetrics = _globalMetrics;
const airbnbMetrics = _airbnbMetrics;
const parceiroMetrics = _parceiroMetrics;

// ── Tab Configuration ──────────────────────────────────────────────────────────

type ZCCTab = 'overview' | 'pulse' | 'cerebro' | 'ze-code' | 'sandbox' | 'financeiro' | 'airbnb' | 'burnrate' | 'tenants' | 'tokens' | 'geo' | 'financial' | 'code-reviewer';

const tabs: { id: ZCCTab; label: string; icon: React.ElementType; desc: string; group: 'core' | 'ops' | 'config' }[] = [
  { id: 'overview', label: 'Visão Geral', icon: Command, desc: 'Command Center', group: 'core' },
  { id: 'pulse', label: 'Pulse Check', icon: Activity, desc: 'Telemetria & Infra', group: 'core' },
  { id: 'cerebro', label: 'Cérebro', icon: Brain, desc: 'IA em tempo real', group: 'core' },
  { id: 'ze-code', label: 'ZéCode', icon: Code, desc: 'DEV FULL STACK (CodeRabbit-style)', group: 'core' },
  { id: 'code-reviewer', label: 'Code Reviewer', icon: GitPullRequest, desc: 'Revisão IA estilo CodeRabbit', group: 'core' },
  { id: 'sandbox', label: 'Sandbox', icon: FlaskConical, desc: 'Z-Lab Simulação', group: 'core' },
  { id: 'financeiro', label: 'Financeiro', icon: DollarSign, desc: 'Receitas & Pagamentos', group: 'core' },
  { id: 'airbnb', label: 'Airbnb', icon: Home, desc: 'Anfitriões & Imóveis', group: 'ops' },
  { id: 'burnrate', label: 'Burn Rate', icon: Flame, desc: 'Custos API WhatsApp', group: 'ops' },
  { id: 'tenants', label: 'Tenants', icon: Users, desc: 'Raio-X & Kill Switch', group: 'ops' },
  { id: 'tokens', label: 'Tokens & IA', icon: Key, desc: 'LLMs & API Keys', group: 'config' },
  { id: 'geo', label: 'Geo', icon: Globe, desc: 'Métricas Geográficas', group: 'ops' },
  { id: 'financial', label: 'Financeiro Detalhado', icon: DollarSign, desc: 'Breakdown & Churn', group: 'core' },
];

// Group property kept for data organization, not rendered in UI

// ── Mini Sparkline SVG ─────────────────────────────────────────────────────────

function MiniSparkline({ data, color, width = 60, height = 20 }: {
  data: number[]; color: string; width?: number; height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 2) - 1}`
  ).join(' ');
  return (
    <svg width={width} height={height} className="opacity-50">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Generate mock sparkline data
function sparkline(base: number, variance: number, len = 14): number[] {
  return Array.from({ length: len }, () => base + (Math.random() - 0.4) * variance);
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ZCCPage() {
  const [activeTab, setActiveTab] = useState<ZCCTab>('overview');
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

  return (
    <div className="min-h-screen" style={{ background: '#0A0F1C' }}>
      {/* ===== TOP HEADER BAR ===== */}
      <header className="zcc-header" style={{ background: 'rgba(10,15,28,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center justify-between px-4 py-2.5 max-w-[1920px] mx-auto">
          {/* Left: Back + Logo */}
          <div className="flex items-center gap-3">
            <Link href="/"
              className="p-1.5 rounded transition-colors hover:bg-white/[0.04]"
              style={{ color: 'var(--zcc-text-muted)' }}
              aria-label="Voltar ao início">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Command className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
                <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--zcc-champagne)' }}>ZÉLLA</span>
              </div>
              <div className="h-4 w-px" style={{ background: 'var(--zcc-hairline)' }} />
              <span className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--zcc-kinpaku)' }}>
                Central Control
              </span>
            </div>
          </div>

          {/* Center: Tabs */}
          <div className="hidden lg:flex items-center gap-1">
            {tabs.map((tab, ti) => {
              const Icon = tab.icon;
              return (
                <div key={tab.id} className="flex items-center gap-1">
                  {ti > 0 && (
                    <div className="w-px h-4 mx-0.5" style={{ background: 'var(--zcc-hairline)' }} />
                  )}
                  <button onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-mono font-medium transition-all duration-150 cursor-pointer ${
                      activeTab === tab.id ? 'zcc-tab-active' : 'zcc-tab'
                    }`}>
                    <Icon className="w-3 h-3" />
                    <span>{tab.label}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Right: Status + Notifications */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded" style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.12)' }}>
              <DollarSign className="w-3 h-3" style={{ color: 'var(--zcc-kinpaku)' }} />
              <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--zcc-kinpaku)' }}>
                MRR R${totalMRR.toLocaleString('pt-BR')}
              </span>
              <MiniSparkline data={sparkline(totalMRR, totalMRR * 0.05)} color="#d4a843" width={40} height={14} />
            </div>
            <div className="hidden md:flex items-center gap-1.5 px-2 py-1.5 rounded" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono" style={{ color: '#10b981' }}>{totalClients} online</span>
            </div>
            <button className="relative p-1.5 rounded transition-colors hover:bg-white/[0.04]" style={{ color: 'var(--zcc-text-muted)' }}>
              <Bell className="w-4 h-4" />
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--zcc-kinpaku)' }} />
            </button>
            <div className="w-7 h-7 rounded flex items-center justify-center font-mono text-[9px] font-bold"
              style={{ background: 'var(--zcc-kinpaku-dim)', color: 'var(--zcc-kinpaku)', border: '1px solid var(--zcc-hairline)' }}>
              ZA
            </div>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="max-w-[1920px] mx-auto p-4 md:p-6">
        {/* Mobile Tab Selector */}
        <div className="lg:hidden flex items-center gap-1 mb-6 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded text-[10px] font-mono font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id ? 'zcc-tab-active' : 'zcc-tab'
                }`}>
                <Icon className="w-3 h-3" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ===== TAB CONTENT ===== */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>

            {/* ===== TAB: VISÃO GERAL (Mission Control Overview) ===== */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
                {/* Global Command Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {metricsLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={`skel-${i}`} className="zcc-panel p-4">
                        <div className="zcc-eyebrow">&nbsp;</div>
                        <div className="h-5 w-16 rounded shimmer" style={{ background: 'rgba(255,255,255,0.06)' }} />
                        <div className="h-3 w-12 mt-2 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
                      </div>
                    ))
                  ) : ([
                    { label: 'MRR TOTAL', value: `R$ ${(totalMRR / 1000).toFixed(1)}k`, color: 'var(--zcc-kinpaku)', sparkData: sparkline(totalMRR, totalMRR * 0.05), trend: `+${apiGlobalMetrics.monthlyGrowth}%` },
                    { label: 'RESERVAS', value: apiGlobalMetrics.totalReservations.toLocaleString('pt-BR'), color: 'var(--zcc-champagne)', sparkData: sparkline(5000, 500) },
                    { label: 'MSGs IA', value: `${(apiGlobalMetrics.totalMessagesProcessed / 1000).toFixed(1)}k`, color: 'var(--zcc-patina)', sparkData: sparkline(8000, 800) },
                    { label: 'OCUPAÇÃO', value: `${apiGlobalMetrics.avgOccupancy}%`, color: 'var(--zcc-patina)', sparkData: sparkline(82, 4) },
                    { label: 'AJUSTES PREÇO', value: String(apiGlobalMetrics.totalPriceAdjustments), color: '#d4a843', sparkData: sparkline(55, 10) },
                    { label: 'CLIENTES', value: String(totalClients), color: '#10b981', sparkData: sparkline(totalClients, 2), trend: `+${apiGlobalMetrics.monthlyGrowth}%` },
                  ].map((stat, i) => (
                    <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }} className="zcc-panel p-4">
                      <div className="zcc-eyebrow">{stat.label}</div>
                      <div className="text-lg font-bold font-mono" style={{ color: stat.color }}>{stat.value}</div>
                      <MiniSparkline data={stat.sparkData} color={stat.color} />
                      {stat.trend && (
                        <div className="text-[9px] font-mono mt-1 flex items-center gap-0.5" style={{ color: '#10b981' }}>
                          <TrendingUp className="w-2.5 h-2.5" /> {stat.trend}
                        </div>
                      )}
                    </motion.div>
                  )))}
                </div>

                {/* Niche Breakdown — Interlinked */}
                <div className="zcc-panel p-5" style={{ borderColor: 'var(--zcc-kinpaku)', borderWidth: 1 }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--zcc-champagne)' }}>Visão por Nicho — Ecossistema Interligado</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Pousadas */}
                    <div className="zcc-panel p-4 space-y-3" style={{ borderColor: 'rgba(212,168,67,0.2)', borderWidth: 1 }}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
                        <span className="text-xs font-bold" style={{ color: 'var(--zcc-kinpaku)' }}>Pousadas</span>
                        <span className="zcc-badge-gold">BETA</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><div className="zcc-eyebrow">CLIENTES</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--zcc-champagne)' }}>{apiGlobalMetrics.pousada.clients}</div></div>
                        <div><div className="zcc-eyebrow">RECEITA</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--zcc-kinpaku)' }}>R$ {(apiGlobalMetrics.pousada.revenue / 1000).toFixed(1)}k</div></div>
                        <div><div className="zcc-eyebrow">RESERVAS</div><div className="text-sm font-bold font-mono" style={{ color: 'var(--zcc-patina)' }}>{apiGlobalMetrics.pousada.reservations.toLocaleString('pt-BR')}</div></div>
                        <div><div className="zcc-eyebrow">BRAIN AVG</div><div className="text-sm font-bold font-mono" style={{ color: '#10b981' }}>{apiGlobalMetrics.avgBrainAccuracy}%</div></div>
                      </div>
                      <MiniSparkline data={sparkline(apiGlobalMetrics.pousada.revenue, 5000)} color="#d4a843" width={200} height={28} />
                    </div>

                    {/* Airbnb */}
                    <div className="zcc-panel p-4 space-y-3" style={{ borderColor: 'rgba(74,154,154,0.2)', borderWidth: 1 }}>
                      <div className="flex items-center gap-2">
                        <Home className="w-4 h-4" style={{ color: 'var(--zcc-patina)' }} />
                        <span className="text-xs font-bold" style={{ color: 'var(--zcc-patina)' }}>Anfitriões Airbnb</span>
                        <span className="zcc-badge-patina">PRO + MAX</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><div className="zcc-eyebrow">ANFITRIÕES</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--zcc-champagne)' }}>{apiAirbnbMetrics.totalHosts}</div></div>
                        <div><div className="zcc-eyebrow">IMÓVEIS</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--zcc-patina)' }}>{apiAirbnbMetrics.totalProperties}</div></div>
                        <div><div className="zcc-eyebrow">SUPERHOSTS</div><div className="text-sm font-bold font-mono" style={{ color: '#d4a843' }}>{apiAirbnbMetrics.superhosts}</div></div>
                        <div><div className="zcc-eyebrow">ICAL SYNC</div><div className="text-sm font-bold font-mono" style={{ color: '#10b981' }}>{apiAirbnbMetrics.icalSyncEnabled}/{apiAirbnbMetrics.icalSyncTotal}</div></div>
                      </div>
                      <MiniSparkline data={sparkline(apiAirbnbMetrics.monthlyRevenue, 3000)} color="#4a9a9a" width={200} height={28} />
                    </div>

                    {/* Parceiro */}
                    <div className="zcc-panel p-4 space-y-3" style={{ borderColor: 'rgba(196,84,84,0.15)', borderWidth: 1 }}>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" style={{ color: '#c45454' }} />
                        <span className="text-xs font-bold" style={{ color: '#c45454' }}>Parceiro Zélla</span>
                        <span className="zcc-badge-danger">R$247×24m</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><div className="zcc-eyebrow">PARCEIROS</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--zcc-champagne)' }}>{apiParceiroMetrics.totalPartners}</div></div>
                        <div><div className="zcc-eyebrow">MRR</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--zcc-kinpaku)' }}>R$ {apiParceiroMetrics.monthlyMRR}</div></div>
                        <div><div className="zcc-eyebrow">REFERRALS</div><div className="text-sm font-bold font-mono" style={{ color: 'var(--zcc-patina)' }}>{apiParceiroMetrics.totalReferrals}</div></div>
                        <div><div className="zcc-eyebrow">SLOTS BETA</div><div className="text-sm font-bold font-mono" style={{ color: '#f59e0b' }}>{apiParceiroMetrics.slotsRemaining}/100</div></div>
                      </div>
                      <MiniSparkline data={sparkline(apiParceiroMetrics.monthlyMRR, 200)} color="#c45454" width={200} height={28} />
                    </div>
                  </div>
                </div>

                {/* Quick Links to All Modules */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { tab: 'pulse' as ZCCTab, icon: Activity, label: 'Pulse Check', desc: 'CPU/RAM · Docker · Evolution API', color: '#10b981' },
                    { tab: 'burnrate' as ZCCTab, icon: Flame, label: 'Burn Rate', desc: 'Custos WhatsApp · Anomalias', color: '#f59e0b' },
                    { tab: 'tenants' as ZCCTab, icon: Users, label: 'Tenants', desc: 'Raio-X · Kill Switch · Churn', color: 'var(--zcc-kinpaku)' },
                    { tab: 'airbnb' as ZCCTab, icon: Home, label: 'Airbnb', desc: 'Anfitriões · Imóveis · iCal', color: 'var(--zcc-patina)' },
                  ].map((link, i) => {
                    const Icon = link.icon;
                    return (
                      <motion.button key={link.tab} onClick={() => setActiveTab(link.tab)}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                        className="zcc-panel p-4 text-left hover:border-[var(--zcc-hairline-strong)] transition-all cursor-pointer group">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4" style={{ color: link.color }} />
                          <span className="text-xs font-bold font-mono" style={{ color: link.color }}>{link.label}</span>
                        </div>
                        <div className="text-[10px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>{link.desc}</div>
                        <div className="text-[9px] font-mono mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--zcc-kinpaku)' }}>
                          Acessar módulo →
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* System Status Strip */}
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

            {/* ===== TAB: PULSE CHECK ===== */}
            {activeTab === 'pulse' && <PulseCheck />}

            {/* ===== TAB: CÉREBRO ZÉLLA ===== */}
            {activeTab === 'cerebro' && <CerebroVivoPanel />}

            {/* ===== TAB: ZÉCODE (DEV FULL STACK — substitui antigo "refactors") ===== */}
            {activeTab === 'ze-code' && <ZeCodePanel />}

            {/* ===== TAB: SANDBOX (Z-Lab Simulation) ===== */}
            {activeTab === 'sandbox' && <SandboxPanel />}

            {/* ===== TAB: FINANCEIRO ===== */}
            {activeTab === 'financeiro' && <FintechHub />}

            {/* ===== TAB: AIRBNB ===== */}
            {activeTab === 'airbnb' && <AirbnbPanel />}

            {/* ===== TAB: BURN RATE ===== */}
            {activeTab === 'burnrate' && <BurnRateCenter />}

            {/* ===== TAB: TENANTS ===== */}
            {activeTab === 'tenants' && <TenantXRay />}

            {/* ===== TAB: TOKENS ===== */}
            {activeTab === 'tokens' && (
              <div className="space-y-5">
                <ApiKeysPanel />
                <SwarmOverview brainHealth={{}} />
              </div>
            )}

            {/* ===== TAB: GEO ===== */}
            {activeTab === 'geo' && <GeoMetricsPanel />}

            {/* ===== TAB: FINANCIAL DETAIL ===== */}
            {activeTab === 'financial' && <FinancialBreakdownPanel />}

            {/* ===== TAB: CODE REVIEWER (CodeRabbit-style) ===== */}
            {activeTab === 'code-reviewer' && <CodeReviewerPanel />}


          </motion.div>
        </AnimatePresence>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="mt-auto border-t py-3 px-4" style={{ borderColor: 'var(--zcc-hairline)', background: 'rgba(10,15,28,0.9)' }}>
        <div className="max-w-[1920px] mx-auto flex items-center justify-between">
          <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
            ZÉLLA Central Control v3.0 · Mission Control · {new Date().getFullYear()}
          </span>
          <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
            MODO DEUS · Acesso restrito
          </span>
        </div>
      </footer>
    </div>
  );
}
