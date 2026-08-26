'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi,
  Copy,
  Check,
  Sparkles,
  MapPin,
  Camera,
  Shield,
  DollarSign,
  Star,
  Home,
  ChevronRight,
  Loader2,
} from 'lucide-react';

// ─── Animation Phases ──────────────────────────────────────────────
// Phase 0: Idle / reset
// Phase 1: Airbnb listing page (user sees their property, copies link)
// Phase 2: Transition - switching to SeuZélla dashboard
// Phase 3: SeuZélla dashboard - paste link field
// Phase 4: Auto-configuration progress (fields filling up)
// Phase 5: Success - property configured!

type ImportPhase = 0 | 1 | 2 | 3 | 4 | 5;

// ─── Configuration Items that get "auto-filled" ─────────────────────
const configItems = [
  { icon: Camera, label: 'Fotos do anúncio', color: 'text-amber-400' },
  { icon: Shield, label: 'Regras e políticas', color: 'text-blue-400' },
  { icon: MapPin, label: 'Localização e vizinhança', color: 'text-emerald-400' },
  { icon: DollarSign, label: 'Preços e tarifas', color: 'text-rose-400' },
  { icon: Star, label: 'Amenidades', color: 'text-purple-400' },
];

// ─── Airbnb Listing URL ─────────────────────────────────────────────
const airbnbUrl = 'airbnb.com.br/rooms/8472951';

