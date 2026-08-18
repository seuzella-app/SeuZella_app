'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarSync,
  Link2,
  Unplug,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  Info,
  ShieldCheck,
  BarChart3,
  Globe,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface BookingSyncPanelProps {
  niche: 'pousada' | 'airbnb';
  tenantId?: string;
  propertyName?: string;
}

interface BookingSyncConfig {
  id: string;
  tenantId: string;
  hotelId?: string | null;
  icalExportUrl?: string | null;
  icalImportUrl?: string | null;
  syncToken: string;
  status: string; // pending | connected | error | disconnected
  lastSync?: string | null;
  syncCount: number;
  bookingsImported: number;
  bookingsExported: number;
  errorMessage?: string | null;
}

interface SyncStats {
  totalChannels: number;
  activeChannels: number;
}

interface ChannelInfo {
  id: string;
  name: string;
  connected: boolean;
  config?: BookingSyncConfig;
}

interface FetchResult {
  success: boolean;
  channels: ChannelInfo[];
  totalConnected: number;
  configs: BookingSyncConfig[];
  error?: string;
}

// ═══════════════════════════════════════════════════════════════
// STATUS CONFIG
// ═══════════════════════════════════════════════════════════════

type SyncStatus = 'connected' | 'disconnected' | 'syncing' | 'error' | 'pending';

function getStatusConfig(status: SyncStatus) {
  switch (status) {
    case 'connected':
      return {
        label: 'Conectado',
        icon: CheckCircle2,
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
        textColor: 'text-emerald-400',
        dotColor: 'bg-emerald-500',
      };
    case 'syncing':
      return {
        label: 'Sincronizando',
        icon: RefreshCw,
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        textColor: 'text-yellow-400',
        dotColor: 'bg-yellow-500',
      };
    case 'error':
      return {
        label: 'Erro',
        icon: AlertTriangle,
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        textColor: 'text-red-400',
        dotColor: 'bg-red-500',
      };
    case 'pending':
      return {
        label: 'Pendente',
        icon: Clock,
        bgColor: 'bg-zinc-500/10',
        borderColor: 'border-zinc-500/30',
        textColor: 'text-zinc-400',
        dotColor: 'bg-zinc-500',
      };
    case 'disconnected':
    default:
      return {
        label: 'Desconectado',
        icon: Unplug,
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        textColor: 'text-red-400',
        dotColor: 'bg-red-500',
      };
  }
}

// ═══════════════════════════════════════════════════════════════
// DATE FORMATTER
// ═══════════════════════════════════════════════════════════════

