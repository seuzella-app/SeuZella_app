'use client';

/**
 * MobileYieldProfitWidget — Versão compacta para o DDC Mobile
 * ============================================================
 *
 * Card destacado no topo do app mobile (Pousada/Airbnb) que mostra:
 *   💰 R$ 21.450 gerado pela IA nesta temporada
 *
 * Diferenças vs YieldProfitWidget (desktop):
 *   - Padding menor (p-3 ao invés de p-6)
 *   - Número hero menor (text-2xl ao invés de text-3xl)
 *   - Top feriados com lista mais compacta
 *   - Sem animação framer-motion (performance mobile)
 *   - Auto-refresh a cada 5min
 *
 * Endpoint: GET /api/yield/profit-summary
 */

import { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, Trophy, Loader2, AlertCircle } from 'lucide-react';

interface YieldData {
  totalExtraProfitBrl: number;
  totalBonusShareBrl: number;
  totalYieldNights: number;
  scarcityLockNights: number;
  demandSurgeNights: number;
  byHoliday: Record<string, { nights: number; extraProfitBrl: number }>;
  formatted?: {
    totalExtra: string;
    message: string;
  };
  databaseAvailable?: boolean;
}

interface MobileYieldProfitWidgetProps {
  niche: 'pousada' | 'airbnb';
  propertyName?: string;
  onNavigate?: (tab: any) => void;
}

export function MobileYieldProfitWidget({ niche, propertyName, onNavigate }: MobileYieldProfitWidgetProps) {
  const [data, setData] = useState<YieldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/yield/profit-summary', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setData(json);
        setError(null);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Falha ao carregar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const accentColor = niche === 'pousada' ? 'emerald' : 'cyan';

  if (loading) {
    return (
      <div className={`mx-3 mb-3 mt-3 rounded-xl border border-${accentColor}-500/30 bg-${accentColor}-500/5 p-3 flex items-center gap-2`}>
        <Loader2 className={`h-4 w-4 animate-spin text-${accentColor}-400`} />
        <span className={`text-xs text-${accentColor}-300`}>Calculando ganhos...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-3 mb-3 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-400" />
        <span className="text-xs text-amber-300">Yield indisponível agora</span>
      </div>
    );
  }

  const hasProfit = data.totalExtraProfitBrl > 0;
  const topHoliday = Object.entries(data.byHoliday || {})
    .sort((a, b) => b[1].extraProfitBrl - a[1].extraProfitBrl)
    .slice(0, 2);

  const formattedExtra =
    data.formatted?.totalExtra ??
    data.totalExtraProfitBrl.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  return (
    <div className={`mx-3 mb-3 mt-3 rounded-xl border border-${accentColor}-500/30 bg-gradient-to-br from-${accentColor}-500/10 to-transparent p-3`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-${accentColor}-500/20 text-${accentColor}-400`}>
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold text-zinc-100 leading-tight">
            Ganhos com Precificação Dinâmica
          </h3>
          <p className="text-[10px] text-zinc-500">Seu Zélla Yield Booster</p>
        </div>
      </div>

      {hasProfit ? (
        <>
          {/* Hero number */}
          <p className={`text-2xl font-extrabold text-${accentColor}-400 tabular-nums leading-tight`}>
            {formattedExtra}
          </p>
          <p className="text-[11px] text-zinc-400 mt-0.5 mb-2">
            {data.totalYieldNights} {data.totalYieldNights === 1 ? 'diária' : 'diárias'} com yield
          </p>

          {/* Tiers breakdown compact */}
          <div className="grid grid-cols-3 gap-1 mb-2">
            <TierChip label="Escassez" count={data.scarcityLockNights} variant="danger" />
            <TierChip label="Demanda" count={data.demandSurgeNights} variant="warning" />
            <TierChip
              label="Base"
              count={Math.max(0, data.totalYieldNights - data.scarcityLockNights - data.demandSurgeNights)}
              variant="neutral"
            />
          </div>

          {/* Top feriados compact */}
          {topHoliday.length > 0 && (
            <div className="space-y-1">
              {topHoliday.map(([name, info]) => (
                <div
                  key={name}
                  className="flex items-center justify-between text-[11px] py-1"
                >
                  <span className="flex items-center gap-1 text-zinc-300">
                    <Trophy className="h-3 w-3 text-amber-400" />
                    {name}
                  </span>
                  <span className={`font-semibold text-${accentColor}-400`}>
                    {info.extraProfitBrl.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-1 text-[10px] text-zinc-600 mt-2">
            <TrendingUp className="h-3 w-3" />
            <span>Tempo real · IA ajustando tarifa</span>
          </div>
        </>
      ) : (
        // Empty state mobile
        <div className="text-center py-2">
          <div className="flex h-8 w-8 mx-auto items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 mb-1">
            <TrendingUp className="h-4 w-4" />
          </div>
          <p className="text-[11px] text-zinc-300">Yield aguardando reservas</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            IA ajusta preço em alta demanda
          </p>
        </div>
      )}
    </div>
  );
}

function TierChip({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: 'danger' | 'warning' | 'neutral';
}) {
  const palette = {
    danger: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    neutral: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  }[variant];

  return (
    <div className={`rounded-md border ${palette} px-1.5 py-1 text-center`}>
      <p className="text-[9px] uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-sm font-bold tabular-nums">{count}</p>
    </div>
  );
}

export default MobileYieldProfitWidget;
