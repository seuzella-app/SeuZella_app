'use client';

/**
 * Zélla — Conquistas Tab (Gap 9)
 *
 * Tab visualizada APENAS por tenants PARCEIRO_ZÉLLA.
 * Mostra:
 *  - Progresso de achievements (first_booking, milestone_10, milestone_100, etc.)
 *  - Histórico de notificações de conquistas disparadas
 *  - Próximo milestone com barra de progresso
 *
 * Action URL: /mobile/pousada?tab=conquistas
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, Star, TrendingUp, Award, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ConquistasTabProps {
  tenantId?: string;
  className?: string;
}

interface AchievementData {
  bookingsConfirmed: number;
  historicalMaxMrr: number;
  partnerTier: string | null;
  achievementsAwarded: string[];
  nextMilestone: { type: string; at: number; current: number } | null;
  achievementsHistory: Array<{
    id: string;
    title: string;
    message: string;
    createdAt: string;
    priority: string;
  }>;
}

// ─── Mock data for development ──────────────────────────────────────────────
const MOCK_DATA: AchievementData = {
  bookingsConfirmed: 8,
  historicalMaxMrr: 18500,
  partnerTier: 'bronze',
  achievementsAwarded: ['first_booking'],
  nextMilestone: { type: 'milestone_10', at: 10, current: 8 },
  achievementsHistory: [
    {
      id: 'mock-1',
      title: '🏆 Primeira reserva conquistada!',
      message: 'Você fez sua primeira reserva. Continue assim!',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'medium',
    },
    {
      id: 'mock-2',
      title: '💰 Comissão de R$ 250 paga',
      message: 'Comissão de referral creditada este mês.',
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'medium',
    },
  ],
};

const TIER_LABEL: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  bronze: { label: 'Bronze', color: 'text-orange-400', icon: Award },
  prata: { label: 'Prata', color: 'text-zinc-300', icon: Award },
  ouro: { label: 'Ouro', color: 'text-amber-400', icon: Crown },
};

const ACHIEVEMENT_LABEL: Record<string, { label: string; description: string }> = {
  first_booking: {
    label: 'Primeira Reserva',
    description: 'Sua primeira reserva confirmada',
  },
  milestone_10: {
    label: '10 Reservas',
    description: 'Marcou 10 reservas confirmadas',
  },
  milestone_100: {
    label: '100 Reservas',
    description: 'Marcou 100 reservas confirmadas',
  },
  revenue_record: {
    label: 'Recorde de Receita',
    description: 'Bateu o recorde histórico de MRR',
  },
  partner_level_up: {
    label: 'Subida de Tier',
    description: 'Subiu para o próximo tier do programa PARCEIRO',
  },
};

export function ConquistasTab({ tenantId, className = '' }: ConquistasTabProps) {
  const [data, setData] = useState<AchievementData>(MOCK_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        // Try to fetch real data via API (mock mode returns mock data)
        const res = await fetch('/api/ddc/notifications/v2?niche=all&category=achievements&limit=50', {
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          if (active && json?.data) {
            setData((prev) => ({
              ...prev,
              achievementsHistory: json.data.map((n: any) => ({
                id: n.id,
                title: n.title,
                message: n.message,
                createdAt: n.createdAt,
                priority: n.priority,
              })),
            }));
          }
        }
      } catch {
        // Stay with mock data
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [tenantId]);

  const tier = data.partnerTier ? TIER_LABEL[data.partnerTier] : null;
  const TierIcon = tier?.icon ?? Trophy;

  return (
    <div className={`space-y-4 p-4 ${className}`}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mb-3">
          <Trophy className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Conquistas</h2>
        <p className="text-xs text-white/40 mt-1">
          Programa PARCEIRO ZÉLLA · Acompanhe seu progresso
        </p>
      </motion.div>

      {/* Tier Card */}
      {tier && (
        <Card className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border-amber-500/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-white/80 flex items-center gap-2">
                <TierIcon className={`w-4 h-4 ${tier.color}`} />
                Tier Atual
              </CardTitle>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                PARCEIRO
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${tier.color}`}>{tier.label}</p>
            <p className="text-[11px] text-white/40 mt-1">
              Continue indicando para subir de tier
            </p>
          </CardContent>
        </Card>
      )}

      {/* Next Milestone */}
      {data.nextMilestone && (
        <Card className="bg-[#0a0a0f] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-white/80 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Próximo Milestone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-white/60">
                {ACHIEVEMENT_LABEL[data.nextMilestone.type]?.label ?? data.nextMilestone.type}
              </p>
              <p className="text-xs text-white/40 font-mono">
                {data.nextMilestone.current}/{data.nextMilestone.at}
              </p>
            </div>
            <Progress
              value={(data.nextMilestone.current / data.nextMilestone.at) * 100}
              className="h-2"
            />
            <p className="text-[10px] text-white/40 mt-2">
              Faltam {data.nextMilestone.at - data.nextMilestone.current} reserva(s) para a próxima conquista
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-[#0a0a0f] border-white/[0.06]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-blue-400" />
              <p className="text-[10px] text-white/40">Reservas Confirmadas</p>
            </div>
            <p className="text-xl font-bold text-white mt-1">{data.bookingsConfirmed}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0a0a0f] border-white/[0.06]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <p className="text-[10px] text-white/40">Recorde MRR</p>
            </div>
            <p className="text-xl font-bold text-white mt-1">
              R$ {data.historicalMaxMrr.toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Achievements Awarded */}
      <Card className="bg-[#0a0a0f] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white/80 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Conquistas Conquistadas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.achievementsAwarded.length === 0 ? (
            <p className="text-xs text-white/40 italic">
              Nenhuma conquista ainda. Continue usando o Zélla!
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.achievementsAwarded.map((a) => {
                const info = ACHIEVEMENT_LABEL[a] ?? { label: a, description: '' };
                return (
                  <Badge
                    key={a}
                    className="bg-amber-500/10 text-amber-300 border-amber-500/30 px-3 py-1"
                    title={info.description}
                  >
                    <Trophy className="w-3 h-3 mr-1" />
                    {info.label}
                  </Badge>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="bg-[#0a0a0f] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white/80 flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-400" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : data.achievementsHistory.length === 0 ? (
            <p className="text-xs text-white/40 italic py-4 text-center">
              Sem atividade recente
            </p>
          ) : (
            <ScrollArea className="h-48">
              <div className="space-y-2 pr-2">
                {data.achievementsHistory.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start gap-2 p-2 rounded-md hover:bg-white/[0.03] transition-colors"
                  >
                    <ChevronRight className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium leading-tight">
                        {h.title}
                      </p>
                      <p className="text-[10px] text-white/40 mt-0.5 line-clamp-1">
                        {h.message}
                      </p>
                      <p className="text-[9px] text-white/30 mt-0.5 font-mono">
                        {new Date(h.createdAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