function formatSyncDate(dateStr?: string | null): string {
  if (!dateStr) return 'Nunca';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ═══════════════════════════════════════════════════════════════
// BOOKING SYNC PANEL — Main Component
// ═══════════════════════════════════════════════════════════════

export function BookingSyncPanel({ niche, tenantId, propertyName: _propertyName }: BookingSyncPanelProps) {
  const isPousada = niche === 'pousada';

  // ── State ──────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [configs, setConfigs] = useState<BookingSyncConfig[]>([]);
  // channels state intentionally omitted — stats computed inline during fetch
  const [stats, setStats] = useState<SyncStats>({ totalChannels: 0, activeChannels: 0 });
  const [error, setError] = useState<string | null>(null);

  const [icalImportUrl, setIcalImportUrl] = useState('');
  const [hotelId, setHotelId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<string | null>(null);

  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // ── Fetch sync status ──────────────────────────────────
  const fetchSyncStatus = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ddc/booking-sync?tenantId=${tenantId}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Network error' }));
        setError(json.error || 'Erro ao carregar configurações');
        return;
      }
      const json: FetchResult = await res.json();
      if (!json.success) {
        setError(json.error || 'Erro desconhecido');
        return;
      }
      setConfigs(json.configs || []);
      setStats({
        totalChannels: json.channels?.length || 0,
        activeChannels: json.totalConnected || 0,
      });
      // Pre-fill input if there's an existing import URL
      const bookingConfig = json.configs?.find((c) => c.icalImportUrl);
      if (bookingConfig?.icalImportUrl) {
        setIcalImportUrl(bookingConfig.icalImportUrl);
      }
      if (bookingConfig?.hotelId) {
        setHotelId(bookingConfig.hotelId);
      }
    } catch (err) {
      console.error('[BookingSyncPanel] fetch error:', err);
      setError('Erro de conexão com o servidor');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchSyncStatus();
  }, [fetchSyncStatus]);

  // ── Connect (configure) ────────────────────────────────
  const handleConnect = async () => {
    if (!tenantId) {
      toast.error('tenantId é obrigatório para conectar.');
      return;
    }
    if (!icalImportUrl.trim()) {
      toast.error('Insira a URL do iCal do Booking.com.');
      return;
    }
    // Basic URL validation
    if (!icalImportUrl.trim().startsWith('http')) {
      toast.error('A URL deve começar com http:// ou https://');
      return;
    }
    setIsConnecting(true);
    try {
      const res = await fetch('/api/ddc/booking-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          icalImportUrl: icalImportUrl.trim(),
          hotelId: hotelId.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Erro ao conectar com Booking.com');
        return;
      }
      toast.success('Booking.com conectado com sucesso!');
      await fetchSyncStatus();
    } catch (err) {
      console.error('[BookingSyncPanel] connect error:', err);
      toast.error('Erro de conexão ao tentar configurar.');
    } finally {
      setIsConnecting(false);
    }
  };

  // ── Manual sync ────────────────────────────────────────
  const handleSync = async () => {
    if (!tenantId) {
      toast.error('tenantId é obrigatório.');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await fetch('/api/ddc/booking-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', tenantId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Erro ao sincronizar');
        return;
      }
      const imported = json.imported ?? 0;
      const errors = json.errors ?? 0;
      if (imported > 0) {
        toast.success(`${imported} reservas importadas do Booking.com!`);
      } else {
        toast.success('Sincronização concluída — nenhuma reserva nova.');
      }
      if (errors > 0) {
        toast.warning(`${errors} erros durante a importação.`);
      }
      await fetchSyncStatus();
    } catch (err) {
      console.error('[BookingSyncPanel] sync error:', err);
      toast.error('Erro de conexão ao sincronizar.');
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Disconnect ─────────────────────────────────────────
  const handleDisconnect = async (configId: string) => {
    if (!tenantId || !configId) return;
    setIsDisconnecting(true);
    try {
      const res = await fetch(
        `/api/ddc/booking-sync?configId=${configId}&tenantId=${tenantId}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Erro ao desconectar');
        return;
      }
      toast.success('Booking.com desconectado.');
      setDisconnectTarget(null);
      setIcalImportUrl('');
      setHotelId('');
      await fetchSyncStatus();
    } catch (err) {
      console.error('[BookingSyncPanel] disconnect error:', err);
      toast.error('Erro ao desconectar.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // ── Copy URL ───────────────────────────────────────────
  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(key);
      toast.success('URL copiada!');
      setTimeout(() => setCopiedUrl(null), 2500);
    } catch {
      toast.error('Erro ao copiar URL.');
    }
  };

  // ── Get active booking config ──────────────────────────
  const activeConfig = configs.find((c) => c.status === 'connected' && c.icalImportUrl);
  const hasConnection = !!activeConfig;
  const syncStatus: SyncStatus = isSyncing
    ? 'syncing'
    : hasConnection
      ? 'connected'
      : configs.some((c) => c.status === 'error')
        ? 'error'
        : configs.length > 0 && !hasConnection
          ? 'disconnected'
          : 'pending';
  const statusConfig = getStatusConfig(syncStatus);
  const StatusIcon = statusConfig.icon;

  // ── Accent classes ─────────────────────────────────────
  const accentBg = isPousada ? 'bg-emerald-500/15' : 'bg-blue-500/15';
  const accentBorder = isPousada ? 'border-emerald-500/20' : 'border-blue-500/20';
  const accentText = isPousada ? 'text-emerald-400' : 'text-blue-400';
  const accentHover = isPousada ? 'hover:border-emerald-500/30' : 'hover:border-blue-500/30';
  const accentRing = isPousada
    ? 'focus-visible:border-emerald-500 focus-visible:ring-emerald-500/50'
    : 'focus-visible:border-blue-500 focus-visible:ring-blue-500/50';
  const accentBtnBg = isPousada
    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
    : 'bg-blue-600 hover:bg-blue-500 text-white';

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* ── Header Card ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="bg-[#121216] border border-white/[0.06] rounded-xl overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${accentBg} border ${accentBorder} flex items-center justify-center`}>
                  <CalendarSync className={`w-4.5 h-4.5 ${accentText}`} />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-white tracking-tight">
                    Sincronização Booking.com
                  </CardTitle>
                  <CardDescription className="text-[10px] text-white/40 mt-0.5">
                    Importe reservas do Booking.com via iCal e mantenha tudo sincronizado
                  </CardDescription>
                </div>
              </div>
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[9px] px-2 py-0.5 h-5 font-bold uppercase ${statusConfig.bgColor} ${statusConfig.borderColor} ${statusConfig.textColor}`}
                >
                  <div className="relative mr-1.5">
                    <StatusIcon className="w-3 h-3" />
                    {syncStatus === 'connected' && (
                      <motion.div
                        className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 ${statusConfig.dotColor} rounded-full`}
                        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}
                  </div>
                  {statusConfig.label}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {/* ── Stats Row ────────────────────────────────── */}
            {hasConnection && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4"
              >
                {[
                  {
                    label: 'Última Sync',
                    value: formatSyncDate(activeConfig?.lastSync),
                    icon: Clock,
                  },
                  {
                    label: 'Reservas Importadas',
                    value: activeConfig?.bookingsImported ?? 0,
                    icon: BarChart3,
                  },
                  {
                    label: 'Total Sincronizações',
                    value: activeConfig?.syncCount ?? 0,
                    icon: RefreshCw,
                  },
                  {
                    label: 'Reservas Exportadas',
                    value: activeConfig?.bookingsExported ?? 0,
                    icon: Globe,
                  },
                ].map((stat, i) => {
                  const StatIcon = stat.icon;
                  return (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.05 }}
                      className="bg-[#0a0a0f]/60 border border-white/[0.03] rounded-lg p-2.5"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <StatIcon className={`w-3 h-3 ${accentText}`} />
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                          {stat.label}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white font-mono">
                        {stat.value}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* ── Error Message ────────────────────────────── */}
            {activeConfig?.errorMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block">
                    Erro na sincronização
                  </span>
                  <p className="text-xs text-red-300/80 mt-0.5">{activeConfig.errorMessage}</p>
                </div>
              </motion.div>
            )}

            {/* ── iCal Export URL ──────────────────────────── */}
            {hasConnection && activeConfig?.icalExportUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-4"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <ExternalLink className={`w-3.5 h-3.5 ${accentText}`} />
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    URL de Exportação iCal
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-[#0a0a0f] border border-white/[0.04] rounded-lg p-2.5">
                  <div className="flex-1 min-w-0">
                    <code className="text-[11px] text-zinc-300 font-mono truncate block">
                      {activeConfig.icalExportUrl}
                    </code>
                    <p className="text-[9px] text-zinc-500 mt-1">
                      Cole esta URL no extranet do Booking.com para exportar suas reservas
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0 hover:bg-white/[0.06]"
                    onClick={() => copyToClipboard(activeConfig!.icalExportUrl!, 'export')}
                    title="Copiar URL de exportação"
                  >
                    {copiedUrl === 'export' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            <Separator className="bg-white/[0.04] my-4" />

            {/* ── iCal Import URL Input ───────────────────── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              <div className="flex items-center gap-1.5 mb-2.5">
                <Link2 className={`w-3.5 h-3.5 ${accentText}`} />
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  URL de Importação iCal do Booking.com
                </span>
              </div>

              <div className="space-y-2.5">
                {/* iCal URL Input */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      value={icalImportUrl}
                      onChange={(e) => setIcalImportUrl(e.target.value)}
                      placeholder="https://admin.booking.com/hotel/ical/..."
                      className={`h-9 bg-[#0a0a0f] border-white/[0.06] text-white text-xs placeholder:text-zinc-500 rounded-lg ${accentRing} focus-visible:ring-[2px]`}
                      disabled={isConnecting || isSyncing}
                      aria-label="URL do iCal do Booking.com"
                    />
                  </div>
                  <Button
                    onClick={handleConnect}
                    disabled={isConnecting || !icalImportUrl.trim() || isSyncing}
                    className={`h-9 px-4 rounded-lg text-xs font-bold ${accentBtnBg} shadow-xs disabled:opacity-50`}
                  >
                    {isConnecting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Link2 className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {hasConnection ? 'Atualizar' : 'Conectar'}
                  </Button>
                </div>

                {/* Hotel ID Input (optional) */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      value={hotelId}
                      onChange={(e) => setHotelId(e.target.value)}
                      placeholder="Hotel ID (opcional)"
                      className={`h-8 bg-[#0a0a0f] border-white/[0.04] text-white text-xs placeholder:text-zinc-500 rounded-lg ${accentRing} focus-visible:ring-[2px]`}
                      disabled={isConnecting || isSyncing}
                      aria-label="Hotel ID do Booking.com"
                    />
                  </div>
                  <div className="w-[88px] flex items-center">
                    <span className="text-[9px] text-zinc-500">opcional</span>
                  </div>
                </div>
              </div>

              {/* How to find iCal URL hint */}
              <div className={`mt-3 ${accentBg} border ${accentBorder} rounded-lg p-2.5`}>
                <div className="flex items-start gap-2">
                  <Info className={`w-3.5 h-3.5 ${accentText} shrink-0 mt-0.5`} />
                  <div className="text-[10px] text-zinc-400 leading-relaxed">
                    <span className={`${accentText} font-bold`}>Como encontrar a URL:</span>
                    Acesse o extranet do Booking.com →{' '}
                    {isPousada ? 'Propriedade' : 'Imóvel'} → Configurações →{' '}
                    Sincronização de calendário → Copie a URL do iCal.
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Action Buttons ────────────────────────────── */}
            {hasConnection && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.04]"
              >
                {/* Manual Sync */}
                <Button
                  onClick={handleSync}
                  disabled={isSyncing || isDisconnecting}
                  variant="outline"
                  className={`h-8 px-3 rounded-lg text-xs font-bold border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-white ${accentHover} disabled:opacity-50`}
                >
                  {isSyncing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Sincronizar agora
                </Button>

                {/* Disconnect */}
                <Button
                  onClick={() => setDisconnectTarget(activeConfig!.id)}
                  disabled={isSyncing || isDisconnecting}
                  variant="outline"
                  className="h-8 px-3 rounded-lg text-xs font-bold border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300 hover:border-red-500/30 disabled:opacity-50"
                >
                  <Unplug className="w-3.5 h-3.5 mr-1.5" />
                  Desconectar
                </Button>

                {/* Channel Stats */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <ShieldCheck className="w-3 h-3 text-zinc-500" />
                  <span className="text-[9px] text-zinc-500 font-mono">
                    {stats.activeChannels}/{stats.totalChannels} canais
                  </span>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Empty State ──────────────────────────────────── */}
      {!isLoading && !error && configs.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.35 }}
        >
          <Card className="bg-[#121216] border border-white/[0.06] rounded-xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center max-w-md mx-auto">
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
                  className={`w-14 h-14 rounded-2xl ${accentBg} border ${accentBorder} flex items-center justify-center mb-4`}
                >
                  <CalendarSync className={`w-7 h-7 ${accentText}`} />
                </motion.div>

                <h3 className="text-sm font-bold text-white mb-1.5">
                  Conecte com o Booking.com
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                  Sincronize reservas automaticamente importando o calendário iCal
                  do Booking.com. Suas reservas serão atualizadas em tempo real
                  no painel do Zélla.
                </p>

                <div className="space-y-2.5 w-full">
                  {[
                    {
                      step: '1',
                      text: 'Acesse o extranet do Booking.com',
                      icon: ExternalLink,
                    },
                    {
                      step: '2',
                      text: 'Copie a URL iCal em Sincronização → Calendário',
                      icon: Copy,
                    },
                    {
                      step: '3',
                      text: 'Cole a URL acima e clique em Conectar',
                      icon: Link2,
                    },
                  ].map((item, i) => {
                    const StepIcon = item.icon;
                    return (
                      <motion.div
                        key={item.step}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.55 + i * 0.08 }}
                        className="flex items-center gap-3 bg-[#0a0a0f]/60 border border-white/[0.03] rounded-lg p-3"
                      >
                        <div
                          className={`w-7 h-7 rounded-lg ${accentBg} border ${accentBorder} flex items-center justify-center shrink-0`}
                        >
                          <span className={`text-[10px] font-bold ${accentText}`}>{item.step}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <StepIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="text-xs text-zinc-300">{item.text}</span>
                        </div>
                        {i < 2 && (
                          <ArrowRight className="w-3 h-3 text-zinc-500 shrink-0 hidden sm:block" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Export URL teaser */}
                <div className={`mt-5 ${accentBg} border ${accentBorder} rounded-lg p-3 w-full`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className={`w-3.5 h-3.5 ${accentText}`} />
                    <span className={`text-[10px] font-bold ${accentText} uppercase tracking-wider`}>
                      Exportação iCal
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    Ao conectar, o Zélla gera uma URL de exportação iCal que você
                    pode colar no extranet do Booking.com para sincronizar
                    {isPousada ? ' suas reservas de pousada' : ' suas reservas de imóvel'}
                    bidirecionalmente.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Loading State ────────────────────────────────── */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <Card className="bg-[#121216] border border-white/[0.06] rounded-xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <CalendarSync className={`w-8 h-8 ${accentText}`} />
                </motion.div>
                <span className="text-xs text-zinc-500">Carregando configurações de sincronização...</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Error State ──────────────────────────────────── */}
      {!isLoading && error && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Card className="bg-[#121216] border border-red-500/20 rounded-xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">
                  Erro ao carregar
                </h3>
                <p className="text-xs text-red-300/80 mb-4">{error}</p>
                <Button
                  onClick={fetchSyncStatus}
                  variant="outline"
                  className="h-8 px-3 rounded-lg text-xs font-bold border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-white"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Tentar novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Disconnect Confirmation Dialog ────────────────── */}
      <Dialog open={!!disconnectTarget} onOpenChange={(open) => !open && setDisconnectTarget(null)}>
        <DialogContent className="bg-[#0a0a0f] border border-white/[0.08] text-white max-w-sm p-6 rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Unplug className="w-4 h-4 text-red-400" />
              </div>
              Desconectar Booking.com
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 pt-2">
              Isso removerá a sincronização iCal com o Booking.com.
              Reservas importadas anteriormente não serão afetadas,
              mas novas reservas não serão sincronizada automaticamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-4 border-t border-white/[0.04]">
            <Button
              variant="outline"
              onClick={() => setDisconnectTarget(null)}
              className="h-8 px-3 rounded-lg text-xs font-bold border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => disconnectTarget && handleDisconnect(disconnectTarget)}
              disabled={isDisconnecting}
              className="h-8 px-3 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
            >
              {isDisconnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : null}
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
