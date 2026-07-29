'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Check,
  X,
  MessageSquare,
  Brain,
  Globe,
  DollarSign,
  Shield,
  Zap,
  Headphones,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';

interface ComparisonRow {
  feature: string;
  icon: React.ElementType;
  zehla: string | boolean;
  zehlaHighlight?: boolean;
  cloudbeds: string | boolean;
  cloudbedsBad?: boolean;
}

function getComparisons(niche: 'pousada' | 'airbnb'): ComparisonRow[] {
  return [
    {
      feature: 'WhatsApp IA Nativo',
      icon: MessageSquare,
      zehla: true,
      zehlaHighlight: true,
      cloudbeds: false,
      cloudbedsBad: true,
    },
    {
      feature: 'Conexão & Tom de Voz',
      icon: MessageSquare,
      zehla: 'QR Code em 5s + Clone de Tom de Voz (Zero Taxas)',
      zehlaHighlight: true,
      cloudbeds: 'Configuração genérica / Taxas extras',
      cloudbedsBad: true,
    },
    {
      feature: niche === 'airbnb' ? 'IA Preditiva para Atendimento' : 'IA Preditiva para Hóspedes',
      icon: Brain,
      zehla: true,
      zehlaHighlight: true,
      cloudbeds: 'Parcial',
    },
    {
      feature: 'Preço em Real (BRL)',
      icon: DollarSign,
      zehla: 'A partir de R$197/mês',
      zehlaHighlight: true,
      cloudbeds: 'USD ~R$800+/mês',
      cloudbedsBad: true,
    },
    {
      feature: 'Suporte em Português',
      icon: Headphones,
      zehla: 'PT-BR Nativo via WhatsApp',
      zehlaHighlight: true,
      cloudbeds: 'Apenas Inglês (Ticket)',
      cloudbedsBad: true,
    },
    {
      feature: 'Entende Mercado BR',
      icon: Globe,
      zehla: niche === 'pousada' ? 'Feito para pousadas brasileiras' : niche === 'airbnb' ? 'Feito para anfitriões brasileiros' : 'Feito para parceiros brasileiros',
      zehlaHighlight: true,
      cloudbeds: 'Foco em hotéis globais',
      cloudbedsBad: true,
    },
    {
      feature: 'Onboarding',
      icon: Zap,
      zehla: '5 minutos — wizard automático',
      zehlaHighlight: true,
      cloudbeds: '2 a 4 semanas',
      cloudbedsBad: true,
    },
    {
      feature: niche === 'airbnb' ? 'Resposta a Contatos' : 'Resposta a Hóspedes',
      icon: Clock,
      zehla: '< 8 segundos (24/7)',
      zehlaHighlight: true,
      cloudbeds: 'Depende do staff',
    },
    {
      feature: 'Revenue Management IA',
      icon: TrendingUp,
      zehla: true,
      zehlaHighlight: true,
      cloudbeds: 'Básico',
      cloudbedsBad: true,
    },
    {
      feature: 'Dados Diretos (sem Webhook)',
      icon: Shield,
      zehla: 'PostgreSQL direto',
      zehlaHighlight: true,
      cloudbeds: 'Webhooks com delays',
      cloudbedsBad: true,
    },
  ];
}

function CellValue({ value, highlight, bad }: { value: string | boolean; highlight?: boolean; bad?: boolean }) {
  if (value === true) {
    return (
      <div className="flex items-center justify-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Check className="w-3 h-3 text-emerald-400" />
        </div>
        <span className="text-emerald-400 text-xs font-semibold">Incluso</span>
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex items-center justify-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
          <X className="w-3 h-3 text-red-400" />
        </div>
        <span className="text-red-400 text-xs font-semibold">Não possui</span>
      </div>
    );
  }
  return (
    <span className={`text-xs font-medium ${highlight ? 'text-emerald-400' : bad ? 'text-red-400/80' : 'text-neutral-400'}`}>
      {value}
    </span>
  );
}

export function WhyZehlaSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const { isPousada, isAirbnb } = useNiche();
  const comparisons = getComparisons(isPousada ? 'pousada' : 'airbnb');

  return (
    <section ref={ref} className="relative py-28 sm:py-36 lg:py-44 bg-[#0a0a0a] overflow-hidden">
      {/* Background accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-emerald-500/[0.03] rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 text-xs font-medium uppercase tracking-wider">Comparativo Direto</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6">
            Por que {isPousada ? 'pousadas' : 'anfitriões'} trocam o{' '}
            <span className="text-blue-400 font-bold">Cloudbeds</span>{' '}
            pelo <span className="text-emerald-400 font-bold">Zélla</span>?
          </h2>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            Feito no Brasil, em português, com IA nativa no WhatsApp. Veja como o Zélla supera o Cloudbeds em cada ponto crítico {isPousada ? 'para sua pousada' : isAirbnb ? 'para seus imóveis' : 'para sua operação'}.
          </p>
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
        >
          {/* Table Header */}
          <div className="grid grid-cols-3 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="p-5 sm:p-6">
              <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Recurso</span>
            </div>
            <div className="p-5 sm:p-6 text-center border-l border-white/[0.06]">
              <span className="text-emerald-400 text-sm font-bold">Seu Zélla</span>
            </div>
            <div className="p-5 sm:p-6 text-center border-l border-white/[0.06]">
              <span className="text-neutral-400 text-sm font-bold">Cloudbeds</span>
            </div>
          </div>

          {/* Rows */}
          {comparisons.map((row, i) => {
            const Icon = row.icon;
            return (
              <motion.div
                key={row.feature}
                initial={{ opacity: 0, x: -10 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.05 }}
                className={`grid grid-cols-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors`}
              >
                <div className="p-5 sm:p-6 flex items-center gap-3">
                  <Icon className="w-4 h-4 text-neutral-500 shrink-0" />
                  <span className="text-white text-xs sm:text-sm font-medium">{row.feature}</span>
                </div>
                <div className={`p-5 sm:p-6 flex items-center justify-center border-l border-white/[0.06] ${row.zehlaHighlight ? 'bg-emerald-500/[0.04]' : ''}`}>
                  <CellValue value={row.zehla} highlight={row.zehlaHighlight} />
                </div>
                <div className={`p-5 sm:p-6 flex items-center justify-center border-l border-white/[0.06] ${row.cloudbedsBad ? 'bg-red-500/[0.02]' : ''}`}>
                  <CellValue value={row.cloudbeds} bad={row.cloudbedsBad} />
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-14"
        >
          <p className="text-neutral-400 text-sm mb-4">
            Migração simplificada — seu histórico de reservas é preservado
          </p>
          <button
            onClick={() => {
              const el = document.querySelector('#precos');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-xl hover:from-emerald-400 hover:to-emerald-500 transition-all duration-200 shadow-xl shadow-emerald-500/30 cursor-pointer text-sm active:scale-95"
          >
            Começar Grátis por 7 Dias
          </button>
        </motion.div>
      </div>
    </section>
  );
}
