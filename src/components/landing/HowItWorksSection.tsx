'use client';

import { useRef } from 'react';
import { motion, AnimatePresence, useInView, useReducedMotion } from 'framer-motion';
import {
  UserPlus,
  MessageSquare,
  BarChart3,
  ArrowRight,
  Mail,
  Building,
  CheckCircle2,
  Sparkles,
  Zap,
  Globe,
  Link,
  Bot,
  CreditCard,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';
import { getNicheContent, type StepData } from '@/data/niche-content';

/* ─────────── ICON LOOKUP MAP ─────────── */
const iconMap: Record<string, LucideIcon> = {
  UserPlus,
  MessageSquare,
  BarChart3,
  Link,
  Bot,
  CreditCard,
  TrendingUp,
};

/* ─────────── COLOR MAP ─────────── */
const colorMap: Record<string, { bg: string; border: string; text: string; glow: string; accent: string; ring: string }> = {
  emerald: {
    bg: 'from-emerald-500/20 to-emerald-900/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/10',
    accent: 'bg-emerald-500/10',
    ring: 'border-emerald-500/20',
  },
  blue: {
    bg: 'from-sky-500/20 to-sky-900/10',
    border: 'border-sky-500/20',
    text: 'text-sky-400',
    glow: 'shadow-sky-500/10',
    accent: 'bg-sky-500/10',
    ring: 'border-sky-500/20',
  },
  violet: {
    bg: 'from-violet-500/20 to-violet-900/10',
    border: 'border-violet-500/20',
    text: 'text-violet-400',
    glow: 'shadow-violet-500/10',
    accent: 'bg-violet-500/10',
    ring: 'border-violet-500/20',
  },
  amber: {
    bg: 'from-amber-500/20 to-amber-900/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/10',
    accent: 'bg-amber-500/10',
    ring: 'border-amber-500/20',
  },
  sky: {
    bg: 'from-sky-500/20 to-sky-900/10',
    border: 'border-sky-500/20',
    text: 'text-sky-400',
    glow: 'shadow-sky-500/10',
    accent: 'bg-sky-500/10',
    ring: 'border-sky-500/20',
  },
};

/* ─────────── STEP CARD ─────────── */
function StepCard({
  step,
  index,
  isInView,
  reducedMotion,
}: {
  step: StepData;
  index: number;
  isInView: boolean;
  reducedMotion: boolean;
}) {
  const c = colorMap[step.color];
  const IconComponent = iconMap[step.icon];

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: reducedMotion ? 0.2 : 0.6, delay: reducedMotion ? 0 : index * 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative group h-full"
    >
      {/* Desktop connector line */}
      {index < 2 && (
        <div className="hidden lg:flex absolute top-1/2 -right-5 z-20 items-center justify-center w-10 h-10 pointer-events-none">
          <div className="w-8 h-8 rounded-full bg-zinc-900/90 border border-white/20 flex items-center justify-center group-hover:border-emerald-400 group-hover:bg-emerald-500/10 transition-all duration-300 shadow-xl">
            <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-emerald-400 transition-colors duration-300" />
          </div>
        </div>
      )}

      <div className={`relative p-8 sm:p-10 rounded-3xl bg-gradient-to-b from-zinc-900/95 via-zinc-900/80 to-zinc-950/95 border border-white/10 hover:border-emerald-500/40 transition-all duration-500 shadow-2xl backdrop-blur-xl h-full flex flex-col justify-between overflow-hidden group-hover:-translate-y-1.5`}>
        
        {/* Background Watermark Number */}
        <span className="absolute -bottom-6 -right-4 text-9xl font-black font-satoshi text-white/[0.04] group-hover:text-white/[0.08] transition-colors duration-500 select-none pointer-events-none tracking-tighter">
          {step.num}
        </span>

        {/* Ambient Glow Gradient Blob */}
        <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full ${c.accent} blur-[80px] opacity-20 group-hover:opacity-60 transition-opacity duration-700 pointer-events-none`} />
        
        {/* Metallic Top Hairline Highlight */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:via-emerald-400 transition-all duration-500" />

        <div className="relative z-10">
          {/* Top Row: step badge & icon */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-800/90 border border-white/15 shadow-inner">
              <span className={`text-xs font-black tracking-widest font-satoshi uppercase ${c.text}`}>PASSO {step.num}</span>
            </div>

            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.bg} border ${c.border} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-black/40`}>
              {IconComponent && <IconComponent className={`w-7 h-7 ${c.text}`} />}
            </div>
          </div>

          {/* Title & Subtitle */}
          <h3 className="text-white font-extrabold text-2xl sm:text-3xl mb-2 tracking-tight">{step.title}</h3>
          <p className={`text-xs font-bold ${c.text} mb-4 tracking-wider uppercase`}>{step.subtitle}</p>

          {/* Description */}
          <p className="text-neutral-300 text-sm sm:text-base leading-relaxed mb-6 font-normal">{step.desc}</p>

          {/* Highlights Chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            {step.highlights.map((h, i) => (
              <div
                key={i}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-800/80 border border-white/10 text-xs font-semibold ${c.text} shadow-sm`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                {h}
              </div>
            ))}
          </div>
        </div>

        {/* Form fields preview (step 1 only) */}
        {step.fields && (
          <div className="relative z-10 space-y-2 pt-5 border-t border-white/10 mt-auto">
            {step.fields.map((field, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5"
              >
                <div className={`w-2 h-2 rounded-full ${c.text.replace('text-', 'bg-')} opacity-90`} />
                <span className="text-neutral-300 text-xs font-medium">{field}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-4 pt-2 text-emerald-400 text-xs font-bold">
              <Mail className="w-4 h-4" />
              <Building className="w-4 h-4" />
              <span>Setup rápido — em menos de 5 minutos</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────── SECTION ─────────── */
export function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-60px' });
  const { niche, isPousada, isAirbnb } = useNiche();
  const content = getNicheContent(niche);
  const prefersReducedMotion = useReducedMotion();

  // Niche-aware header text
  const headerTitle = isPousada
    ? 'Em 3 passos simples'
    : 'Em 3 passos, sem sair do sofá';

  const headerDesc = isPousada
    ? 'Do cadastro à primeira reserva automatizada em menos de 24 horas. Sem precisar de conhecimento técnico.'
    : 'Da URL do anúncio ao primeiro check-in virtual automaticamente. Sem precisar de conhecimento técnico.';

  return (
    <section ref={sectionRef} id="como-funciona" className="relative overflow-hidden py-24 sm:py-32 bg-[#09090b]">
      {/* Background grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center mb-14"
        >
          {/* Eyebrow */}
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full ${isAirbnb ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'} mb-5`}>
            <Zap className={`w-3.5 h-3.5 ${isAirbnb ? 'text-blue-400' : 'text-emerald-400'}`} />
            <span className={`${isAirbnb ? 'text-blue-400' : 'text-emerald-400'} text-[11px] font-semibold uppercase tracking-[0.04em]`}>Simples como 1-2-3</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.h2
              key={`title-${niche}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 leading-[1.08] tracking-[-0.02em]"
            >
              {headerTitle}
            </motion.h2>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.p
              key={`desc-${niche}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
              className="text-neutral-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed"
            >
              {headerDesc}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* ── Steps Grid ── */}
        <AnimatePresence mode="wait">
          <div
            key={`steps-${niche}`}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {content.steps.map((step, i) => (
              <StepCard
                key={`${niche}-${step.num}`}
                step={step}
                index={i}
                isInView={isInView}
                reducedMotion={!!prefersReducedMotion}
              />
            ))}
          </div>
        </AnimatePresence>

        {/* ── Bottom promise strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.7 }}
          className={`mt-16 p-7 sm:p-8 rounded-2xl bg-zinc-900/80 border border-white/10 text-center shadow-xl backdrop-blur-md`}
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center`}>
                <Sparkles className={`w-5 h-5 text-emerald-400`} />
              </div>
              <div className="text-left">
                <div className="text-white font-bold text-sm">Primeira reserva automatizada</div>
                <div className="text-neutral-400 text-xs">Em até 24 horas</div>
              </div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-white/[0.08]" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Globe className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-left">
                <div className="text-white font-bold text-sm">
                  <span className="text-emerald-400">PT</span>
                  <span className="text-neutral-600 mx-1.5">/</span>
                  <span className="text-blue-400">ES</span>
                  <span className="text-white ml-1.5">Bilíngue</span>
                </div>
                <div className="text-neutral-400 text-xs">Atende em português e espanhol</div>
              </div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-white/[0.08]" />
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center`}>
                <Zap className={`w-5 h-5 text-violet-400`} />
              </div>
              <div className="text-left">
                <div className="text-white font-bold text-sm">Tom Personalizado</div>
                <div className="text-neutral-400 text-xs">IA treinada na sua pousada</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="text-center mt-12"
        >
          <button
            onClick={() => {
              const el = document.querySelector('#precos');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`group inline-flex items-center gap-2 px-8 py-4 rounded-xl ${isAirbnb ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 shadow-blue-500/25 hover:shadow-blue-500/40' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-emerald-500/25 hover:shadow-emerald-500/40'} text-white font-bold transition-all duration-300 shadow-lg cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
          >
            Conhecer Planos & Começar
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
