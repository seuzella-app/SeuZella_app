'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';
import { NicheToggle } from './NicheToggle';

export function HeroSection() {
  const { niche, setNiche, isPousada, isAirbnb } = useNiche();
  const [mounted, setMounted] = useState(false);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  // ── Rotating phrases for the second line of the headline ──
  const rotatingPhrases = isPousada
    ? ['gaste menos no WhatsApp.', 'nunca perca uma reserva.', 'tenha preços inteligentes.']
    : isAirbnb
    ? ['gaste menos no WhatsApp.', 'nunca perca uma reserva.', 'tenha preços inteligentes.']
    : ['congela seu preço por 24 meses.', 'plano PRO completo.', 'selo exclusivo de parceiro.'];

  // Rotate phrase every 3 seconds
  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = setInterval(() => {
      setPhraseIdx((prev) => (prev + 1) % rotatingPhrases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [rotatingPhrases.length, prefersReducedMotion]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Staggered entrance animation variants
  // CORREÇÃO v2 — finding 4.1: gate com `mounted` para evitar hydration mismatch.
  // useReducedMotion() retorna null no SSR (não acessa window.matchMedia), mas boolean
  // no client. Sem o gate, usuários com prefers-reduced-motion ativado veriam mismatch
  // entre HTML servido (assumindo y:20) e HTML rehydratado (assumindo sem y).
  const effectiveReducedMotion = mounted ? prefersReducedMotion : false;

  const staggerContainer = {
    hidden: {},
    visible: {
      transition: { staggerChildren: effectiveReducedMotion ? 0 : 0.12, delayChildren: effectiveReducedMotion ? 0 : 0.1 },
    },
  };
  const staggerItem = {
    hidden: effectiveReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 },
    visible: {
      opacity: 1, y: 0,
      transition: { duration: effectiveReducedMotion ? 0.2 : 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
    },
  };

  // CTA shimmer keyframe style (também gated por effectiveReducedMotion para consistência)
  const shimmerStyle = effectiveReducedMotion ? undefined : {
    backgroundSize: '200% 100%',
    animation: 'shimmer 3s ease-in-out infinite',
  };

  return (
    <section className="relative flex items-center overflow-hidden bg-[#09090b]">

      {/* Ambient glow — with floating animation */}
      <motion.div
        animate={prefersReducedMotion ? {} : { y: [0, -18, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.05] blur-[120px]"
      />
      <motion.div
        animate={prefersReducedMotion ? {} : { y: [0, 14, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute bottom-1/4 -right-32 w-[400px] h-[400px] rounded-full bg-purple-500/[0.03] blur-[100px]"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 lg:px-10 pt-28 pb-8 sm:pt-36 sm:pb-12 w-full">
        <div className="flex flex-col items-center text-center">

          {/* ── Text Content — Staggered Entrance ── */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center max-w-5xl mx-auto"
          >
            {/* Badge — eyebrow with positive tracking (Linear design) */}
            <motion.div variants={staggerItem} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] mb-8">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 text-xs font-medium uppercase tracking-[0.04em]">
                Deixa com o Zélla
              </span>
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            </motion.div>

            {/* Headline — bold (700) with aggressive negative tracking & tight leading */}
            <motion.h1
              variants={staggerItem}
              className="text-[2.25rem] sm:text-[3.5rem] md:text-[4.5rem] lg:text-[5.25rem] xl:text-[6rem] font-satoshi font-bold tracking-[-0.03em] md:tracking-[-0.04em] leading-[1.05] md:leading-[1.02] text-white mb-8 text-center"
            >
              <span className="block">Organize e lucre mais</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={phraseIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className="block whitespace-nowrap text-emerald-500 font-bold"
                >
                  {rotatingPhrases[phraseIdx]}
                </motion.span>
              </AnimatePresence>
            </motion.h1>

            {/* Subtitle — compact with relaxed leading */}
            <motion.p variants={staggerItem} className="text-[15px] sm:text-[17px] md:text-lg text-neutral-400 leading-relaxed mb-12 max-w-2xl mx-auto">
              {!mounted ? 'O Zélla organiza sua pousada e ajuda a lucrar mais com preços inteligentes — e gastar menos no WhatsApp. Responde em 8 segundos com disponibilidade e manda sua chave PIX. Sincroniza Booking.com e entrega Guia Digital automático.' :
              isPousada
                ? 'O Zélla organiza sua pousada e ajuda a lucrar mais com preços inteligentes — e gastar menos no WhatsApp. Responde em 8 segundos com disponibilidade e manda sua chave PIX. Sincroniza Booking.com e entrega Guia Digital automático.'
                : isAirbnb
                ? 'O Zélla organiza seu imóvel e ajuda a lucrar mais com preços inteligentes — e gastar menos no WhatsApp. Responde em 8 segundos com disponibilidade e manda sua chave PIX. Conecta Airbnb e Booking.com e entrega Guia Digital automático.'
                : 'O programa de parceria que congela seu preço por 24 meses. Plano PRO completo por R$247/mês com selo exclusivo de parceiro no Link-in-Bio.'}
            </motion.p>

            {/* ── Niche Switcher — Escolha seu perfil ── */}
            <motion.div
              variants={staggerItem}
              className="flex flex-col items-center gap-6"
            >
              {/* Label */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.04]">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span className="text-neutral-400 text-[11px] font-semibold uppercase tracking-[0.03em]">
                  Escolha seu perfil
                </span>
              </div>

              {/* 3-toggle buttons */}
              <NicheToggle niche={niche} onNicheChange={setNiche} />
            </motion.div>

            {/* ── Social proof — below toggles ── */}
            <motion.div
              variants={staggerItem}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 text-xs sm:text-sm text-neutral-400 font-medium mt-8"
            >
              <div className="flex -space-x-2">
                {([
                      { name: isAirbnb ? 'Flat Copacabana' : 'Pousada Serenity', img: '/avatar-serenity.jpg' },
                      { name: isAirbnb ? 'Chalé Campos' : 'Pousada Sol & Mar', img: '/pousada-vista.jpg' },
                      { name: isAirbnb ? 'Apartamento Centro' : 'Chalé da Montanha', img: '/pousada-chale.jpg' },
                      { name: isAirbnb ? 'Studio Paulista' : 'Recanto Verde', img: '/pousada-jardim.jpg' },
                    ]).map((p, i) => (
                  <div key={i} className="w-7 h-7 rounded-full p-[1.5px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-sm relative" style={{ zIndex: 40 - i * 10 }}>
                    <div className="w-full h-full rounded-full border border-[#09090b] overflow-hidden bg-zinc-900">
                      <img
                        src={p.img}
                        alt={p.name}
                        className="w-full h-full object-cover select-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <span className="sm:border-l sm:border-white/10 sm:pl-6 text-neutral-300 font-bold tracking-tight">{isPousada ? '+100 pousadas já atendem melhor com o Zélla' : '+100 anfitriões já atendem melhor com o Zélla'}</span>
            </motion.div>

            {/* ── High-Converting Sales CTAs ── */}
            <motion.div
              variants={staggerItem}
              key={`cta-${niche}`}
              className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <button
                onClick={() => {
                  const el = document.querySelector('#precos');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`group inline-flex items-center justify-center gap-2 px-8 py-4 ${
                  isPousada
                    ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-emerald-500/30'
                    : 'bg-gradient-to-r from-rose-500 via-rose-400 to-rose-600 hover:from-rose-400 hover:to-rose-500 shadow-rose-500/30'
                } text-white font-bold rounded-xl transition-all duration-200 shadow-2xl text-base active:scale-[0.98] hover:scale-[1.02] cursor-pointer`}
                style={shimmerStyle}
              >
                Conhecer Planos & Preços
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </button>

              <a
                href="/parceiro"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold rounded-xl transition-all duration-200 shadow-xl shadow-amber-500/20 text-base active:scale-[0.98] hover:scale-[1.02] cursor-pointer"
                style={shimmerStyle}
              >
                Quero ser Parceiro Zélla
                <Sparkles className="w-5 h-5 text-amber-200" />
              </a>
            </motion.div>

            {/* ── LIVE INTERACTIVE WHATSAPP MOCKUP SIMULATOR ── */}
            <motion.div
              variants={staggerItem}
              className="mt-14 w-full max-w-2xl mx-auto rounded-3xl border border-white/15 bg-gradient-to-b from-zinc-900/90 to-black/95 p-4 sm:p-6 shadow-2xl backdrop-blur-2xl text-left relative overflow-hidden"
            >
              {/* Header do WhatsApp Mockup */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 text-sm">
                      ZÉ
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-900"></span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Zélla IA {isPousada ? '— Pousada Paraty' : '— Flat Copacabana'}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Atendimento 24/7
                      </span>
                    </h4>
                    <p className="text-[11px] text-zinc-400">Resposta instantânea em &lt; 0.8s • 0% Comissão OTA</p>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <span className="text-[10px] text-zinc-500 block">Orçamento Meta</span>
                  <span className="text-xs font-semibold text-emerald-400">80% Economia</span>
                </div>
              </div>

              {/* Corpo da Conversa Animada */}
              <div className="space-y-3 text-xs sm:text-sm">
                {/* Balão 1: Hóspede */}
                <div className="flex justify-start">
                  <div className="bg-zinc-800 text-zinc-200 rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[85%] border border-zinc-700/50">
                    <p>Olá! Tem vaga na {isPousada ? 'suíte casal pro próximo fim de semana' : 'acomodação do Airbnb pras próximas datas'}? Qual o valor?</p>
                    <span className="text-[9px] text-zinc-500 block text-right mt-1">14:32</span>
                  </div>
                </div>

                {/* Balão 2: Zélla IA */}
                <div className="flex justify-end">
                  <div className="bg-emerald-950/80 text-emerald-100 rounded-2xl rounded-tr-none px-4 py-3 max-w-[88%] border border-emerald-500/30 shadow-lg">
                    <p className="font-semibold text-emerald-300 mb-1">
                      {isPousada ? 'Olá! Temos sim! ✨ Suíte Master Luxo disponível.' : 'Olá! Imóvel disponível e limpinho pra você! ✨'}
                    </p>
                    <p className="text-zinc-200 leading-relaxed">
                      {isPousada ? 'R$ 450/noite com café da manhã incluso. Para garantir direto sem taxas adicionais:' : 'R$ 380/noite sem taxa de limpeza extra. Para reservar nativamente:'}
                    </p>
                    {isPousada ? (
                      <div className="mt-2 p-2 rounded-lg bg-black/40 border border-emerald-500/20 text-xs font-mono text-emerald-300">
                        💳 <strong>PIX (CNPJ):</strong> 12.345.678/0001-90
                      </div>
                    ) : (
                      <div className="mt-2 p-2 rounded-lg bg-black/40 border border-rose-500/20 text-xs font-mono text-rose-300">
                        🛡️ <strong>Airbnb Direct:</strong> Reserva 100% Nativa protegida
                      </div>
                    )}
                    <span className="text-[9px] text-emerald-400/70 block text-right mt-1">14:32 • Resposta em 0.6s</span>
                  </div>
                </div>

                {/* Balão 3: Hóspede */}
                <div className="flex justify-start">
                  <div className="bg-zinc-800 text-zinc-200 rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[85%] border border-zinc-700/50">
                    <p>{isPousada ? 'Show! PIX realizado.' : 'Maravilha, reserva efetuada no aplicativo!'}</p>
                    <span className="text-[9px] text-zinc-500 block text-right mt-1">14:33</span>
                  </div>
                </div>

                {/* Balão 4: Zélla IA (Confirmação + Guia) */}
                <div className="flex justify-end">
                  <div className="bg-emerald-950/90 text-emerald-100 rounded-2xl rounded-tr-none px-4 py-3 max-w-[88%] border border-emerald-400/40 shadow-xl">
                    <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Reserva Confirmada com Sucesso!
                    </p>
                    <p className="text-zinc-200 mt-1 text-xs">
                      Seu Guia Digital DDC já está pronto com a senha do Wi-Fi, fechadura eletrônica e passeios da região.
                    </p>
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/40">
                      📱 <span>Acessar Guia Digital do Hóspede</span>
                    </div>
                    <span className="text-[9px] text-emerald-400/70 block text-right mt-1">14:33 • Zélla Brain v5.2</span>
                  </div>
                </div>
              </div>
            </motion.div>

          </motion.div>
        </div>
      </div>

      {/* Shimmer keyframe animation — only rendered when motion is not reduced (gated por mounted p/ evitar hydration mismatch) */}
      {mounted && !effectiveReducedMotion && (
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes shimmer {
            0% { background-position: 200% center; }
            100% { background-position: -200% center; }
          }
        ` }} />
      )}
    </section>
  );
}
