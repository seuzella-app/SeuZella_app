'use client';

import { useRef, useState, useMemo } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  Calculator,
  ArrowRight,
  TrendingUp,
  Moon,
  Users,
  Wallet,
  BadgeDollarSign,
  Sparkles,
  Clock,
  CheckCircle,
  Home,
  Percent,
  MessageSquare,
  AlertTriangle,
  Building2,
  PiggyBank,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';

// ============================================================================
// Constantes de negócio — Pousadas (cálculo original mantido)
// ============================================================================
const CONVERSAO_SEM_ZELLA = 0.20;
const CONVERSAO_COM_ZELLA = 0.35;
const ESTADIA_MEDIA_HOSPEDAGEM = 2.5;
const ECONOMIA_RECEPCIONISTA = 1200;
const CUSTO_ZELLA_PRO_POUSADA = 397;

// ============================================================================
// Constantes de negócio — Airbnb (novo cálculo inteligente)
// ============================================================================
const CONVERSAO_SEM_ZELLA_AIRBNB = 0.18; // 18% — anfitrião demora a responder, hóspede vai para outro
const CONVERSAO_COM_ZELLA_AIRBNB = 0.32; // 32% — resposta instantânea 24/7 + PIX direto
const ESTADIA_MEDIA_AIRBNB = 3.2; // noites por reserva Airbnb (média Brasil)
const TAXA_RESERVA_DIRETA = 0.25; // 25% das reservas Zélla são diretas (sem comissão)
const CUSTO_ZELLA_PRO_AIRBNB = 197; // R$/mês plano PRO Airbnb
const CUSTO_ZELLA_MAX_AIRBNB = 397; // R$/mês plano MAX Airbnb
const ECONOMIA_AUTOMACAO_AIRBNB = 950; // R$/mês economizados (automação noturna/fim de semana)

