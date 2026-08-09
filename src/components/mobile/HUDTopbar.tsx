'use client';

// ==============================================================================
// HUD TOPBAR — Real-Time Cyberpunk Hospitality Header
// ==============================================================================
// - Real-time digital clock (1s interval)
// - 4 KPI metrics formatted with JetBrains Mono (tabular nums)
// - WhatsApp AI live status indicator with animated pulse
// - Niche-aware branding (Pousada HUD vs Airbnb HUD)
// ==============================================================================

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Activity, ShieldCheck, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface HUDTopbarProps {
  niche: 'pousada' | 'airbnb';
}

export function HUDTopbar({ niche }: HUDTopbarProps) {
  const [time, setTime] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isPousada = niche === 'pousada';

  // Metrics Data by Niche
  const metrics = isPousada
    ? [
        { label: 'OCUPAÇÃO', value: '88%', sub: '14/16 Qts', accent: 'text-emerald-400' },
        { label: 'ADR (DIÁRIA)', value: 'R$ 420', sub: '+12% sem', accent: 'text-emerald-300' },
        { label: 'HÓSPEDES', value: '28', sub: 'Ativos', accent: 'text-cyan-400' },
        { label: 'META SAVE', value: '80%', sub: 'Economia', accent: 'text-emerald-400' },
      ]
    : [
        { label: 'RECEITA MÊS', value: 'R$ 8.950', sub: '+18% m/m', accent: 'text-blue-400' },
        { label: 'CHECK-IN', value: '14:00', sub: 'Hoje (Lucas)', accent: 'text-cyan-400' },
        { label: 'LINK-IN-BIO', value: '342', sub: '12 Reservas', accent: 'text-blue-300' },
        { label: 'PIX BLOQ', value: '5', sub: 'Anti-Ban', accent: 'text-emerald-400' },
      ];

  const badgeTheme = isPousada
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : 'bg-blue-500/15 text-blue-400 border-blue-500/30';

  const borderTheme = isPousada ? 'border-emerald-500/20' : 'border-blue-500/20';

  return (
    <div className={`w-full bg-[#080b12]/90 backdrop-blur-xl border-b ${borderTheme} p-3 text-white transition-all`}>
      {/* Top Meta Line: Status + Clock + Niche Badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span
              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
              }`}
            />
          </div>
          <span className="text-[11px] font-mono font-bold tracking-wider text-zinc-300">
            {time || '10:45:00'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-md border uppercase ${badgeTheme}`}>
            {isPousada ? 'POUSADA HUD' : 'AIRBNB HUD'}
          </span>
        </div>
      </div>

      {/* KPI Metrics Carousel Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {metrics.map((m, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] rounded-lg p-1.5 text-center transition-all"
          >
            <span className="block text-[8px] font-mono font-bold text-zinc-400 tracking-wider">
              {m.label}
            </span>
            <span className={`block text-[13px] font-mono font-extrabold tracking-tight ${m.accent}`}>
              {m.value}
            </span>
            <span className="block text-[8px] text-zinc-400 font-sans truncate">
              {m.sub}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
