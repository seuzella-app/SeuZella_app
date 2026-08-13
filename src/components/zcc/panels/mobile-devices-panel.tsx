"use client";

/**
 * ZCC Panel — Mobile Devices Tracking
 * ======================================
 *
 * Monitora todos os celulares plugados no seuzélla.com via rotas /mobile/pousada
 * e /mobile/airbnb. Permite ao operador ver:
 *   - Quantos dispositivos estão ativos agora
 *   - Distribuição por nicho (Pousada vs Airbnb)
 *   - Distribuição por tenant (multi-empresa)
 *   - Histórico de acessos recentes
 *
 * Como funciona o tracking:
 *   - Cada visita a /mobile/pousada ou /mobile/airbnb grava um "ping" no banco
 *     via /api/mobile/devices-tracking (anonimizado, sem cookies persistentes)
 *   - O ping contém: tenantId (do subdomínio), niche, userAgent, viewport,
 *     timestamp, e um deviceId efêmero (sessionStorage, não persistente)
 *   - LGPD compliant: nenhum dado pessoal é coletado sem consentimento
 *
 * Endpoint: GET /api/mobile/devices-tracking (admin ZCC)
 */

import * as React from "react";
import { motion } from "framer-motion";
import {
  Smartphone,
  RefreshCw,
  Hotel,
  Home,
  Wifi,
  Activity,
  Users,
  Globe,
  MapPin,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DevicePing {
  id: string;
  tenantId: string;
  tenantName?: string;
  niche: "pousada" | "airbnb";
  userAgent: string;
  viewport: string;
  deviceId: string;
  lastSeen: string;
  firstSeen: string;
  sessionDuration: number; // seconds
}

interface DevicesSummary {
  totalActive: number;
  pousadaActive: number;
  airbnbActive: number;
  uniqueTenants: number;
  last24h: number;
  last7d: number;
  recentDevices: DevicePing[];
}

const REFRESH_INTERVAL_MS = 30_000; // 30s

export function MobileDevicesPanel() {
  const [data, setData] = React.useState<DevicesSummary | null>(null);
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
      // Dados mock para demo quando API não está disponível
      if (!data) {
        setData({
          totalActive: 0,
          pousadaActive: 0,
          airbnbActive: 0,
          uniqueTenants: 0,
          last24h: 0,
          last7d: 0,
          recentDevices: [],
        });
      }
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
        <span className="text-sm">Carregando dispositivos conectados...</span>
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

  const summary = data!;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card/50 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">
              <Smartphone className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Dispositivos Mobile Conectados
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Monitor em tempo real de celulares plugados em /mobile/pousada e /mobile/airbnb
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
        {/* KPIs principais */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Online Agora"
            value={summary.totalActive}
            icon={<Activity className="size-4" />}
            variant="emerald"
          />
          <KpiCard
            label="Pousada Mobile"
            value={summary.pousadaActive}
            icon={<Hotel className="size-4" />}
            variant="emerald-soft"
            href="/mobile/pousada"
          />
          <KpiCard
            label="Airbnb Mobile"
            value={summary.airbnbActive}
            icon={<Home className="size-4" />}
            variant="blue"
            href="/mobile/airbnb"
          />
          <KpiCard
            label="Tenants únicos"
            value={summary.uniqueTenants}
            icon={<Users className="size-4" />}
            variant="purple"
          />
        </div>

        {/* Stats secundários */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <Clock className="size-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Últimas 24h
                </p>
                <p className="text-xl font-bold tabular-nums">{summary.last24h}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-blue-100 text-blue-700">
                <Globe className="size-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Últimos 7 dias
                </p>
                <p className="text-xl font-bold tabular-nums">{summary.last7d}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de dispositivos recentes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wifi className="size-4 text-emerald-500" />
              Dispositivos Ativos Agora
              {summary.totalActive > 0 && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 ml-auto">
                  {summary.totalActive} {summary.totalActive === 1 ? "conectado" : "conectados"}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {summary.recentDevices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Smartphone className="size-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum dispositivo conectado no momento</p>
                <p className="text-xs mt-1">
                  Quando um usuário acessar /mobile/pousada ou /mobile/airbnb,
                  ele aparecerá aqui em tempo real.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {summary.recentDevices.map((device) => (
                  <DeviceRow key={device.id} device={device} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acesso rápido aos DDCs Mobile */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Acesso rápido — DDCs Mobile</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 grid grid-cols-2 gap-3">
            <a
              href="/mobile/pousada"
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-emerald-200 bg-emerald-50 p-3 hover:bg-emerald-100 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <Hotel className="size-4 text-emerald-600" />
                <span className="font-semibold text-emerald-900">Pousada Mobile</span>
              </div>
              <p className="text-xs text-emerald-700/70">/mobile/pousada</p>
              <p className="text-[10px] text-emerald-700/60 mt-1">
                Visão Geral, Hóspedes, Central Zélla, Whats Live, Mais
              </p>
            </a>
            <a
              href="/mobile/airbnb"
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-blue-200 bg-blue-50 p-3 hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <Home className="size-4 text-blue-600" />
                <span className="font-semibold text-blue-900">Airbnb Mobile</span>
              </div>
              <p className="text-xs text-blue-700/70">/mobile/airbnb</p>
              <p className="text-[10px] text-blue-700/60 mt-1">
                Financeiro, Check-ins, Shield, Link-in-Bio, Simulador
              </p>
            </a>
          </CardContent>
        </Card>

        {error && (
          <div className="text-xs text-amber-600 italic flex items-center gap-2">
            <AlertCircle className="size-3.5" />
            <span>API indisponível — mostrando dados de demonstração.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  variant,
  href,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  variant: "emerald" | "emerald-soft" | "blue" | "purple";
  href?: string;
}) {
  const palette = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    "emerald-soft": "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
  }[variant];

  return (
    <Card className={palette}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider opacity-80">{label}</span>
          {icon}
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] underline opacity-70 hover:opacity-100"
          >
            {href} ↗
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function DeviceRow({ device }: { device: DevicePing }) {
  const ago = computeTimeAgo(device.lastSeen);
  const nicheColor =
    device.niche === "pousada"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : "bg-blue-100 text-blue-700 border-blue-200";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
    >
      <div className={`grid size-9 place-items-center rounded-md border ${nicheColor}`}>
        <Smartphone className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="outline" className={`text-[10px] border ${nicheColor}`}>
            {device.niche === "pousada" ? "Pousada" : "Airbnb"}
          </Badge>
          <span className="text-xs font-medium truncate">
            {device.tenantName || device.tenantId}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="size-3" />
            {parseDeviceType(device.userAgent)}
          </span>
          <span className="flex items-center gap-1">
            <Activity className="size-3" />
            {device.viewport}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold tabular-nums">{ago}</p>
        <p className="text-[10px] text-muted-foreground">
          sessão {formatDuration(device.sessionDuration)}
        </p>
      </div>
    </motion.div>
  );
}

function computeTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.round(diff / 1000)}s atrás`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h atrás`;
  return `${Math.round(diff / 86_400_000)}d atrás`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}min`;
}

function parseDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("android")) return "Android";
  if (ua.includes("macintosh")) return "Mac";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("linux")) return "Linux";
  return "Desconhecido";
}
