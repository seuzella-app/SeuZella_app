'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Wifi,
  Key,
  Link as LinkIcon,
  Check,
  Zap,
  Shield,
  Clock,
  Star,
  TrendingUp,
  Sparkles,
  Crown,
  BarChart3,
  DollarSign,
  type LucideIcon,
} from 'lucide-react';
import { LinkInBioDemo } from './LinkInBioDemo';
import { AirbnbImportMockup } from './AirbnbImportMockup';
import { useNiche } from '@/contexts/NicheContext';
import { getNicheContent } from '@/data/niche-content';

// Icon lookup map for string-to-component resolution
const featureIconMap: Record<string, LucideIcon> = {
  MessageSquare,
  Wifi,
  Key,
  Link: LinkIcon,
  Shield,
  Clock,
  TrendingUp,
  Zap,
  Sparkles,
  Star,
  Crown,
  BarChart3,
  DollarSign,
};

function WhatsAppMockup() {
  const { isPousada, isAirbnb } = useNiche();
  const [animationStep, setAnimationStep] = useState(0);

  // Niche-specific chat data
  const businessName = isPousada ? 'Pousada Serenity' : isAirbnb ? 'Flat Copacabana' : 'Parceiro Zélla';
  const roomName = isPousada ? 'Chalé Vista Mar' : isAirbnb ? 'Apartamento Vista Mar' : 'Sua Operação';
  const greeting = isPousada ? 'Seja muito bem-vindo à Pousada Serenity. 🌸' : isAirbnb ? 'Seja muito bem-vindo ao Apartamento Copacabana. 🌊' : 'Seja muito bem-vindo. ✨';

  useEffect(() => {
      const timers = [
        setTimeout(() => setAnimationStep(1), 1000),
        setTimeout(() => setAnimationStep(2), 2500),
        setTimeout(() => setAnimationStep(3), 3800),
        setTimeout(() => setAnimationStep(4), 8500),
        setTimeout(() => setAnimationStep(5), 10000),
        setTimeout(() => setAnimationStep(6), 11000),
      ];

      const loopInterval = setInterval(() => {
        setAnimationStep(0);
        timers[0] = setTimeout(() => setAnimationStep(1), 1000);
        timers[1] = setTimeout(() => setAnimationStep(2), 2500);
        timers[2] = setTimeout(() => setAnimationStep(3), 3800);
        timers[3] = setTimeout(() => setAnimationStep(4), 8500);
        timers[4] = setTimeout(() => setAnimationStep(5), 10000);
        timers[5] = setTimeout(() => setAnimationStep(6), 11000);
      }, 16000);

      return () => {
        timers.forEach((t) => clearTimeout(t));
        clearInterval(loopInterval);
      };
    }, []);

  return (
    <div className="relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full bg-emerald-500/[0.07] blur-[90px] pointer-events-none z-0" />
        <div className="relative w-[290px] mx-auto h-[570px] rounded-[52px] border-[7px] border-neutral-900 bg-[#070709] shadow-2xl p-2.5 overflow-hidden flex flex-col justify-between select-none z-10 ring-1 ring-white/10">
          <div className="absolute -left-[9px] top-[95px] w-[3px] h-[18px] bg-neutral-800 rounded-l-md border-r border-neutral-700" />
          <div className="absolute -left-[9px] top-[130px] w-[3px] h-[32px] bg-neutral-800 rounded-l-md border-r border-neutral-700" />
          <div className="absolute -left-[9px] top-[172px] w-[3px] h-[32px] bg-neutral-800 rounded-l-md border-r border-neutral-700" />
          <div className="absolute -right-[9px] top-[140px] w-[3px] h-[45px] bg-neutral-800 rounded-r-md border-l border-neutral-700" />
          <div className="absolute -right-[9px] top-[215px] w-[3px] h-[28px] bg-neutral-900 rounded-r-sm border-l border-neutral-700 opacity:90" />
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-20 h-[18px] bg-black rounded-full z-30 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1c1c1e] absolute right-4" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none rounded-[42px] z-20" />
          <div className="w-full h-full rounded-[42px] bg-gradient-to-b from-emerald-950/15 via-[#0b141a] to-[#0b141a] p-0 flex flex-col justify-between overflow-hidden relative">
            <div className="w-full pt-2.5 px-6 flex items-center justify-between text-[9px] font-bold text-white/90 z-20 shrink-0 select-none">
              <span>09:41</span>
              <div className="flex items-center gap-1.5">
                <div className="flex gap-[1px] items-end h-[7px] w-3">
                  <div className="w-[1.5px] h-[2px] bg-white rounded-[0.5px]" />
                  <div className="w-[1.5px] h-[3.5px] bg-white rounded-[0.5px]" />
                  <div className="w-[1.5px] h-[5px] bg-white rounded-[0.5px]" />
                  <div className="w-[1.5px] h-[6.5px] bg-white rounded-[0.5px]" />
                </div>
                <Wifi className="w-2.5 h-2.5 text-white stroke-[2.5]" />
                <div className="w-4 h-2 border border-white/60 rounded-[3px] p-[0.5px] flex items-center shrink-0">
                  <div className="w-full h-full bg-white rounded-[1px]" />
                  <div className="w-[1px] h-[2.5px] bg-white/60 -mr-[2px]" />
                </div>
              </div>
            </div>
            <div className="w-full bg-[#1f2c34] pt-2 pb-2 px-3 flex items-center justify-between border-b border-white/[0.03] z-10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#111] border border-emerald-500/30 overflow-hidden relative">
                  <img src="/avatar-serenity.jpg" className="w-full h-full object-cover" alt={businessName} />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#1f2c34] rounded-full" />
                </div>
                <div>
                  <h4 className="text-white text-[11px] font-bold tracking-tight flex items-center gap-1">
                    {businessName}
                    <span className="px-1 py-[1px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[7px] font-bold rounded">ZÉLLA</span>
                  </h4>
                  <p className="text-emerald-400 text-[8px] font-medium leading-none mt-0.5">ZÉLLA está online</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-neutral-400">
                <span className="text-[9px] font-medium">WhatsApp</span>
              </div>
            </div>
            <div className="flex-1 p-3 overflow-y-auto no-scrollbar scrollbar-none space-y-2.5 z-0 pb-16 relative">
              <style dangerouslySetInnerHTML={{__html: `
                .no-scrollbar::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; background: transparent !important; }
                .no-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
              `}} />
              <div className="flex justify-center my-1.5">
                <span className="bg-[#1f2c34]/50 text-neutral-400 text-[8px] font-medium px-2 py-0.5 rounded-md">HOJE</span>
              </div>
              {animationStep >= 1 && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex gap-1.5 justify-end">
                  <div className="rounded-2xl px-3 py-2 text-[10px] leading-relaxed max-w-[85%] bg-[#005c4b] text-[#e9edef] rounded-tr-none relative">
                    <p>Olá! Vocês têm vaga para casal de 12 a 14 de setembro? E qual o valor?</p>
                    <span className="text-[7px] text-neutral-400/70 float-right mt-1 ml-2 font-medium">09:41</span>
                  </div>
                </motion.div>
              )}
              {animationStep === 2 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-1.5">
                  <div className="flex gap-1 items-center py-2 px-3 bg-[#202c33] rounded-2xl rounded-tl-none max-w-[55px]">
                    <motion.span animate={{ y: ["0%", "-50%", "0%"] }} transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" as const, delay: 0 }} className="w-1.5 h-1.5 bg-neutral-400 rounded-full" />
                    <motion.span animate={{ y: ["0%", "-50%", "0%"] }} transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" as const, delay: 0.15 }} className="w-1.5 h-1.5 bg-neutral-400 rounded-full" />
                    <motion.span animate={{ y: ["0%", "-50%", "0%"] }} transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" as const, delay: 0.3 }} className="w-1.5 h-1.5 bg-neutral-400 rounded-full" />
                  </div>
                </motion.div>
              )}
              {animationStep >= 3 && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex gap-1.5">
                  <div className="rounded-2xl px-3 py-2 text-[10px] leading-relaxed max-w-[90%] bg-[#202c33] text-[#e9edef] rounded-tl-none relative space-y-1.5 shadow-sm">
                    <p className="whitespace-pre-line text-[#e9edef] text-[9.5px]">
                      Olá, Bernardo! {greeting}{"\n\n"}
                      Temos disponibilidade sim! O nosso <strong className="font-bold text-white">{roomName}</strong> é perfeito para casal nessa data.{"\n\n"}
                      💰 <strong className="font-bold text-white">Valor do pacote (2 noites):</strong> R$ 980 no PIX (ou 3x de R$ 350).
                    </p>
                    <div className="bg-[#111b21] p-1.5 rounded-lg border border-white/[0.04] font-mono text-[7px] break-all select-all flex items-center justify-between gap-1 mt-1">
                      <span className="text-neutral-400">00020101021226300014...</span>
                      <span className="text-emerald-400 text-[6.5px] font-bold bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20 shrink-0">CHAVE PIX COPIA/COLA</span>
                    </div>
                    <p className="text-[7.5px] text-neutral-400 leading-snug">Efetue o pagamento acima para garantir a vaga. A confirmação é instantânea!</p>
                    <span className="text-[7px] text-neutral-400/70 float-right mt-1 ml-2 font-medium">09:42</span>
                  </div>
                </motion.div>
              )}
              {animationStep >= 4 && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex gap-1.5 justify-end">
                  <div className="rounded-2xl px-3 py-2 text-[10px] leading-relaxed max-w-[85%] bg-[#005c4b] text-[#e9edef] rounded-tr-none relative shadow-sm">
                    <p>Show! Acabei de pagar o PIX.</p>
                    <span className="text-[7px] text-emerald-200/80 float-right mt-1 ml-2 flex items-center gap-0.5 font-medium">
                      09:43 <span className="text-sky-300">✓✓</span>
                    </span>
                  </div>
                </motion.div>
              )}
              {animationStep === 5 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-1.5">
                  <div className="flex gap-1 items-center py-2 px-3 bg-[#202c33] rounded-2xl rounded-tl-none max-w-[55px]">
                    <motion.span animate={{ y: ["0%", "-50%", "0%"] }} transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" as const, delay: 0 }} className="w-1.5 h-1.5 bg-neutral-400 rounded-full" />
                    <motion.span animate={{ y: ["0%", "-50%", "0%"] }} transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" as const, delay: 0.15 }} className="w-1.5 h-1.5 bg-neutral-400 rounded-full" />
                    <motion.span animate={{ y: ["0%", "-50%", "0%"] }} transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" as const, delay: 0.3 }} className="w-1.5 h-1.5 bg-neutral-400 rounded-full" />
                  </div>
                </motion.div>
              )}
              {animationStep >= 6 && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex gap-1.5">
                  <div className="rounded-2xl px-3 py-2 text-[10px] leading-relaxed max-w-[85%] bg-[#202c33] text-[#e9edef] rounded-tl-none relative space-y-1 shadow-sm">
                    <p className="text-emerald-400 font-bold flex items-center gap-1">
                      <span>✓</span> Confirmado! 🎉
                    </p>
                    <p className="text-[9.5px]">
                      Pagamento de R$ 980 recebido com sucesso! Sua reserva para o <strong className="font-bold text-white">{roomName}</strong> (12 a 14 de setembro) está garantida. Nos vemos lá! 🏝️
                    </p>
                    <span className="text-[7px] text-neutral-400/70 float-right mt-1 ml-2 font-medium">09:43</span>
                  </div>
                </motion.div>
              )}
            </div>
            <div className="absolute bottom-0 inset-x-0 bg-[#1f2c34] p-2 flex items-center gap-2 border-t border-white/[0.03] z-10 shrink-0">
              <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1.5 flex items-center justify-between border border-white/[0.02]">
                <span className="text-neutral-400 text-[10px]">
                  {animationStep === 0 ? "..." : animationStep < 4 ? "Gera o PIX pra mim!" : "Acabei de pagar o PIX."}
                </span>
              </div>
              <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
                <MessageSquare className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
}

