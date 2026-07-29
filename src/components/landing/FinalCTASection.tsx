'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, Zap, Shield, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useNiche } from '@/contexts/NicheContext';

export function FinalCTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const { isPousada } = useNiche();

  return (
    <section ref={ref} className="py-28 sm:py-36 lg:py-44 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className={`absolute inset-0 bg-gradient-to-b from-transparent via-${
          isPousada ? 'emerald' : 'blue'
        }-500/[0.04] to-transparent`} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-10 blur-[120px]">
          <div className={`w-full h-full rounded-full ${
            isPousada
              ? 'bg-gradient-to-br from-emerald-500 via-purple-500 to-blue-500'
              : 'bg-gradient-to-br from-blue-500 via-purple-500 to-emerald-500'
          }`} />
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          {/* Logo */}
          <div className="flex items-center justify-center mb-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={isInView ? { scale: 1 } : {}}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            >
              <img
                src="/logo-zella-b01.png"
                alt="Zélla"
                className="h-7 sm:h-8 w-auto object-contain block"
              />
            </motion.div>
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-8 leading-tight">
            {isPousada ? 'Sua pousada merece' : 'Seus imóveis merecem'}
            <br />
            <span className={`font-bold ${isPousada ? 'text-emerald-400' : 'text-blue-400'}`}>um Zelador 24h por 7</span>
          </h2>

          <p className="text-neutral-400 text-lg sm:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
            {isPousada
              ? 'Imagine ter um atendente que nunca dorme, nunca erra o preço e ainda envia sua chave PIX na hora. O ZÉLLA cuida do seu WhatsApp enquanto você cuida dos seus hóspedes. Assine agora e veja resultados em 48 horas.'
              : 'Imagine ter um co-anfitrião digital que nunca dorme, responde hóspedes instantaneamente e fecha reservas diretas sem comissão. O ZÉLLA cuida do seu WhatsApp enquanto você escala seu portfólio. Assine agora e veja resultados em 48 horas.'
            }
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-14">
            <button
              onClick={() => {
                const el = document.querySelector('#precos');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`group px-10 py-4 text-white font-bold rounded-xl transition-all duration-300 shadow-xl cursor-pointer text-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                isPousada
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-emerald-500/30 hover:shadow-emerald-500/50 focus-visible:ring-emerald-500'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 shadow-blue-500/30 hover:shadow-blue-500/50 focus-visible:ring-blue-500'
              }`}
            >
              <span className="flex items-center gap-2">
                {'Criar meu Dashboard'}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            {isPousada && (
              <button
                onClick={() => router.push('/parceiro')}
                className="px-8 py-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300 font-semibold hover:bg-amber-500/10 hover:border-amber-500/30 transition-all duration-300 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Quero ser Parceiro
              </button>
            )}
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-neutral-600 text-xs">
            <div className="flex items-center gap-2">
              <Zap className={`w-4 h-4 ${isPousada ? 'text-emerald-500/40' : 'text-blue-500/40'}`} />
              <span>Setup em 5 minutos</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className={`w-4 h-4 ${isPousada ? 'text-emerald-500/40' : 'text-blue-500/40'}`} />
              <span>Sem cartão de crédito</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className={`w-4 h-4 ${isPousada ? 'text-emerald-500/40' : 'text-blue-500/40'}`} />
              <span>4.9/5 de avaliação</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
