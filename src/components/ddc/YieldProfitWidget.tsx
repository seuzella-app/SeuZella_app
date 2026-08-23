'use client';

/**
 * ZÉLLA — Yield Profit Widget (DDC)
 * ==================================
 *
 * Card de Precificação Dinâmica Seu Zélla
 *
 * Endpoint: GET /api/yield/profit-summary
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Loader2, AlertCircle, Sparkles, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface YieldProfitData {
  totalExtraProfitBrl: number;
  totalBonusShareBrl: number;
  totalYieldNights: number;
  scarcityLockNights: number;
  demandSurgeNights: number;
  nominalNights: number;
  byHoliday: Record<string, { nights: number; extraProfitBrl: number }>;
  formatted?: {
    totalExtra: string;
    bonusShare: string;
    message: string;
  };
  databaseAvailable?: boolean;
}

interface YieldProfitWidgetProps {
  /** Força mostrar em modo compacto (cards menores) */
  compact?: boolean;
  /** Callback ao carregar os dados — útil para upstream aggregator */
  onDataLoaded?: (data: YieldProfitData) => void;
}

export function YieldProfitWidget({ compact = false, onDataLoaded }: YieldProfitWidgetProps) {
  const [data, setData] = useState<YieldProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/yield/profit-summary', {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setData(json.data);
          onDataLoaded?.(json.data);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Erro ao carregar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [onDataLoaded]);

  if (loading) {
    return (
      <Card className="border-white/10 bg-[#0d0d14] rounded-2xl mb-4">
        <CardContent className="p-4 flex items-center justify-center gap-2 text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          <span className="text-xs">Calculando rendimento da temporada...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null;
  }

  const hasProfit = data.totalExtraProfitBrl > 0;
  const phase2Active = data.totalBonusShareBrl > 0;
  const topHoliday = Object.entries(data.byHoliday || {})
    .sort((a, b) => b[1].extraProfitBrl - a[1].extraProfitBrl)
    .slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-4"
    >
      <Card className="border-white/10 bg-[#0d0d14] rounded-2xl overflow-hidden shadow-none">
        <CardContent className={compact ? 'p-4' : 'p-6'}>
          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  Ganhos Extras com Precificação Dinâmica
                </h3>
                <p className="text-xs text-zinc-400">Motor Seu Zélla · Yield Booster</p>
              </div>
            </div>
            {phase2Active ? (
              <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                ZÉLLA BOOST ativo
              </Badge>
            ) : (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                Temporada Grátis
              </Badge>
            )}
          </div>

          {hasProfit ? (
            <>
              {/* ── Hero Number ── */}
              <div className="mb-4">
                <p className="text-3xl font-extrabold text-emerald-400 tabular-nums">
                  {data.formatted?.totalExtra ?? 'R$ 0,00'}
                </p>
                <p className="text-sm text-zinc-300 mt-1">
                  {data.formatted?.message ??
                    `Lucro extra gerado em ${data.totalYieldNights} diárias com ajuste dinâmico.`}
                </p>
              </div>

              {/* ── Breakdown por Tier ── */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <TierPill
                  label="Escassez"
                  count={data.scarcityLockNights}
                  variant="danger"
                />
                <TierPill
                  label="Alta Demanda"
                  count={data.demandSurgeNights}
                  variant="warning"
                />
                <TierPill
                  label="Nominal"
                  count={data.nominalNights}
                  variant="neutral"
                />
              </div>

              {/* ── Top Feriados ── */}
              {topHoliday.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Top feriados com maior rendimento
                  </p>
                  <div className="space-y-1.5">
                    {topHoliday.map(([name, info]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                      >
                        <span className="flex items-center gap-1.5 font-medium text-zinc-200">
                          <Trophy className="h-3.5 w-3.5 text-amber-400" />
                          {name}
                          <span className="text-xs text-zinc-500">
                            ({info.nights} {info.nights === 1 ? 'diária' : 'diárias'})
                          </span>
                        </span>
                        <span className="font-semibold text-emerald-400 tabular-nums">
                          {info.extraProfitBrl.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Footer ── */}
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-2">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                <span>
                  Atualizado em tempo real · {data.totalYieldNights} diárias ajustadas
                </span>
              </div>
            </>
          ) : (
            // Empty state
            <div className="text-center py-4">
              <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-2 border border-emerald-500/20">
                <TrendingUp className="h-5 w-5" />
              </div>
              <p className="text-sm text-zinc-200 font-medium mb-1">
                Ajustes automáticos de diárias para esta temporada
              </p>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Quando a ocupação passar de 50% ou datas especiais se aproximarem,
                o motor Seu Zélla protege e maximiza o valor de cada diária.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TierPill({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: 'danger' | 'warning' | 'neutral';
}) {
  const palette = {
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    neutral: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20',
  };
  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 text-center ${palette[variant]}`}
    >
      <p className="text-[10px] font-medium tracking-tight opacity-75">{label}</p>
      <p className="text-sm font-bold tabular-nums">{count}</p>
    </div>
  );
}

export default YieldProfitWidget;
