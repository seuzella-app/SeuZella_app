'use client';

// =============================================================================
// 🔐 SEU ZÉLLA — LocksTab (Fechaduras Eletrônicas)
// =============================================================================
// Componente principal do módulo de Fechaduras Eletrônicas.
//
// Renderizado dentro do DDC de Pousadas E de Anfitriões Airbnb.
// O `niche` prop controla a paleta:
//   - pousada → verde (emerald)
//   - airbnb  → azul (blue)
//
// ESTRUTURA:
// 1. Header com métricas (dispositivos, PINs ativos, alertas)
// 2. Lista de dispositivos (cards)
// 3. Lista de PINs ativos (tabela)
// 4. Botão de emergência (revogar todos)
// 5. Modal de cadastro de novo dispositivo (wizard marca → modo)
// 6. Modal de geração de PIN
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Key,
  Lock,
  Unlock,
  Plus,
  Battery,
  BatteryLow,
  Wifi,
  WifiOff,
  Trash2,
  Pencil,
  AlertTriangle,
  ShieldCheck,
  Smartphone,
  Building2,
  Home,
  Clock,
  Send,
  Copy,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
  Zap,
  CheckCircle2,
  Info,
  Power,
  User,
  Calendar,
  RefreshCw,
  QrCode,
  Cpu,
} from 'lucide-react';
import {
  type LockDeviceData,
  type LockCodeData,
  type LockBrand,
  type BrandCatalogEntry,
  BRAND_CATALOG,
  listAllBrands,
  getBrandInfo,
} from '@/lib/locks/types';
import { calculatePinValidityWindow } from '@/lib/locks/pin-generator';

interface LocksTabProps {
  niche: 'pousada' | 'airbnb';
  /** ID da propriedade atual (pousada ou airbnb). Em demo, usa 'demo-prop-1'. */
  propertyId?: string;
}

// ─── Paletas por niche ──────────────────────────────────────────────────────
const PALETTE = {
  pousada: {
    accent: 'emerald',
    text: 'text-emerald-400',
    bgSoft: 'bg-emerald-500/10',
    borderSoft: 'border-emerald-500/30',
    bgBtn: 'bg-emerald-600 hover:bg-emerald-500',
    textBtn: 'text-emerald-300',
    glow: 'shadow-emerald-500/10',
  },
  airbnb: {
    accent: 'blue',
    text: 'text-blue-400',
    bgSoft: 'bg-blue-500/10',
    borderSoft: 'border-blue-500/30',
    bgBtn: 'bg-blue-600 hover:bg-blue-500',
    textBtn: 'text-blue-300',
    glow: 'shadow-blue-500/10',
  },
} as const;

type Palette = (typeof PALETTE)[keyof typeof PALETTE];

// ─── Componente principal ───────────────────────────────────────────────────

