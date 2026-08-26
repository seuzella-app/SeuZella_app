'use client';

import { useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Activity, Hand, DollarSign, ShieldAlert, CheckCircle2,
  Building2, Bell, Key,
  type LucideIcon,
} from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';
import { getNicheContent } from '@/data/niche-content';

const painIconMap: Record<string, LucideIcon> = {
  Activity, Hand, DollarSign, Building2, Bell, Key,
};

export function DashboardPreviewSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const { niche, isPousada, isAirbnb } = useNiche();
  const content = getNicheContent(niche);
  const {dashboard} = content;

  const accentColor = isPousada ? 'emerald' : isAirbnb ? 'blue' : 'amber';
  const accentBg = isPousada ? 'bg-emerald-500/10' : isAirbnb ? 'bg-blue-500/10' : 'bg-amber-500/10';
  const accentBorder = isPousada ? 'border-emerald-500/20' : isAirbnb ? 'border-blue-500/20' : 'border-amber-500/20';
  const accentText = isPousada ? 'text-emerald-400' : isAirbnb ? 'text-blue-400' : 'text-amber-400';

  return (
    <section ref={ref} className="relative py-24 sm:py-32 bg-[#08080a] overflow-hidden border-t border-white/[0.02]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* LADO ESQUERDO: TEXTOS E COPYS DE VENDAS */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="flex flex-col space-y-6"
          >
            {/* Badge */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`dash-badge-${niche}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${accentBg} ${accentBorder} self-start text-xs font-semibold ${accentText}`}
              >
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                {dashboard.badge}
              </motion.div>
            </AnimatePresence>

            {/* Título Principal */}
            <AnimatePresence mode="wait">
              <motion.h2
                key={`dash-title-${niche}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight"
              >
                {dashboard.headline} <br className="hidden sm:inline" />
                <span className="text-[#6488ff] font-bold">
                  {dashboard.headlineAccent}
                </span>
              </motion.h2>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.p
                key={`dash-desc-${niche}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1], delay: 0.1 }}
                className="text-zinc-400 text-base sm:text-lg leading-relaxed"
              >
                {dashboard.desc}
              </motion.p>
            </AnimatePresence>

            {/* Blocos de Solução de Dores */}
            <div className="space-y-4 pt-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`dash-pains-${niche}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                  className="space-y-4"
                >
                  {dashboard.pains.map((pain, i) => {
                    const PainIcon = painIconMap[pain.icon] || Activity;
                    return (
                      <div key={i} className="flex gap-4">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accentBg} ${accentBorder} ${accentText}`}>
                          <PainIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-white font-bold text-sm sm:text-base">{pain.title}</h4>
                          <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">
                            {pain.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* CTA da Seção */}
            <div className="pt-6">
              <Link
                href="#precos"
                className={`inline-flex items-center gap-2 px-6 py-3 ${isPousada ? 'bg-emerald-500 hover:bg-emerald-600' : isAirbnb ? 'bg-blue-500 hover:bg-blue-600' : 'bg-amber-500 hover:bg-amber-600'} text-white font-bold rounded-xl transition-all duration-200 shadow-lg ${isPousada ? 'shadow-emerald-500/10' : isAirbnb ? 'shadow-blue-500/10' : 'shadow-amber-500/10'} text-sm sm:text-base cursor-pointer hover:translate-x-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${isPousada ? 'focus-visible:outline-emerald-500' : isAirbnb ? 'focus-visible:outline-blue-500' : 'focus-visible:outline-amber-500'}`}
              >
                Quero ter esse controle
                <span className="text-base">→</span>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full relative"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`dash-mockup-${niche}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                className="relative bg-[#111] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[480px] w-full text-xs font-sans select-none"
              >
                {/* Header do Mockup */}
                <div className="bg-[#16161a] border-b border-white/[0.05] px-4 py-3 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    </div>
                    <span className="text-[10px] text-zinc-400 font-bold tracking-wider ml-2">
                      PAINEL DE CONTROLE — SEU ZÉLLA
                    </span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${accentText} font-medium text-[10px]`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isPousada ? 'bg-emerald-500' : isAirbnb ? 'bg-blue-500' : 'bg-amber-500'} animate-ping`} />
                    Conectado
                  </div>
                </div>

                {/* Corpo da Interface */}
                <div className="flex flex-1 overflow-hidden">
                  
                  {/* Sidebar de Conversas */}
                  <div className="w-[30%] bg-[#121215] border-r border-white/[0.04] flex flex-col overflow-y-auto hidden sm:flex">
                    <div className="p-2.5 border-b border-white/[0.03] text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                      Conversas Recentes
                    </div>
                    
                    {dashboard.chatConversation.map((msg, i) => (
                      <div key={i} className={`p-2.5 ${i === 0 ? 'bg-white/[0.02]' : ''} border-b border-white/[0.03] flex flex-col gap-1`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-bold ${i === 0 ? 'text-zinc-200' : 'text-zinc-400'}`}>{msg.name || 'Hóspede'}</span>
                          {msg.sender === 'bot' ? (
                            <span className={`text-[7px] px-1 py-0.5 ${isPousada ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : isAirbnb ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'} border rounded-sm`}>IA ATIVA</span>
                          ) : (
                            <span className="text-[7px] px-1 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-sm">RESERVA</span>
                          )}
                        </div>
                        <p className="text-[9px] text-zinc-500 truncate">
                          {msg.text.substring(0, 35)}...
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Janela de Chat Central */}
                  <div className="flex-1 bg-[#16161a] flex flex-col justify-between">
                    <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
                      {dashboard.chatConversation.map((msg, i) => (
                        msg.sender === 'user' ? (
                          <div key={i} className="flex flex-col space-y-1 max-w-[85%]">
                            <span className="text-[8px] text-zinc-500 ml-1 font-semibold">{msg.name}</span>
                            <div className="bg-zinc-800 text-zinc-200 p-2.5 rounded-2xl rounded-tl-sm text-[11px] leading-relaxed">
                              {msg.text}
                            </div>
                          </div>
                        ) : (
                          <div key={i} className="flex flex-col space-y-1 items-end max-w-[85%] ml-auto">
                            <span className={`text-[8px] ${accentText} mr-1 font-semibold flex items-center gap-1`}>
                              ZÉLLA (IA)
                              {msg.confidence && (
                                <span className={`px-1 py-[0.5px] ${isPousada ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : isAirbnb ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-amber-500/20 border-amber-500/30 text-amber-400'} border text-[6px] font-bold rounded-sm`}>
                                  {msg.confidence} Confiança
                                </span>
                              )}
                            </span>
                            <div className={`${isPousada ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-300' : isAirbnb ? 'bg-blue-950/40 border-blue-500/20 text-blue-300' : 'bg-amber-950/40 border-amber-500/20 text-amber-300'} border p-2.5 rounded-2xl rounded-tr-sm text-[11px] leading-relaxed`}>
                              {msg.text}
                            </div>
                            {msg.actions && (
                              <span className={`text-[7px] ${isPousada ? 'text-emerald-500/70' : isAirbnb ? 'text-blue-500/70' : 'text-amber-500/70'} font-semibold tracking-wide mt-0.5`}>
                                ⚡ Ações do ZÉLLA: {msg.actions}
                              </span>
                            )}
                          </div>
                        )
                      ))}
                    </div>

                    {/* Barra de Ação */}
                    <div className="p-3 bg-[#111114] border-t border-white/[0.04] flex items-center justify-between shrink-0">
                      <span className="text-[9px] text-zinc-500 font-medium">
                        {isPousada ? 'Hóspede está aguardando o link...' : isAirbnb ? 'Notificação de reserva enviada...' : 'Economia de R$100/mês confirmada...'}
                      </span>
                      <button
                        type="button"
                        className={`px-3 py-1.5 ${accentBg} border ${isPousada ? 'border-emerald-500/35 hover:bg-emerald-500/20 text-emerald-400' : isAirbnb ? 'border-blue-500/35 hover:bg-blue-500/20 text-blue-400' : 'border-amber-500/35 hover:bg-amber-500/20 text-amber-400'} font-bold rounded-lg flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-md ${isPousada ? 'shadow-emerald-500/5' : isAirbnb ? 'shadow-blue-500/5' : 'shadow-amber-500/5'} active:scale-95`}
                      >
                        <Hand className="w-3.5 h-3.5" />
                        {isPousada ? 'Assumir Conversa' : isAirbnb ? 'Aprovar Reserva' : 'Ver Economia'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Rodapé de Métricas */}
                <div className="bg-[#1b1b22] border-t border-white/[0.05] px-4 py-2 flex items-center justify-between text-[10px] shrink-0 text-zinc-400 font-medium">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className={`w-3.5 h-3.5 ${accentText}`} />
                    {dashboard.footerLeft.label} <span className="text-white font-bold">{dashboard.footerLeft.value}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${accentText}`} />
                    {dashboard.footerRight.label} <span className={`${accentText} font-bold`}>{dashboard.footerRight.value}</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
