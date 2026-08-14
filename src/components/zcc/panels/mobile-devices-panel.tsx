"use client";

/**
 * ZCC Panel — Mobile Analytics (Desktop vs Mobile)
 * ================================================
 *
 * Painel de ANALYTICS para o operador do ZCC ver:
 *   - Quantos pousadeiros estão online agora (mobile + desktop)
 *   - Distribuição Desktop vs Mobile (24h, 7d)
 *   - Heatmap por horário (24h) — quando os pousadeiros acessam
 *   - Tendência 7 dias (gráfico de barras empilhadas)
 *   - Top abas mais usadas (engajamento)
 *   - Insights automáticos (sugestões de melhoria detectadas pela IA)
 *   - Tempo médio de sessão (mobile vs desktop)
 *
 * Não mostra mockups de celular — apenas DADOS ESTATÍSTICOS.
 *
 * Endpoint: GET /api/mobile/devices-tracking
 */

import * as React from "react";
import { motion } from "framer-motion";
import {
  Smartphone,
  Monitor,
  RefreshCw,
  Activity,
  Users,
  Clock,
  Globe,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Flame,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DevicePing {
  id: string;
  tenantId: string;
  tenantName?: string;
  niche: "pousada" | "airbnb";
  route: string;
  isMobile: boolean;
  userAgent: string;
  viewport: string;
  deviceId: string;
  tabName?: string | null;
  pingCount: number;
  lastSeen: string;
  firstSeen: string;
  sessionDuration: number;
}

interface Insight {
  id: string;
  type: "success" | "warning" | "critical" | "info";
  category: "engagement" | "ux" | "performance" | "adoption" | "peak_hours";
  title: string;
  description: string;
  recommendation: string;
  metric?: string;
}

interface AnalyticsData {
  // Online agora
  onlineNow: number;
  mobileActive: number;
  desktopActive: number;
  pousadaMobile: number;
  airbnbMobile: number;
  pousadaDesktop: number;
  airbnbDesktop: number;
  uniqueTenantsNow: number;
  // Volume
  last24h: number;
  last7d: number;
  last30d: number;
  mobile24h: number;
  desktop24h: number;
  mobile7d: number;
  desktop7d: number;
  mobileShare24h: number;
  desktopShare24h: number;
  mobileShare7d: number;
  desktopShare7d: number;
  // Sessões
  avgSessionSec24h: number;
  avgSessionSecMobile: number;
  avgSessionSecDesktop: number;
  // Charts
  hourlyHeatmap: Array<{ hour: number; mobile: number; desktop: number; total: number }>;
  dailyTrend7d: Array<{ date: string; mobile: number; desktop: number; total: number }>;
  topTabs: Array<{ tabName: string; count: number; avgSessionSec: number }>;
  // Insights
  insights: Insight[];
  // Lista
  recentDevices: DevicePing[];
  databaseAvailable?: boolean;
}

const REFRESH_INTERVAL_MS = 30_000;

export function MobileAnalyticsPanel() {
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/mobile/devices-tracking", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch (err: any) {
      setError(err?.message ?? "Falha ao carregar");
      if (!data) setData(emptyData());
    } finally {
      setLoading(false);
    }
  }, [data]);

  React.useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="p-6 flex items-center gap-3 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando analytics...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 text-amber-600 flex items-center gap-3">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  const a = data!;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card/50 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">
              <BarChart3 className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Mobile Analytics — Desktop vs Mobile
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Estatísticas de uso dos DDCs · insights automáticos para melhorar o produto
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-[10px] text-muted-foreground">
                Atualizado: {lastUpdate.toLocaleTimeString("pt-BR")}
              </span>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {a.databaseAvailable === false && (
          <div className="text-xs text-amber-600 italic flex items-center gap-2 bg-amber-50 border border-amber-200 p-3 rounded-md">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>
              Banco de dados indisponível — mostrando dados vazios. Execute{" "}
              <code className="bg-amber-100 px-1 rounded">npx prisma migrate dev --name add_device_pings</code>{" "}
              quando contratar a VPS para criar a tabela.
            </span>
          </div>
        )}

        {/* ── KPIs principais: Online agora + 24h + 7d ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Online Agora"
            value={a.onlineNow}
            sublabel={`${a.uniqueTenantsNow} tenants`}
            icon={<Activity className="size-4" />}
            variant="emerald"
          />
          <KpiCard
            label="Últimas 24h"
            value={a.last24h}
            sublabel={`${a.mobile24h}m / ${a.desktop24h}d`}
            icon={<Clock className="size-4" />}
            variant="blue"
          />
          <KpiCard
            label="Últimos 7d"
            value={a.last7d}
            sublabel={`${a.mobile7d}m / ${a.desktop7d}d`}
            icon={<TrendingUp className="size-4" />}
            variant="purple"
          />
          <KpiCard
            label="Últimos 30d"
            value={a.last30d}
            sublabel="sessões totais"
            icon={<Globe className="size-4" />}
            variant="slate"
          />
        </div>

        {/* ── COMPARAÇÃO Desktop vs Mobile (o coração do painel) ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Smartphone className="size-4 text-emerald-500" />
              Desktop vs Mobile
              <span className="text-[10px] text-muted-foreground ml-auto">
                Quem usa mais o Seu Zélla?
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {/* Online agora */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Online agora
              </p>
              <UsageBar
                mobile={a.mobileActive}
                desktop={a.desktopActive}
                showNumbers
              />
            </div>
            {/* 24h */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Últimas 24h — {a.mobileShare24h}% mobile / {a.desktopShare24h}% desktop
              </p>
              <UsageBar
                mobile={a.mobile24h}
                desktop={a.desktop24h}
                showNumbers
              />
            </div>
            {/* 7d */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Últimos 7 dias — {a.mobileShare7d}% mobile / {a.desktopShare7d}% desktop
              </p>
              <UsageBar
                mobile={a.mobile7d}
                desktop={a.desktop7d}
                showNumbers
              />
            </div>

            {/* Split por nicho */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Smartphone className="size-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold">Mobile</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <div className="rounded bg-emerald-50 p-1.5">
                    <p className="text-[9px] uppercase text-emerald-700">Pousada</p>
                    <p className="font-bold text-emerald-900">{a.pousadaMobile}</p>
                  </div>
                  <div className="rounded bg-cyan-50 p-1.5">
                    <p className="text-[9px] uppercase text-cyan-700">Airbnb</p>
                    <p className="font-bold text-cyan-900">{a.airbnbMobile}</p>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Monitor className="size-3.5 text-blue-500" />
                  <span className="text-xs font-semibold">Desktop</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <div className="rounded bg-emerald-50 p-1.5">
                    <p className="text-[9px] uppercase text-emerald-700">Pousada</p>
                    <p className="font-bold text-emerald-900">{a.pousadaDesktop}</p>
                  </div>
                  <div className="rounded bg-cyan-50 p-1.5">
                    <p className="text-[9px] uppercase text-cyan-700">Airbnb</p>
                    <p className="font-bold text-cyan-900">{a.airbnbDesktop}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── INSIGHTS AUTOMÁTICOS (sugestões de melhoria) ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="size-4 text-amber-500" />
              Insights Automáticos
              <Badge className="ml-auto bg-amber-100 text-amber-700 border-amber-300">
                {a.insights.length} {a.insights.length === 1 ? "achado" : "achados"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {a.insights.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Lightbulb className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sem insights por enquanto</p>
                <p className="text-xs mt-1">
                  Insights surgem com mais dados de uso (mínimo 10 sessões/7d)
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {a.insights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── TENDÊNCIA 7 DIAS (gráfico barras empilhadas) ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="size-4 text-blue-500" />
              Tendência — Últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <DailyTrendChart data={a.dailyTrend7d} />
          </CardContent>
        </Card>

        {/* ── HEATMAP HORÁRIO (24h) ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="size-4 text-orange-500" />
              Heatmap por Horário
              <span className="text-[10px] text-muted-foreground ml-auto">
                Quando os pousadeiros acessam?
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <HourlyHeatmap data={a.hourlyHeatmap} />
          </CardContent>
        </Card>

        {/* ── TOP ABAS MAIS USADAS ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="size-4 text-purple-500" />
              Engajamento por Aba
              <span className="text-[10px] text-muted-foreground ml-auto">
                Quais abas os pousadeiros mais usam?
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {a.topTabs.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-xs">
                Sem dados de abas ainda. Preenche conforme os pousadeiros navegam.
              </div>
            ) : (
              <div className="space-y-2">
                {a.topTabs.map((tab, i) => {
                  const max = a.topTabs[0].count || 1;
                  const pct = (tab.count / max) * 100;
                  return (
                    <div key={tab.tabName}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
                          <span className="font-medium">{tab.tabName}</span>
                        </span>
                        <span className="text-muted-foreground">
                          {tab.count} {tab.count === 1 ? "sessão" : "sessões"} ·{" "}
                          {Math.round(tab.avgSessionSec / 60)}min méd
                        </span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── TEMPO MÉDIO DE SESSÃO ── */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Sessão média (24h)
              </p>
              <p className="text-xl font-bold tabular-nums">
                {formatDuration(a.avgSessionSec24h)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1">
                <Smartphone className="size-3" /> Mobile
              </p>
              <p className="text-xl font-bold tabular-nums text-emerald-600">
                {formatDuration(a.avgSessionSecMobile)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1">
                <Monitor className="size-3" /> Desktop
              </p>
              <p className="text-xl font-bold tabular-nums text-blue-600">
                {formatDuration(a.avgSessionSecDesktop)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── DISPOSITIVOS ATIVOS AGORA (top 20) ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="size-4 text-emerald-500" />
              Dispositivos Ativos Agora
              <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-300">
                {a.recentDevices.length} online
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {a.recentDevices.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Activity className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Ninguém online no momento</p>
                <p className="text-xs mt-1">
                  Quando um pousadeiro abrir o DDC, ele aparece aqui em tempo real
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {a.recentDevices.map((device) => (
                  <DeviceRow key={device.id} device={device} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES
// ─────────────────────────────────────────────────────────────────────────────

function emptyData(): AnalyticsData {
  return {
    onlineNow: 0,
    mobileActive: 0,
    desktopActive: 0,
    pousadaMobile: 0,
    airbnbMobile: 0,
    pousadaDesktop: 0,
    airbnbDesktop: 0,
    uniqueTenantsNow: 0,
    last24h: 0,
    last7d: 0,
    last30d: 0,
    mobile24h: 0,
    desktop24h: 0,
    mobile7d: 0,
    desktop7d: 0,
    mobileShare24h: 0,
    desktopShare24h: 0,
    mobileShare7d: 0,
    desktopShare7d: 0,
    avgSessionSec24h: 0,
    avgSessionSecMobile: 0,
    avgSessionSecDesktop: 0,
    hourlyHeatmap: Array.from({ length: 24 }, (_, h) => ({
      hour: h, mobile: 0, desktop: 0, total: 0,
    })),
    dailyTrend7d: Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { date: d.toISOString().slice(0, 10), mobile: 0, desktop: 0, total: 0 };
    }),
    topTabs: [],
    insights: [],
    recentDevices: [],
    databaseAvailable: false,
  };
}

function KpiCard({
  label,
  value,
  sublabel,
  icon,
  variant,
}: {
  label: string;
  value: number;
  sublabel?: string;
  icon: React.ReactNode;
  variant: "emerald" | "blue" | "purple" | "slate";
}) {
  const palette = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  }[variant];

  return (
    <Card className={palette}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider opacity-80">{label}</span>
          {icon}
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {sublabel && <p className="text-[10px] opacity-70 mt-0.5">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

function UsageBar({
  mobile,
  desktop,
  showNumbers,
}: {
  mobile: number;
  desktop: number;
  showNumbers?: boolean;
}) {
  const total = mobile + desktop;
  const mobilePct = total > 0 ? (mobile / total) * 100 : 0;
  const desktopPct = total > 0 ? (desktop / total) * 100 : 0;

  return (
    <div>
      <div className="flex h-6 rounded-md overflow-hidden border border-border">
        <div
          className="bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold transition-all"
          style={{ width: `${mobilePct}%` }}
        >
          {showNumbers && mobilePct > 15 && `${mobile}`}
        </div>
        <div
          className="bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold transition-all"
          style={{ width: `${desktopPct}%` }}
        >
          {showNumbers && desktopPct > 15 && `${desktop}`}
        </div>
      </div>
      {total === 0 && (
        <p className="text-[10px] text-muted-foreground text-center mt-1">
          Sem dados — aguardando primeiras sessões
        </p>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const palette = {
    success: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      icon: <CheckCircle2 className="size-4 text-emerald-600" />,
      text: "text-emerald-900",
    },
    warning: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      icon: <AlertTriangle className="size-4 text-amber-600" />,
      text: "text-amber-900",
    },
    critical: {
      bg: "bg-rose-50",
      border: "border-rose-200",
      icon: <AlertCircle className="size-4 text-rose-600" />,
      text: "text-rose-900",
    },
    info: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      icon: <Lightbulb className="size-4 text-blue-600" />,
      text: "text-blue-900",
    },
  }[insight.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border ${palette.border} ${palette.bg} p-3`}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">{palette.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className={`text-sm font-semibold ${palette.text}`}>{insight.title}</p>
            <Badge variant="outline" className="text-[9px]">
              {insight.category}
            </Badge>
            {insight.metric && (
              <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                {insight.metric}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-2">{insight.description}</p>
          <div className={`text-xs ${palette.text} bg-white/50 rounded p-2 border ${palette.border}`}>
            <span className="font-semibold">→ Recomendação: </span>
            <span>{insight.recommendation}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DailyTrendChart({
  data,
}: {
  data: Array<{ date: string; mobile: number; desktop: number; total: number }>;
}) {
  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-1 h-32">
        {data.map((d, i) => {
          const totalHeight = (d.total / maxTotal) * 100;
          const mobileHeight = d.total > 0 ? (d.mobile / d.total) * totalHeight : 0;
          const desktopHeight = d.total > 0 ? (d.desktop / d.total) * totalHeight : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex flex-col-reverse h-full w-full justify-start">
                <div
                  className="bg-emerald-500 w-full transition-all"
                  style={{ height: `${mobileHeight}%` }}
                  title={`Mobile: ${d.mobile}`}
                />
                <div
                  className="bg-blue-500 w-full transition-all"
                  style={{ height: `${desktopHeight}%` }}
                  title={`Desktop: ${d.desktop}`}
                />
              </div>
              <span className="text-[9px] text-muted-foreground">
                {new Date(d.date + "T00:00:00").toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  weekday: "short",
                }).slice(0, 4)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-emerald-500" /> Mobile
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-blue-500" /> Desktop
        </span>
      </div>
    </div>
  );
}

function HourlyHeatmap({
  data,
}: {
  data: Array<{ hour: number; mobile: number; desktop: number; total: number }>;
}) {
  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div>
      <div className="grid grid-cols-12 gap-0.5">
        {data.map((h) => {
          const intensity = h.total / maxTotal;
          const opacity = h.total === 0 ? 0.1 : 0.3 + intensity * 0.7;
          return (
            <div
              key={h.hour}
              className="aspect-square rounded-sm flex items-center justify-center text-[9px] font-medium relative group"
              style={{
                backgroundColor: h.total === 0
                  ? "rgb(241 245 249)"
                  : `rgba(16, 185, 129, ${opacity})`,
              }}
              title={`${h.hour}h — ${h.total} sessões (m:${h.mobile} d:${h.desktop})`}
            >
              <span className={h.total > 0 ? "text-white" : "text-slate-400"}>
                {h.total > 0 ? h.total : "·"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  );
}

function DeviceRow({ device }: { device: DevicePing }) {
  const ago = computeTimeAgo(device.lastSeen);
  const isMobile = device.isMobile;
  const nicheColor =
    device.niche === "pousada"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : "bg-cyan-100 text-cyan-700 border-cyan-200";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5"
    >
      <div className={`grid size-8 place-items-center rounded-md border ${nicheColor}`}>
        {isMobile ? <Smartphone className="size-3.5" /> : <Monitor className="size-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="outline" className={`text-[10px] border ${nicheColor}`}>
            {device.niche === "pousada" ? "Pousada" : "Airbnb"}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {isMobile ? "Mobile" : "Desktop"}
          </Badge>
          {device.tabName && (
            <span className="text-[10px] text-muted-foreground">aba: {device.tabName}</span>
          )}
          <span className="text-xs font-medium truncate">
            {device.tenantName || device.tenantId}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{parseDeviceType(device.userAgent)}</span>
          <span>{device.viewport}</span>
          <span className="flex items-center gap-1">
            <RefreshCw className="size-3" />
            {device.pingCount} pings
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold tabular-nums">{ago}</p>
        <p className="text-[10px] text-muted-foreground">
          {formatDuration(device.sessionDuration)}
        </p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function computeTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.round(diff / 1000)}s atrás`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h atrás`;
  return `${Math.round(diff / 86_400_000)}d atrás`;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}min`;
}

function parseDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("android")) return "Android";
  if (ua.includes("macintosh")) return "Mac";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("linux")) return "Linux";
  return "—";
}

export default MobileAnalyticsPanel;