export function AirbnbImportMockup() {
  const [phase, setPhase] = useState<ImportPhase>(0);
  const [filledCount, setFilledCount] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    const startAnimation = () => {
      setPhase(0);
      setFilledCount(0);
      setProgress(0);

      timers.push(setTimeout(() => setPhase(1), 500)); // Show Airbnb listing
      timers.push(setTimeout(() => setPhase(2), 4000)); // Transition to Zélla
      timers.push(setTimeout(() => setPhase(3), 5000)); // Show paste field
      timers.push(setTimeout(() => setPhase(4), 6500)); // Start auto-config
      // Filled items progress
      timers.push(setTimeout(() => { setFilledCount(1); setProgress(20); }, 7000));
      timers.push(setTimeout(() => { setFilledCount(2); setProgress(40); }, 7800));
      timers.push(setTimeout(() => { setFilledCount(3); setProgress(60); }, 8500));
      timers.push(setTimeout(() => { setFilledCount(4); setProgress(80); }, 9200));
      timers.push(setTimeout(() => { setFilledCount(5); setProgress(100); }, 9800));
      timers.push(setTimeout(() => setPhase(5), 10500)); // Success!
    };

    startAnimation();

    const loopInterval = setInterval(() => {
      startAnimation();
    }, 15000);

    return () => {
      timers.forEach((t) => clearTimeout(t));
      clearInterval(loopInterval);
    };
  }, []);

  return (
    <div className="relative">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full bg-blue-500/[0.07] blur-[90px] pointer-events-none z-0" />

      {/* iPhone 16 Frame */}
      <div className="relative w-[290px] mx-auto h-[570px] rounded-[52px] border-[7px] border-neutral-900 bg-[#070709] shadow-2xl p-2.5 overflow-hidden flex flex-col select-none z-10 ring-1 ring-white/10">
        {/* Side Buttons */}
        <div className="absolute -left-[9px] top-[95px] w-[3px] h-[18px] bg-neutral-800 rounded-l-md border-r border-neutral-700" />
        <div className="absolute -left-[9px] top-[130px] w-[3px] h-[32px] bg-neutral-800 rounded-l-md border-r border-neutral-700" />
        <div className="absolute -left-[9px] top-[172px] w-[3px] h-[32px] bg-neutral-800 rounded-l-md border-r border-neutral-700" />
        <div className="absolute -right-[9px] top-[140px] w-[3px] h-[45px] bg-neutral-800 rounded-r-md border-l border-neutral-700" />
        <div className="absolute -right-[9px] top-[215px] w-[3px] h-[28px] bg-neutral-900 rounded-r-sm border-l border-neutral-700 opacity-90" />

        {/* Dynamic Island */}
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-20 h-[18px] bg-black rounded-full z-30 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-[#1c1c1e] absolute right-4" />
        </div>

        {/* Glass glare */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none rounded-[42px] z-20" />

        {/* Content Area */}
        <div className="w-full h-full rounded-[42px] overflow-hidden flex flex-col relative bg-[#0a0a0a]">
          {/* Status Bar */}
          <div className="w-full pt-2.5 px-6 flex items-center justify-between text-[9px] font-bold text-white/90 z-20 shrink-0 select-none">
            <span>09:41</span>
            <div className="flex items-center gap-1.5">
              <div className="flex gap-[1px] items-end h-[7px] w-3">
                <div className="w-[1.5px] h-[2px] bg-white rounded-[0.5px]" />
                <div className="w-[1.5px] h-[3.5px] bg-white rounded-[0.5px]" />
                <div className="w-[1.5px] h-[5px] bg-white rounded-[0.5px]" />
                <div className="w-[1.5px] h-[6.5px] bg-white rounded-[0.5px]" />
              </div>
              <Wifi className="w-2.5 h-2.5 text-white stroke-[2.5]" />
              <div className="w-4 h-2 border border-white/60 rounded-[3px] p-[0.5px] flex items-center shrink-0">
                <div className="w-full h-full bg-white rounded-[1px]" />
                <div className="w-[1px] h-[2.5px] bg-white/60 -mr-[2px]" />
              </div>
            </div>
          </div>

          {/* Phone Content - Animated Phases */}
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {/* ─── Phase 1: Airbnb Listing Page ─── */}
              {phase === 1 && (
                <motion.div
                  key="airbnb-listing"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 flex flex-col bg-white"
                >
                  {/* Airbnb Header */}
                  <div className="shrink-0 bg-white px-3 pt-2 pb-1.5 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                        <span className="text-white text-[7px] font-bold">A</span>
                      </div>
                      <span className="text-[9px] font-bold text-gray-900">airbnb</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <ShareIcon className="w-2 h-2 text-gray-600" />
                      </div>
                    </div>
                  </div>

                  {/* Property Image */}
                  <div className="relative shrink-0 h-[140px] overflow-hidden">
                    <img
                      src="/airbnb-listing-apartment.png"
                      alt="Apartamento Copacabana"
                      className="w-full h-full object-cover"
                    />
                    {/* Image dots */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      <div className="w-1 h-1 rounded-full bg-white" />
                      <div className="w-1 h-1 rounded-full bg-white/40" />
                      <div className="w-1 h-1 rounded-full bg-white/40" />
                      <div className="w-1 h-1 rounded-full bg-white/40" />
                    </div>
                    {/* Heart icon */}
                    <div className="absolute top-2 right-2">
                      <svg className="w-4 h-4 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                  </div>

                  {/* Property Info */}
                  <div className="px-3 pt-2 flex-1 overflow-hidden">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-[10px] font-bold text-gray-900 leading-tight">Apartamento Vista Mar — Copacabana</h3>
                        <p className="text-[8px] text-gray-500 mt-0.5">Superhost · Apartamento inteiro · 2 quartos</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                          <span className="text-[8px] font-bold text-gray-900">4,96</span>
                          <span className="text-[8px] text-gray-400">(203 avaliações)</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-[11px] font-extrabold text-gray-900">R$ 380</p>
                        <p className="text-[7px] text-gray-400">/noite</p>
                      </div>
                    </div>

                    {/* Amenities */}
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {['🌊 Vista mar', '🛜 Wi-Fi', '🅿️ Estacionamento', '❄️ Ar-condicionado'].map((a, i) => (
                        <span key={i} className="text-[7px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded-md border border-gray-100">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Copy Link Action */}
                  <div className="shrink-0 px-3 pb-3 pt-2 bg-white border-t border-gray-50">
                    <motion.div
                      initial={{ scale: 1 }}
                      animate={{ scale: [1, 0.95, 1] }}
                      transition={{ duration: 0.3, delay: 2 }}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 flex items-center justify-center gap-1.5 shadow-lg shadow-rose-500/20"
                    >
                      <Copy className="w-3 h-3 text-white" />
                      <span className="text-[9px] font-bold text-white">Copiar link do anúncio</span>
                    </motion.div>

                    {/* Link copied toast */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 2.5, duration: 0.3 }}
                      className="mt-1.5 flex items-center justify-center gap-1 bg-emerald-50 rounded-lg py-1"
                    >
                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                      <span className="text-[7px] font-semibold text-emerald-700">Link copiado!</span>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* ─── Phase 2: Transition ─── */}
              {phase === 2 && (
                <motion.div
                  key="transition"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-500 mb-3"
                  />
                  <p className="text-[9px] text-neutral-400 font-medium">Abrindo SeuZélla...</p>
                </motion.div>
              )}

              {/* ─── Phase 3: SeuZélla Dashboard - Paste Link ─── */}
              {phase === 3 && (
                <motion.div
                  key="zella-paste"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 flex flex-col bg-[#0c0c0e]"
                >
                  {/* Zélla Header */}
                  <div className="shrink-0 px-3 pt-2 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                        <span className="text-white text-[7px] font-black">Z</span>
                      </div>
                      <span className="text-[9px] font-bold text-white">SeuZélla</span>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
                      <span className="text-[7px] text-neutral-400">JS</span>
                    </div>
                  </div>

                  {/* Magic Onboarding Card */}
                  <div className="px-3 flex-1 flex flex-col">
                    <div className="bg-gradient-to-b from-blue-500/[0.08] to-transparent rounded-2xl border border-blue-500/20 p-3 flex-1 flex flex-col">
                      {/* Magic Onboarding Title */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-3 h-3 text-blue-400" />
                        <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">Magic Onboarding</span>
                      </div>
                      <h3 className="text-[11px] font-bold text-white leading-tight">Importação Airbnb 1-Click</h3>
                      <p className="text-[8px] text-neutral-500 mt-1 leading-relaxed">Cole o link do seu anúncio e o Zélla configura tudo automaticamente.</p>

                      {/* URL Input Field */}
                      <div className="mt-3 relative">
                        <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-xl px-2.5 py-2 gap-2">
                          <div className="w-4 h-4 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                            <span className="text-[6px] font-bold text-rose-400">A</span>
                          </div>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: 'auto' }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="overflow-hidden"
                          >
                            <span className="text-[8px] text-blue-300 font-mono whitespace-nowrap">{airbnbUrl}</span>
                          </motion.div>
                          <div className="ml-auto shrink-0">
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 1, type: 'spring', stiffness: 300 }}
                              className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center"
                            >
                              <Check className="w-2 h-2 text-white" />
                            </motion.div>
                          </div>
                        </div>

                        {/* "Colar" indicator */}
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 1, 0] }}
                          transition={{ duration: 0.6, delay: 0.1 }}
                          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neutral-800 text-[6px] text-neutral-300 px-1.5 py-0.5 rounded-md shadow-lg"
                        >
                          Colar
                        </motion.div>
                      </div>

                      {/* Import Button */}
                      <motion.button
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.2 }}
                        className="mt-3 w-full py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20"
                      >
                        <Sparkles className="w-3 h-3 text-white" />
                        <span className="text-[9px] font-bold text-white">Importar anúncio</span>
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── Phase 4: Auto-configuration Progress ─── */}
              {phase === 4 && (
                <motion.div
                  key="zella-config"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex flex-col bg-[#0c0c0e]"
                >
                  {/* Zélla Header */}
                  <div className="shrink-0 px-3 pt-2 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                        <span className="text-white text-[7px] font-black">Z</span>
                      </div>
                      <span className="text-[9px] font-bold text-white">SeuZélla</span>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
                      <span className="text-[7px] text-neutral-400">JS</span>
                    </div>
                  </div>

                  {/* Configuration Progress */}
                  <div className="px-3 flex-1 flex flex-col">
                    <div className="bg-white/[0.02] rounded-2xl border border-white/[0.05] p-3 flex-1 flex flex-col">
                      {/* Title */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                        <span className="text-[9px] font-bold text-blue-400">Importando dados...</span>
                      </div>
                      <p className="text-[8px] text-neutral-500 mb-3">Apartamento Vista Mar — Copacabana</p>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-3">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                          initial={{ width: '0%' }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>

                      {/* Config Items */}
                      <div className="space-y-2 flex-1">
                        {configItems.map((item, i) => {
                          const Icon = item.icon;
                          const isFilled = i < filledCount;
                          return (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-300 ${
                                isFilled
                                  ? 'bg-emerald-500/[0.08] border border-emerald-500/20'
                                  : 'bg-white/[0.02] border border-white/[0.04]'
                              }`}
                            >
                              <Icon className={`w-3 h-3 ${isFilled ? item.color : 'text-neutral-600'}`} />
                              <span className={`text-[8px] font-medium flex-1 ${isFilled ? 'text-white' : 'text-neutral-500'}`}>
                                {item.label}
                              </span>
                              {isFilled ? (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 300 }}
                                >
                                  <Check className="w-3 h-3 text-emerald-400" />
                                </motion.div>
                              ) : (
                                <Loader2 className="w-3 h-3 text-neutral-600 animate-spin" />
                              )}
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Progress percentage */}
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[8px] text-neutral-500">Progresso</span>
                        <span className="text-[10px] font-bold text-blue-400">{progress}%</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── Phase 5: Success! ─── */}
              {phase === 5 && (
                <motion.div
                  key="zella-success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
                  className="absolute inset-0 flex flex-col bg-[#0c0c0e]"
                >
                  {/* Zélla Header */}
                  <div className="shrink-0 px-3 pt-2 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                        <span className="text-white text-[7px] font-black">Z</span>
                      </div>
                      <span className="text-[9px] font-bold text-white">SeuZélla</span>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
                      <span className="text-[7px] text-neutral-400">JS</span>
                    </div>
                  </div>

                  {/* Success Content */}
                  <div className="px-3 flex-1 flex flex-col items-center justify-center">
                    {/* Success Icon */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                      className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-2 border-emerald-500/30 flex items-center justify-center mb-4"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, delay: 0.4 }}
                        className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center"
                      >
                        <Check className="w-5 h-5 text-white" strokeWidth={3} />
                      </motion.div>
                    </motion.div>

                    {/* Success Message */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="text-center"
                    >
                      <h3 className="text-[13px] font-bold text-white mb-1">Imóvel configurado! 🎉</h3>
                      <p className="text-[9px] text-neutral-400 leading-relaxed">
                        Apartamento Vista Mar — Copacabana<br />
                        está pronto para atender hóspedes.
                      </p>
                    </motion.div>

                    {/* Summary Stats */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      className="mt-4 w-full grid grid-cols-2 gap-2"
                    >
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 text-center">
                        <p className="text-[12px] font-bold text-emerald-400">78%</p>
                        <p className="text-[7px] text-neutral-500 mt-0.5">Auto-preenchido</p>
                      </div>
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 text-center">
                        <p className="text-[12px] font-bold text-blue-400">5 min</p>
                        <p className="text-[7px] text-neutral-500 mt-0.5">Tempo total</p>
                      </div>
                    </motion.div>

                    {/* CTA */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 }}
                      className="mt-4 w-full"
                    >
                      <div className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20">
                        <Home className="w-3 h-3 text-white" />
                        <span className="text-[9px] font-bold text-white">Ver painel do imóvel</span>
                        <ChevronRight className="w-2.5 h-2.5 text-white/70" />
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Phase 0: Initial state */}
            {phase === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0c0c0e]">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-2">
                  <Link className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-[9px] text-neutral-500">Magic Onboarding</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small utility icons ─────────────────────────────────────────────
function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function Link({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
