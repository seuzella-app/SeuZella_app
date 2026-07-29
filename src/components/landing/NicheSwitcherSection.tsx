'use client';

import { useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';
import { getNicheContent } from '@/data/niche-content';

export function NicheSwitcherSection() {
  const { niche } = useNiche();
  const content = getNicheContent(niche);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative pt-14 pb-20 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-36 overflow-hidden border-t border-white/[0.03] bg-[#060608]">

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] }}
          className="flex flex-col items-center text-center gap-8 sm:gap-10"
        >
          {/* Dynamic headline + subheadline */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`content-${niche}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] }}
              className="flex flex-col items-center gap-7"
            >
              {/* Headline */}
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight leading-[1.1] text-white max-w-4xl">
                Organize e lucre mais,{' '}
                <span className={
                  niche === 'pousada'
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent'
                    : 'bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent'
                }>
                  gaste menos no WhatsApp.
                </span>
              </h2>

              {/* Subheadline */}
              <p className="text-neutral-300 text-base sm:text-lg md:text-xl leading-relaxed max-w-3xl font-normal">
                {niche === 'pousada'
                  ? 'O Zélla organiza sua pousada e ajuda a lucrar mais e gastar menos no WhatsApp. Responde seus hóspedes com disponibilidade. Sincroniza Booking.com e entrega Guia Digital automático.'
                  : 'O Zélla organiza seu imóvel e ajuda a lucrar mais e gastar menos no WhatsApp. Responde seus hóspedes com disponibilidade. Conecta Airbnb e Booking.com e entrega Guia Digital automático.'}
              </p>

              {/* Social proof proof badge */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 text-xs sm:text-sm text-neutral-400 font-medium mt-2">
                <div className="flex -space-x-2">
                  {[
                    { name: niche === 'airbnb' ? 'Flat Copacabana' : 'Pousada Serenity', img: '/avatar-serenity.jpg' },
                    { name: niche === 'airbnb' ? 'Chalé Campos' : 'Pousada Sol & Mar', img: '/pousada-vista.jpg' },
                    { name: niche === 'airbnb' ? 'Apartamento Centro' : 'Chalé da Montanha', img: '/pousada-chale.jpg' },
                    { name: niche === 'airbnb' ? 'Studio Paulista' : 'Recanto Verde', img: '/pousada-jardim.jpg' },
                  ].map((p, i) => (
                    <div key={i} className="w-7 h-7 rounded-full p-[1.5px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-sm relative" style={{ zIndex: 40 - i * 10 }}>
                      <div className="w-full h-full rounded-full border border-[#09090b] overflow-hidden bg-zinc-900">
                        <img src={p.img} alt={p.name} className="w-full h-full object-cover select-none" />
                      </div>
                    </div>
                  ))}
                </div>
                <span className="sm:border-l sm:border-white/10 sm:pl-6 text-neutral-300 font-bold tracking-tight">
                  {niche === 'pousada' ? '+100 pousadas já atendem melhor com o Zélla' : '+100 anfitriões já atendem melhor com o Zélla'}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-4"
          >
            <button
              onClick={() => {
                const el = document.querySelector('#como-funciona');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`group inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-white transition-all duration-300 shadow-lg cursor-pointer active:scale-95 ${
                niche === 'pousada'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-emerald-500/25 hover:shadow-emerald-500/40'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 shadow-blue-500/25 hover:shadow-blue-500/40'
              }`}
            >
              {content.switcher.ctaText}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>

          {/* "Not sure?" link */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-neutral-600 text-sm"
          >
            Não tem certeza?{' '}
            <a
              href="#faq"
              className="text-neutral-400 hover:text-neutral-200 underline underline-offset-2 transition-colors"
            >
              Veja as diferenças
            </a>
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
