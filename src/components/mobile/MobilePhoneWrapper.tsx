'use client';

// ==============================================================================
// MOBILE PHONE WRAPPER — High-End Smartphone Frame Component
// ==============================================================================
// - Wraps DDC Mobile views in a realistic iPhone/Smartphone device shell on desktop
// - Automatically expands to 100% full screen on actual mobile devices (< 640px)
// - Includes status bar (clock, wifi, battery), dynamic island, side buttons, and swipe indicator
// ==============================================================================

import { useState, useEffect, type ReactNode } from 'react';
import { Wifi, Battery, Signal, Smartphone, Maximize2, Minimize2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface MobilePhoneWrapperProps {
  children: ReactNode;
  title: string;
  niche: 'pousada' | 'airbnb';
}

export function MobilePhoneWrapper({ children, title, niche }: MobilePhoneWrapperProps) {
  const [time, setTime] = useState<string>('');
  const [fullscreen, setFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const badgeColor = niche === 'pousada'
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : 'bg-blue-500/20 text-cyan-400 border-blue-500/30';

  return (
    <div className="min-h-screen bg-[#05070d] text-white flex flex-col items-center justify-center p-0 sm:p-4 md:p-8 font-sans selection:bg-emerald-500/30">
      {/* Top Banner on Desktop */}
      <div className="hidden sm:flex items-center justify-between w-full max-w-[430px] mb-3 px-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-300">{title}</span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase ${badgeColor}`}>
            Simulador Mobile
          </span>
        </div>
        <button
          onClick={() => setFullscreen((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 transition-all"
        >
          {fullscreen ? (
            <>
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Ver no Frame</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Expandir</span>
            </>
          )}
        </button>
      </div>

      {/* Main Container */}
      <div
        className={`w-full transition-all duration-300 ${
          fullscreen
            ? 'max-w-none min-h-screen rounded-none border-0'
            : 'sm:max-w-[420px] md:max-w-[440px] sm:h-[880px] sm:rounded-[52px] sm:border-[10px] sm:border-[#1a1d28] sm:shadow-[0_25px_80px_rgba(0,0,0,0.9)] sm:ring-1 sm:ring-white/10 relative overflow-hidden bg-[#0a0a0f]'
        }`}
      >
        {/* Smartphone Hardware Elements (Desktop Frame Mode) */}
        {!fullscreen && (
          <>
            {/* Top Status Bar (Smartphone Top Notch / Dynamic Island) */}
            <div className="hidden sm:flex items-center justify-between px-7 pt-3 pb-1 bg-[#0a0a0f] text-white z-50 relative border-b border-white/[0.04]">
              {/* Left: Clock */}
              <span className="text-[11px] font-semibold tracking-tight font-mono">
                {time || '09:41'}
              </span>

              {/* Center: Dynamic Island Pill */}
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="w-24 h-4 bg-black rounded-full border border-white/10 flex items-center justify-center gap-2 shadow-inner"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500/80 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
              </motion.div>

              {/* Right: Signal, Wifi, Battery */}
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Signal className="w-3 h-3 text-white" />
                <Wifi className="w-3 h-3 text-white" />
                <Battery className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </>
        )}

        {/* Smartphone Screen Content */}
        <div
          className={`w-full overflow-y-auto ${
            fullscreen ? 'min-h-screen' : 'sm:h-[calc(880px-36px)]'
          } no-scrollbar`}
        >
          {/* Native Super App DDC Content */}
          {children}
        </div>

        {/* Smartphone Home Indicator Bar (Desktop Frame Mode) */}
        {!fullscreen && (
          <div className="hidden sm:flex items-center justify-center py-2 bg-[#0a0a0f] border-t border-white/[0.04]">
            <div className="w-32 h-1 bg-white/30 rounded-full" />
          </div>
        )}
      </div>

      {/* Footer Disclaimer on Desktop */}
      <div className="hidden sm:block text-center mt-3 text-[11px] text-zinc-500 font-mono">
        Exibição no Formato Mobile Inteligente · Seu Zélla SmartHotel LTDA®
      </div>
    </div>
  );
}
