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
import { OperatorConsole } from '@/components/zcc/OperatorConsole';
import { FinanceiroIntegrado } from '@/components/zcc/FinanceiroIntegrado';
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
      {/* ===== TAB: VISÃO GERAL — replaced with OperatorConsole (Monolith) ===== */}
      {activeTab === 'overview' && (
        <OperatorConsole
          totalMRR={totalMRR}
          totalClients={totalClients}
          totalMessages={apiGlobalMetrics.totalMessagesProcessed}
          totalReservations={apiGlobalMetrics.totalReservations}
          activeAgents="0/12"
          brainAccuracy={`${apiGlobalMetrics.avgBrainAccuracy}%`}
        />
      )}

      {/* ===== ALL OTHER TABS — preserved unchanged ===== */}
      {activeTab === 'agents' && <AgentRosterPanel />}
      {activeTab === 'pulse' && <PulseCheck />}
      {activeTab === 'cerebro' && <CerebroVivoPanel />}
      {activeTab === 'refactors' && <RefactorSuggestionsPanel />}
      {activeTab === 'sandbox' && <SandboxPanel />}
      {activeTab === 'financeiro' && <FinanceiroIntegrado />}
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
