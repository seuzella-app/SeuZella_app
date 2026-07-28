'use client';

import { useRef } from 'react';
import { motion, AnimatePresence, useInView, useReducedMotion } from 'framer-motion';
import {
  Clock,
  MessageSquare,
  DollarSign,
  BarChart3,
  Users,
  Sparkles,
  Zap,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  ArrowUpRight,
  Key,
  Bot,
  Building2,
  Crown,
  Lock,
  Star,
  CreditCard,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';
import { getNicheContent, type PainCard } from '@/data/niche-content';

/* ─────────── ICON LOOKUP MAP ─────────── */
const iconMap: Record<string, LucideIcon> = {
  Clock,
  MessageSquare,
  DollarSign,
  BarChart3,
  Users,
  ShieldCheck,
  ShieldAlert,
  Key,
  Bot,
  Building2,
  Crown,
  Lock,
  Star,
  Zap,
  TrendingUp,
  CreditCard,
  UserPlus,
  Sparkles,
};

/* ─────────── COLOR MAP ─────────── */
const colorMap: Record<string, { bg: string; accent: string; ring: string; glow: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-500', accent: 'bg-emerald-500/10', ring: 'border-emerald-500/20', glow: 'shadow-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  blue:    { bg: 'bg-blue-500', accent: 'bg-blue-500/10', ring: 'border-blue-500/20', glow: 'shadow-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  sky:     { bg: 'bg-sky-500', accent: 'bg-sky-500/10', ring: 'border-sky-500/20', glow: 'shadow-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/30' },
  amber:   { bg: 'bg-amber-500', accent: 'bg-amber-500/10', ring: 'border-amber-500/20', glow: 'shadow-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  violet:  { bg: 'bg-violet-500', accent: 'bg-violet-500/10', ring: 'border-violet-500/20', glow: 'shadow-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30' },
  pink:    { bg: 'bg-pink-500', accent: 'bg-pink-500/10', ring: 'border-pink-500/20', glow: 'shadow-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
  rose:    { bg: 'bg-rose-500', accent: 'bg-rose-500/10', ring: 'border-rose-500/20', glow: 'shadow-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30' },
};

/* ─────────── SCROLLING STATS MARQUEE ─────────── */
const scrollStats = [
  { val: '+35%', label: 'Aumento em reservas diretas' },
  { val: '8s', label: 'Tempo médio de resposta' },
  { val: '64%', label: 'Redução em mensagens da API' },
  { val: '24/7', label: 'Disponibilidade 24/7' },
  { val: '5 min', label: 'Tempo de setup' },
  { val: 'R$ 197', label: 'A partir de /mês' },
];

function StatsMarquee() {
  return (
    <div className="relative overflow-hidden py-6 mb-10">
      {/* Edge fade masks */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#060608] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#060608] to-transparent z-10 pointer-events-none" />

      <div className="flex animate-marquee hover:[animation-play-state:paused] w-max gap-3">
        {[...scrollStats, ...scrollStats].map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-5 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] shrink-0"
          >
            <span className="text-xl font-semibold text-white tracking-tight">{s.val}</span>
            <span className="text-[11px] text-neutral-500 font-medium">{s.label}</span>
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
      ` }} />
    </div>
  );
}

/* ─────────── SINGLE OPPORTUNITY CARD ─────────── */
function OpportunityCard({ item, index, isInView, reducedMotion }: { item: PainCard; index: number; isInView: boolean; reducedMotion: boolean }) {
  const c = colorMap[item.color];
  const isLarge = item.size === 'lg';
  const IconComponent = iconMap[item.icon];

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: reducedMotion ? 0.2 : 0.5, delay: reducedMotion ? 0 : index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
      className={`group relative p-6 sm:p-7 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.04] transition-all duration-500 cursor-default overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060608] ${
        isLarge ? 'lg:col-span-1' : ''
      }`}
    >
      {/* Hover glow effect */}
      <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full ${c.accent} blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`} />

      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl ${c.accent} border ${c.ring} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
        {IconComponent && <IconComponent className="w-5 h-5 text-white" />}
      </div>

      {/* Title */}
      <h3 className="text-white font-bold text-base sm:text-lg mb-3">
        {item.title}
      </h3>

      {/* Description */}
      <p className="text-neutral-400 text-sm leading-relaxed mb-4">
        {item.desc}
      </p>

      {/* Stat badge (only large cards) */}
      {item.stat && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${c.accent} border ${c.ring}`}>
          <TrendingUp className={`w-3.5 h-3.5 ${c.text}`} />
          <span className={`text-base font-bold ${c.text}`}>{item.stat.val}</span>
          <span className="text-[10px] text-neutral-500 font-medium">{item.stat.label}</span>
        </div>
      )}

      {/* Arrow hint on hover (large cards) */}
      {isLarge && (
        <div className="absolute bottom-5 right-5 w-7 h-7 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
          <ArrowUpRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white transition-colors duration-300" />
        </div>
      )}
    </motion.div>
  );
}

/* ─────────── MAIN SECTION ─────────── */
export function PainPointsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-60px' });
  const { niche, isPousada } = useNiche();
  const content = getNicheContent(niche);
  const prefersReducedMotion = useReducedMotion();

  // Niche-aware header text
  const headerTitle = isPousada
    ? 'Sua pousada merece'
    : 'Seus imóveis merecem';

  const headerDesc = isPousada
    ? 'Veja como o Zélla transforma o WhatsApp da sua pousada em uma máquina de reservas — sem complicação e no seu tom de voz.'
    : 'Veja como o Zélla transforma o WhatsApp dos seus imóveis em uma máquina de reservas — sem complicação e no seu tom de voz.';

  return (
    <section ref={sectionRef} className="relative bg-[#060608] overflow-hidden py-24 sm:py-32" id="integracoes">
      {/* Subtle background orbs */}
      <div className="absolute top-20 -left-40 w-[400px] h-[400px] rounded-full bg-emerald-500/[0.03] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-20 -right-40 w-[350px] h-[350px] rounded-full bg-blue-500/[0.03] blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center mb-14"
        >
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 mb-5">
            <span className="text-neutral-600 text-sm font-medium">/</span>
            <span className="text-emerald-400/80 text-[11px] font-semibold uppercase tracking-[0.04em]">
              Por que o Zélla
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 leading-[1.08] tracking-[-0.02em]">
            <AnimatePresence mode="wait">
              <motion.span
                key={`title-${niche}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {headerTitle}
              </motion.span>
            </AnimatePresence>
            {' '}
            <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">um atendimento à altura</span>
          </h2>

          <AnimatePresence mode="wait">
            <motion.p
              key={`desc-${niche}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
              className="text-neutral-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed"
            >
              {headerDesc}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* ── Stats Marquee ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <StatsMarquee />
        </motion.div>

        {/* ── Bento Grid ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`grid-${niche}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
          >
            {content.painCards.map((item, i) => (
              <OpportunityCard key={`${niche}-${item.title}`} item={item} index={i} isInView={isInView} reducedMotion={!!prefersReducedMotion} />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* ── Bottom trust strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 mt-14 pt-8 border-t border-white/[0.04]"
        >
          {[
            { icon: Zap, text: 'Setup em 5 minutos' },
            { icon: ShieldCheck, text: 'Sem cartão de crédito' },
            { icon: Sparkles, text: isPousada ? 'Treinado para pousadas' : 'Treinado para anfitriões' },
            { icon: TrendingUp, text: 'Resultados em 48h' },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-neutral-500 text-sm">
              <t.icon className="w-4 h-4 text-emerald-500/50" />
              <span>{t.text}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
