'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  FileText,
  Wallet,
  Sparkles,
  ClipboardList,
  Target,
  Handshake,
  Check,
  ArrowRight,
  Zap,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';

// ────────────────────────────────────────────────────────────────────────────
// PROHOST SECTION — Evidencia as 6 melhorias ProHost no Zélla AirB
// (mostrada APENAS quando o nicho ativo = airbnb / "Para Anfitriões")
// ────────────────────────────────────────────────────────────────────────────

type ProHostFeature = {
  id: string;
  tier: 'P0' | 'P1';
  icon: LucideIcon;
  badge: string;
  title: string;
  desc: string;
  highlights: string[];
  heroStat: { val: string; label: string };
};

const features: ProHostFeature[] = [
  {
    id: 'pdf-reports',
    tier: 'P0',
    icon: FileText,
    badge: 'Relatórios em PDF',
    title: '7 tipos de relatório, 3 formatos',
    desc: 'Gere relatórios profissionais de faturamento, ocupação, operações, hóspedes, metas e comissões em PDF (via impressão do browser), XLSX ou CSV. Histórico persistente de cada relatório gerado, com filtro por período e exportação direta para o contador.',
    highlights: [
      'monthly_summary, reservations, financial',
      'guests, operations, goals, commissions',
      'PDF via browser print, XLSX, CSV',
      'Histórico persistente por tenant',
    ],
    heroStat: { val: '7', label: 'tipos de relatório' },
  },
  {
    id: 'financial',
    tier: 'P0',
    icon: Wallet,
    badge: 'Gestão Financeira',
    title: 'DRE, fluxo de caixa e despesas',
    desc: 'Cadastre despesas em 8 categorias (custos fixos, variáveis, manutenção, utilities, marketing, comissões, impostos, outros). Auto-detecção de vencimentos atrasados, status pending/paid/overdue/cancelled, recorrência mensal/semanal/anual. DRE simplificado e visão de fluxo de caixa consolidada do portfólio.',
    highlights: [
      '8 categorias de despesa',
      'Auto-overdue detection',
      'Recorrência mensal/semanal/anual',
      'DRE simplificado + cash flow',
    ],
    heroStat: { val: '8', label: 'categorias de despesa' },
  },
  {
    id: 'trial',
    tier: 'P0',
    icon: Sparkles,
    badge: 'Trial Self-Service',
    title: 'Onboarding sem call comercial',
    desc: 'Página pública /trial onde o anfitrião se cadastra sozinho com email, recebe um magic-link de verificação e entra no painel sem precisar de call com vendas. Funil de conversão rastreado no ZCC com stats em tempo real: signups → verificados → ativados.',
    highlights: [
      'Signup público via /trial',
      'Magic-link por email',
      'Zero call comercial necessário',
      'Funil rastreado no ZCC',
    ],
    heroStat: { val: '0', label: 'calls comerciais' },
  },
  {
    id: 'operations',
    tier: 'P1',
    icon: ClipboardList,
    badge: 'Operações & Cleaning',
    title: 'Checklists automáticos de limpeza',
    desc: 'Tarefas de limpeza, manutenção, inspeção e reposição com checklists automáticos (10 itens para limpeza, 8 para manutenção). Workflow pending → in_progress → completed, prioridade low/normal/high/urgent, custos por tarefa, responsável atribuído, fotos e notas em metadata.',
    highlights: [
      '4 tipos: cleaning/maintenance/inspection/restock',
      'Checklists automáticos (10 + 8 itens)',
      'Workflow de status com timestamps',
      'Custos + responsável + fotos',
    ],
    heroStat: { val: '18', label: 'itens de checklist' },
  },
  {
    id: 'goals',
    tier: 'P1',
    icon: Target,
    badge: 'Metas & KPIs',
    title: '7 KPIs com projeção linear',
    desc: 'Defina metas de receita, ocupação, reservas, ADR, RevPAR, hóspedes e avaliações. 5 períodos (diário/semanal/mensal/trimestral/anual), projeção linear automática baseada no ritmo atual, barra de progresso visual e auto-atualização de currentValue a partir de dados reais.',
    highlights: [
      '7 tipos de KPI (revenue/occupancy/bookings/ADR/RevPAR/guests/reviews)',
      '5 períodos configuráveis',
      'Projeção linear automática',
      'Auto-update via dados reais',
    ],
    heroStat: { val: '7', label: 'tipos de KPI' },
  },
  {
    id: 'commissions',
    tier: 'P1',
    icon: Handshake,
    badge: 'Comissões de Parceiros',
    title: '4 tipos de parceiro, regra flexível',
    desc: 'Gerencie comissões de affiliates, agentes, parceiros e influencers. Regra percentual ou fixa, geração automática de partnerCode único, workflow pending → payable → paid. Resumo consolidado por parceiro com total pendente, a pagar e pago.',
    highlights: [
      '4 tipos: affiliate/agent/partner/influencer',
      'Regra % ou valor fixo',
      'partnerCode auto-gerado',
      'Workflow pending → payable → paid',
    ],
    heroStat: { val: '4', label: 'tipos de parceiro' },
  },
];

