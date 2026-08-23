'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  FileText,
  Wallet,
  TrendingUp,
  DollarSign,
  BarChart3,
  ClipboardList,
  Target,
  Check,
  ArrowRight,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';

type ProHostFeature = {
  id: string;
  icon: LucideIcon;
  badge: string;
  title: string;
  desc: string;
  highlights: string[];
  heroStat: { val: string; label: string };
};

const features: ProHostFeature[] = [
  {
    id: 'lucro-imovel',
    icon: TrendingUp,
    badge: 'Lucro por Imóvel',
    title: 'Saiba exatamente quanto você lucra',
    desc: 'Veja a receita, as despesas e o lucro real de cada imóvel. Escolha o período (mês, trimestre ou ano) e descubra quais imóveis mais lucram — sem achismo, com números reais.',
    highlights: [
      'Receita menos despesas = lucro real de cada imóvel',
      'Margem de lucro e taxa de ocupação',
      'Período por mês, trimestre ou ano',
    ],
    heroStat: { val: '100%', label: 'transparência financeira' },
  },
  {
    id: 'preco-ideal',
    icon: DollarSign,
    badge: 'Preço Ideal',
    title: 'O sistema sugere o melhor preço para cada data',
    desc: 'Simule o preço da diária para qualquer data. O sistema considera feriados (Réveillon, Carnaval, Natal), alta ou baixa temporada e a ocupação do seu imóvel para sugerir o preço que maximiza seu ganho sem espantar hóspedes.',
    highlights: [
      'Feriados brasileiros detectados automaticamente',
      'Preço maior em datas de muita procura',
      'Alerta quando há poucos quartos livres',
    ],
    heroStat: { val: '+37%', label: 'receita extra com preço inteligente' },
  },
  {
    id: 'comparar',
    icon: BarChart3,
    badge: 'Comparar Imóveis',
    title: 'Ranking de qual imóvel lucra mais',
    desc: 'Compare todos os seus imóveis lado a lado em um único painel. Veja receita, despesas, lucro e ocupação de cada um. Ranking visual do que mais lucra para o que menos lucra.',
    highlights: [
      'Comparação lado a lado de todos os imóveis',
      'Ranking por lucro, ocupação ou preço médio',
      'Identifique quais imóveis rendem menos',
    ],
    heroStat: { val: '6', label: 'informações comparadas' },
  },
  {
    id: 'financeiro',
    icon: Wallet,
    badge: 'Controle Financeiro',
    title: 'Tudo que entra e sai de cada imóvel',
    desc: 'Cadastre receitas e despesas em 8 categorias (contas fixas, manutenção, impostos, etc). Avisos de contas atrasadas, repetição automática de contas mensais e visão completa do que entra e sai.',
    highlights: [
      '8 categorias de despesa',
      'Aviso automático de contas atrasadas',
      'Contas que se repetem todo mês',
    ],
    heroStat: { val: '8', label: 'categorias de despesa' },
  },
  {
    id: 'relatorios',
    icon: FileText,
    badge: 'Relatórios Profissionais',
    title: 'Gere relatórios em PDF e Excel',
    desc: 'Crie relatórios de faturamento, ocupação, hóspedes e operações em PDF ou Excel com poucos cliques. Envie direto para o contador ou para donos de imóveis que você administra.',
    highlights: [
      '7 tipos de relatório',
      'Exporta em PDF e Excel',
      'Filtro por período',
    ],
    heroStat: { val: '7', label: 'tipos de relatório' },
  },
  {
    id: 'operacoes',
    icon: ClipboardList,
    badge: 'Operações e Limpeza',
    title: 'Checklist de limpeza e manutenção',
    desc: 'Tarefas de limpeza, manutenção e inspeção com checklist automático. Acompanhe o status de cada tarefa, atribua responsáveis e saiba exatamente quando o imóvel está pronto para o próximo hóspede.',
    highlights: [
      'Checklist automático de limpeza e manutenção',
      'Acompanhe status de cada tarefa',
      'Atribua responsáveis e custos',
    ],
    heroStat: { val: '18', label: 'itens de checklist' },
  },
  {
    id: 'metas',
    icon: Target,
    badge: 'Metas e Acompanhamento',
    title: 'Defina metas e acompanhe o progresso',
    desc: 'Estabeleça metas de receita, ocupação, reservas e avaliações. O sistema acompanha seu progresso automaticamente e mostra se você está no caminho certo para bater cada meta.',
    highlights: [
      'Metas de receita, ocupação e reservas',
      'Acompanhamento automático do progresso',
      'Visão diária, semanal, mensal ou anual',
    ],
    heroStat: { val: '7', label: 'tipos de meta' },
  },
];

export function ProHostSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const { isAirbnb } = useNiche();

  if (!isAirbnb) return null;

  return (
    <section
      ref={ref}
      id="prohost"
      className="py-28 sm:py-32 lg:py-40 bg-gradient-to-b from-[#0a0a0a] via-[#080a12] to-[#0a0a0a] relative overflow-hidden"
    >
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
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full bg-gradient-to-r from-blue-500/15 via-indigo-500/15 to-violet-500/15 border border-blue-500/30 backdrop-blur-sm"
          >
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
              Zélla AirB Pro
            </span>
          </motion.div>

          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-6 tracking-tight leading-tight">
            O anfitrião agora tem{' '}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent font-bold">
              superpoderes
            </span>
          </h2>

          <p className="text-neutral-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Tudo que você precisa para gerenciar seus imóveis, atender hóspedes e
            aumentar seu lucro — em um só painel.
          </p>

          {/* Métricas topo — simples e diretas */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 flex flex-wrap justify-center gap-8 sm:gap-12"
          >
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                7
              </div>
              <div className="text-[11px] text-neutral-500 font-semibold mt-1 uppercase tracking-wider">
                Ferramentas
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                24h
              </div>
              <div className="text-[11px] text-neutral-500 font-semibold mt-1 uppercase tracking-wider">
                Atendimento Automático
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-amber-400 to-orange-400 bg-clip-text text-transparent">
                +37%
              </div>
              <div className="text-[11px] text-neutral-500 font-semibold mt-1 uppercase tracking-wider">
                Receita Extra
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
            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.5 + i * 0.08 }}
                whileHover={{ y: -4 }}
                className="group relative rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-blue-500/30 hover:bg-white/[0.04] transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.04] via-transparent to-violet-500/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="relative p-7 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                  </div>

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

                  <span className="text-blue-400 text-[11px] font-bold uppercase tracking-wider mb-2">
                    {feature.badge}
                  </span>

                  <h3 className="text-lg font-bold text-white mb-3 leading-tight">
                    {feature.title}
                  </h3>

                  <p className="text-neutral-400 text-[13px] leading-relaxed mb-5 flex-grow">
                    {feature.desc}
                  </p>

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

                  <div className="pt-4 border-t border-white/[0.05] flex items-center justify-between">
                    <span className="text-[10px] text-neutral-600 font-medium uppercase tracking-wider">
                      No seu painel
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
                  Acesse o painel do anfitrião e comece a usar
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

        {/* Cadastro */}
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
              Assine agora →
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
