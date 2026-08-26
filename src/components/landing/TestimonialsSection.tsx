'use client';

import { useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Star, Quote, MessageSquare } from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';
import { getNicheContent } from '@/data/niche-content';

const colorKeys = ['emerald', 'blue', 'royal', 'amber'];

const colorMap: Record<string, { border: string; bg: string; star: string }> = {
  emerald: { border: 'border-emerald-500/15', bg: 'from-emerald-500/10 to-emerald-900/5', star: 'text-emerald-400' },
  blue: { border: 'border-blue-500/15', bg: 'from-blue-500/10 to-blue-900/5', star: 'text-blue-400' },
  royal: { border: 'border-blue-500/15', bg: 'from-blue-500/10 to-blue-900/5', star: 'text-blue-400' },
  amber: { border: 'border-amber-500/15', bg: 'from-amber-500/10 to-amber-900/5', star: 'text-amber-400' },
};

const easeOut: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

export function TestimonialsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const { niche } = useNiche();
  const content = getNicheContent(niche);
  const {testimonials} = content;

  const headerText = niche === 'pousada' ? 'O que os pousadeiros dizem' : niche === 'airbnb' ? 'O que os anfitriões dizem' : 'O que os parceiros dizem';

  return (
    <section ref={ref} id="depoimentos" className="parallax-section parallax-grid py-28 sm:py-36 lg:py-44">
      <div className="relative z-10 max-w-6xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-400 text-xs font-medium">Depoimentos Reais</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6">
            {headerText}
            <br />
            <span className="text-amber-400">sobre o Zélla</span>
          </h2>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            {niche === 'pousada'
              ? 'Pousadeiros que já usam o Zélla para vender mais e atender melhor pelo WhatsApp.'
              : niche === 'airbnb'
              ? 'Anfitriões que já usam o Zélla para escalar seus imóveis e atender melhor pelo WhatsApp.'
              : 'Parceiros que já economizam com o plano PRO por preço de parceiro.'}
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={niche}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {testimonials.map((t, i) => {
              const c = colorMap[colorKeys[i % colorKeys.length]];
              return (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 30 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className={`relative p-7 rounded-2xl bg-white/[0.02] border ${c.border} hover:bg-white/[0.04] transition-all duration-300`}
                >
                  {/* Quote icon */}
                  <Quote className={`w-8 h-8 ${c.star} opacity-20 mb-4`} />

                  {/* Stars */}
                  <div className="flex items-center gap-0.5 mb-5">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className={`w-3.5 h-3.5 ${c.star} fill-current`} />
                    ))}
                  </div>

                  {/* Text */}
                  <p className="text-neutral-300 text-sm leading-relaxed mb-6">&ldquo;{t.text}&rdquo;</p>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${c.bg} flex items-center justify-center text-xs font-bold text-white`}>
                      {t.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="text-white text-sm font-semibold">{t.name}</div>
                      <div className="text-neutral-400 text-[11px]">{t.role} — {t.location}</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
