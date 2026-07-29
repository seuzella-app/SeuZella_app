'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useNiche } from '@/contexts/NicheContext';

/**
 * Floating CTA Bar — aparece quando o usuário scrolla mais de 450px.
 *
 * CORREÇÃO v2 — finding 4.3:
 *  Versão anterior registava `handleScroll` apenas como listener, sem
 *  chamar manualmente no mount. Se o usuário acessasse via anchor link
 *  (`/#precos`) ou voltasse de history com scrollY > 450, o componente
 *  ficava hidden até o próximo evento de scroll.
 *
 *  V2: chama `handleScroll` imediatamente após registerListener para
 *  reavaliar a posição atual. Também adiciona `{ passive: true }` no
 *  listener para performance.
 */
export function FloatingCTA() {
  const [isVisible, setIsVisible] = useState(false);
  const { isPousada, isAirbnb } = useNiche();

  useEffect(() => {
    const handleScroll = () => {
      // Mostra a barra quando o usuário rolar mais de 450px
      setIsVisible(window.scrollY > 450);
    };

    // Reavalia imediatamente — cobre casos de anchor link / history navigation
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[#09090b]/95 backdrop-blur-xl transition-all duration-300 transform shadow-[0_-8px_30px_rgba(0,0,0,0.8)] ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6">
        {/* Texto da Esquerda */}
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <p className="text-zinc-200 text-sm sm:text-base font-medium text-center sm:text-left">
            Atendimento inteligente 24/7 para {isPousada ? 'sua pousada.' : isAirbnb ? 'seus imóveis.' : 'seu negócio.'}
          </p>
        </div>

        {/* Botão da Direita */}
        <Link
          href="#precos"
          className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-lg text-center transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-sm cursor-pointer whitespace-nowrap active:scale-[0.98]"
        >
          Criar meu Dashboard
        </Link>
      </div>
    </div>
  );
}