export function LocksTab({ niche, propertyId = 'demo-prop-1' }: LocksTabProps) {
  const palette = PALETTE[niche];
  const [devices, setDevices] = useState<LockDeviceData[]>([]);
  const [allPins, setAllPins] = useState<LockCodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  // Modais
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showGeneratePin, setShowGeneratePin] = useState<LockDeviceData | null>(null);
  const [showPanicConfirm, setShowPanicConfirm] = useState<LockDeviceData | null>(null);
  const [showDevicePins, setShowDevicePins] = useState<LockDeviceData | null>(null);

  // Carrega dispositivos
  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ddc/locks?propertyId=${propertyId}`);
      const data = await res.json();
      if (data.success) {
        setDevices(data.data);
        // Para cada dispositivo, carrega PINs
        const allPinsList: LockCodeData[] = [];
        await Promise.all(
          (data.data as LockDeviceData[]).map(async (d) => {
            try {
              const pinsRes = await fetch(`/api/ddc/locks/${d.id}/pins`);
              const pinsData = await pinsRes.json();
              if (pinsData.success) {
                allPinsList.push(...pinsData.data);
              }
            } catch {
              // skip
            }
          }),
        );
        allPinsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAllPins(allPinsList);
      } else {
        toast.error('Erro ao carregar fechaduras', { description: data.error });
      }
    } catch (err) {
      toast.error('Erro de conexão ao carregar fechaduras');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Métricas
  const totalDevices = devices.length;
  const apiDevices = devices.filter((d) => d.providerType === 'api').length;
  const manualDevices = devices.filter((d) => d.providerType === 'manual').length;
  const lowBatteryDevices = devices.filter((d) => d.batteryLevel != null && d.batteryLevel < 20).length;
  const activePins = allPins.filter((p) => p.status === 'active' || p.status === 'scheduled').length;

  return (
    <div className="space-y-4">
      {/* ─── HEADER ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-[#121216] border border-white/[0.04] rounded-xl p-5`}
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-xl ${palette.bgSoft} border ${palette.borderSoft} flex items-center justify-center`}>
              <Key className={`w-6 h-6 ${palette.text}`} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                Fechaduras Eletrônicas
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${palette.bgSoft} ${palette.text} border ${palette.borderSoft} font-bold uppercase`}>
                  {niche === 'pousada' ? 'Pousada' : 'Anfitrião'}
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl">
                Gerencie fechaduras inteligentes e PINs temporários. Compatível com 10 marcas do mercado brasileiro —
                5 com API automática (TTLock, Tuya, Igloohome, Nuki, August) e 5 em modo manual (Intelbras, Yale, Papaiz, Philco, Samsung).
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddDevice(true)}
            className={`flex items-center gap-2 px-4 py-2 ${palette.bgBtn} text-white font-bold text-xs rounded-lg transition-all active:scale-95 shrink-0`}
          >
            <Plus className="w-4 h-4" />
            Adicionar Fechadura
          </button>
        </div>

        {/* ─── KPIs ─── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <KpiTile label="Dispositivos" value={totalDevices} icon={<Lock className="w-3.5 h-3.5" />} palette={palette} />
          <KpiTile label="Com API" value={apiDevices} icon={<Zap className="w-3.5 h-3.5" />} palette={palette} />
          <KpiTile label="Manuais" value={manualDevices} icon={<Cpu className="w-3.5 h-3.5" />} palette={palette} />
          <KpiTile label="PINs ativos" value={activePins} icon={<Key className="w-3.5 h-3.5" />} palette={palette} />
          <KpiTile
            label="Bateria fraca"
            value={lowBatteryDevices}
            icon={<BatteryLow className="w-3.5 h-3.5" />}
            palette={palette}
            warn={lowBatteryDevices > 0}
          />
        </div>
      </motion.div>

      {/* ─── LOADING ─── */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          <span className="ml-2 text-zinc-500 text-sm">Carregando fechaduras...</span>
        </div>
      )}

      {/* ─── EMPTY STATE ─── */}
      {!loading && devices.length === 0 && (
        <div className="bg-[#121216] border border-white/[0.04] rounded-xl p-12 text-center">
          <div className={`w-16 h-16 mx-auto rounded-2xl ${palette.bgSoft} border ${palette.borderSoft} flex items-center justify-center mb-4`}>
            <Key className={`w-8 h-8 ${palette.text}`} />
          </div>
          <h3 className="text-white font-bold text-base mb-1">Nenhuma fechadura cadastrada</h3>
          <p className="text-zinc-500 text-xs max-w-md mx-auto mb-4">
            Cadastre sua primeira fechadura eletrônica para começar a gerar PINs temporários automáticos para seus hóspedes.
            Funciona com Intelbras, TTLock, Yale, Igloohome e outras 6 marcas.
          </p>
          <button
            onClick={() => setShowAddDevice(true)}
            className={`inline-flex items-center gap-2 px-4 py-2 ${palette.bgBtn} text-white font-bold text-xs rounded-lg transition-all active:scale-95`}
          >
            <Plus className="w-4 h-4" />
            Cadastrar primeira fechadura
          </button>
        </div>
      )}

      {/* ─── LISTA DE DISPOSITIVOS ─── */}
      {!loading && devices.length > 0 && (
        <div className="space-y-3">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              palette={palette}
              onGeneratePin={() => setShowGeneratePin(device)}
              onShowPins={() => setShowDevicePins(device)}
              onPanicRevoke={() => setShowPanicConfirm(device)}
              onRefresh={loadDevices}
              expanded={expandedDevice === device.id}
              onToggleExpand={() =>
                setExpandedDevice(expandedDevice === device.id ? null : device.id)
              }
            />
          ))}
        </div>
      )}

      {/* ─── PINs ATIVOS (tabela) ─── */}
      {!loading && allPins.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[#121216] border border-white/[0.04] rounded-xl overflow-hidden"
        >
          <div className="p-4 border-b border-white/[0.04]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className={`w-4 h-4 ${palette.text}`} />
              PINs Recentes
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 font-mono">
                {allPins.length}
              </span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase text-zinc-500 font-bold border-b border-white/[0.04]">
                  <th className="text-left p-3">Hóspede</th>
                  <th className="text-left p-3">Dispositivo</th>
                  <th className="text-left p-3">PIN</th>
                  <th className="text-left p-3">Válido de</th>
                  <th className="text-left p-3">Até</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {allPins.slice(0, 10).map((pin) => (
                  <PinRow key={pin.id} pin={pin} palette={palette} onRefresh={loadDevices} />
                ))}
              </tbody>
            </table>
          </div>
          {allPins.length > 10 && (
            <div className="p-3 text-center text-[11px] text-zinc-500 border-t border-white/[0.04]">
              + {allPins.length - 10} PIN(s) anterior(es) — use o botão "Ver PINs" de cada dispositivo para ver o histórico completo.
            </div>
          )}
        </motion.div>
      )}

      {/* ─── EMERGÊNCIA ─── */}
      {!loading && devices.length > 0 && (
        <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-4.5 h-4.5 text-red-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-300">Emergência</h4>
              <p className="text-[11px] text-red-300/70">
                Suspeita de vazamento de PIN? Revogue todos os PINs ativos de uma vez. Os hóspedes serão notificados e novos PINs podem ser gerados.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowPanicConfirm(devices[0])}
            className="px-3 py-2 bg-red-600/80 hover:bg-red-500 text-white font-bold text-xs rounded-lg transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
          >
            <Power className="w-3.5 h-3.5" />
            Revogar Todos os PINs
          </button>
        </div>
      )}

      {/* ─── MODAIS ─── */}
      <AnimatePresence>
        {showAddDevice && (
          <AddDeviceModal
            niche={niche}
            propertyId={propertyId}
            palette={palette}
            onClose={() => setShowAddDevice(false)}
            onCreated={() => {
              setShowAddDevice(false);
              loadDevices();
            }}
          />
        )}
        {showGeneratePin && (
          <GeneratePinModal
            device={showGeneratePin}
            palette={palette}
            onClose={() => setShowGeneratePin(null)}
            onGenerated={() => {
              setShowGeneratePin(null);
              loadDevices();
            }}
          />
        )}
        {showDevicePins && (
          <DevicePinsModal
            device={showDevicePins}
            palette={palette}
            onClose={() => setShowDevicePins(null)}
            onRefresh={loadDevices}
          />
        )}
        {showPanicConfirm && (
          <PanicConfirmModal
            device={showPanicConfirm}
            onClose={() => setShowPanicConfirm(null)}
            onConfirmed={() => {
              setShowPanicConfirm(null);
              loadDevices();
              toast.success('Todos os PINs foram revogados com sucesso.');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// ─── KPI Tile ──────────────────────────────────────────────────────────────
// =============================================================================

function KpiTile({
  label,
  value,
  icon,
  palette,
  warn = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  palette: Palette;
  warn?: boolean;
}) {
  return (
    <div
      className={`bg-[#0a0a0f] border rounded-lg p-3 ${
        warn ? 'border-red-500/30 bg-red-500/5' : 'border-white/[0.04]'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">{label}</span>
        <span className={warn ? 'text-red-400' : palette.text}>{icon}</span>
      </div>
      <div className={`text-2xl font-extrabold ${warn ? 'text-red-300' : 'text-white'}`}>{value}</div>
    </div>
  );
}

// =============================================================================
// ─── Device Card ───────────────────────────────────────────────────────────
// =============================================================================

function DeviceCard({
  device,
  palette,
  onGeneratePin,
  onShowPins,
  onPanicRevoke,
  onRefresh,
  expanded,
  onToggleExpand,
}: {
  device: LockDeviceData;
  palette: Palette;
  onGeneratePin: () => void;
  onShowPins: () => void;
  onPanicRevoke: () => void;
  onRefresh: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const brandInfo = getBrandInfo(device.brand);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isApiDevice = device.providerType === 'api';
  const isLowBattery = device.batteryLevel != null && device.batteryLevel < 20;

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/ddc/locks/${device.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Fechadura removida. Todos os PINs foram revogados.');
        onRefresh();
      } else {
        toast.error('Erro ao remover', { description: data.error });
      }
    } catch {
      toast.error('Erro de conexão');
    }
    setShowDeleteConfirm(false);
  };

  return (
    <motion.div
      layout
      className={`bg-[#121216] border border-white/[0.04] rounded-xl overflow-hidden ${palette.glow}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Status indicator */}
            <div className={`w-10 h-10 rounded-lg ${palette.bgSoft} border ${palette.borderSoft} flex items-center justify-center shrink-0`}>
              {brandInfo?.logo ? (
                <span className="text-lg">{brandInfo.logo}</span>
              ) : (
                <Lock className={`w-5 h-5 ${palette.text}`} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white truncate">{device.nickname}</h3>
                {device.location && (
                  <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                    <Building2 className="w-2.5 h-2.5" />
                    {device.location}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                <span className="text-zinc-400">{brandInfo?.label ?? device.brand}</span>
                {device.model && <span className="text-zinc-500">· {device.model}</span>}
                {isApiDevice ? (
                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${palette.bgSoft} ${palette.text} font-bold text-[9px] uppercase`}>
                    <Zap className="w-2.5 h-2.5" />
                    API automática
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-400 font-bold text-[9px] uppercase">
                    <Cpu className="w-2.5 h-2.5" />
                    Manual
                  </span>
                )}
              </div>

              {/* Status row */}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500">
                {device.online ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Wifi className="w-2.5 h-2.5" />
                    Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-zinc-500">
                    <WifiOff className="w-2.5 h-2.5" />
                    Offline
                  </span>
                )}
                {device.batteryLevel !== null && (
                  <span className={`flex items-center gap-1 ${isLowBattery ? 'text-red-400' : 'text-zinc-400'}`}>
                    {isLowBattery ? <BatteryLow className="w-2.5 h-2.5" /> : <Battery className="w-2.5 h-2.5" />}
                    {device.batteryLevel}%
                  </span>
                )}
                {device._count && (
                  <span className="flex items-center gap-1">
                    <Key className="w-2.5 h-2.5" />
                    {device._count.activeCodes} PIN(s) ativo(s)
                  </span>
                )}
                {device.lastSeenAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(device.lastSeenAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Expand button */}
          <button
            onClick={onToggleExpand}
            className="p-1.5 rounded hover:bg-white/5 text-zinc-500 transition-colors"
            title={expanded ? 'Recolher' : 'Expandir'}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button
            onClick={onGeneratePin}
            className={`flex items-center gap-1.5 px-3 py-1.5 ${palette.bgSoft} ${palette.text} border ${palette.borderSoft} font-bold text-[11px] rounded-lg transition-all active:scale-95 hover:brightness-125`}
          >
            <Plus className="w-3 h-3" />
            Gerar PIN
          </button>
          <button
            onClick={onShowPins}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/[0.04] font-bold text-[11px] rounded-lg transition-all active:scale-95"
          >
            <Key className="w-3 h-3" />
            Ver PINs
          </button>
          <button
            onClick={onPanicRevoke}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-[11px] rounded-lg transition-all active:scale-95"
          >
            <AlertTriangle className="w-3 h-3" />
            Revogar PINs
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition-colors text-[11px]"
            title="Remover dispositivo"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/[0.04] overflow-hidden"
          >
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <h4 className="text-[10px] uppercase font-bold text-zinc-500 mb-2">Informações Técnicas</h4>
                <dl className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Marca:</dt>
                    <dd className="text-zinc-300 font-medium">{brandInfo?.label ?? device.brand}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Modelo:</dt>
                    <dd className="text-zinc-300 font-medium">{device.model ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Tipo:</dt>
                    <dd className="text-zinc-300 font-medium">{isApiDevice ? 'API automática' : 'Manual'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">N° de série:</dt>
                    <dd className="text-zinc-300 font-mono text-[10px]">{device.serialNumber ?? '—'}</dd>
                  </div>
                  {device.externalDeviceId && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-500">ID externo:</dt>
                      <dd className="text-zinc-300 font-mono text-[10px]">{device.externalDeviceId}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div>
                <h4 className="text-[10px] uppercase font-bold text-zinc-500 mb-2">
                  Sobre a marca {brandInfo?.label}
                </h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{brandInfo?.notes}</p>
                {brandInfo && (
                  <p className="text-[10px] text-zinc-500 mt-2">
                    <strong className="text-zinc-400">Participação no mercado BR:</strong> {brandInfo.marketShareBR}
                  </p>
                )}
                {device.notes && (
                  <div className="mt-2 p-2 bg-white/[0.02] rounded border border-white/[0.04]">
                    <p className="text-[10px] text-zinc-500 mb-1">Notas do host:</p>
                    <p className="text-[11px] text-zinc-300">{device.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-10"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0a0a0f] border border-red-500/30 rounded-xl p-5 max-w-sm"
            >
              <h4 className="text-sm font-bold text-white mb-2">Remover fechadura?</h4>
              <p className="text-xs text-zinc-400 mb-4">
                Todos os PINs ativos serão revogados imediatamente. Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg"
                >
                  Remover
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================================================
// ─── PIN Row ───────────────────────────────────────────────────────────────
// =============================================================================

function PinRow({
  pin,
  palette,
  onRefresh,
}: {
  pin: LockCodeData;
  palette: Palette;
  onRefresh: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pin.code);
    toast.success('PIN copiado para a área de transferência');
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      const res = await fetch(`/api/ddc/locks/${pin.deviceId}/pins/${pin.id}?reason=Revogado manualmente`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('PIN revogado');
        onRefresh();
      } else {
        toast.error('Erro ao revogar', { description: data.error });
      }
    } catch {
      toast.error('Erro de conexão');
    }
    setRevoking(false);
  };

  const statusBadge = getStatusBadge(pin.status);

  return (
    <tr className="border-b border-white/[0.02] hover:bg-white/[0.02]">
      <td className="p-3">
        <div className="flex items-center gap-2">
          <User className="w-3 h-3 text-zinc-500" />
          <div>
            <div className="text-zinc-300 font-medium">{pin.guestName ?? 'Hóspede'}</div>
            {pin.guestPhone && <div className="text-[10px] text-zinc-500 font-mono">{pin.guestPhone}</div>}
          </div>
        </div>
      </td>
      <td className="p-3 text-zinc-400">{pin.device?.nickname ?? '—'}</td>
      <td className="p-3">
        <div className="flex items-center gap-1.5">
          <code className={`font-mono font-bold ${palette.text}`}>
            {revealed ? pin.code : '•'.repeat(pin.code.length)}
          </code>
          <button
            onClick={() => setRevealed(!revealed)}
            className="text-zinc-500 hover:text-zinc-300"
            title={revealed ? 'Ocultar' : 'Revelar'}
          >
            {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <button
            onClick={handleCopy}
            className="text-zinc-500 hover:text-zinc-300"
            title="Copiar"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </td>
      <td className="p-3 text-zinc-400 text-[11px]">
        {new Date(pin.validFrom).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
      </td>
      <td className="p-3 text-zinc-400 text-[11px]">
        {new Date(pin.validTo).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
      </td>
      <td className="p-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge.cls}`}>
          {statusBadge.icon}
          {statusBadge.label}
        </span>
      </td>
      <td className="p-3 text-right">
        {pin.status === 'active' || pin.status === 'scheduled' ? (
          <button
            onClick={handleRevoke}
            disabled={revoking}
            className="text-red-400 hover:text-red-300 disabled:opacity-50 text-[11px] font-bold inline-flex items-center gap-1"
          >
            {revoking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
            Revogar
          </button>
        ) : (
          <span className="text-zinc-600 text-[10px]">—</span>
        )}
      </td>
    </tr>
  );
}

function getStatusBadge(status: string): { label: string; cls: string; icon: React.ReactNode } {
  switch (status) {
    case 'active':
      return {
        label: 'Ativo',
        cls: 'bg-emerald-500/15 text-emerald-300',
        icon: <CheckCircle2 className="w-2.5 h-2.5" />,
      };
    case 'scheduled':
      return {
        label: 'Agendado',
        cls: 'bg-blue-500/15 text-blue-300',
        icon: <Clock className="w-2.5 h-2.5" />,
      };
    case 'used':
      return {
        label: 'Usado',
        cls: 'bg-zinc-500/15 text-zinc-400',
        icon: <CheckCircle2 className="w-2.5 h-2.5" />,
      };
    case 'expired':
      return {
        label: 'Expirado',
        cls: 'bg-zinc-500/15 text-zinc-500',
        icon: <Clock className="w-2.5 h-2.5" />,
      };
    case 'revoked':
      return {
        label: 'Revogado',
        cls: 'bg-red-500/15 text-red-300',
        icon: <Power className="w-2.5 h-2.5" />,
      };
    default:
      return { label: status, cls: 'bg-zinc-500/15 text-zinc-400', icon: null };
  }
}

// =============================================================================
// ─── Add Device Modal ──────────────────────────────────────────────────────
// =============================================================================

function AddDeviceModal({
  niche,
  propertyId,
  palette,
  onClose,
  onCreated,
}: {
  niche: 'pousada' | 'airbnb';
  propertyId: string;
  palette: Palette;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<'brand' | 'details'>('brand');
  const [selectedBrand, setSelectedBrand] = useState<LockBrand | null>(null);
  const [form, setForm] = useState({
    nickname: '',
    location: '',
    model: '',
    serialNumber: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const brands = listAllBrands();
  const apiBrands = brands.filter((b) => b.apiAvailable);
  const manualBrands = brands.filter((b) => !b.apiAvailable);

  const handleSubmit = async () => {
    if (!selectedBrand) return;
    if (!form.nickname.trim()) {
      toast.error('Apelido é obrigatório');
      return;
    }
    setSaving(true);
    try {
      const brandInfo = getBrandInfo(selectedBrand)!;
      const res = await fetch('/api/ddc/locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          propertyType: niche,
          nickname: form.nickname.trim(),
          location: form.location.trim() || undefined,
          brand: selectedBrand,
          model: form.model.trim() || undefined,
          providerType: brandInfo.apiAvailable ? 'api' : 'manual',
          serialNumber: form.serialNumber.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Fechadura "${form.nickname}" cadastrada!`, {
          description: brandInfo.apiAvailable
            ? 'Modo API: PINs serão gerados automaticamente quando OAuth estiver configurado.'
            : 'Modo Manual: você deverá gerar o PIN no app oficial da marca e colar no Zélla.',
        });
        onCreated();
      } else {
        toast.error('Erro ao cadastrar', { description: data.error });
      }
    } catch (err) {
      toast.error('Erro de conexão');
      console.error(err);
    }
    setSaving(false);
  };

  return (
    <ModalWrapper onClose={onClose} title="Adicionar Fechadura" palette={palette}>
      {step === 'brand' && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-400">
            Selecione a marca da sua fechadura. As marcas com API geram PINs automaticamente; as manuais exigem que você cole o PIN gerado no app oficial.
          </p>

          {/* Marcas com API */}
          <div>
            <h4 className="text-[10px] uppercase font-bold text-zinc-500 mb-2 flex items-center gap-1">
              <Zap className={`w-3 h-3 ${palette.text}`} />
              Com API automática (5 marcas)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {apiBrands.map((brand) => (
                <BrandOption
                  key={brand.id}
                  brand={brand}
                  selected={selectedBrand === brand.id}
                  onSelect={() => setSelectedBrand(brand.id)}
                  palette={palette}
                />
              ))}
            </div>
          </div>

          {/* Marcas manuais */}
          <div>
            <h4 className="text-[10px] uppercase font-bold text-zinc-500 mb-2 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-zinc-400" />
              Modo manual (5 marcas — sem API pública)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {manualBrands.map((brand) => (
                <BrandOption
                  key={brand.id}
                  brand={brand}
                  selected={selectedBrand === brand.id}
                  onSelect={() => setSelectedBrand(brand.id)}
                  palette={palette}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.04]">
            <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
              Cancelar
            </button>
            <button
              onClick={() => setStep('details')}
              disabled={!selectedBrand}
              className={`px-3 py-1.5 ${palette.bgBtn} text-white text-xs font-bold rounded-lg disabled:opacity-40`}
            >
              Próximo
            </button>
          </div>
        </div>
      )}

      {step === 'details' && selectedBrand && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setStep('brand')}
              className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1"
            >
              <ChevronRight className="w-3 h-3 rotate-180" />
              Voltar
            </button>
            <span className="text-zinc-500 text-xs">/</span>
            <span className="text-xs text-zinc-300">
              {getBrandInfo(selectedBrand)?.label}
            </span>
          </div>

          <Field label="Apelido *" required>
            <input
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              placeholder="Ex: Suíte Master 104, Porta da Frente"
              className="input-base"
            />
          </Field>

          <Field label="Localização (opcional)">
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Ex: Porta frontal, Portão dos fundos"
              className="input-base"
            />
          </Field>

          <Field label="Modelo (opcional)">
            <input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder={getBrandInfo(selectedBrand)?.popularModels[0] ?? 'Ex: TTLock X15'}
              className="input-base"
            />
          </Field>

          <Field label="Número de série (opcional)">
            <input
              value={form.serialNumber}
              onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
              placeholder="Etiqueta na embalagem da fechadura"
              className="input-base"
            />
          </Field>

          <Field label="Notas internas (opcional)">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ex: Bateria trocada em 01/2025, código master 1234"
              rows={2}
              className="input-base resize-none"
            />
          </Field>

          {getBrandInfo(selectedBrand)?.apiAvailable && (
            <div className={`p-3 rounded-lg ${palette.bgSoft} border ${palette.borderSoft} text-[11px] ${palette.textBtn} flex items-start gap-2`}>
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                <strong>Modo API:</strong> PINs serão gerados automaticamente quando você conectar sua conta {getBrandInfo(selectedBrand)?.label} via OAuth.
                Por ora, você pode gerar PINs manualmente (gera no app oficial e cola no Zélla).
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.04]">
            <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !form.nickname.trim()}
              className={`px-3 py-1.5 ${palette.bgBtn} text-white text-xs font-bold rounded-lg disabled:opacity-40 flex items-center gap-1.5`}
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Cadastrar Fechadura
            </button>
          </div>
        </div>
      )}
    </ModalWrapper>
  );
}

function BrandOption({
  brand,
  selected,
  onSelect,
  palette,
}: {
  brand: BrandCatalogEntry;
  selected: boolean;
  onSelect: () => void;
  palette: Palette;
}) {
  return (
    <button
      onClick={onSelect}
      className={`text-left p-3 rounded-lg border transition-all ${
        selected
          ? `${palette.bgSoft} ${palette.borderSoft} ${palette.textBtn}`
          : 'bg-[#0a0a0f] border-white/[0.04] text-zinc-300 hover:border-white/[0.08]'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{brand.logo}</span>
        <span className="font-bold text-xs">{brand.label}</span>
        {brand.apiAvailable && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${palette.bgSoft} ${palette.text} font-bold uppercase ml-auto`}>
            API
          </span>
        )}
      </div>
      <p className="text-[10px] text-zinc-500 line-clamp-2">{brand.marketShareBR}</p>
    </button>
  );
}

// =============================================================================
// ─── Generate PIN Modal ────────────────────────────────────────────────────
// =============================================================================

function GeneratePinModal({
  device,
  palette,
  onClose,
  onGenerated,
}: {
  device: LockDeviceData;
  palette: Palette;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const brandInfo = getBrandInfo(device.brand);
  const isManual = device.providerType === 'manual' || !brandInfo?.apiAvailable;
  const [form, setForm] = useState({
    guestName: '',
    guestPhone: '',
    checkInDate: '',
    checkOutDate: '',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    manualPin: '',
    autoGenerate: false,
    note: '',
  });
  const [generating, setGenerating] = useState(false);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [whatsappSent, setWhatsappSent] = useState(false);

  // Pré-preenche datas com hoje + amanhã
  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86400000);
    setForm((f) => ({
      ...f,
      checkInDate: today.toISOString().slice(0, 10),
      checkOutDate: tomorrow.toISOString().slice(0, 10),
    }));
  }, []);

  const handleGenerate = async () => {
    if (!form.checkInDate || !form.checkOutDate) {
      toast.error('Datas de check-in e check-out são obrigatórias');
      return;
    }
    if (isManual && !form.manualPin.trim() && !form.autoGenerate) {
      toast.error('Para marcas manuais, forneça o PIN gerado no app da marca ou marque "Gerar PIN criptográfico".');
      return;
    }
    setGenerating(true);
    setGeneratedPin(null);
    setWhatsappSent(false);
    try {
      const res = await fetch(`/api/ddc/locks/${device.id}/pins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: form.guestName.trim() || undefined,
          guestPhone: form.guestPhone.trim() || undefined,
          checkInDate: form.checkInDate,
          checkOutDate: form.checkOutDate,
          checkInTime: form.checkInTime,
          checkOutTime: form.checkOutTime,
          manualPin: form.manualPin.trim() || undefined,
          autoGenerate: form.autoGenerate,
          note: form.note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedPin(data.data.code.code);
        setWhatsappSent(data.data.delivered);
        toast.success('PIN gerado com sucesso!', {
          description: data.data.delivered
            ? 'Enviado via WhatsApp para o hóspede.'
            : 'WhatsApp não enviado — copie o PIN e envie manualmente.',
        });
      } else {
        toast.error('Erro ao gerar PIN', { description: data.error });
      }
    } catch (err) {
      toast.error('Erro de conexão');
      console.error(err);
    }
    setGenerating(false);
  };

  const handleCopy = () => {
    if (generatedPin) {
      navigator.clipboard.writeText(generatedPin);
      toast.success('PIN copiado!');
    }
  };

  return (
    <ModalWrapper onClose={onClose} title={`Gerar PIN — ${device.nickname}`} palette={palette}>
      <div className="space-y-3">
        {/* Info da marca */}
        <div className={`p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-start gap-2`}>
          <span className="text-base">{brandInfo?.logo}</span>
          <div className="flex-1">
            <div className="text-xs font-bold text-white">{brandInfo?.label}</div>
            <div className="text-[11px] text-zinc-500">
              {isManual ? (
                <>
                  <strong>Modo manual:</strong> gere o PIN no app oficial {brandInfo?.label} e cole no campo abaixo.
                </>
              ) : (
                <>
                  <strong>Modo API:</strong> PIN será gerado automaticamente (quando OAuth estiver configurado, por enquanto use o manual).
                </>
              )}
            </div>
          </div>
        </div>

        <Field label="Nome do hóspede">
          <input
            value={form.guestName}
            onChange={(e) => setForm({ ...form, guestName: e.target.value })}
            placeholder="João Silva"
            className="input-base"
          />
        </Field>

        <Field label="WhatsApp do hóspede">
          <input
            value={form.guestPhone}
            onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
            placeholder="+55 11 99999-0000"
            className="input-base"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Check-in">
            <input
              type="date"
              value={form.checkInDate}
              onChange={(e) => setForm({ ...form, checkInDate: e.target.value })}
              className="input-base"
            />
            <input
              type="time"
              value={form.checkInTime}
              onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
              className="input-base mt-1"
            />
          </Field>
          <Field label="Check-out">
            <input
              type="date"
              value={form.checkOutDate}
              onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })}
              className="input-base"
            />
            <input
              type="time"
              value={form.checkOutTime}
              onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
              className="input-base mt-1"
            />
          </Field>
        </div>

        {/* PIN manual OU auto-gerar */}
        <div className="space-y-2">
          <Field label={isManual ? 'PIN gerado no app oficial da marca' : 'PIN (opcional — deixe vazio para auto-gerar)'}>
            <input
              value={form.manualPin}
              onChange={(e) => setForm({ ...form, manualPin: e.target.value })}
              placeholder="Ex: 4821# (TTLock usa # ao final)"
              className="input-base font-mono"
              maxLength={12}
            />
          </Field>
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoGenerate}
              onChange={(e) => setForm({ ...form, autoGenerate: e.target.checked })}
              className="rounded border-zinc-700"
            />
            <span>
              Gerar PIN criptográfico automaticamente (CSPRNG)
              {isManual && (
                <span className="text-zinc-500 block text-[10px] mt-0.5">
                  ⚠️ Você precisará cadastrar esse PIN manualmente na fechadura via app {brandInfo?.label}.
                </span>
              )}
            </span>
          </label>
        </div>

        <Field label="Nota (opcional)">
          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Ex: Reserva BK-1234, suite master"
            className="input-base"
          />
        </Field>

        {/* Resultado */}
        {generatedPin && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-4 rounded-lg ${palette.bgSoft} border ${palette.borderSoft}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white">PIN gerado:</span>
              {whatsappSent ? (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <Send className="w-2.5 h-2.5" />
                  Enviado via WhatsApp
                </span>
              ) : (
                <span className="text-[10px] text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Copie e envie manualmente
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <code className={`text-3xl font-mono font-extrabold ${palette.text}`}>
                {generatedPin}
              </code>
              <button
                onClick={handleCopy}
                className={`p-2 ${palette.bgSoft} ${palette.text} border ${palette.borderSoft} rounded-lg hover:brightness-125`}
                title="Copiar"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 mt-2">
              Válido de {form.checkInDate} {form.checkInTime} até {form.checkOutDate} {form.checkOutTime}
            </p>
          </motion.div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.04]">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
            {generatedPin ? 'Fechar' : 'Cancelar'}
          </button>
          {!generatedPin && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`px-3 py-1.5 ${palette.bgBtn} text-white text-xs font-bold rounded-lg disabled:opacity-40 flex items-center gap-1.5`}
            >
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
              Gerar PIN
            </button>
          )}
          {generatedPin && (
            <button
              onClick={onGenerated}
              className={`px-3 py-1.5 ${palette.bgBtn} text-white text-xs font-bold rounded-lg`}
            >
              Concluído
            </button>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}

// =============================================================================
// ─── Device Pins Modal (lista completa de PINs de um dispositivo) ──────────
// =============================================================================

function DevicePinsModal({
  device,
  palette,
  onClose,
  onRefresh,
}: {
  device: LockDeviceData;
  palette: Palette;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [pins, setPins] = useState<LockCodeData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ddc/locks/${device.id}/pins`);
      const data = await res.json();
      if (data.success) setPins(data.data);
    } catch {
      toast.error('Erro ao carregar PINs');
    }
    setLoading(false);
  }, [device.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ModalWrapper
      onClose={onClose}
      title={`PINs — ${device.nickname}`}
      palette={palette}
      wide
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
        </div>
      ) : pins.length === 0 ? (
        <div className="py-8 text-center text-zinc-500 text-xs">
          Nenhum PIN gerado para esta fechadura ainda.
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {pins.map((pin) => (
            <PinListItem key={pin.id} pin={pin} palette={palette} onRefresh={() => { load(); onRefresh(); }} />
          ))}
        </div>
      )}
    </ModalWrapper>
  );
}

function PinListItem({
  pin,
  palette,
  onRefresh,
}: {
  pin: LockCodeData;
  palette: Palette;
  onRefresh: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      const res = await fetch(`/api/ddc/locks/${pin.deviceId}/pins/${pin.id}?reason=Revogado pelo host`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('PIN revogado');
        onRefresh();
      } else {
        toast.error('Erro ao revogar', { description: data.error });
      }
    } catch {
      toast.error('Erro de conexão');
    }
    setRevoking(false);
  };

  const statusBadge = getStatusBadge(pin.status);

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      <code className={`font-mono font-bold text-sm ${palette.text}`}>
        {revealed ? pin.code : '•'.repeat(pin.code.length)}
      </code>
      <button
        onClick={() => setRevealed(!revealed)}
        className="text-zinc-500 hover:text-zinc-300"
      >
        {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-300 truncate">
          {pin.guestName ?? 'Hóspede sem nome'}
          {pin.guestPhone && <span className="text-zinc-500 ml-1 font-mono text-[10px]">{pin.guestPhone}</span>}
        </div>
        <div className="text-[10px] text-zinc-500">
          {new Date(pin.validFrom).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          {' → '}
          {new Date(pin.validTo).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${statusBadge.cls}`}>
        {statusBadge.icon}
        {statusBadge.label}
      </span>
      {(pin.status === 'active' || pin.status === 'scheduled') && (
        <button
          onClick={handleRevoke}
          disabled={revoking}
          className="text-red-400 hover:text-red-300 disabled:opacity-50"
          title="Revogar"
        >
          {revoking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// ─── Panic Confirm Modal ───────────────────────────────────────────────────
// =============================================================================

function PanicConfirmModal({
  device,
  onClose,
  onConfirmed,
}: {
  device: LockDeviceData;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/ddc/locks/${device.id}/panic-revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || 'Pânico acionado pelo host' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.data.revokedCount} PIN(s) revogado(s)`, {
          description: 'Todos os PINs ativos foram invalidados.',
        });
        onConfirmed();
      } else {
        toast.error('Erro ao revogar PINs', { description: data.error });
      }
    } catch {
      toast.error('Erro de conexão');
    }
    setConfirming(false);
  };

  return (
    <ModalWrapper onClose={onClose} title="🚨 Revogar TODOS os PINs" palette={PALETTE.pousada} danger>
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-xs text-red-300">
            Esta ação vai revogar <strong>TODOS</strong> os PINs ativos da fechadura <strong>{device.nickname}</strong>.
            Hóspedes que tentarem usar o PIN antigo não conseguirão abrir a porta.
            Esta ação não pode ser desfeita.
          </p>
        </div>
        <Field label="Motivo (opcional)">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Suspeita de vazamento, hóspede fez checkout..."
            className="input-base"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg disabled:opacity-40 flex items-center gap-1.5"
          >
            {confirming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
            Revogar TODOS os PINs
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

// =============================================================================
// ─── Modal Wrapper ─────────────────────────────────────────────────────────
// =============================================================================

function ModalWrapper({
  children,
  onClose,
  title,
  palette,
  wide,
  danger,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  palette: Palette;
  wide?: boolean;
  danger?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`bg-[#0a0a0f] border rounded-xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-hidden flex flex-col`}
        style={{
          borderColor: danger ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/[0.04] shrink-0">
          <h3 className={`text-sm font-extrabold flex items-center gap-2 ${danger ? 'text-red-300' : 'text-white'}`}>
            {danger && <AlertTriangle className="w-4 h-4" />}
            {title}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] text-zinc-400 font-medium block mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
