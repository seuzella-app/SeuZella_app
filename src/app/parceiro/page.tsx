'use client';

import { useRef } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import {
  Crown,
  Clock,
  DollarSign,
  ArrowRight,
  Users,
  Sparkles,
  Flame,
  ArrowLeft,
  Shield,
  MessageSquare,
  Brain,
  Headphones,
  Rocket,
  Trophy,
  Gift,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/* ──────────────────────────────────────────────
   Partner Benefits Grid
   ────────────────────────────────────────────── */
const partnerPerks = [
  {
    icon: Trophy,
    title: 'Status de Fundador',
    desc: 'Selo exclusivo no painel e menção especial na comunidade Zélla.',
    color: 'amber',
  },
  {
    icon: Rocket,
    title: 'Acesso Antecipado',
    desc: 'Seja o primeiro a testar novos recursos antes do lançamento oficial.',
    color: 'blue',
  },
  {
    icon: MessageSquare,
    title: 'Contato Direto com Desenvolvedores',
    desc: 'Canal exclusivo no WhatsApp para falar direto com a equipe técnica.',
    color: 'emerald',
  },
  {
    icon: Brain,
    title: 'Treinamento Personalizado',
    desc: 'Onboarding 1:1 para configurar a IA com a personalidade da sua pousada.',
    color: 'purple',
  },
  {
    icon: Crown,
    title: 'Selo Parceiro Fundador',
    desc: 'Distintivo visual exclusivo no seu painel que transmite confiança.',
    color: 'amber',
  },
  {
    icon: Headphones,
    title: 'Suporte VIP 24h',
    desc: 'Atendimento prioritário em horário comercial e suporte emergencial.',
    color: 'blue',
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    glow: 'group-hover:shadow-amber-500/10',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    glow: 'group-hover:shadow-blue-500/10',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    glow: 'group-hover:shadow-emerald-500/10',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    text: 'text-purple-400',
    glow: 'group-hover:shadow-purple-500/10',
  },
};

/* ──────────────────────────────────────────────
   Timeline Steps
   ────────────────────────────────────────────── */
const timelineSteps = [
  {
    step: '01',
    title: 'Cadastro Rápido',
    desc: 'Preencha o formulário em 2 minutos com ativação simplificada.',
    icon: Zap,
  },
  {
    step: '02',
    title: 'Onboarding Personalizado',
    desc: 'Nossa equipe configura a IA com os dados da sua pousada: preços, quartos e regras.',
    icon: Brain,
  },
  {
    step: '03',
    title: 'Primeiro Mês Grátis',
    desc: 'Use 30 dias sem pagar nada. Valide o Zélla com hóspedes reais.',
    icon: Gift,
  },
  {
    step: '04',
    title: 'Preço Fundador R$ 247/mês',
    desc: 'Após o primeiro mês, plano PRO por R$ 247/mês congelado por 24 meses.',
    icon: Crown,
  },
];

/* ──────────────────────────────────────────────
   PAGE COMPONENT
   ────────────────────────────────────────────── */
export default function ParceiroPage() {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);
  const benefitsRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const heroInView = useInView(heroRef, { once: true, margin: '-50px' });
  const benefitsInView = useInView(benefitsRef, { once: true, margin: '-100px' });
  const timelineInView = useInView(timelineRef, { once: true, margin: '-100px' });
  const ctaInView = useInView(ctaRef, { once: true, margin: '-100px' });

  const { scrollYProgress } = useScroll();
  const heroBgOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">

      {/* ─── HEADER ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[#0a0a0f]/80 border-b border-white/[0.06] py-3">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 flex items-center justify-center bg-white/[0.03] border border-white/10 rounded-lg group-hover:border-emerald-500/30 transition-all">
              <img src="/logo.svg" className="w-5 h-5" alt="Seu ZÉLLA Logo" />
            </div>
            <span className="text-lg font-bold text-white tracking-wide font-sans">
              Seu <span className="text-blue-500 font-bold">ZÉLLA</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/login')}
              className="text-xs font-semibold text-white/80 hover:text-white px-4 py-2 transition-all"
            >
              ENTRAR
            </button>
            <Link
              href="/"
              className="group inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-400 rounded-lg shadow-lg shadow-blue-500/20 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              Voltar ao site
            </Link>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section ref={heroRef} className="relative min-h-[85vh] flex items-center overflow-hidden bg-[#0a0a0a] pt-20">
        {/* Ambient glows */}
        <motion.div className="absolute top-1/3 -left-32 w-[600px] h-[600px] rounded-full bg-amber-500/[0.06] blur-[120px]" style={{ opacity: heroBgOpacity }} />
        <motion.div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-blue-500/[0.05] blur-[100px]" style={{ opacity: heroBgOpacity }} />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            {/* Badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">Oferta Parceiro</span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/30">
                <Clock className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-400 text-xs font-bold">Vagas Limitadas — 100 pousadas</span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 leading-[1.1] tracking-tight">
              Programa Beta:
              <br />
              <span className="text-[#6488ff] font-extrabold">Seja um Parceiro do SEU ZÉLLA</span>
            </h1>

            <p className="text-lg sm:text-xl text-neutral-400 leading-relaxed mb-10 max-w-2xl mx-auto">
              Você foi escolhido para o seleto grupo de <strong className="text-white">100 pousadas parceiras</strong> pioneiras no Brasil. Como agradecimento por nos ajudar a crescer, oferecemos uma condição única: use todas as funções do plano PRO pagando o valor do plano LITE, com preço congelado por 24 meses enquanto mantiver a assinatura ativa.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 mb-10">
              {[
                { value: '100', label: 'Vagas totais', color: 'text-amber-400' },
                { value: 'R$ 0', label: 'Primeiro mês', color: 'text-emerald-400' },
                { value: 'R$ 247', label: '/mês por 24 meses', color: 'text-blue-400' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className={`text-3xl sm:text-4xl font-extrabold ${s.color}`}>{s.value}</div>
                  <div className="text-neutral-500 text-xs font-medium mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Scroll hint */}
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-neutral-600 text-xs"
            >
              <span>Deslize para ver os detalhes</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── MAIN BENEFIT CARDS ─── */}
      <section ref={benefitsRef} className="py-24 sm:py-32 relative bg-[#060608]">
        <div className="max-w-5xl mx-auto px-6">

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={benefitsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              O que você recebe como <span className="text-amber-400">Parceiro Fundador</span>
            </h2>
            <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
              Duas condições exclusivas que não estarão disponíveis após o fechamento do grupo.
            </p>
          </motion.div>

          {/* Benefit cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={benefitsInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="relative p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-amber-500/30 hover:bg-white/[0.03] transition-all duration-300 group overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full blur-[80px] group-hover:bg-amber-500/10 transition-all" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5 group-hover:bg-amber-500/20 group-hover:scale-110 transition-all duration-300">
                  <DollarSign className="w-7 h-7 text-amber-400" />
                </div>
                <h3 className="text-white font-bold text-xl mb-2">Primeiro Mês GRÁTIS</h3>
                <span className="text-amber-400 text-sm font-bold">R$ 0,00 na fase de validação</span>
                <p className="text-zinc-500 text-sm leading-relaxed mt-4 group-hover:text-zinc-400 transition-colors">
                  Comece a atender seus clientes e fechar reservas sem pagar absolutamente nada no primeiro mês. Valide na prática antes do seu primeiro faturamento. Ativação via cartão de crédito.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={benefitsInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="relative p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/30 hover:bg-white/[0.03] transition-all duration-300 group overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-[80px] group-hover:bg-emerald-500/10 transition-all" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 group-hover:bg-emerald-500/20 group-hover:scale-110 transition-all duration-300">
                  <Crown className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-white font-bold text-xl mb-2">Preço de Fundador Congelado</h3>
                <span className="text-emerald-400 text-sm font-bold">R$ 247,00/mês por 24 meses</span>
                <p className="text-zinc-500 text-sm leading-relaxed mt-4 group-hover:text-zinc-400 transition-colors">
                  Garanta acesso às funcionalidades completas do plano PRO com preço especial de parceiro. Valor congelado por 24 meses enquanto sua assinatura estiver ativa. O plano PRO custa R$ 397/mês no preço regular — você economiza R$ 150 todos os meses.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Perks Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={benefitsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h3 className="text-xl font-bold text-white text-center mb-8">Além disso, você também recebe:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {partnerPerks.map((perk, i) => {
                const c = colorMap[perk.color];
                const Icon = perk.icon;
                return (
                  <motion.div
                    key={perk.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={benefitsInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5, delay: 0.35 + i * 0.08 }}
                    whileHover={{ y: -4 }}
                    className={`p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 group shadow-lg ${c.glow}`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center mb-3 group-hover:scale-110 transition-all duration-300`}>
                      <Icon className={`w-5 h-5 ${c.text}`} />
                    </div>
                    <h4 className="text-white font-bold text-sm mb-1.5">{perk.title}</h4>
                    <p className="text-zinc-500 text-xs leading-relaxed group-hover:text-zinc-400 transition-colors">{perk.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── HOW IT WORKS TIMELINE ─── */}
      <section ref={timelineRef} className="py-24 sm:py-32 relative bg-[#0a0a0a]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/[0.03] to-transparent" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={timelineInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
              <Rocket className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-blue-400 text-xs font-medium">Passo a Passo</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Como funciona o <span className="text-blue-400">Programa Beta</span>
            </h2>
            <p className="text-neutral-400 text-lg max-w-xl mx-auto">
              Do cadastro ao primeiro hóspede atendido pela IA em 4 etapas simples.
            </p>
          </motion.div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 sm:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

            {timelineSteps.map((item, i) => {
              const Icon = item.icon;
              const isLeft = i % 2 === 0;
              return (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 30 }}
                  animate={timelineInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.15 * i }}
                  className={`relative flex items-start gap-6 mb-12 last:mb-0 ${
                    isLeft ? 'sm:flex-row' : 'sm:flex-row-reverse'
                  }`}
                >
                  {/* Circle indicator */}
                  <div className="absolute left-6 sm:left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-[#0a0a0a] border-2 border-blue-500/30 flex items-center justify-center z-10">
                    <Icon className="w-5 h-5 text-blue-400" />
                  </div>

                  {/* Content card */}
                  <div className={`ml-20 sm:ml-0 sm:w-[calc(50%-3rem)] ${isLeft ? 'sm:pr-0 sm:mr-auto sm:text-right' : 'sm:pl-0 sm:ml-auto sm:text-left'}`}>
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all">
                      <span className="text-blue-500/40 text-xs font-bold font-mono">{item.step}</span>
                      <h3 className="text-white font-bold text-lg mt-1 mb-2">{item.title}</h3>
                      <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── COMPARISON TABLE ─── */}
      <section className="py-24 sm:py-32 relative bg-[#060608]">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Parceiro Fundador <span className="text-amber-400">vs.</span> Plano Regular
            </h2>
            <p className="text-neutral-400 text-lg">Veja a diferença que ser pioneiro faz.</p>
          </motion.div>

          <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.03]">
                  <th className="text-left p-4 text-neutral-400 font-semibold">Recurso</th>
                  <th className="text-center p-4 text-amber-400 font-bold">Parceiro Fundador</th>
                  <th className="text-center p-4 text-neutral-400 font-semibold">Plano PRO Regular</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {[
                  { feature: 'Primeiro mês', partner: 'GRÁTIS (R$ 0)', regular: 'R$ 397,00' },
                  { feature: 'Mensalidade', partner: 'R$ 247/mês', regular: 'R$ 397/mês' },
                  { feature: 'Duração do preço', partner: '24 meses congelado', regular: 'Sujeito a reajuste' },
                  { feature: 'Funcionalidades', partner: 'Plano PRO completo', regular: 'Plano PRO completo' },
                  { feature: 'Suporte', partner: 'VIP 24h + canal direto', regular: 'Horário comercial' },
                  { feature: 'Selo exclusivo', partner: 'Parceiro Fundador', regular: '—' },
                  { feature: 'Onboarding', partner: '1:1 personalizado', regular: 'Autoatendimento' },
                ].map((row) => (
                  <tr key={row.feature} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 text-zinc-300 font-medium">{row.feature}</td>
                    <td className="p-4 text-center text-amber-300 font-semibold">{row.partner}</td>
                    <td className="p-4 text-center text-zinc-500">{row.regular}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section ref={ctaRef} className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/[0.04] to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={ctaInView ? { scale: 1 } : {}}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-amber-500/30"
            >
              <Crown className="w-8 h-8 text-white" />
            </motion.div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
              Garanta sua vaga antes que
              <br />
              <span className="text-amber-400">o grupo se feche</span>
            </h2>

            <p className="text-neutral-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              São apenas 100 vagas para pousadas pioneiras no Brasil. Uma vez preenchidas, o Programa Beta será encerrado definitivamente e a condição de R$ 247/mês não voltará.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <button
                onClick={() => {
                  const el = document.querySelector('#precos');
                  if (el) {
                    router.push('/#precos');
                  } else {
                    router.push('/#precos');
                  }
                }}
                className="group relative overflow-hidden px-10 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-bold rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all duration-300 shadow-xl shadow-amber-500/10 cursor-pointer flex items-center gap-2 text-base active:scale-[0.98]"
              >
                <Sparkles className="w-5 h-5" />
                Quero ser Parceiro
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <Link
                href="/"
                className="px-8 py-4 rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-300 font-semibold hover:bg-white/[0.06] hover:border-white/[0.15] transition-all duration-300 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao site
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-neutral-600 text-xs">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500/40" />
                <span>Ativação em 5 minutos</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500/40" />
                <span>Pagamento via Cartão de Crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500/40" />
                <span>Poucas vagas restantes</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER (same as landing) ─── */}
      <footer className="border-t border-white/[0.04] bg-[#080808] pt-16 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Col 1: Logo */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="font-extrabold text-white text-lg block leading-none tracking-tight">Seu Zélla</span>
                  <span className="text-[9px] text-neutral-600 font-mono uppercase tracking-wider">Cognitive OS for Hospitality</span>
                </div>
              </div>
              <p className="text-neutral-500 text-xs leading-relaxed max-w-sm">
                Plataforma inteligente de automação de reservas e atendimento 24/7 com inteligência artificial para o seu hotel ou pousada.
              </p>
              <div className="flex items-center gap-4 text-neutral-600 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Ativação rápida</span>
                </div>
                <span className="text-neutral-800">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Sem fidelidade</span>
                </div>
              </div>
            </div>

            {/* Col 2: Navigation */}
            <div>
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-widest mb-4">Navegação</h3>
              <ul className="space-y-2.5">
                {[
                  { label: 'Página Inicial', href: '/' },
                  { label: 'Como Funciona', href: '/#como-funciona' },
                  { label: 'Planos', href: '/#precos' },
                  { label: 'Dúvidas Frequentes', href: '/#faq' },
                ].map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-neutral-500 hover:text-emerald-400 text-xs transition-colors duration-200 block py-0.5">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3: Legal */}
            <div>
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-widest mb-4">Jurídico</h3>
              <ul className="space-y-2.5">
                {['Central de Privacidade', 'Termos de Uso', 'Política de Privacidade', 'Política de Cobrança', 'Contrato SaaS'].map((link) => (
                  <li key={link}>
                    <a href="#" className="text-neutral-500 hover:text-emerald-400 text-xs transition-colors duration-200 block py-0.5">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/[0.04] pt-6 mt-10" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-neutral-600 text-[11px]">&copy; {new Date().getFullYear()} Seu Zélla. Todos os direitos reservados.</span>
            <div className="flex items-center gap-4 text-neutral-600 text-[11px]">
              <div className="flex items-center gap-1">
                <span>Pagamentos via</span>
                <span className="text-neutral-400 font-semibold">Mercado Pago</span>
              </div>
              <span className="text-neutral-800">|</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Todos os sistemas operacionais online</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}