export function ProHostSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const { isAirbnb } = useNiche();

  // Não renderiza para Pousada nem Parceiro — só Anfitriões (Airbnb)
  if (!isAirbnb) return null;

  return (
    <section
      ref={ref}
      id="prohost"
      className="py-28 sm:py-32 lg:py-40 bg-gradient-to-b from-[#0a0a0a] via-[#080a12] to-[#0a0a0a] relative overflow-hidden"
    >
      {/* Glow de fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-blue-500/[0.04] blur-[140px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-500/[0.03] blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          {/* Badge superior */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full bg-gradient-to-r from-blue-500/15 via-indigo-500/15 to-violet-500/15 border border-blue-500/30 backdrop-blur-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
              Zélla AirB Pro — Novidade
            </span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-[10px] font-bold text-blue-200">
              NEW
            </span>
          </motion.div>

          {/* Headline */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-6 tracking-tight leading-tight">
            O anfitrião agora tem{' '}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent font-bold">
              superpoderes
            </span>
          </h2>

          <p className="text-neutral-400 text-lg max-w-3xl mx-auto leading-relaxed">
            Inspirado nas melhores práticas do mercado, o <strong className="text-white">Zélla AirB Pro</strong> reúne
            6 módulos profissionais que transformam sua operação Airbnb numa máquina de receber hóspede, controlar
            financeiro e escalar sem contratar equipe. Tudo dentro do mesmo painel.
          </p>

          {/* Métricas topo */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 flex flex-wrap justify-center gap-8 sm:gap-12"
          >
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                6
              </div>
              <div className="text-[11px] text-neutral-500 font-semibold mt-1 uppercase tracking-wider">
                Novos Módulos
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                3
              </div>
              <div className="text-[11px] text-neutral-500 font-semibold mt-1 uppercase tracking-wider">
                Críticos (P0)
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-amber-400 to-orange-400 bg-clip-text text-transparent">
                3
              </div>
              <div className="text-[11px] text-neutral-500 font-semibold mt-1 uppercase tracking-wider">
                Avançados (P1)
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                +6.500
              </div>
              <div className="text-[11px] text-neutral-500 font-semibold mt-1 uppercase tracking-wider">
                Linhas de Código
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Grid de Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, i) => {
            const Icon = feature.icon;
            const isP0 = feature.tier === 'P0';

            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.5 + i * 0.08 }}
                whileHover={{ y: -4 }}
                className="group relative rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-blue-500/30 hover:bg-white/[0.04] transition-all duration-300 overflow-hidden"
              >
                {/* Glow no hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.04] via-transparent to-violet-500/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="relative p-7 flex flex-col h-full">
                  {/* Topo: ícone + tier badge */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        isP0
                          ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                          : 'bg-amber-500/10 border border-amber-500/25 text-amber-400'
                      }`}
                    >
                      {feature.tier}
                    </span>
                  </div>

                  {/* Hero Stat */}
                  <div className="mb-5">
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-black tracking-tighter bg-gradient-to-br from-blue-400 to-indigo-400 bg-clip-text text-transparent leading-none">
                        {feature.heroStat.val}
                      </span>
                      <span className="text-neutral-500 text-[11px] font-medium pb-1.5 leading-snug">
                        {feature.heroStat.label}
                      </span>
                    </div>
                    <div className="h-px mt-3 bg-gradient-to-r from-blue-500/40 to-transparent" />
                  </div>

                  {/* Badge (categoria) */}
                  <span className="text-blue-400 text-[11px] font-bold uppercase tracking-wider mb-2">
                    {feature.badge}
                  </span>

                  {/* Título */}
                  <h3 className="text-lg font-bold text-white mb-3 leading-tight">
                    {feature.title}
                  </h3>

                  {/* Descrição */}
                  <p className="text-neutral-400 text-[13px] leading-relaxed mb-5 flex-grow">
                    {feature.desc}
                  </p>

                  {/* Highlights */}
                  <ul className="space-y-2 mb-6">
                    {feature.highlights.map((h, hi) => (
                      <li
                        key={hi}
                        className="flex items-start gap-2 text-[12px] text-neutral-300"
                      >
                        <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Footer do card */}
                  <div className="pt-4 border-t border-white/[0.05] flex items-center justify-between">
                    <span className="text-[10px] text-neutral-600 font-medium uppercase tracking-wider">
                      Sub-tab "Pro" no DDC
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* CTA inferior */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 1.0 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-violet-500/10 border border-blue-500/20 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-left">
                <div className="text-white font-bold text-sm">Tudo isso já está no seu painel</div>
                <div className="text-neutral-400 text-xs">
                  Acesse <span className="text-blue-400 font-mono">/ddc/airbnb</span> → sub-tab "Pro"
                </div>
              </div>
            </div>
            <a
              href="/ddc/airbnb"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5"
            >
              <TrendingUp className="w-4 h-4" />
              Explorar agora
            </a>
          </div>
        </motion.div>

        {/* Trial callout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="mt-8 text-center"
        >
          <p className="text-neutral-500 text-sm">
            Ainda não é cliente?{' '}
            <a
              href="/login"
              className="text-blue-400 hover:text-blue-300 font-bold underline decoration-blue-500/30 hover:decoration-blue-400 underline-offset-4 transition-colors"
            >
              Comece agora pelo Cadastro →
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