function FeatureMockup({ type }: { type: string }) {
  const { isAirbnb } = useNiche();

  if (type === 'whatsapp') {
    return <WhatsAppMockup />;
  }

  // Airbnb Import — exclusive to Airbnb (Magic Onboarding)
  if (type === 'airbnb-import') {
    return <AirbnbImportMockup />;
  }

  // Link-in-Bio is EXCLUSIVE to Pousadas — never render for Airbnb
  if (type === 'linkinbio') {
    if (isAirbnb) return <WhatsAppMockup />;
    return <LinkInBioDemo />;
  }

  return null;
}

export function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const { niche, isPousada, isAirbnb } = useNiche();
  const content = getNicheContent(niche);
  const features = content.features;

  return (
    <section ref={ref} id="funcionalidades" className="py-28 sm:py-36 lg:py-44 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-24"
        >
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-8 tracking-tight">
            Funcionalidades que <span className={isPousada ? 'text-emerald-500 font-bold' : isAirbnb ? 'text-blue-500 font-bold' : 'text-amber-500 font-bold'}>transformam</span>
          </h2>
          <AnimatePresence mode="wait">
            <motion.p
              key={`features-desc-${niche}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
              className="text-neutral-400 text-lg max-w-2xl mx-auto"
            >
              {isPousada
                ? 'O ZÉLLA vai ser seu zelador com funcionalidades inovadoras. São funções que vão te dar mais tempo para fazer sua pousada decolar.'
                : isAirbnb
                ? 'O ZÉLLA é seu co-anfitrião digital. Funcionalidades que automatizam tudo — do check-in ao atendimento — para você escalar sem estresse.'
                : 'O ZÉLLA é seu parceiro de negócio. Funcionalidades completas do plano PRO com preço congelado — para você economizar e crescer.'
              }
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Feature Rows — Alternating layout */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`features-${niche}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            className="space-y-32"
          >
            {features.map((feature, i) => {
              const IconComponent = featureIconMap[feature.icon] || MessageSquare;

              return (
                <motion.div
                  key={feature.badge}
                  initial={{ opacity: 0, y: 30 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className={`grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center ${
                    feature.reverse ? 'lg:[direction:rtl]' : ''
                  }`}
                >
                  {/* Text side */}
                  <div className={feature.reverse ? 'lg:[direction:ltr]' : ''}>
                    {/* Badge bar */}
                    <div className="flex items-center gap-3 mb-8">
                      <div className={`w-10 h-10 rounded-xl ${
                        isPousada
                          ? 'bg-emerald-500/10 border border-emerald-500/20'
                          : isAirbnb
                          ? 'bg-blue-500/10 border border-blue-500/20'
                          : 'bg-amber-500/10 border border-amber-500/20'
                      } flex items-center justify-center shrink-0`}>
                        <IconComponent className={`w-5 h-5 ${isPousada ? 'text-emerald-400' : isAirbnb ? 'text-blue-400' : 'text-amber-400'}`} />
                      </div>
                      <span className={`${isPousada ? 'text-emerald-400' : isAirbnb ? 'text-blue-400' : 'text-amber-400'} text-xs font-bold uppercase tracking-wider`}>
                        {feature.badge}
                      </span>
                    </div>

                    {/* Hero Stat */}
                    {'heroStat' in feature && (
                      <div className="mb-6 relative">
                        <div className="flex items-end gap-3">
                          <motion.span
                            className={`text-6xl sm:text-7xl font-black tracking-tighter bg-gradient-to-br ${feature.heroStat.gradient} bg-clip-text text-transparent leading-none`}
                            initial={{ opacity: 0, scale: 0.7, y: 10 }}
                            animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
                            transition={{ duration: 0.7, delay: 0.15, type: 'spring', stiffness: 120 }}
                          >
                            {feature.heroStat.val}
                          </motion.span>
                          <span className="text-neutral-400 text-sm font-medium pb-2 leading-snug">
                            {feature.heroStat.label}
                          </span>
                        </div>
                        <motion.div
                          className={`h-[2px] mt-3 bg-gradient-to-r ${feature.heroStat.gradient} opacity-50`}
                          initial={{ scaleX: 0 }}
                          animate={isInView ? { scaleX: 1 } : {}}
                          transition={{ duration: 0.8, delay: 0.4 }}
                          style={{ transformOrigin: 'left' }}
                        />
                      </div>
                    )}

                    {/* Headline */}
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-3 tracking-tight leading-tight">
                      {feature.headline}
                    </h3>

                    {/* Subtitle */}
                    <p className="text-neutral-500 text-sm font-medium mb-6">{feature.subtitle}</p>

                    {/* Description */}
                    <p className="text-neutral-300 text-[15px] leading-relaxed mb-10">{feature.desc}</p>

                    {/* Secondary Stats */}
                    {'stats' in feature && (
                      <div className="grid grid-cols-2 gap-4 mb-10">
                        {feature.stats.map((s, si: number) => {
                          const StatIcon = featureIconMap[s.icon] || Clock;
                          return (
                            <motion.div
                              key={si}
                              initial={{ opacity: 0, y: 15 }}
                              animate={isInView ? { opacity: 1, y: 0 } : {}}
                              transition={{ duration: 0.4, delay: 0.3 + si * 0.1 }}
                              className="relative p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300 group/stat"
                            >
                              <StatIcon className={`w-4 h-4 ${isPousada ? 'text-emerald-500/60' : isAirbnb ? 'text-blue-500/60' : 'text-amber-500/60'} mb-2.5 block`} />
                              <div className="text-2xl font-bold text-white tracking-tight">{s.val}</div>
                              <div className="text-[11px] text-neutral-400 font-semibold mt-1">{s.label}</div>
                              {'sublabel' in s && s.sublabel && (
                                <div className="text-[10px] text-neutral-600 mt-0.5">{s.sublabel}</div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* Pills */}
                    {'pills' in feature && (
                      <div className="flex flex-wrap gap-2.5 mb-10">
                        {feature.pills.map((p, pi: number) => (
                          <motion.span
                            key={pi}
                            initial={{ opacity: 0, x: -8 }}
                            animate={isInView ? { opacity: 1, x: 0 } : {}}
                            transition={{ duration: 0.3, delay: 0.5 + pi * 0.06 }}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-medium transition-all duration-200 ${
                              p.accent
                                ? isPousada
                                  ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                                  : isAirbnb
                                  ? 'bg-blue-500/10 border border-blue-500/25 text-blue-400'
                                  : 'bg-amber-500/10 border border-amber-500/25 text-amber-400'
                                : 'bg-white/[0.03] border border-white/[0.06] text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.05]'
                            }`}
                          >
                            <Check className={`w-3 h-3 ${p.accent ? (isPousada ? 'text-emerald-400' : isAirbnb ? 'text-blue-400' : 'text-amber-400') : 'text-neutral-600'}`} />
                            {p.text}
                          </motion.span>
                        ))}
                      </div>
                    )}

                    {/* Bottom line */}
                    {'bottomLine' in feature && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={isInView ? { opacity: 1 } : {}}
                        transition={{ duration: 0.5, delay: 0.7 }}
                        className={`text-neutral-600 text-xs italic border-l-2 ${isPousada ? 'border-emerald-500/30' : isAirbnb ? 'border-blue-500/30' : 'border-amber-500/30'} pl-3`}
                      >
                        {feature.bottomLine}
                      </motion.p>
                    )}
                  </div>

                  {/* Mockup side */}
                  <div className={feature.reverse ? 'lg:[direction:ltr]' : ''}>
                    <FeatureMockup type={feature.mockup} />
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
