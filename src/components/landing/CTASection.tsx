'use client';

import { motion } from 'framer-motion';
import { Zap, ArrowRight } from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';

interface CTASectionProps {
  onNavigate?: () => void;
}

export function CTASection({ onNavigate }: CTASectionProps) {
  const { isPousada, isAirbnb } = useNiche();
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto text-center glass-strong p-12 sm:p-16 rounded-2xl relative overflow-hidden"
      >
        {/* Background effects */}
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(${
          isPousada ? '16,185,129' : '59,130,246'
        },0.12),transparent_70%)]`} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.06),transparent_70%)]" />

        <div className="relative z-10">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-neutral-100 mb-4">
            {isPousada ? (
              <>Sua pousada atendida{' '}
              <span className="font-bold text-emerald-400">24 horas por dia</span></>
            ) : isAirbnb ? (
              <>Seus hóspedes respondidos{' '}
              <span className="font-bold text-blue-400">a qualquer hora</span></>
            ) : (
              <>Sua hospedagem funcionando{' '}
              <span className="font-bold text-emerald-400">sem você estar online</span></>
            )}
            {' '}
          </h2>
          <p className="text-neutral-400 text-lg mb-8 max-w-2xl mx-auto">
            Escolha seu plano e comece a atender hóspedes automaticamente hoje mesmo.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <button
                type="button"
                onClick={onNavigate}
                className={`inline-flex items-center gap-2 px-8 py-4 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg text-lg cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                  isPousada
                    ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25 focus-visible:ring-emerald-500'
                    : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/25 focus-visible:ring-blue-500'
                }`}
              >
                <Zap className="w-5 h-5" />
                Criar meu Dashboard
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
          <p className="text-sm text-neutral-600 mt-6">
            Setup em 5 min • Pagamento 100% seguro • Reservas sem comissão
          </p>
        </div>
      </motion.div>
    </section>
  );
}
