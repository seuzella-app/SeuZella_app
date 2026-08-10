'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';
import { getNicheContent } from '@/data/niche-content';
import { NicheToggle } from './NicheToggle';
import { DDCHeroPreview } from './DDCHeroPreview';
import { PaymentTrustBadges } from './PaymentTrustBadges';

import { trackLandingClick } from '@/lib/telemetry/landing-telemetry';

export function HeroSection() {
  const { niche, setNiche, isPousada } = useNiche();
  const content = getNicheContent(niche);
  const [mounted, setMounted] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveReducedMotion = mounted ? prefersReducedMotion : false;

  const staggerContainer = {
    hidden: {},
    visible: {
      transition: { staggerChildren: effectiveReducedMotion ? 0 : 0.12, delayChildren: effectiveReducedMotion ? 0 : 0.1 },
    },
  };

  const staggerItem = {
    hidden: effectiveReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 },
    visible: {
      opacity: 1, y: 0,
      transition: { duration: effectiveReducedMotion ? 0.2 : 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
    },
  };

  const shimmerStyle = effectiveReducedMotion ? undefined : {
    backgroundSize: '200% 100%',
    animation: 'shimmer 3s ease-in-out infinite',
  };

  return (
    <section className="relative flex items-center overflow-hidden bg-[#09090b]">
      {/* Dynamic background image with crossfade */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={`bg-${niche}`}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] }}
            className="absolute inset-0"
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${content.switcher.backgroundImage})` }}
            />
            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#09090b] via-[#09090b]/85 to-[#09090b]" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dynamic glow orbs */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`orbs-${niche}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 pointer-events-none z-[1]"
        >
          <div
            className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full blur-[120px]"
            style={{ background: content.switcher.glowColor }}
          />
          <div
            className="absolute bottom-1/4 -right-32 w-[400px] h-[400px] rounded-full blur-[100px]"
            style={{
              background: niche === 'pousada'
                ? 'rgba(20, 184, 166, 0.04)'
                : 'rgba(139, 92, 246, 0.04)',
            }}
          />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 lg:px-10 pt-28 pb-12 sm:pt-36 sm:pb-16 w-full">
        <div className="flex flex-col items-center text-center">

          {/* ── Text Content — Staggered Entrance ── */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center max-w-5xl mx-auto w-full"
          >
            {/* HOTSPOT 1: Niche Switcher Toggle at the very top */}
            <motion.div
              variants={staggerItem}
              className="flex flex-col items-center gap-2 mb-6"
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 shadow-lg shadow-emerald-500/10">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 text-xs font-bold uppercase tracking-wider">
                  Selecione o seu perfil de atendimento:
                </span>
              </div>
              <NicheToggle niche={niche} onNicheChange={setNiche} />
            </motion.div>

            {/* Headline — Dynamic Pure Niche Copy */}
            <motion.h1
              variants={staggerItem}
              key={`headline-${niche}`}
              className="text-[2.2rem] sm:text-[3.2rem] md:text-[3.8rem] lg:text-[4.2rem] font-satoshi font-extrabold tracking-[-0.03em] md:tracking-[-0.04em] leading-[1.12] text-white mb-6 text-center max-w-4xl mx-auto"
            >
              <span className="block bg-gradient-to-r from-white via-zinc-100 to-zinc-300 bg-clip-text text-transparent">
                {content.switcher.headline}
              </span>
            </motion.h1>

            {/* Subtitle — Dynamic Pure Niche Copy */}
            <motion.p
              variants={staggerItem}
              key={`sub-${niche}`}
              className="text-[16px] sm:text-[18px] md:text-xl text-zinc-300 leading-relaxed mb-8 max-w-3xl mx-auto font-normal"
            >
              {content.switcher.subheadline}
            </motion.p>

            {/* Hero stat chip */}
            <motion.div variants={staggerItem} className="mb-8 flex justify-center">
              <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-xl border ${
                isPousada
                  ? 'bg-emerald-500/[0.08] border-emerald-500/30 text-emerald-400'
                  : 'bg-blue-500/[0.08] border-blue-500/30 text-blue-400'
              }`}>
                <span className="text-2xl sm:text-3xl font-black tracking-tight">
                  {content.switcher.heroStat.val}
                </span>
                <span className="text-zinc-300 text-xs sm:text-sm font-semibold text-left">
                  {content.switcher.heroStat.label}
                </span>
              </div>
            </motion.div>

            {/* ── Social proof ── */}
            <motion.div
              variants={staggerItem}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 text-xs sm:text-sm text-neutral-400 font-medium mb-4"
            >
              <div className="flex -space-x-2">
                {[
                  { name: 'Pousada Serenity', img: '/avatar-serenity.jpg' },
                  { name: 'Pousada Sol & Mar', img: '/pousada-vista.jpg' },
                  { name: 'Chalé da Montanha', img: '/pousada-chale.jpg' },
                  { name: 'Recanto Verde', img: '/pousada-jardim.jpg' },
                ].map((p, i) => (
                  <div key={i} className="w-7 h-7 rounded-full p-[1.5px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-sm relative" style={{ zIndex: 40 - i * 10 }}>
                    <div className="w-full h-full rounded-full border border-[#09090b] overflow-hidden bg-zinc-900">
                      <img
                        src={p.img}
                        alt={p.name}
                        className="w-full h-full object-cover select-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <span className="sm:border-l sm:border-white/10 sm:pl-6 text-neutral-300 font-bold tracking-tight">
                {isPousada ? '+100 pousadas já atendem melhor com o Zélla' : '+100 anfitriões já atendem melhor com o Zélla'}
              </span>
            </motion.div>

            {/* ── LIVE INTERACTIVE DDC DASHBOARD DO CLIENTE PREVIEW ── */}
            <motion.div variants={staggerItem} className="w-full">
              <DDCHeroPreview />
            </motion.div>

            {/* ── REPOSICIONADOS: CTAS CONHECER PLANOS & QUERO SER PARCEIRO (ABAIXO DO DDC) ── */}
            <motion.div
              variants={staggerItem}
              key={`cta-${niche}`}
              className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4 w-full"
            >
              <button
                onClick={() => {
                  trackLandingClick({ eventName: 'hero_planos', category: 'cta_click', label: 'Conhecer Planos & Preços' });
                  const el = document.querySelector('#precos');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`group inline-flex items-center justify-center gap-2 px-8 py-4 ${
                  isPousada
                    ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-emerald-500/30'
                    : 'bg-gradient-to-r from-rose-500 via-rose-400 to-rose-600 hover:from-rose-400 hover:to-rose-500 shadow-rose-500/30'
                } text-white font-bold rounded-xl transition-all duration-200 shadow-2xl text-base active:scale-[0.98] hover:scale-[1.02] cursor-pointer`}
                style={shimmerStyle}
              >
                Conhecer Planos & Preços
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </button>

              <a
                href="/parceiro"
                onClick={() => {
                  trackLandingClick({ eventName: 'hero_parceiro', category: 'cta_click', label: 'Quero ser Parceiro Zélla' });
                }}
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold rounded-xl transition-all duration-200 shadow-xl shadow-amber-500/20 text-base active:scale-[0.98] hover:scale-[1.02] cursor-pointer"
                style={shimmerStyle}
              >
                Quero ser Parceiro Zélla
                <Sparkles className="w-5 h-5 text-amber-200" />
              </a>
            </motion.div>

            {/* Selos de Pagamento Asaas & Mercado Pago */}
            <motion.div variants={staggerItem} className="w-full mt-4">
              <PaymentTrustBadges />
            </motion.div>

          </motion.div>
        </div>
      </div>

      {/* Shimmer keyframe animation */}
      {mounted && !effectiveReducedMotion && (
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes shimmer {
            0% { background-position: 200% center; }
            100% { background-position: -200% center; }
          }
        ` }} />
      )}
    </section>
  );
}
