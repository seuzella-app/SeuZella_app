'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  DollarSign,
  CheckCircle2,
  MessageSquare,
  Calendar,
  Zap,
  ShieldCheck,
  Sparkles,
  MousePointer2,
  Users,
  ArrowUpRight,
  PieChart,
  Bell,
  SlidersHorizontal,
  ChevronRight,
  QrCode,
  Smartphone,
  Star,
} from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';

export function DDCHeroPreview() {
  const { niche, isPousada } = useNiche();
  const [activeTab, setActiveTab] = useState<'overview' | 'pix' | 'whatsapp' | 'finance'>('overview');
  const [isAutoCursorActive, setIsAutoCursorActive] = useState(true);
  const [cursorTarget, setCursorTarget] = useState({ x: '20%', y: '18%', clicking: false });

  // Auto-rotating tabs with simulated cursor movement
  useEffect(() => {
    if (!isAutoCursorActive) return;

    const sequence = [
      { tab: 'overview' as const, pos: { x: '18%', y: '16%' } },
      { tab: 'pix' as const, pos: { x: '42%', y: '16%' } },
      { tab: 'whatsapp' as const, pos: { x: '66%', y: '16%' } },
      { tab: 'finance' as const, pos: { x: '88%', y: '16%' } },
    ];

    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % sequence.length;
      const nextStep = sequence[idx];

      // Move cursor first
      setCursorTarget({ x: nextStep.pos.x, y: nextStep.pos.y, clicking: true });

      // Trigger click & tab change slightly after movement
      setTimeout(() => {
        setActiveTab(nextStep.tab);
        setCursorTarget((prev) => ({ ...prev, clicking: false }));
      }, 400);
    }, 4500);

    return () => clearInterval(interval);
  }, [isAutoCursorActive]);

  const handleTabClick = (tab: 'overview' | 'pix' | 'whatsapp' | 'finance') => {
    setIsAutoCursorActive(false); // Pause auto animation if user manually clicks
    setActiveTab(tab);
  };

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-zinc-950/95 via-zinc-900/90 to-black/95 p-4 sm:p-7 shadow-[0_0_50px_rgba(16,185,129,0.15)] backdrop-blur-2xl text-left relative overflow-hidden my-8 select-none">
      {/* Top Hairline Glow Line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(16,185,129,0.8)]" />

      {/* Background ambient lighting */}
      <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-teal-500/10 blur-[100px] pointer-events-none" />

      {/* ── DDC HEADER BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 mb-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 p-[1px] shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full rounded-[11px] bg-zinc-950 flex items-center justify-center font-black text-emerald-400 text-sm tracking-widest font-mono">
              DDC
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                {isPousada ? 'Pousada Recanto Baiano — Itacaré, BA' : 'Flat Copacabana Premium — RJ'}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                DDC AO VIVO
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 flex items-center gap-3 mt-0.5 font-medium">
              <span>IA Zélla: <strong className="text-emerald-400">Ativa 24/7</strong></span>
              <span>•</span>
              <span>Comissão OTA: <strong className="text-emerald-400">0%</strong></span>
              <span>•</span>
              <span>WhatsApp Meta: <strong className="text-emerald-400">82% economia</strong></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-zinc-300">
            <Bell className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
            <span>3 novas reservas diretas hoje!</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400">
            DDC Pro 2026
          </div>
        </div>
      </div>

      {/* ── KPI METRICS CARDS GRID ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {/* Metric 1 */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span>Faturamento no Mês</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-white font-mono tracking-tight">
            R$ 48.920<span className="text-xs text-zinc-400 font-normal">,00</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
            <TrendingUp className="w-3 h-3" />
            <span>+42% em reservas diretas</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span>Reservas via PIX Direct</span>
            <QrCode className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-white font-mono tracking-tight">
            38 reservas
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-teal-300 font-semibold">
            <CheckCircle2 className="w-3 h-3 text-teal-400" />
            <span>R$ 0,00 pago de comissão</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span>Economia WhatsApp Meta</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-300 font-mono tracking-tight">
            -82% em custos
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold">
            <ShieldCheck className="w-3 h-3" />
            <span>Mensagens agrupadas</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span>Ocupação Fim de Semana</span>
            <Calendar className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-white font-mono tracking-tight">
            96% ocupado
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-indigo-300 font-semibold">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Preço Inteligente Ativo</span>
          </div>
        </div>
      </div>

      {/* ── DDC OPERATIONAL CONTROL TABS ── */}
      <div className="flex items-center gap-1 sm:gap-2 p-1 rounded-2xl bg-zinc-950 border border-white/10 mb-5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => handleTabClick('overview')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Visão Geral & Ocupação</span>
        </button>

        <button
          onClick={() => handleTabClick('pix')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap cursor-pointer ${
            activeTab === 'pix'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>Reservas PIX Direct</span>
        </button>

        <button
          onClick={() => handleTabClick('whatsapp')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap cursor-pointer ${
            activeTab === 'whatsapp'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>IA WhatsApp 24/7</span>
        </button>

        <button
          onClick={() => handleTabClick('finance')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap cursor-pointer ${
            activeTab === 'finance'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <PieChart className="w-3.5 h-3.5" />
          <span>Controle Financeiro</span>
        </button>
      </div>

      {/* ── DDC ACTIVE VIEW CONTENT PANELS ── */}
      <div className="min-h-[260px] rounded-2xl bg-zinc-950/80 border border-white/10 p-4 sm:p-5 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {/* TAB 1: VISÃO GERAL */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <h4 className="text-xs font-bold text-white tracking-wide">
                    Painel Operacional em Tempo Real
                  </h4>
                </div>
                <span className="text-[11px] text-zinc-400 font-mono">
                  Sincronização: Hoje, 10:30
                </span>
              </div>

              {/* Guest Reservation Cards */}
              <div className="space-y-2.5">
                {[
                  {
                    guest: 'Ricardo & Família',
                    dates: '30 Jul - 02 Ago (3 diárias)',
                    suite: isPousada ? 'Suíte Master Ocean' : 'Flat Copacabana #302',
                    val: 'R$ 1.680,00',
                    status: 'PIX Confirmado',
                    statusColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                    channel: 'WhatsApp Direto (0% taxa)',
                  },
                  {
                    guest: 'Carolina Mendes',
                    dates: '04 Ago - 07 Ago (3 diárias)',
                    suite: isPousada ? 'Bangalô Vista Jardim' : 'Studio Vista Mar',
                    val: 'R$ 1.450,00',
                    status: 'Guia Digital Enviado',
                    statusColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
                    channel: 'WhatsApp Direto (0% taxa)',
                  },
                  {
                    guest: 'Lucas Silveira',
                    dates: '08 Ago - 10 Ago (2 diárias)',
                    suite: isPousada ? 'Chalé da Montanha' : 'Apartamento Luxo',
                    val: 'R$ 980,00',
                    status: 'Preço Inteligente (+25%)',
                    statusColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                    channel: 'WhatsApp Direto',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-white/5 hover:border-emerald-500/30 transition-colors gap-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 text-xs">
                        {item.guest.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-bold text-white">{item.guest}</h5>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${item.statusColor}`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">{item.suite} • {item.dates}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
                      <span className="text-xs font-mono font-bold text-emerald-400">{item.val}</span>
                      <span className="text-[10px] text-zinc-400 bg-white/5 px-2 py-1 rounded-md">{item.channel}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 2: PIX DIRECT */}
          {activeTab === 'pix' && (
            <motion.div
              key="pix"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">
                    Automação de Pagamento PIX Direct
                  </h4>
                  <p className="text-[11px] text-zinc-400">O Zélla envia sua chave PIX no WhatsApp e confirma o comprovante instantaneamente</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  Zero Taxas OTA
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-zinc-900/90 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <QrCode className="w-4 h-4" />
                    <span>Chave PIX Cadastrada no DDC</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/60 font-mono text-xs text-emerald-300 border border-emerald-500/20">
                    CNPJ: 12.345.678/0001-90 (Pousada Itacaré)
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Sua conta recebe o dinheiro direto, sem passar por intermediários. Dinheiro caindo na sua conta no mesmo minuto!
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/90 border border-white/10 space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Confirmação & Guia Digital Automático</span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-zinc-300">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span> Hóspede manda o comprovante no WhatsApp
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span> Zélla valida e marca a data no DDC
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span> Envia Guia Digital com senha do Wi-Fi e dicas locais
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: IA WHATSAPP 24/7 */}
          {activeTab === 'whatsapp' && (
            <motion.div
              key="whatsapp"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">
                    Assistente IA WhatsApp 24/7 com Economia Meta
                  </h4>
                  <p className="text-[11px] text-zinc-400">Resposta rápida em até 8 segundos no tom da sua hospedagem</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                  Agrupamento Inteligente 82%
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Balão Único Consolidado
                  </span>
                  <span className="text-[10px] text-zinc-400">Economia no custo por mensagem Meta API</span>
                </div>
                <p className="text-xs text-zinc-200 bg-black/40 p-3 rounded-lg border border-white/5 font-sans leading-relaxed">
                  "Olá! Temos sim disponibilidade para o próximo fim de semana! Nossas suítes com vista para o mar saem a R$ 420/noite com café da manhã completo. Aceitamos PIX direto sem taxas extras! Para confirmar sua reserva agora, utilize a chave PIX CNPJ 12.345.678/0001-90. Quer que eu segure sua vaga?"
                </p>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                  <span>✨ 4 perguntas respondidas em 1 único balão</span>
                  <span className="text-emerald-400 font-semibold">Tempo de resposta: 4 segundos</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: CONTROLE FINANCEIRO */}
          {activeTab === 'finance' && (
            <motion.div
              key="finance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">
                    Relatório de Lucratividade & Preços Inteligentes
                  </h4>
                  <p className="text-[11px] text-zinc-400">Comparativo entre Reservas Diretas no Zélla vs Comissões de OTAs</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  +R$ 7.320 economizados este mês
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                  <h5 className="text-xs font-bold text-emerald-300 mb-1">Reservas Diretas com Zélla</h5>
                  <div className="text-xl font-mono font-black text-white">R$ 41.600,00</div>
                  <p className="text-[11px] text-emerald-400 mt-1">Taxa paga para intermediários: R$ 0,00 (100% no seu bolso)</p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-white/10">
                  <h5 className="text-xs font-bold text-zinc-400 mb-1">Se fosse via OTAs (Booking / Airbnb)</h5>
                  <div className="text-xl font-mono font-black text-zinc-300">R$ 34.280,00</div>
                  <p className="text-[11px] text-rose-400 mt-1">Perdido em comissões de 15%: -R$ 7.320,00</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── SETA DO MOUSE VIVA ANIMADA (CURSOR VIVO) ── */}
      {isAutoCursorActive && (
        <motion.div
          animate={{
            x: cursorTarget.x,
            y: cursorTarget.y,
            scale: cursorTarget.clicking ? 0.85 : 1,
          }}
          transition={{
            duration: 0.8,
            ease: [0.25, 1, 0.5, 1],
          }}
          className="absolute z-50 pointer-events-none drop-shadow-[0_0_15px_rgba(16,185,129,0.8)] hidden sm:block"
          style={{ top: 0, left: 0 }}
        >
          <div className="relative">
            <MousePointer2 className="w-6 h-6 text-emerald-400 fill-emerald-400 stroke-zinc-950 stroke-2" />
            <div className="absolute top-5 left-4 px-2 py-0.5 rounded-md bg-emerald-500 text-zinc-950 font-black text-[10px] whitespace-nowrap shadow-lg">
              Navegando no DDC...
            </div>
            {cursorTarget.clicking && (
              <span className="absolute -top-1 -left-1 w-8 h-8 rounded-full bg-emerald-400/40 animate-ping" />
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
