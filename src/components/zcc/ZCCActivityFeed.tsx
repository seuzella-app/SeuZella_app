'use client';

// ==============================================================================
// ZCC ACTIVITY FEED — Live activity stream on the Overview tab
// ==============================================================================
// Shows a reverse-chronological list of recent system events:
//   - New tenant signups
//   - Subscription upgrades / cancellations
//   - AI Brain anomalies / alerts
//   - Burn rate thresholds crossed
//   - Refactor suggestions applied
//
// Sprint 3: mocked with realistic data. In production this will be hydrated
// by /api/zcc/activity (to be added when Cérebro Zélla starts emitting events).
// ==============================================================================

import { motion } from 'framer-motion';
import {
  UserPlus, TrendingUp, AlertTriangle, Flame, Code,
  CheckCircle, XCircle, Brain,
} from 'lucide-react';

interface ActivityEvent {
  id: string;
  type: 'signup' | 'upgrade' | 'downgrade' | 'anomaly' | 'burn' | 'refactor' | 'success' | 'failure' | 'brain';
  title: string;
  desc: string;
  time: string; // human-readable ("5 min", "2 h")
  severity: 'info' | 'success' | 'warning' | 'critical';
}

const SAMPLE_EVENTS: ActivityEvent[] = [
  {
    id: 'evt-1',
    type: 'signup',
    title: 'Nova pousada cadastrada',
    desc: 'Recanto dos Lagos (SC) — plano PRO R$397/mês',
    time: '5 min',
    severity: 'success',
  },
  {
    id: 'evt-2',
    type: 'anomaly',
    title: 'Anomalia detectada pelo Cérebro',
    desc: 'Pico de erro 5xx no /api/brain — 4.2% (limite: 1%)',
    time: '12 min',
    severity: 'critical',
  },
  {
    id: 'evt-3',
    type: 'upgrade',
    title: 'Upgrade de plano',
    desc: 'Pousada Vista Mar (BA): LITE → PRO',
    time: '23 min',
    severity: 'info',
  },
  {
    id: 'evt-4',
    type: 'burn',
    title: 'Burn rate acima da média',
    desc: 'Custo API WhatsApp +18% nos últimos 7 dias (R$ 384)',
    time: '1 h',
    severity: 'warning',
  },
  {
    id: 'evt-5',
    type: 'refactor',
    title: 'Sugestão de refactor aplicada',
    desc: 'Otimização de cache no /api/cerebro/anomalies (-32ms p95)',
    time: '1 h',
    severity: 'info',
  },
  {
    id: 'evt-6',
    type: 'success',
    title: 'Meta de MRR atingida',
    desc: 'R$ 47.250 / R$ 45.000 — 105% da meta mensal',
    time: '2 h',
    severity: 'success',
  },
  {
    id: 'evt-7',
    type: 'brain',
    title: 'Cérebro Zélla treinado',
    desc: 'Modelo DPO atualizado com 1.247 novos exemplos',
    time: '3 h',
    severity: 'info',
  },
  {
    id: 'evt-8',
    type: 'failure',
    title: 'Falha em webhook de pagamento',
    desc: 'MP webhook recebido com assinatura inválida — descartado',
    time: '4 h',
    severity: 'critical',
  },
];

const TYPE_CONFIG: Record<ActivityEvent['type'], { icon: React.ElementType; color: string }> = {
  signup: { icon: UserPlus, color: 'var(--zcc-success)' },
  upgrade: { icon: TrendingUp, color: 'var(--zcc-kinpaku)' },
  downgrade: { icon: TrendingUp, color: 'var(--zcc-text-muted)' },
  anomaly: { icon: AlertTriangle, color: 'var(--zcc-danger)' },
  burn: { icon: Flame, color: '#f59e0b' },
  refactor: { icon: Code, color: 'var(--zcc-patina)' },
  success: { icon: CheckCircle, color: 'var(--zcc-success)' },
  failure: { icon: XCircle, color: 'var(--zcc-danger)' },
  brain: { icon: Brain, color: 'var(--zcc-kinpaku)' },
};

export function ZCCActivityFeed({ events = SAMPLE_EVENTS, maxItems = 8 }: { events?: ActivityEvent[]; maxItems?: number }) {
  const displayEvents = events.slice(0, maxItems);

  return (
    <div className="zcc-panel p-0 overflow-hidden">
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--zcc-hairline)' }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--zcc-kinpaku)' }}
          />
          <h3 className="text-xs font-bold font-mono tracking-wide" style={{ color: 'var(--zcc-champagne)' }}>
            Atividade Recente
          </h3>
        </div>
        <button className="text-[10px] font-mono hover:underline" style={{ color: 'var(--zcc-text-muted)' }}>
          Ver tudo
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto zcc-scroll">
        {displayEvents.map((evt, i) => {
          const config = TYPE_CONFIG[evt.type];
          const Icon = config.icon;
          return (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="px-4 py-3 border-b last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer group"
              style={{ borderColor: 'var(--zcc-hairline)' }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-7 h-7 rounded shrink-0 flex items-center justify-center mt-0.5"
                  style={{
                    background: `${config.color}15`,
                    border: `1px solid ${config.color}30`,
                  }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold truncate" style={{ color: 'var(--zcc-champagne)' }}>
                      {evt.title}
                    </span>
                    <span className="text-[9px] font-mono shrink-0" style={{ color: 'var(--zcc-text-muted)' }}>
                      {evt.time}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--zcc-text-secondary)' }}>
                    {evt.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