// ============================================================================
// Helpers
// ============================================================================
const fmt = (v: number) =>
  `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

const fmtPct = (v: number) =>
  `${v.toFixed(1).replace('.', ',')}%%`.replace('%%', '%');

// ============================================================================
// POUSADA CALCULATOR (original, mantido intacto)
// ============================================================================
function PousadaCalculator() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const [contatosMes, setContatosMes] = useState(80);
  const [valorMedio, setValorMedio] = useState(350);
  const [incluirUpsellFeriados, setIncluirUpsellFeriados] = useState(false);
  const [feriadosAno, setFeriadosAno] = useState(8);
  const [upsellPorFeriado, setUpsellPorFeriado] = useState(950);

  const custoZellaMensal = CUSTO_ZELLA_PRO_POUSADA;
  const estadiaMedia = ESTADIA_MEDIA_HOSPEDAGEM;
  const economiaMensal = ECONOMIA_RECEPCIONISTA;

  const calc = useMemo(() => {
    const conversoesSem = Math.round(contatosMes * CONVERSAO_SEM_ZELLA);
    const conversoesCom = Math.round(contatosMes * CONVERSAO_COM_ZELLA);
    const conversoesAMais = conversoesCom - conversoesSem;
    const receitaSem = conversoesSem * valorMedio * estadiaMedia;
    const receitaCom = conversoesCom * valorMedio * estadiaMedia;
    const receitaExtraMensal = receitaCom - receitaSem;
    const receitaExtraAnual = receitaExtraMensal * 12;
    const economiaAnual = economiaMensal * 12;
    const custoZellaAnual = custoZellaMensal * 12;

    const totalUpsellAnual = incluirUpsellFeriados ? feriadosAno * upsellPorFeriado : 0;
    const taxaZellaUpsellAnual = totalUpsellAnual * 0.07;
    const lucroLiquidoUpsellPousada = totalUpsellAnual - taxaZellaUpsellAnual;

    const lucroLiquidoAnual = receitaExtraAnual + economiaAnual + lucroLiquidoUpsellPousada - custoZellaAnual;
    const roiPercent = custoZellaAnual > 0
      ? Math.round(((receitaExtraAnual + economiaAnual + lucroLiquidoUpsellPousada - custoZellaAnual) / custoZellaAnual) * 100)
      : 0;

    return {
      conversoesSem,
      conversoesCom,
      conversoesAMais,
      receitaSem,
      receitaCom,
      receitaExtraMensal,
      receitaExtraAnual,
      economiaAnual,
      custoZellaAnual,
      totalUpsellAnual,
      taxaZellaUpsellAnual,
      lucroLiquidoUpsellPousada,
      lucroLiquidoAnual,
      roiPercent,
    };
  }, [contatosMes, valorMedio, estadiaMedia, custoZellaMensal, economiaMensal, incluirUpsellFeriados, feriadosAno, upsellPorFeriado]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: 0.15 }}
      className="relative rounded-3xl bg-[#111] border border-white/[0.06] p-10 sm:p-14 overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-[100px] bg-emerald-500/[0.07]" />
      <div className="absolute bottom-0 left-0 w-56 h-56 bg-blue-500/[0.05] rounded-full blur-[80px]" />

      <div className="relative z-10">
        {/* Inputs */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
            <div className="space-y-3">
              <label className="block text-neutral-300 text-sm font-medium">Contatos de WhatsApp por mês</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setContatosMes(Math.max(10, contatosMes - 10))} className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-bold text-xl hover:bg-white/[0.1] transition-all cursor-pointer active:scale-95">-</button>
                <div className="flex-1 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                  <span className="text-3xl font-extrabold text-white">{contatosMes}</span>
                </div>
                <button onClick={() => setContatosMes(Math.min(400, contatosMes + 10))} className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-bold text-xl hover:bg-white/[0.1] transition-all cursor-pointer active:scale-95">+</button>
              </div>
              <p className="text-neutral-500 text-[11px]">Inclui perguntas de disponibilidade, preço e reserva</p>
            </div>
            <div className="space-y-3">
              <label className="block text-neutral-300 text-sm font-medium">Diária média da pousada</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setValorMedio(Math.max(80, valorMedio - 50))} className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-bold text-xl hover:bg-white/[0.1] transition-all cursor-pointer active:scale-95">-</button>
                <div className="flex-1 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">R$ {valorMedio.toLocaleString('pt-BR')}</span>
                </div>
                <button onClick={() => setValorMedio(Math.min(3000, valorMedio + 50))} className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-bold text-xl hover:bg-white/[0.1] transition-all cursor-pointer active:scale-95">+</button>
              </div>
              <p className="text-neutral-500 text-[11px]">Valor médio cobrado por noite de hospedagem</p>
            </div>
          </div>
        </div>

        {/* OPÇÃO DE UPSELL EM DATAS ESPECIAIS / FERIADOS */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    Simular Motor de UPSELL em Feriados & Alta Demanda
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                      Opcional
                    </span>
                  </h4>
                  <p className="text-neutral-400 text-xs mt-0.5">
                    Em 90% do ano (dia a dia), a taxa é <strong className="text-emerald-400">ZERO (0%)</strong>. Em feriados com grande fluxo de mensagens, o Zélla fecha reservas no valor de alta demanda com 7% de sucesso só sobre o ganho a mais.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIncluirUpsellFeriados(!incluirUpsellFeriados)}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  incluirUpsellFeriados ? 'bg-emerald-500' : 'bg-neutral-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    incluirUpsellFeriados ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <AnimatePresence>
              {incluirUpsellFeriados && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-5 pt-5 border-t border-white/[0.06] space-y-4 overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-neutral-400 text-[11px] font-medium mb-1.5">
                        Feriados & datas comemorativas no ano
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFeriadosAno(Math.max(2, feriadosAno - 1))}
                          className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white font-bold hover:bg-white/[0.1]"
                        >
                          -
                        </button>
                        <div className="flex-1 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center font-bold text-white">
                          {feriadosAno} datas de pico
                        </div>
                        <button
                          type="button"
                          onClick={() => setFeriadosAno(Math.min(18, feriadosAno + 1))}
                          className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white font-bold hover:bg-white/[0.1]"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-neutral-400 text-[11px] font-medium mb-1.5">
                        Estimativa de UPSELL faturado a mais por feriado (R$)
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setUpsellPorFeriado(Math.max(200, upsellPorFeriado - 100))}
                          className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white font-bold hover:bg-white/[0.1]"
                        >
                          -
                        </button>
                        <div className="flex-1 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center font-bold text-emerald-300">
                          {fmt(upsellPorFeriado)} / feriado
                        </div>
                        <button
                          type="button"
                          onClick={() => setUpsellPorFeriado(Math.min(5000, upsellPorFeriado + 100))}
                          className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white font-bold hover:bg-white/[0.1]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-emerald-300 font-bold block">
                        + {fmt(calc.lucroLiquidoUpsellPousada)} / ano no seu caixa
                      </span>
                      <span className="text-neutral-400 text-[11px]">
                        Total vendido: {fmt(calc.totalUpsellAnual)} · Taxa Zélla (7% sobre o extra): {fmt(calc.taxaZellaUpsellAnual)}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 self-start sm:self-auto">
                      93% do lucro extra no seu bolso
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {[
            { icon: Users, val: `+${calc.conversoesAMais}`, label: 'reservas/mês', bg: 'emerald' },
            { icon: TrendingUp, val: fmt(calc.receitaExtraMensal), label: 'receita extra/mês', bg: 'blue' },
            { icon: BadgeDollarSign, val: fmt(calc.receitaExtraAnual), label: 'receita extra/ano', bg: 'purple' },
            { icon: Sparkles, val: `${calc.roiPercent > 0 ? '+' : ''}${calc.roiPercent}%`, label: 'ROI anual', bg: 'amber' },
          ].map((item, i) => (
            <div key={i} className={`text-center p-6 rounded-2xl border ${item.bg === 'emerald' ? 'bg-emerald-500/[0.06] border-emerald-500/15' : item.bg === 'blue' ? 'bg-blue-500/[0.06] border-blue-500/15' : item.bg === 'purple' ? 'bg-purple-500/[0.06] border-purple-500/15' : 'bg-amber-500/[0.06] border-amber-500/15'}`}>
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mx-auto mb-3 ${item.bg === 'emerald' ? 'bg-emerald-500/15 border-emerald-500/20' : item.bg === 'blue' ? 'bg-blue-500/15 border-blue-500/20' : item.bg === 'purple' ? 'bg-purple-500/15 border-purple-500/20' : 'bg-amber-500/15 border-amber-500/20'}`}>
                <item.icon className={`w-5 h-5 ${item.bg === 'emerald' ? 'text-emerald-400' : item.bg === 'blue' ? 'text-blue-400' : item.bg === 'purple' ? 'text-purple-400' : 'text-amber-400'}`} />
              </div>
              <div className={`text-2xl sm:text-3xl font-extrabold ${item.bg === 'emerald' ? 'text-emerald-400' : item.bg === 'blue' ? 'text-blue-400' : item.bg === 'purple' ? 'text-purple-400' : 'text-amber-400'}`}>{item.val}</div>
              <div className="text-neutral-500 text-xs mt-1">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-neutral-500" />
              <span className="text-neutral-400 text-sm font-semibold">Sem o Zélla</span>
              <span className="ml-auto text-[10px] text-neutral-600 bg-white/[0.04] px-2 py-0.5 rounded-full">20% conversão</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-neutral-500">Reservas/mês</span><span className="text-neutral-300 font-semibold">{calc.conversoesSem}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Receita/mês</span><span className="text-neutral-300 font-semibold">{fmt(calc.receitaSem)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Resposta após horas</span><span className="text-red-400/80 font-medium">Perde hóspedes</span></div>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-neutral-600 to-neutral-500 transition-all duration-500" style={{ width: `${CONVERSAO_SEM_ZELLA * 100 / CONVERSAO_COM_ZELLA}%` }} />
            </div>
          </div>
          <div className="p-6 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/15">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">Com o Zélla</span>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-500 bg-emerald-500/10 border border-emerald-500/20">35% conversão</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-neutral-500">Reservas/mês</span><span className="text-emerald-300 font-bold">{calc.conversoesCom} <span className="text-emerald-500">(+{calc.conversoesAMais})</span></span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Receita/mês</span><span className="text-emerald-300 font-bold">{fmt(calc.receitaCom)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Resposta instantânea 24/7</span><span className="text-emerald-400 font-medium">Sua chave PIX na hora</span></div>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500" style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* Financial Detail */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          <div className="flex items-center gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0"><Moon className="w-5 h-5 text-indigo-400" /></div>
            <div><div className="text-sm font-bold text-white">{fmt(economiaMensal)}/mês</div><div className="text-[11px] text-neutral-500">Economia recepcionista noturno</div></div>
          </div>
          <div className="flex items-center gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0"><Wallet className="w-5 h-5 text-neutral-400" /></div>
            <div><div className="text-sm font-bold text-white">{fmt(custoZellaMensal)}/mês</div><div className="text-[11px] text-neutral-500">Investimento no plano PRO</div></div>
          </div>
          <div className="flex items-center gap-4 p-5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0"><TrendingUp className="w-5 h-5 text-emerald-400" /></div>
            <div><div className="text-sm font-bold text-emerald-400">{fmt(calc.lucroLiquidoAnual)}/ano</div><div className="text-[11px] text-neutral-500">Lucro líquido (receita + economia - custo)</div></div>
          </div>
        </div>

        {/* Methodology */}
        <div className="bg-white/[0.02] rounded-2xl p-5 border border-white/[0.05] mb-12">
          <h4 className="text-neutral-300 text-xs font-bold uppercase tracking-wider mb-3">Como calculamos esses números?</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-[11px] text-neutral-500 leading-relaxed">
            <div className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-emerald-500" /><span>Sem Zélla: <strong className="text-neutral-400">20% de conversão</strong> — resposta demorada perde hóspedes</span></div>
            <div className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-emerald-500" /><span>Com Zélla: <strong className="text-emerald-400">35% de conversão</strong> — resposta instantânea + PIX convertem mais</span></div>
            <div className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-blue-500" /><span>Estadia média: <strong className="text-neutral-400">2,5 noites</strong> por reserva</span></div>
            <div className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-blue-500" /><span>Economia recepcionista: <strong className="text-neutral-400">R$ 1.200/mês</strong> cobrindo madrugadas e fins de semana</span></div>
            <div className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-emerald-400" /><span>Diárias normais (90% do ano): <strong className="text-emerald-400">0% de taxa Zélla</strong> — 100% da diária no seu bolso</span></div>
            <div className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-emerald-400" /><span>Feriados & Pico de Demanda: <strong className="text-emerald-300">7% taxa de sucesso</strong> cobrada exclusivamente sobre o ganho extra de UPSELL</span></div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-neutral-500 text-sm mb-6">Estimativa baseada nos dados informados. Escolha o melhor plano e comece hoje mesmo.</p>
          <button onClick={() => { const el = document.querySelector('#precos'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }} className="inline-flex items-center gap-2 px-8 py-3.5 text-white font-bold rounded-xl transition-all duration-200 shadow-xl cursor-pointer bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-emerald-500/30">
            Ver Planos e Começar <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// AIRBNB CALCULATOR (novo — inteligente e cruzado com dados Airbnb)
// ============================================================================
function AirbnbCalculator() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [showDetails, setShowDetails] = useState(false);

  // ─── Inputs ────────────────────────────────────────────────────────
  const [numImoveis, setNumImoveis] = useState(2);
  const [diariaMedia, setDiariaMedia] = useState(280);
  const [ocupacaoMensal, setOcupacaoMensal] = useState(65); // %
  const [comissaoAirbnb, setComissaoAirbnb] = useState(15); // %
  const [contatosWhatsapp, setContatosWhatsapp] = useState(40);
  const [planoZella, setPlanoZella] = useState<'pro' | 'max'>('pro');

  const custoZella = planoZella === 'pro' ? CUSTO_ZELLA_PRO_AIRBNB : CUSTO_ZELLA_MAX_AIRBNB;
  const maxImoveis = planoZella === 'pro' ? 4 : 12;

  // ─── Cálculos ──────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const taxaOcupacao = ocupacaoMensal / 100;
    const taxaComissao = comissaoAirbnb / 100;

    // Noites reservadas por mês (por imóvel)
    const noitesPorImovel = Math.round(30 * taxaOcupacao);
    const noitesTotais = noitesPorImovel * numImoveis;

    // Receita bruta via Airbnb
    const receitaBrutaAirbnb = noitesTotais * diariaMedia;

    // Comissão Airbnb (sobre todas as reservas via plataforma)
    const comissaoPaga = receitaBrutaAirbnb * taxaComissao;

    // Receita líquida Airbnb (sem Zélla)
    const receitaLiquidaAirbnb = receitaBrutaAirbnb - comissaoPaga;

    // ── Com o Zélla ──
    // 1. Conversão WhatsApp: mais contatos viram reservas
    const reservasAdicionaisSem = Math.round(contatosWhatsapp * CONVERSAO_SEM_ZELLA_AIRBNB);
    const reservasAdicionaisCom = Math.round(contatosWhatsapp * CONVERSAO_COM_ZELLA_AIRBNB);
    const reservasAMais = reservasAdicionaisCom - reservasAdicionaisSem;

    // 2. Receita das reservas adicionais (pelo WhatsApp = direta, sem comissão)
    const receitaReservasAdicionais = reservasAMais * diariaMedia * ESTADIA_MEDIA_AIRBNB;

    // 3. Reservas diretas via Zélla (sem comissão Airbnb) — das reservas que já viriam pelo Airbnb
    const reservasDiretasZella = Math.round(noitesTotais / ESTADIA_MEDIA_AIRBNB * TAXA_RESERVA_DIRETA);
    const economiaComissaoDireta = reservasDiretasZella * diariaMedia * ESTADIA_MEDIA_AIRBNB * taxaComissao;

    // 4. Economia automação (cobrir madrugadas/fins de semana)
    const economiaAutomacao = ECONOMIA_AUTOMACAO_AIRBNB;

    // 5. Total de ganhos com Zélla
    const ganhoTotalMensal = receitaReservasAdicionais + economiaComissaoDireta + economiaAutomacao;

    // 6. Custo-benefício
    const lucroLiquidoMensal = ganhoTotalMensal - custoZella;
    const lucroLiquidoAnual = lucroLiquidoMensal * 12;
    const custoZellaAnual = custoZella * 12;
    const roiPercent = custoZellaAnual > 0
      ? Math.round(((lucroLiquidoAnual) / custoZellaAnual) * 100)
      : 0;

    // Receita direta mensal (sem comissão de OTA)
    const receitaDiretaMensal = reservasDiretasZella * diariaMedia * ESTADIA_MEDIA_AIRBNB;

    return {
      noitesPorImovel,
      noitesTotais,
      receitaBrutaAirbnb,
      comissaoPaga,
      receitaLiquidaAirbnb,
      reservasAdicionaisSem,
      reservasAdicionaisCom,
      reservasAMais,
      receitaReservasAdicionais,
      reservasDiretasZella,
      economiaComissaoDireta,
      economiaAutomacao,
      ganhoTotalMensal,
      lucroLiquidoMensal,
      lucroLiquidoAnual,
      custoZellaAnual,
      roiPercent,
      receitaDiretaMensal,
      taxaComissao,
    };
  }, [numImoveis, diariaMedia, ocupacaoMensal, comissaoAirbnb, contatosWhatsapp, custoZella]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: 0.15 }}
      className="relative rounded-3xl bg-[#111] border border-white/[0.06] p-8 sm:p-12 overflow-hidden"
    >
      {/* Background glows */}
      <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-[100px] bg-blue-500/[0.07]" />
      <div className="absolute bottom-0 left-0 w-56 h-56 bg-rose-500/[0.05] rounded-full blur-[80px]" />

      <div className="relative z-10">
        {/* ===== PLAN SELECTOR ===== */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={() => setPlanoZella('pro')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
              planoZella === 'pro'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                : 'bg-white/[0.04] text-neutral-400 border border-white/[0.06] hover:bg-white/[0.08]'
            }`}
          >
            PRO — R$ 197/mês
          </button>
          <button
            onClick={() => setPlanoZella('max')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
              planoZella === 'max'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                : 'bg-white/[0.04] text-neutral-400 border border-white/[0.06] hover:bg-white/[0.08]'
            }`}
          >
            MAX — R$ 397/mês
          </button>
        </div>

        {/* ===== INPUTS ===== */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Input 1: Número de imóveis */}
            <div className="space-y-3">
              <label className="block text-neutral-300 text-sm font-medium">
                <Home className="w-3.5 h-3.5 inline mr-1.5 text-blue-400" />
                Quantos imóveis você gerencia?
              </label>
              <div className="flex items-center gap-3">
                <button onClick={() => setNumImoveis(Math.max(1, numImoveis - 1))} className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-bold text-xl hover:bg-white/[0.1] transition-all cursor-pointer active:scale-95">-</button>
                <div className="flex-1 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                  <span className="text-3xl font-extrabold text-white">{numImoveis}</span>
                </div>
                <button onClick={() => setNumImoveis(Math.min(maxImoveis, numImoveis + 1))} className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-bold text-xl hover:bg-white/[0.1] transition-all cursor-pointer active:scale-95">+</button>
              </div>
              <p className="text-neutral-500 text-[11px]">Plano {planoZella.toUpperCase()}: até {maxImoveis} imóveis</p>
            </div>

            {/* Input 2: Diária média */}
            <div className="space-y-3">
              <label className="block text-neutral-300 text-sm font-medium">
                <BadgeDollarSign className="w-3.5 h-3.5 inline mr-1.5 text-emerald-400" />
                Diária média por imóvel
              </label>
              <div className="flex items-center gap-3">
                <button onClick={() => setDiariaMedia(Math.max(80, diariaMedia - 20))} className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-bold text-xl hover:bg-white/[0.1] transition-all cursor-pointer active:scale-95">-</button>
                <div className="flex-1 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">R$ {diariaMedia.toLocaleString('pt-BR')}</span>
                </div>
                <button onClick={() => setDiariaMedia(Math.min(3000, diariaMedia + 20))} className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-bold text-xl hover:bg-white/[0.1] transition-all cursor-pointer active:scale-95">+</button>
              </div>
              <p className="text-neutral-500 text-[11px]">Média das diárias de todos os imóveis</p>
            </div>

            {/* Input 3: Ocupação mensal */}
            <div className="space-y-3">
              <label className="block text-neutral-300 text-sm font-medium">
                <BarChart3 className="w-3.5 h-3.5 inline mr-1.5 text-amber-400" />
                Taxa de ocupação mensal
              </label>
              <div className="flex items-center gap-3">
                <button onClick={() => setOcupacaoMensal(Math.max(10, ocupacaoMensal - 5))} className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-bold text-xl hover:bg-white/[0.1] transition-all cursor-pointer active:scale-95">-</button>
                <div className="flex-1 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                  <span className="text-3xl font-extrabold text-white">{ocupacaoMensal}%</span>
                </div>
                <button onClick={() => setOcupacaoMensal(Math.min(100, ocupacaoMensal + 5))} className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-bold text-xl hover:bg-white/[0.1] transition-all cursor-pointer active:scale-95">+</button>
              </div>
              <p className="text-neutral-500 text-[11px]">% de noites reservadas por mês</p>
            </div>

            {/* Input 4: Comissão Airbnb */}
            <div className="space-y-3">
              <label className="block text-neutral-300 text-sm font-medium">
                <Percent className="w-3.5 h-3.5 inline mr-1.5 text-rose-400" />
                Comissão Airbnb
              </label>
              <div className="flex items-center gap-3">
                <button onClick={() => setComissaoAirbnb(Math.max(3, comissaoAirbnb - 1))} className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-bold text-xl hover:bg-white/[0.1] transition-all cursor-pointer active:scale-95">-</button>
                <div className="flex-1 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                  <span className="text-3xl font-extrabold text-white">{comissaoAirbnb}%</span>
                </div>
                <button onClick={() => setComissaoAirbnb(Math.min(25, comissaoAirbnb + 1))} className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-bold text-xl hover:bg-white/[0.1] transition-all cursor-pointer active:scale-95">+</button>
              </div>
              <p className="text-neutral-500 text-[11px]">Padrão Airbnb: 15% (3% processamento + 12% serviço)</p>
            </div>

            {/* Input 5: Contatos WhatsApp */}
            <div className="space-y-3">
              <label className="block text-neutral-300 text-sm font-medium">
                <MessageSquare className="w-3.5 h-3.5 inline mr-1.5 text-green-400" />
                Contatos WhatsApp por mês
              </label>
              <div className="flex items-center gap-3">
                <button onClick={() => setContatosWhatsapp(Math.max(5, contatosWhatsapp - 5))} className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-bold text-xl hover:bg-white/[0.1] transition-all cursor-pointer active:scale-95">-</button>
                <div className="flex-1 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                  <span className="text-3xl font-extrabold text-white">{contatosWhatsapp}</span>
                </div>
                <button onClick={() => setContatosWhatsapp(Math.min(200, contatosWhatsapp + 5))} className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-bold text-xl hover:bg-white/[0.1] transition-all cursor-pointer active:scale-95">+</button>
              </div>
              <p className="text-neutral-500 text-[11px]">Perguntas sobre disponibilidade e reservas</p>
            </div>

            {/* Summary card — current Airbnb scenario */}
            <div className="space-y-3">
              <label className="block text-neutral-300 text-sm font-medium">
                <Building2 className="w-3.5 h-3.5 inline mr-1.5 text-neutral-400" />
                Seu cenário hoje (Airbnb)
              </label>
              <div className="h-12 rounded-xl bg-rose-500/[0.06] border border-rose-500/15 flex items-center justify-center px-4">
                <span className="text-xs text-rose-300 font-medium text-center">
                  {calc.noitesTotais} noites/mês → {fmt(calc.receitaBrutaAirbnb)} bruto → <strong className="text-rose-400">{fmt(calc.comissaoPaga)}</strong> de comissão
                </span>
              </div>
              <p className="text-neutral-500 text-[11px]">Você paga {fmt(calc.comissaoPaga)}/mês só em comissão Airbnb</p>
            </div>
          </div>
        </div>

        {/* ===== RESULTADOS PRINCIPAIS ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {/* Reservas adicionais */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="text-center p-6 rounded-2xl bg-blue-500/[0.06] border border-blue-500/15"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-400">+{calc.reservasAMais}</div>
            <div className="text-neutral-500 text-xs mt-1">reservas diretas/mês</div>
          </motion.div>

          {/* Economia comissão */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3 }}
            className="text-center p-6 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/15"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <PiggyBank className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">{fmt(calc.economiaComissaoDireta + calc.receitaReservasAdicionais)}</div>
            <div className="text-neutral-500 text-xs mt-1">ganho extra/mês</div>
          </motion.div>

          {/* Comissão que você deixa de pagar */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.4 }}
            className="text-center p-6 rounded-2xl bg-rose-500/[0.06] border border-rose-500/15"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-400">{fmt(calc.economiaComissaoDireta)}</div>
            <div className="text-neutral-500 text-xs mt-1">comissão Airbnb economizada</div>
          </motion.div>

          {/* ROI */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.5 }}
            className="text-center p-6 rounded-2xl bg-amber-500/[0.06] border border-amber-500/15"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">{calc.roiPercent > 0 ? '+' : ''}{calc.roiPercent}%</div>
            <div className="text-neutral-500 text-xs mt-1">ROI anual</div>
          </motion.div>
        </div>

        {/* ===== COMPARAÇÃO: AIRBNB vs ZELLA ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
          {/* Sem Zélla — só Airbnb */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <span className="text-[8px] font-bold text-rose-400">A</span>
              </div>
              <span className="text-neutral-400 text-sm font-semibold">Só pelo Airbnb</span>
              <span className="ml-auto text-[10px] text-neutral-600 bg-white/[0.04] px-2 py-0.5 rounded-full">{comissaoAirbnb}% comissão</span>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between"><span className="text-neutral-500">Noites reservadas/mês</span><span className="text-neutral-300 font-semibold">{calc.noitesTotais}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Receita bruta</span><span className="text-neutral-300 font-semibold">{fmt(calc.receitaBrutaAirbnb)}</span></div>
              <div className="flex justify-between border-t border-white/[0.04] pt-2"><span className="text-rose-400 font-medium">− Comissão Airbnb</span><span className="text-rose-400 font-bold">{fmt(calc.comissaoPaga)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Receita líquida</span><span className="text-neutral-300 font-bold">{fmt(calc.receitaLiquidaAirbnb)}</span></div>
              <div className="flex justify-between border-t border-white/[0.04] pt-2"><span className="text-neutral-500">Contatos WhatsApp sem resposta</span><span className="text-red-400/80 font-medium">Perde reservas à noite</span></div>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-500" style={{ width: `${(1 - calc.taxaComissao) * 100}%` }} />
            </div>
            <p className="text-[9px] text-neutral-600 mt-1.5 text-right">{fmtPct((1 - calc.taxaComissao) * 100)} fica com você</p>
          </div>

          {/* Com Zélla */}
          <div className="p-6 rounded-2xl bg-blue-500/[0.04] border border-blue-500/15">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-blue-400">Com o Zélla</span>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full text-blue-500 bg-blue-500/10 border border-blue-500/20">0% comissão direta</span>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between"><span className="text-neutral-500">Receita líquida Airbnb</span><span className="text-neutral-300 font-semibold">{fmt(calc.receitaLiquidaAirbnb)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">+ Reservas diretas (sem comissão)</span><span className="text-blue-300 font-bold">+{calc.reservasAMais} reservas</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">+ Receita reservas diretas</span><span className="text-blue-300 font-bold">{fmt(calc.receitaReservasAdicionais)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">+ Economia comissão (reservas diretas)</span><span className="text-emerald-300 font-bold">{fmt(calc.economiaComissaoDireta)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">+ Economia automação noturna</span><span className="text-indigo-300 font-bold">{fmt(calc.economiaAutomacao)}</span></div>
              <div className="flex justify-between border-t border-blue-500/20 pt-2"><span className="text-blue-400 font-medium">− Custo Zélla {planoZella.toUpperCase()}</span><span className="text-blue-400 font-bold">{fmt(custoZella)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-300 font-semibold">Lucro líquido mensal</span><span className={`font-bold ${calc.lucroLiquidoMensal > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(calc.lucroLiquidoMensal)}</span></div>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500" style={{ width: '100%' }} />
            </div>
            <p className="text-[9px] text-blue-400 mt-1.5 text-right">100% das reservas diretas fica com você</p>
          </div>
        </div>

        {/* ===== BREAKDOWN DETALHADO ===== */}
        <div className="mb-10">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-neutral-400 text-sm font-medium hover:text-neutral-200 transition-colors mx-auto"
          >
            <Info className="w-4 h-4" />
            {showDetails ? 'Ocultar' : 'Ver'} detalhamento completo dos cálculos
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="mt-6 bg-white/[0.02] rounded-2xl p-6 border border-white/[0.05]">
                  <h4 className="text-white text-sm font-bold mb-4">📊 Conta detalhada — baseada nos seus dados</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-3">
                      <h5 className="text-blue-400 font-bold uppercase tracking-wider text-[10px]">Receita Airbnb atual</h5>
                      <div className="space-y-1.5 text-neutral-400">
                        <div className="flex justify-between"><span>{numImoveis} imóveis × {calc.noitesPorImovel} noites × R$ {diariaMedia.toLocaleString('pt-BR')}</span><span className="text-neutral-300">{fmt(calc.receitaBrutaAirbnb)}</span></div>
                        <div className="flex justify-between"><span>− Comissão Airbnb ({comissaoAirbnb}%)</span><span className="text-rose-400">−{fmt(calc.comissaoPaga)}</span></div>
                        <div className="flex justify-between font-bold border-t border-white/[0.06] pt-1"><span className="text-neutral-300">Receita líquida Airbnb</span><span className="text-white">{fmt(calc.receitaLiquidaAirbnb)}/mês</span></div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h5 className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">Ganhos com Zélla</h5>
                      <div className="space-y-1.5 text-neutral-400">
                        <div className="flex justify-between"><span>+{calc.reservasAMais} reservas diretas × R$ {diariaMedia.toLocaleString('pt-BR')} × {ESTADIA_MEDIA_AIRBNB} noites</span><span className="text-emerald-300">{fmt(calc.receitaReservasAdicionais)}</span></div>
                        <div className="flex justify-between"><span>Economia comissão ({calc.reservasDiretasZella} reservas diretas)</span><span className="text-emerald-300">{fmt(calc.economiaComissaoDireta)}</span></div>
                        <div className="flex justify-between"><span>Economia automação noturna/fim de semana</span><span className="text-indigo-300">{fmt(calc.economiaAutomacao)}</span></div>
                        <div className="flex justify-between"><span>− Custo Zélla {planoZella.toUpperCase()}</span><span className="text-blue-400">−{fmt(custoZella)}</span></div>
                        <div className="flex justify-between font-bold border-t border-white/[0.06] pt-1"><span className="text-neutral-300">Lucro líquido mensal</span><span className={calc.lucroLiquidoMensal > 0 ? 'text-emerald-400' : 'text-rose-400'}>{fmt(calc.lucroLiquidoMensal)}/mês</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/[0.06] text-center">
                    <p className="text-neutral-500 text-[11px]">
                      ROI anual: <strong className={calc.roiPercent > 0 ? 'text-emerald-400' : 'text-rose-400'}>{calc.roiPercent > 0 ? '+' : ''}{calc.roiPercent}%</strong> —
                      Você investe {fmt(custoZella)}/mês e ganha {fmt(calc.ganhoTotalMensal)}/mês em receita adicional + economia.
                      {calc.lucroLiquidoMensal > 0 && (
                        <span className="text-emerald-400 font-medium"> O Zélla se paga sozinho e ainda sobra {fmt(calc.lucroLiquidoMensal)}/mês.</span>
                      )}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ===== FINANCIAL SUMMARY ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          <div className="flex items-center gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5 text-rose-400" /></div>
            <div><div className="text-sm font-bold text-white">{fmt(calc.comissaoPaga)}/mês</div><div className="text-[11px] text-neutral-500">Comissão Airbnb que você paga</div></div>
          </div>
          <div className="flex items-center gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0"><Wallet className="w-5 h-5 text-neutral-400" /></div>
            <div><div className="text-sm font-bold text-white">{fmt(custoZella)}/mês</div><div className="text-[11px] text-neutral-500">Investimento no plano {planoZella.toUpperCase()}</div></div>
          </div>
          <div className="flex items-center gap-4 p-5 rounded-xl bg-blue-500/[0.06] border border-blue-500/15">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0"><TrendingUp className="w-5 h-5 text-blue-400" /></div>
            <div><div className={`text-sm font-bold ${calc.lucroLiquidoAnual > 0 ? 'text-blue-400' : 'text-rose-400'}`}>{fmt(calc.lucroLiquidoAnual)}/ano</div><div className="text-[11px] text-neutral-500">Lucro líquido anual</div></div>
          </div>
        </div>

        {/* ===== KEY INSIGHT ===== */}
        <div className="bg-gradient-to-r from-blue-500/[0.08] to-emerald-500/[0.05] rounded-2xl p-6 border border-blue-500/15 mb-10">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm mb-1">A conta que importa</h4>
              <p className="text-neutral-300 text-xs leading-relaxed">
                Hoje você paga <strong className="text-rose-400">{fmt(calc.comissaoPaga)}/mês</strong> de comissão ao Airbnb.
                Com o Zélla, <strong className="text-emerald-400">{fmt(calc.economiaComissaoDireta)}/mês</strong> dessas reservas passam a ser diretas (0% comissão).
                Só a economia de comissão {calc.economiaComissaoDireta > custoZella ? <strong className="text-emerald-400">já paga o plano {planoZella.toUpperCase()}</strong> : 'ajuda a pagar o plano'}.
                {calc.reservasAMais > 0 && ` E ainda ganha +${calc.reservasAMais} reservas/mês que antes perderia por não responder a tempo.`}
              </p>
            </div>
          </div>
        </div>

        {/* ===== METODOLOGIA ===== */}
        <div className="bg-white/[0.02] rounded-2xl p-5 border border-white/[0.05] mb-12">
          <h4 className="text-neutral-300 text-xs font-bold uppercase tracking-wider mb-3">Como calculamos esses números?</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-[11px] text-neutral-500 leading-relaxed">
            <div className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-blue-500" /><span>Conversão sem Zélla: <strong className="text-neutral-400">18%</strong> — anfitrião demora a responder, hóspede vai para outro</span></div>
            <div className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-blue-500" /><span>Conversão com Zélla: <strong className="text-blue-400">32%</strong> — resposta instantânea 24/7 + PIX direto convertem mais</span></div>
            <div className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-emerald-500" /><span>Reservas diretas: <strong className="text-emerald-400">25%</strong> das reservas via Zélla são diretas (sem comissão Airbnb)</span></div>
            <div className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-rose-500" /><span>Comissão Airbnb: padrão <strong className="text-neutral-400">15%</strong> (3% processamento + 12% taxa de serviço)</span></div>
            <div className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-amber-500" /><span>Estadia média: <strong className="text-neutral-400">3,2 noites</strong> por reserva Airbnb (média Brasil)</span></div>
            <div className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-indigo-500" /><span>Economia automação: <strong className="text-neutral-400">R$ 950/mês</strong> atendendo automaticamente madrugadas e fins de semana</span></div>
          </div>
        </div>

        {/* ===== CTA ===== */}
        <div className="text-center">
          <p className="text-neutral-500 text-sm mb-6">Estimativa baseada nos dados informados. Escolha seu plano e comprove na prática.</p>
          <button
            onClick={() => { const el = document.querySelector('#precos'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
            className="inline-flex items-center gap-2 px-8 py-3.5 text-white font-bold rounded-xl transition-all duration-200 shadow-xl cursor-pointer bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 shadow-blue-500/30"
          >
            Assinar agora <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN EXPORT — switches between Pousada and Airbnb calculators
// ============================================================================
export function SavingsCalculator() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const { isPousada } = useNiche();

  return (
    <section ref={ref} id="calculadora" className="py-28 sm:py-36 lg:py-44 bg-[#060608]">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-6 ${
            isPousada
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-blue-500/10 border-blue-500/20'
          }`}>
            <Calculator className={`w-3.5 h-3.5 ${isPousada ? 'text-emerald-400' : 'text-blue-400'}`} />
            <span className={`text-xs font-medium ${isPousada ? 'text-emerald-400' : 'text-blue-400'}`}>
              Simulador de Resultados
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
            {isPousada ? 'Quanto sua pousada' : 'Quanto seus imóveis'}{' '}
            <span className={`font-bold ${isPousada ? 'text-emerald-400' : 'text-blue-400'}`}>ganha com o Zélla?</span>
          </h2>
          <p className="text-neutral-400 text-lg sm:text-xl max-w-2xl mx-auto">
            {isPousada
              ? 'Insira os dados reais da sua operação e veja o impacto no seu faturamento'
              : 'Insira os dados da sua operação Airbnb e veja quanto economiza em comissões e ganha em reservas diretas'
            }
          </p>
        </motion.div>

        {/* Calculator */}
        <AnimatePresence mode="wait">
          {isPousada ? (
            <motion.div key="pousada-calc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <PousadaCalculator />
            </motion.div>
          ) : (
            <motion.div key="airbnb-calc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <AirbnbCalculator />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
