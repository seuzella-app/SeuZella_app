'use client';

import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';
import { getNicheContent } from '@/data/niche-content';

import { trackLandingClick } from '@/lib/telemetry/landing-telemetry';

const easeOut: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

function FAQItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-white/[0.04] last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-6 text-left cursor-pointer group"
      >
        <span className="text-white text-sm font-medium pr-4 group-hover:text-emerald-400 transition-colors">{q}</span>
        <ChevronDown
          className={`w-4 h-4 text-neutral-500 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-400' : ''}`}
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
            <p className="text-neutral-400 text-sm leading-relaxed pb-6">{a}</p>
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
  const { niche } = useNiche();
  const content = getNicheContent(niche);
  const faqs = content.faqs;

  const headerText = niche === 'pousada'
    ? 'Perguntas frequentes sobre Pousadas'
    : niche === 'airbnb'
    ? 'Perguntas frequentes sobre Anfitriões'
    : 'Perguntas frequentes sobre Parceiros';

  return (
    <section ref={ref} id="faq" className="py-28 sm:py-36 lg:py-44">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-blue-400 text-xs font-medium">Dúvidas Frequentes</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-6">
            {headerText}
          </h2>
          <p className="text-neutral-400 text-lg">
            Tudo que você precisa saber antes de começar.
          </p>
        </motion.div>

        {/* FAQ Items */}
        <AnimatePresence mode="wait">
          <motion.div
            key={niche}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="rounded-2xl bg-white/[0.02] border border-white/[0.06] px-8"
          >
            {faqs.map((faq, i) => (
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
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
