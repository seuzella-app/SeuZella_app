'use client';

import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';
import { getNicheContent } from '@/data/niche-content';

import { trackLandingClick } from '@/lib/telemetry/landing-telemetry';

const easeOut: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

import { Search } from 'lucide-react';

function FAQItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-6 text-left cursor-pointer group"
      >
        <span className="text-white text-base font-semibold pr-4 group-hover:text-emerald-400 transition-colors">{q}</span>
        <ChevronDown
          className={`w-5 h-5 text-neutral-500 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-400' : ''}`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed pb-6 font-normal">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const { niche } = useNiche();
  const content = getNicheContent(niche);
  const {faqs} = content;

  const filteredFaqs = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const headerText = niche === 'pousada'
    ? 'Perguntas frequentes sobre Pousadas'
    : niche === 'airbnb'
    ? 'Perguntas frequentes sobre Anfitriões'
    : 'Perguntas frequentes sobre Parceiros';

  return (
    <section ref={ref} id="faq" className="py-24 sm:py-32 bg-[#09090b]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-5">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-blue-400 text-[11px] font-semibold uppercase tracking-[0.04em]">Dúvidas Frequentes</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            {headerText}
          </h2>
          <p className="text-neutral-400 text-base sm:text-lg">
            Tudo que você precisa saber sobre o Seu Zélla.
          </p>

          {/* Search bar */}
          <div className="mt-8 relative max-w-md mx-auto">
            <Search className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite sua dúvida (ex: WhatsApp, PIX, reservas)..."
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all"
            />
          </div>
        </motion.div>

        {/* FAQ Items */}
        <AnimatePresence mode="wait">
          <motion.div
            key={niche}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 border border-white/10 px-6 sm:px-8 shadow-xl backdrop-blur-md"
          >
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq, i) => (
                <FAQItem
                  key={i}
                  q={faq.question}
                  a={faq.answer}
                  isOpen={openIndex === i}
                  onToggle={() => {
                    const nextState = openIndex !== i;
                    if (nextState) {
                      trackLandingClick({
                        eventName: 'faq_expand',
                        category: 'faq_interaction',
                        label: faq.question,
                      });
                    }
                    setOpenIndex(openIndex === i ? null : i);
                  }}
                />
              ))
            ) : (
              <div className="py-12 text-center text-neutral-400 text-sm">
                Nenhuma pergunta encontrada para &quot;{searchQuery}&quot;.
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
