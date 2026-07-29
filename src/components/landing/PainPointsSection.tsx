'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence, useInView, useReducedMotion } from 'framer-motion';
import {
  Clock,
  MessageSquare,
  DollarSign,
  BarChart3,
  Users,
  Sparkles,
  Zap,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  Key,
  Bot,
  CheckCircle2,
  CreditCard,
  Calendar,
  Smartphone,
  SlidersHorizontal,
  QrCode,
  Award,
} from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';

export function PainPointsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-60px' });
  const { niche, isPousada } = useNiche();
  const prefersReducedMotion = useReducedMotion();
  const [activeFeatureTab, setActiveFeatureTab] = useState<number>(0);

  // Niche-aware text
  const headerTitle = isPousada ? 'Sua pousada merece' : 'Seus imóveis merecem';

  return (
    <section ref={sectionRef} className="relative bg-[#060608] overflow-hidden py-24 sm:py-32" id="integracoes">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-40 w-[600px] h-[600px] rounded-full bg-emerald-500/[0.05] blur-[160px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-40 w-[550px] h-[550px] rounded-full bg-teal-500/[0.05] blur-[160px] pointer-events-none" />

      {/* Modern fine grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── SECTION HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center max-w-4xl mx-auto mb-16 sm:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-500/30 mb-6">
            <Award className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 text-xs font-extrabold uppercase tracking-wider font-mono">
              EXCELÊNCIA OPERACIONAL SEU ZÉLLA
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-satoshi font-black text-white mb-6 leading-[1.08] tracking-tight">
            {headerTitle}{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
              um atendimento à altura
            </span>
          </h2>

          <p className="text-neutral-300 text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed font-normal">
            Esqueça bots robóticos de IA genéricos. O Zélla combina atendimento humanizado em tempo real no WhatsApp, precificação inteligente de diárias e controle financeiro total no DDC.
          </p>
        </motion.div>

        {/* ── FEATURE SHOWCASE 1: HERO FEATURE CARD (SPLIT LAYOUT) ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8 p-6 sm:p-10 rounded-3xl bg-gradient-to-b from-zinc-900/90 via-zinc-900/70 to-zinc-950/90 border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.1)] backdrop-blur-xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Text side */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                <Zap className="w-3.5 h-3.5" />
                <span>Atendimento 24/7 em 8 Segundos</span>
              </div>

              <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Seu WhatsApp virando um balcão de vendas automatizado 24 horas por dia
              </h3>

              <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
                Quando o hóspede chama de madrugada ou no fim de semana, o Zélla responde em instantes no tom da sua {isPousada ? 'pousada' : 'hospedagem'}. Envia fotos, tira dúvidas sobre regras, confirma datas e envia o PIX.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-white/10 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-0.5">Economia Meta WhatsApp (80%)</h4>
                    <p className="text-[11px] text-neutral-400">Responde tudo em 1 único balão denso, evitando cobranças múltiplas da Meta.</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-white/10 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-0.5">Tempo Médio: 8 Segundos</h4>
                    <p className="text-[11px] text-neutral-400">Taxa de conversão 4x maior do que atendimentos manuais atrasados.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Side: Interactive Demo Card */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-zinc-950 border border-white/10 shadow-2xl relative space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-white">Simulador WhatsApp Zélla</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Respondeu em 4s
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="bg-zinc-800 text-zinc-200 p-3 rounded-xl rounded-tl-none max-w-[90%] border border-zinc-700/50">
                  Olá! Tem disponibilidade para o próximo feriado? Aceitam PIX?
                </div>
                <div className="bg-emerald-950/90 text-emerald-100 p-3.5 rounded-xl rounded-tr-none border border-emerald-500/30 shadow-lg">
                  <p className="font-semibold text-emerald-300 mb-1">Olá! Temos sim! 🌴</p>
                  <p className="text-zinc-200 text-[11px] leading-relaxed mb-2">
                    Nossa suíte com café da manhã está disponível por R$ 420/noite. Para garantir com 0% de taxas extras, você pode pagar direto via PIX CNPJ 12.345.678/0001-90. Posso reservar agora?
                  </p>
                  <span className="text-[9px] text-emerald-400/80 font-mono">✓✓ Balão único • Meta API Otimizada</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── FEATURE SHOWCASE GRID (2 COLUMNS HIGH-IMPACT CARDS) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8">
          {/* Card 1: Preços Inteligentes */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="p-7 sm:p-8 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-white/10 hover:border-amber-500/40 transition-all duration-300 shadow-xl flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-bold border border-amber-500/20 mb-3">
                <span>+47% de Receita em Feriados</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-3 tracking-tight">
                Preços Inteligentes: Nunca mais alugue barato no feriado
              </h3>

              <p className="text-neutral-300 text-sm leading-relaxed mb-6 font-normal">
                O Zélla analisa a demanda de datas comemorativas, fins de semana e feriadões para ajustar automaticamente sua diária. Você para de perder dinheiro vendendo quarto barato quando a demanda está alta.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold">Feriado de Réveillon:</span>
                <span className="text-neutral-400 line-through">R$ 380/noite</span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                Ajustado Zélla: R$ 680/noite
              </span>
            </div>
          </motion.div>

          {/* Card 2: Chave PIX & Zero Comissão */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="p-7 sm:p-8 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-white/10 hover:border-emerald-500/40 transition-all duration-300 shadow-xl flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
                <QrCode className="w-6 h-6" />
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 mb-3">
                <span>0% de Comissão para OTAs</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-3 tracking-tight">
                Receba direto no seu PIX sem pagar 15% para intermediários
              </h3>

              <p className="text-neutral-300 text-sm leading-relaxed mb-6 font-normal">
                Cada reserva fechada via WhatsApp garante 100% da receita no seu bolso. O Zélla envia sua chave PIX CNPJ cadastrada e confirma o comprovante automaticamente no DDC.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Economia média mensal:</span>
              </div>
              <span className="font-mono font-bold text-white bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                R$ 3.450,00 mantidos no seu caixa
              </span>
            </div>
          </motion.div>
        </div>

        {/* ── SECONDARY FEATURE GRID (2 COLUMNS) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-16">
          {/* Card 3: Guia Digital do Hóspede */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="p-7 sm:p-8 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-white/10 hover:border-teal-500/40 transition-all duration-300 shadow-xl flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-5 group-hover:scale-110 transition-transform">
                <Smartphone className="w-6 h-6" />
              </div>

              <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-3 tracking-tight">
                Guia Digital Automático para o Hóspede
              </h3>

              <p className="text-neutral-300 text-sm leading-relaxed mb-6 font-normal">
                Assim que o PIX é confirmado, o Zélla despacha o link do Guia Digital com senha do Wi-Fi, regras da casa, recomendações de praias e restaurantes locais. Reduz em 80% as chamadas e mensagens durante a estadia.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-teal-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Sem necessidade do hóspede baixar qualquer aplicativo</span>
            </div>
          </motion.div>

          {/* Card 4: DDC Dashboard do Cliente */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="p-7 sm:p-8 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-white/10 hover:border-sky-500/40 transition-all duration-300 shadow-xl flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-5 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6" />
              </div>

              <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-3 tracking-tight">
                DDC — Dashboard do Cliente Vivo & Transparente
              </h3>

              <p className="text-neutral-300 text-sm leading-relaxed mb-6 font-normal">
                Tenha total visibilidade das suas finanças, calendário de ocupação e métricas de desempenho em um único painel. Decisões estratégicas baseadas em dados reais da sua operação.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Acesso instantâneo em computador, tablet ou celular</span>
            </div>
          </motion.div>
        </div>

        {/* ── BOTTOM TRUST BADGES STRIP (REMOVIDO SEM CARTÃO DE CRÉDITO) ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-8 border-t border-white/10"
        >
          {[
            { icon: Zap, text: 'Setup rápido em 5 minutos' },
            { icon: CreditCard, text: 'Pagamento via Cartão de Crédito' },
            { icon: Sparkles, text: isPousada ? 'Treinado para pousadas' : 'Treinado para anfitriões' },
            { icon: TrendingUp, text: 'Resultados em até 48 horas' },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-neutral-300 text-xs sm:text-sm font-semibold">
              <t.icon className="w-4 h-4 text-emerald-400" />
              <span>{t.text}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
