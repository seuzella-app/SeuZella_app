'use client';

import { motion } from 'framer-motion';
import {
  History,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Smartphone,
  Monitor,
  Tablet,
  Link2,
  Mail,
  MessageCircle,
  Hash,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ReferralRowDTO } from '@/lib/credits/engine';
import type { ConversionStatus, ReferralChannel } from '@/lib/credits/rules';
import {
  CONVERSION_STATUS_LABEL,
  CONVERSION_STATUS_COLOR,
  formatCentsAsBRL,
} from '@/lib/credits/rules';

interface Props {
  referrals: ReferralRowDTO[];
  loading: boolean;
}

const STATUS_ICON: Record<ConversionStatus, React.ElementType> = {
  pending: Clock,
  confirmed: CheckCircle2,
  reversed: XCircle,
  expired: AlertCircle,
};

const CHANNEL_ICON: Record<ReferralChannel, React.ElementType> = {
  linkinbio: Link2,
  email: Mail,
  whatsapp: MessageCircle,
  manual: Hash,
};

const DEVICE_ICON: Record<string, React.ElementType> = {
  mobile: Smartphone,
  desktop: Monitor,
  tablet: Tablet,
};

export function ReferralsHistory({ referrals, loading }: Props) {
  return (
    <Card className="bg-[#0d0d14] border-white/[0.06]">
      <CardHeader>
        <CardTitle className="text-base font-bold text-white flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-400" />
          Histórico de Indicações
        </CardTitle>
        <CardDescription className="text-xs text-zinc-500">
          Acompanhe o status de cada lead que clicou no seu link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && referrals.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse bg-white/[0.03] rounded-lg" />
            ))}
          </div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-10 text-zinc-500 text-xs">
            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma indicação registrada ainda.</p>
            <p className="text-[10px] mt-1">Divulgue seus links para começar a acompanhar conversões aqui.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {referrals.map((ref, idx) => {
              const StatusIcon = STATUS_ICON[ref.status];
              const ChannelIcon = CHANNEL_ICON[ref.channel];
              const DeviceIcon = DEVICE_ICON[ref.deviceType] || Monitor;
              const statusColor = CONVERSION_STATUS_COLOR[ref.status];

              return (
                <motion.div
                  key={ref.id || idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                  className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Channel icon */}
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                      <ChannelIcon className="w-3.5 h-3.5 text-zinc-400" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold text-white">
                          {ref.newTenantPlan ? ref.newTenantPlan.toUpperCase() : 'Lead não convertido'}
                        </span>
                        <Badge className={`text-[9px] uppercase tracking-wider border ${statusColor}`}>
                          <StatusIcon className="w-2.5 h-2.5 mr-1" />
                          {CONVERSION_STATUS_LABEL[ref.status].split(' ')[0]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          <DeviceIcon className="w-3 h-3" />
                          {ref.deviceType}
                        </span>
                        {ref.country && (
                          <span className="font-mono">{ref.country}</span>
                        )}
                        <span>
                          {ref.conversionDate
                            ? `Convertido em ${new Date(ref.conversionDate).toLocaleDateString('pt-BR')}`
                            : `Clique em ${new Date(ref.clickDate).toLocaleDateString('pt-BR')}`}
                        </span>
                      </div>
                    </div>

                    {/* Credit amount */}
                    {ref.creditCents > 0 && (
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${
                          ref.status === 'confirmed' ? 'text-emerald-400' :
                          ref.status === 'pending' ? 'text-amber-400' :
                          ref.status === 'reversed' ? 'text-red-400 line-through' :
                          'text-zinc-500'
                        }`}>
                          {ref.status === 'reversed' ? '-' : '+'}{formatCentsAsBRL(ref.creditCents)}
                        </p>
                        {ref.status === 'pending' && (
                          <p className="text-[9px] text-zinc-500">em 30 dias</p>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
