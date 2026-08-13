'use client';

/**
 * ZÉLLA — Yield Profit Widget (DDC)
 * ==================================
 *
 * Card destacado no topo do Dashboard do Anfitrião (DDC) que mostra:
 *   💰 Ganhos Extras com Precificação Dinâmica Seu Zélla
 *   "Nesta temporada, a IA do Seu Zélla gerou R$ 21.450,00 a mais para a sua
 *    pousada ajustando a tarifa dos últimos quartos de Réveillon e Férias!"
 *
 * Estratégia comercial (Fase 1 = gratuito):
 *   - YIELD_BONUS_SHARE_RATE=0 → bonusShareBrl sempre 0
 *   - Apenas registra para exibir "valor entregue"
 *   - Quando Fase 2 ativar (YIELD_BONUS_SHARE_RATE=0.10..0.12), o widget
 *     automaticamente passa a mostrar a linha "ZÉLLA BOOST: R$ X cobrado sobre
 *     R$ Y de lucro extra" — sem mudança de código.
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
        const res = await fetch('/api/yield/profit-summary', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setData(json);
        onDataLoaded?.(json);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Falha ao carregar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    // Atualiza a cada 5 min
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [onDataLoaded]);

  if (loading) {
    return (
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
        <CardContent className="p-6 flex items-center gap-3 text-emerald-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Calculando ganhos extras...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6 flex items-center gap-3 text-amber-700">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">
            {error ?? 'Não foi possível carregar os ganhos de yield agora.'}
          </span>
        </CardContent>
      </Card>
    );
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
    >
      <Card className="border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 shadow-md">
        <CardContent className={compact ? 'p-4' : 'p-6'}>
          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-900 leading-tight">
                  Ganhos Extras com Precificação Dinâmica
                </h3>
                <p className="text-xs text-emerald-700/70">IA do Seu Zélla · Yield Booster</p>
              </div>
            </div>
            {phase2Active ? (
              <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                ZÉLLA BOOST ativo
              </Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                Temporada Grátis
              </Badge>
            )}
          </div>

          {hasProfit ? (
            <>
              {/* ── Hero Number ── */}
              <div className="mb-4">
                <p className="text-3xl font-extrabold text-emerald-700 tabular-nums">
                  {data.formatted?.totalExtra ?? 'R$ 0,00'}
                </p>
                <p className="text-sm text-emerald-900/80 mt-1">
                  {data.formatted?.message ??
                    `Lucro extra gerado em ${data.totalYieldNights} diárias pela IA.`}
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
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700/70 mb-2">
                    Top feriados com maior lucro
                  </p>
                  <div className="space-y-1.5">
                    {topHoliday.map(([name, info]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md bg-white/60"
                      >
                        <span className="flex items-center gap-1.5 font-medium text-emerald-900">
                          <Trophy className="h-3.5 w-3.5 text-amber-500" />
                          {name}
                          <span className="text-xs text-emerald-700/60">
                            ({info.nights} {info.nights === 1 ? 'diária' : 'diárias'})
                          </span>
                        </span>
                        <span className="font-semibold text-emerald-700 tabular-nums">
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

              {/* ── Fase 2 linha (ZÉLLA BOOST) — só aparece se phase2Active ── */}
              <AnimatePresence>
                {phase2Active && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 p-3 rounded-lg bg-purple-50 border border-purple-200"
                  >
                    <p className="text-xs text-purple-700">
                      <span className="font-semibold">ZÉLLA BOOST:</span>{' '}
                      {data.formatted?.bonusShare ?? 'R$ 0,00'} cobrado sobre{' '}
                      {data.formatted?.totalExtra ?? 'R$ 0,00'} de lucro extra gerado
                      (10% performance share — você fica com{' '}
                      <span className="font-bold">
                        {(data.totalExtraProfitBrl - data.totalBonusShareBrl).toLocaleString(
                          'pt-BR',
                          { style: 'currency', currency: 'BRL' },
                        )}
                      </span>
                      ).
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Footer ── */}
              <div className="flex items-center gap-1.5 text-xs text-emerald-700/70 mt-2">
                <TrendingUp className="h-3 w-3" />
                <span>
                  Atualizado em tempo real · {data.totalYieldNights} diárias com yield
                </span>
              </div>
            </>
          ) : (
            // Empty state — ainda não há lucro registrado
            <div className="text-center py-4">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mb-2">
                <TrendingUp className="h-6 w-6" />
              </div>
              <p className="text-sm text-emerald-900/80 font-medium mb-1">
                A IA ainda não reajustou diárias nesta temporada
              </p>
              <p className="text-xs text-emerald-700/60">
                Quando a ocupação passar de 50% ou datas especiais se aproximarem,
                o Seu Zélla começa a gerar lucro extra automaticamente.
              </p>
            </div>
          )}

          {data.databaseAvailable === false && (
            <p className="text-[10px] text-amber-600 mt-2 italic">
              ⚠ Banco indisponível — mostrando zeros.
            </p>
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
    danger: 'bg-rose-100 text-rose-700 border-rose-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  }[variant];

  return (
    <div className={`rounded-md border ${palette} px-2 py-1.5 text-center`}>
      <p className="text-[10px] uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-base font-bold tabular-nums">{count}</p>
    </div>
  );
}

export default YieldProfitWidget;
