'use client';

import { Trophy, Target, Calendar, Sparkles, CheckCircle2, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { LiteMilestoneDTO } from '@/lib/credits/engine';
import { LITE_INITIAL_LINKINBIO_DAYS, LITE_MILESTONE_REWARD_MONTHS } from '@/lib/credits/rules';

interface Props {
  milestone: LiteMilestoneDTO | null;
  loading: boolean;
}

export function LiteMilestoneCard({ milestone, loading }: Props) {
  if (loading || !milestone) {
    return (
      <Card className="bg-[#0d0d14] border-white/[0.06]">
        <CardContent className="p-6">
          <div className="h-32 animate-pulse bg-white/[0.03] rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  const progress = Math.min(100, (milestone.paidReferralsCount / milestone.target) * 100);
  const achieved = milestone.achieved;

  return (
    <Card className={`bg-gradient-to-br from-amber-500/[0.06] via-[#0d0d14] to-[#0d0d14] border-amber-500/20 overflow-hidden relative`}>
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/[0.08] rounded-full blur-3xl pointer-events-none" />
      <CardContent className="p-5 md:p-6 relative">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
            achieved
              ? 'bg-emerald-500/15 border-emerald-500/30'
              : 'bg-amber-500/15 border-amber-500/30'
          }`}>
            {achieved ? (
              <Trophy className="w-5 h-5 text-emerald-400" />
            ) : (
              <Target className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">
                {achieved ? 'Milestone LITE conquistado!' : 'Desafio LITE: 10 indicações pagas'}
              </h3>
              {achieved && (
                <Badge className="bg-emerald-500/15 border-emerald-500/30 text-emerald-400 text-[9px] uppercase">
                  Desbloqueado
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
              {achieved
                ? `Você liberou ${LITE_MILESTONE_REWARD_MONTHS} meses extras de Link-in-Bio e acesso permanente à amortização.`
                : `Traga ${milestone.target} clientes pagos e ganhe ${LITE_MILESTONE_REWARD_MONTHS} meses de Link-in-Bio grátis + acesso ao sistema de créditos.`}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium">
              {milestone.paidReferralsCount} de {milestone.target} conversões
            </span>
            <span className={`font-bold ${achieved ? 'text-emerald-400' : 'text-amber-400'}`}>
              {Math.round(progress)}%
            </span>
          </div>
          <Progress
            value={progress}
            className="h-2 bg-white/[0.04] [&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-emerald-500"
          />
          <p className="text-[10px] text-zinc-500">
            {achieved
              ? `Conquistado em ${milestone.achievedAt ? new Date(milestone.achievedAt).toLocaleDateString('pt-BR') : '—'}`
              : `Faltam ${milestone.target - milestone.paidReferralsCount} conversões para desbloquear`}
          </p>
        </div>

        {/* Link-in-Bio status */}
        <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                Link-in-Bio grátis
              </p>
              <p className="text-sm font-bold text-white">
                {milestone.linkinbioDaysLeft > 0
                  ? `${milestone.linkinbioDaysLeft} dias restantes`
                  : 'Expirado'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {achieved ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                    Amortização
                  </p>
                  <p className="text-sm font-bold text-emerald-400">Ativada</p>
                </div>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                    Amortização
                  </p>
                  <p className="text-sm font-bold text-zinc-400">Bloqueada</p>
                </div>
              </>
            )}
          </div>
        </div>

        {!achieved && milestone.paidReferralsCount === 0 && (
          <div className="mt-3 flex items-start gap-2 bg-amber-500/[0.05] border border-amber-500/15 rounded-lg p-2.5">
            <Sparkles className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[10px] text-amber-200/90 leading-relaxed">
              LITE tem <strong>{LITE_INITIAL_LINKINBIO_DAYS} dias iniciais</strong> de Link-in-Bio grátis para você começar a indicar agora mesmo.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
