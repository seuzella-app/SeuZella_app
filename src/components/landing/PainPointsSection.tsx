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
  CheckCircle2,
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
const colorMap: Record<string, { bg: string; border: string; text: string; glow: string; accent: string; ring: string }> = {
  emerald: {
    bg: 'from-emerald-500/25 to-emerald-950/30',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/15',
    accent: 'bg-emerald-500/15',
    ring: 'border-emerald-500/30',
  },
  blue: {
    bg: 'from-sky-500/25 to-sky-950/30',
    border: 'border-sky-500/30',
    text: 'text-sky-400',
    glow: 'shadow-sky-500/15',
    accent: 'bg-sky-500/15',
    ring: 'border-sky-500/30',
  },
  violet: {
    bg: 'from-violet-500/25 to-violet-950/30',
    border: 'border-violet-500/30',
    text: 'text-violet-400',
    glow: 'shadow-violet-500/15',
    accent: 'bg-violet-500/15',
    ring: 'border-violet-500/30',
  },
  amber: {
    bg: 'from-amber-500/25 to-amber-950/30',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/15',
    accent: 'bg-amber-500/15',
    ring: 'border-amber-500/30',
  },
  sky: {
    bg: 'from-sky-500/25 to-sky-950/30',
    border: 'border-sky-500/30',
    text: 'text-sky-400',
    glow: 'shadow-sky-500/15',
    accent: 'bg-sky-500/15',
    ring: 'border-sky-500/30',
  },
  rose: {
    bg: 'from-rose-500/25 to-rose-950/30',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    glow: 'shadow-rose-500/15',
    accent: 'bg-rose-500/15',
    ring: 'border-rose-500/30',
  },
};

/* ─────────── SCROLLING STATS MARQUEE ─────────── */
const scrollStats = [
  { val: '+47%', label: 'Aumento em receita direta' },
  { val: '8s', label: 'Tempo médio de resposta' },
  { val: '80%', label: 'Economia no atendimento' },
  { val: '24/7', label: 'Disponibilidade total' },
  { val: 'Zero', label: 'Risco de overbooking' },
  { val: '100%', label: 'No seu tom de voz' },
];

function StatsMarquee() {
  return (
    <div className="relative overflow-hidden py-6 mb-12">
      {/* Edge fade masks */}
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#060608] via-[#060608]/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#060608] via-[#060608]/80 to-transparent z-10 pointer-events-none" />

      <div className="flex animate-marquee hover:[animation-play-state:paused] w-max gap-4">
        {[...scrollStats, ...scrollStats, ...scrollStats].map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-zinc-900/80 border border-white/10 shadow-lg backdrop-blur-md shrink-0"
          >
            <span className="text-lg font-black text-emerald-400 tracking-tight font-satoshi">{s.val}</span>
            <span className="text-xs text-neutral-300 font-medium">{s.label}</span>
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .animate-marquee {
          animation: marquee 35s linear infinite;
        }
      ` }} />
    </div>
  );
}

/* ─────────── BENTO OPPORTUNITY CARD ─────────── */
function OpportunityCard({ item, index, isInView, reducedMotion }: { item: PainCard; index: number; isInView: boolean; reducedMotion: boolean }) {
  const c = colorMap[item.color] || colorMap.emerald;
  const isLarge = item.size === 'lg' || index === 0;
  const IconComponent = iconMap[item.icon] || Sparkles;

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: reducedMotion ? 0.2 : 0.5, delay: reducedMotion ? 0 : index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative p-8 sm:p-9 rounded-3xl bg-gradient-to-b from-zinc-900/95 via-zinc-900/85 to-zinc-950/95 border border-white/10 hover:border-emerald-500/40 transition-all duration-500 shadow-2xl backdrop-blur-xl flex flex-col justify-between overflow-hidden group-hover:-translate-y-1.5 ${
        isLarge ? 'md:col-span-2 lg:col-span-2' : 'col-span-1'
      }`}
    >
      {/* Top Hairline Metallic Highlight */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:via-emerald-400 transition-all duration-500" />

      {/* Ambient Glow Gradient Blob */}
      <div className={`absolute -top-24 -right-24 w-52 h-52 rounded-full ${c.accent} blur-[90px] opacity-25 group-hover:opacity-75 transition-opacity duration-700 pointer-events-none`} />

      <div className="relative z-10">
        {/* Top Header Row: Icon + Badge */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.bg} border ${c.border} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-xl shadow-black/50`}>
            <IconComponent className={`w-7 h-7 ${c.text}`} />
          </div>

          {item.stat && (
            <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full ${c.accent} border ${c.ring} shadow-sm`}>
              <TrendingUp className={`w-3.5 h-3.5 ${c.text}`} />
              <span className={`text-xs font-black ${c.text}`}>{item.stat.val}</span>
              <span className="text-[10px] text-neutral-300 font-medium hidden sm:inline">{item.stat.label}</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-white font-extrabold text-xl sm:text-2xl mb-3 tracking-tight leading-snug">
          {item.title}
        </h3>

        {/* Description */}
        <p className="text-neutral-300 text-sm sm:text-base leading-relaxed mb-6 font-normal">
          {item.desc}
        </p>
      </div>

      {/* Bottom Action Footer */}
      <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 group-hover:text-emerald-400 transition-colors">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Solução Integrada Seu Zélla</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center group-hover:border-emerald-400/50 group-hover:bg-emerald-500/10 transition-all duration-300">
          <ArrowUpRight className="w-4 h-4 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
        </div>
      </div>
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
    ? 'Veja como o Zélla transforma o WhatsApp da sua pousada em uma máquina de reservas 24/7 — com precificação inteligente e no seu tom de voz.'
    : 'Veja como o Zélla transforma o WhatsApp dos seus imóveis em uma máquina de reservas 24/7 — com precificação inteligente e no seu tom de voz.';

  return (
    <section ref={sectionRef} className="relative bg-[#060608] overflow-hidden py-24 sm:py-32" id="integracoes">
      {/* Background grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* Subtle background ambient orbs */}
      <div className="absolute top-20 -left-40 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.04] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-20 -right-40 w-[450px] h-[450px] rounded-full bg-blue-500/[0.04] blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center mb-14"
        >
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">
              Diferenciais de Alta Conversão
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-5 leading-[1.08] tracking-tight">
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
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
              um atendimento à altura
            </span>
          </h2>

          <AnimatePresence mode="wait">
            <motion.p
              key={`desc-${niche}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
              className="text-neutral-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-normal"
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

        {/* ── Bento Grid Glassmorphic ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`grid-${niche}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
          >
            {content.painCards.map((item, i) => (
              <OpportunityCard
                key={`${niche}-${item.title}`}
                item={item}
                index={i}
                isInView={isInView}
                reducedMotion={!!prefersReducedMotion}
              />
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
