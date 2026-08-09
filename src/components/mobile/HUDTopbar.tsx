'use client';

// ═══════════════════════════════════════════════════════════════════════════
// HUD TOPBAR — Neo-Emerald Cyber-Hospitality HUD Overlay
// ═══════════════════════════════════════════════════════════════════════════
// Sits inside MobilePhoneWrapper, below the status bar.
// Shows 4 real-time KPI metrics in JetBrains Mono.
//
// POUSADA:  Occupancy % | ADR (R$) | Guests Present | Meta Savings %
// AIRBNB:    Revenue (R$) | Next Check-in | LiB Clicks | PIX Blocked
//
// Data sourced from: /api/v1/guest/ddc/overview (SWR, 15s refresh)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Clock, TrendingUp, Users, DollarSign, Shield, Calendar, Instagram, Ban } from 'lucide-react';

interface HUDMetric {
  label: string;
  value: string;
  icon: typeof Clock;
  accent: 'emerald' | 'blue' | 'amber' | 'red';
}

interface HUDTopbarProps {
  niche: 'pousada' | 'airbnb';
  propertyName?: string;
  whatsappConnected?: boolean;
}

export function HUDTopbar({ niche, propertyName = 'Propriedade', whatsappConnected = true }: HUDTopbarProps) {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const isPousada = niche === 'pousada';
  const accentClass = isPousada ? 'text-emerald-400' : 'text-blue-400';
  const glowClass = isPousada ? 'hud-glow-emerald' : 'hud-glow-blue';
  const glassClass = isPousada ? 'hud-glass-emerald' : 'hud-glass-blue';
  const badgeText = isPousada ? 'POUSADA HUD' : 'AIRBNB HUD';

  // Mock data — em produção seria do BFF /api/v1/guest/ddc/overview
  const metrics: HUDMetric[] = isPousada
    ? [
        { label: 'Ocupação', value: '88%', icon: TrendingUp, accent: 'emerald' },
        { label: 'ADR', value: 'R$ 420', icon: DollarSign, accent: 'emerald' },
        { label: 'Hóspedes', value: '28', icon: Users, accent: 'emerald' },
        { label: 'Meta Save', value: '80%', icon: Shield, accent: 'emerald' },
      ]
    : [
        { label: 'Receita Mês', value: 'R$ 8.950', icon: DollarSign, accent: 'blue' },
        { label: 'Próx. Check-in', value: 'Hoje 14h', icon: Calendar, accent: 'blue' },
        { label: 'LiB Cliques', value: '342', icon: Instagram, accent: 'blue' },
        { label: 'PIX Bloq.', value: '5', icon: Ban, accent: 'blue' },
      ];

  const accentMap = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  };

  return (
    <div className={`relative z-30 ${glassClass} ${glowClass} px-3 py-2.5 border-b border-white/[0.06]`}>
      {/* Row 1: Property name + time + badges */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`badge-nano ${accentClass} ${isPousada ? 'hud-pulse-emerald' : ''}`}>
            ● {badgeText}
          </span>
          <span className="text-[11px] text-white/70 font-medium truncate max-w-[120px]">
            {propertyName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* WhatsApp status */}
          <div className="flex items-center gap-1">
            {whatsappConnected ? (
              <Wifi className="w-3 h-3 text-emerald-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-400 hud-pulse-red" />
            )}
          </div>
          {/* Clock */}
          <span className="font-mono-hud text-[11px] text-white/60 tabular-nums">
            {currentTime}
          </span>
        </div>
      </div>

      {/* Row 2: 4 KPI metrics in JetBrains Mono */}
      <div className="grid grid-cols-4 gap-1.5">
        {metrics.map((metric, i) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex flex-col items-center justify-center bg-white/[0.03] rounded-lg py-1.5 px-1 border border-white/[0.04]"
            >
              <Icon className={`w-3 h-3 ${accentMap[metric.accent]} mb-0.5`} />
              <span className={`font-mono-hud text-[13px] font-bold ${accentMap[metric.accent]} leading-none`}>
                {metric.value}
              </span>
              <span className="text-[7px] text-white/40 uppercase tracking-wider mt-0.5">
                {metric.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
