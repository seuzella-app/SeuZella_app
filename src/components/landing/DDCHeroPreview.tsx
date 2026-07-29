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
  QrCode,
  Smartphone,
  Star,
  RefreshCw,
  Brain,
  GraduationCap,
  Globe,
  Building2,
  SlidersHorizontal,
  Lock,
  CheckCheck,
  AlertCircle,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';

type DDCTab = 'overview' | 'whatsapp' | 'pix' | 'airb' | 'training' | 'zellador';

export function DDCHeroPreview() {
  const { niche, isPousada } = useNiche();
  const [activeTab, setActiveTab] = useState<DDCTab>('overview');
  const [isAutoCursorActive, setIsAutoCursorActive] = useState(true);
  const [cursorTarget, setCursorTarget] = useState({ x: '10%', y: '16%', clicking: false });

  // ── Auto-rotating 6 real DDC tabs with simulated organic cursor movement ──
  useEffect(() => {
    if (!isAutoCursorActive) return;

    const sequence: { tab: DDCTab; pos: { x: string; y: string } }[] = [
      { tab: 'overview', pos: { x: '10%', y: '16%' } },
      { tab: 'whatsapp', pos: { x: '26%', y: '16%' } },
      { tab: 'pix', pos: { x: '42%', y: '16%' } },
      { tab: 'airb', pos: { x: '58%', y: '16%' } },
      { tab: 'training', pos: { x: '74%', y: '16%' } },
      { tab: 'zellador', pos: { x: '90%', y: '16%' } },
    ];

    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % sequence.length;
      const nextStep = sequence[idx];

      setCursorTarget({ x: nextStep.pos.x, y: nextStep.pos.y, clicking: true });

      setTimeout(() => {
        setActiveTab(nextStep.tab);
        setCursorTarget((prev) => ({ ...prev, clicking: false }));
      }, 450);
    }, 4800);

    return () => clearInterval(interval);
  }, [isAutoCursorActive]);

  const handleTabClick = (tab: DDCTab) => {
    setIsAutoCursorActive(false); // Pause auto animation if user clicks manually
    setActiveTab(tab);
  };

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-zinc-950/95 via-zinc-900/95 to-black/98 p-4 sm:p-7 shadow-[0_0_60px_rgba(16,185,129,0.18)] backdrop-blur-2xl text-left relative overflow-hidden my-8 select-none">
      {/* Metallic Top Edge Line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_rgba(16,185,129,0.9)]" />

      {/* Subtle Background Glow Orbs */}
      <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-emerald-500/10 blur-[110px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-teal-500/10 blur-[110px] pointer-events-none" />

      {/* ── HEADER DDC ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 mb-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600 p-[1px] shadow-lg shadow-emerald-500/30">
            <div className="w-full h-full rounded-[11px] bg-zinc-950 flex items-center justify-center font-black text-emerald-400 text-xs tracking-widest font-mono">
              DDC
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                {isPousada ? 'Pousada Recanto Baiano — Itacaré, BA' : 'Flat Copacabana Premium — RJ'}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                DDC OPERACIONAL AO VIVO
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-2 sm:gap-3 mt-0.5 font-medium">
              <span>Cérebro Zélla: <strong className="text-emerald-400">Ativo 24/7</strong></span>
              <span>•</span>
              <span>Comissão OTAs: <strong className="text-emerald-400">0% Eliminada</strong></span>
              <span>•</span>
              <span>WhatsApp Meta: <strong className="text-emerald-400">82% economia</strong></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-zinc-300">
            <Bell className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
            <span>3 reservas diretas hoje!</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-xs font-black text-emerald-300">
            DDC Suite Pro 2026
          </div>
        </div>
      </div>

      {/* ── KPI METRICS GRID ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {/* Metric 1 */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span>Receita no Mês</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-white font-mono tracking-tight">
            R$ 48.920<span className="text-xs text-zinc-400 font-normal">,00</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold">
            <TrendingUp className="w-3 h-3" />
            <span>+42% em reservas diretas</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span>PIX Direct (Zero Taxas)</span>
            <QrCode className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-white font-mono tracking-tight">
            38 reservas
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-teal-300 font-bold">
            <CheckCircle2 className="w-3 h-3 text-teal-400" />
            <span>R$ 0,00 pago de comissão</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span>Economia Meta WhatsApp</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-300 font-mono tracking-tight">
            -82% em custos
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-400 font-bold">
            <ShieldCheck className="w-3 h-3" />
            <span>Balão único consolidado</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
            <span>Taxa de Ocupação</span>
            <Calendar className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-white font-mono tracking-tight">
            96% ocupado
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-indigo-300 font-bold">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Preço Inteligente Ativo</span>
          </div>
        </div>
      </div>

      {/* ── DDC 6 OPERATIONAL TABS ── */}
      <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-zinc-950 border border-white/10 mb-5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => handleTabClick('overview')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Visão Geral</span>
        </button>

        <button
          onClick={() => handleTabClick('whatsapp')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap cursor-pointer ${
            activeTab === 'whatsapp'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
          <span>IA WhatsApp 24/7</span>
        </button>

        <button
          onClick={() => handleTabClick('pix')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap cursor-pointer ${
            activeTab === 'pix'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <QrCode className="w-3.5 h-3.5 text-teal-400" />
          <span>PIX Direct</span>
        </button>

        <button
          onClick={() => handleTabClick('airb')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap cursor-pointer ${
            activeTab === 'airb'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
          <span>Sync OTAs (Airbnb)</span>
        </button>

        <button
          onClick={() => handleTabClick('training')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap cursor-pointer ${
            activeTab === 'training'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Brain className="w-3.5 h-3.5 text-amber-400" />
          <span>Cérebro IA</span>
        </button>

        <button
          onClick={() => handleTabClick('zellador')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap cursor-pointer ${
            activeTab === 'zellador'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Preços Inteligentes</span>
        </button>
      </div>

      {/* ── DDC ACTIVE MODULE PANELS ── */}
      <div className="min-h-[280px] rounded-2xl bg-zinc-950/90 border border-white/10 p-4 sm:p-5 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {/* TAB 1: VISÃO GERAL */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <h4 className="text-xs font-bold text-white tracking-wide">
                    Live Feed Operacional — Entradas & Check-ins
                  </h4>
                </div>
                <span className="text-[11px] text-zinc-400 font-mono">
                  Hoje • Sincronizado
                </span>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    guest: 'Ricardo & Família',
                    dates: '30 Jul - 02 Ago (3 diárias)',
                    suite: isPousada ? 'Suíte Master Ocean' : 'Flat Copacabana #302',
                    val: 'R$ 1.680,00',
                    status: 'PIX Confirmado',
                    statusColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                    channel: 'WhatsApp Direto (0% comissão)',
                  },
                  {
                    guest: 'Carolina Mendes',
                    dates: '04 Ago - 07 Ago (3 diárias)',
                    suite: isPousada ? 'Bangalô Vista Jardim' : 'Studio Vista Mar',
                    val: 'R$ 1.450,00',
                    status: 'Guia Digital Enviado',
                    statusColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
                    channel: 'WhatsApp Direto (0% comissão)',
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

          {/* TAB 2: IA WHATSAPP 24/7 & HUMAN TAKEOVER */}
          {activeTab === 'whatsapp' && (
            <motion.div
              key="whatsapp"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">
                    Atendimento IA WhatsApp 24/7 & Intervenção Humana
                  </h4>
                  <p className="text-[11px] text-zinc-400">Resposta em 4 a 8 segundos no tom da sua hospedagem + Pausa em 1 clique</p>
                </div>
                <button className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Pausar IA & Assumir
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Balão Único Consolidado (Meta API Otimizada)
                  </span>
                  <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                    -82% custo Meta 2026
                  </span>
                </div>
                <p className="text-xs text-zinc-200 bg-black/50 p-3 rounded-lg border border-white/10 font-sans leading-relaxed">
                  "Olá! Temos sim disponibilidade para o próximo feriado! Nossas suítes com vista para o mar saem a R$ 420/noite com café da manhã baiano incluso. Aceitamos PIX direto sem taxas extras! Para confirmar sua reserva agora, utilize a chave PIX CNPJ 12.345.678/0001-90. Quer que eu segure sua vaga?"
                </p>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> Resposta densa que encerra a dúvida do hóspede
                  </span>
                  <span className="text-emerald-400 font-semibold font-mono">Tempo: 4.2s</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: PIX DIRECT */}
          {activeTab === 'pix' && (
            <motion.div
              key="pix"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">
                    Automação de Pagamento PIX Direct (0% Comissão OTAs)
                  </h4>
                  <p className="text-[11px] text-zinc-400">Receba no seu banco direto sem intermediários</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  R$ 7.320 Economizados Este Mês
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-zinc-900/90 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                      <QrCode className="w-4 h-4" /> Chave PIX Cadastrada
                    </span>
                    <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded font-bold">Ativa</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/60 font-mono text-xs text-emerald-300 border border-emerald-500/20">
                    CNPJ: 12.345.678/0001-90 (Pousada Itacaré)
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Sem intermediários. Dinheiro entra na sua conta no mesmo minuto!
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/90 border border-white/10 space-y-2.5">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Disparo Automático do Guia Digital</span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-zinc-300">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span> Envia link do Wi-Fi e código de entrada
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span> Guia de praias, restaurantes e contatos
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span> Reduz em 80% chamadas na recepção
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: ZELLA AIRB & SYNC OTAS */}
          {activeTab === 'airb' && (
            <motion.div
              key="airb"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">
                    ZellaAirB & Calendar Sync (Airbnb + Booking.com + WhatsApp)
                  </h4>
                  <p className="text-[11px] text-zinc-400">Sincronização iCal bidirecional e trava de overbooking automática</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-500/30">
                  Zero Overbooking
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-white/10 text-center space-y-1">
                  <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto text-xs font-bold">
                    Ab
                  </div>
                  <h5 className="text-xs font-bold text-white">Airbnb Sync</h5>
                  <p className="text-[10px] text-emerald-400 font-semibold">🟢 Sincronizado</p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-white/10 text-center space-y-1">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto text-xs font-bold">
                    Bk
                  </div>
                  <h5 className="text-xs font-bold text-white">Booking.com Sync</h5>
                  <p className="text-[10px] text-emerald-400 font-semibold">🟢 Sincronizado</p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-center space-y-1">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto text-xs font-bold">
                    ZÉ
                  </div>
                  <h5 className="text-xs font-bold text-emerald-300">WhatsApp Direto</h5>
                  <p className="text-[10px] text-emerald-400 font-bold">⭐ 0% Comissão</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 5: TREINAMENTO DO CÉREBRO IA */}
          {activeTab === 'training' && (
            <motion.div
              key="training"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">
                    Treinamento do Cérebro IA — Personalização do Seu Negócio
                  </h4>
                  <p className="text-[11px] text-zinc-400">Importação em 1 clique do anúncio ou preenchimento guiado</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                  78% Auto-preenchido
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Brain className="w-4 h-4 text-amber-400" /> Tom de Voz do Assistente
                  </span>
                  <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Acolhedor & Solícito
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-black/40 border border-white/10 text-center text-zinc-300">
                    📌 Regras da Casa
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/10 text-center text-zinc-300">
                    🍳 Café da Manhã
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/10 text-center text-zinc-300">
                    🐾 Aceita Pets
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/10 text-center text-zinc-300">
                    🔑 Fechadura Digital
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 6: PREÇOS INTELIGENTES & ZELLADOR */}
          {activeTab === 'zellador' && (
            <motion.div
              key="zellador"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">
                    Preços Inteligentes & Co-Piloto de Receita (Yield Engine)
                  </h4>
                  <p className="text-[11px] text-zinc-400">Nunca mais alugue barato em feriados e datas disputadas</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
                  +47% Faturamento
                </span>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/60 via-zinc-900 to-zinc-950 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> Sugestão Zélla para Feriado de 7 de Setembro
                  </span>
                  <span className="text-[10px] text-indigo-300 font-mono bg-indigo-500/20 px-2 py-0.5 rounded font-bold">
                    Recomendado
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-black/50 border border-white/10 text-xs">
                  <div>
                    <span className="text-zinc-400">Diária padrão atual: </span>
                    <span className="text-zinc-300 line-through">R$ 420,00</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">Preço Inteligente Zélla:</span>
                    <span className="text-base font-mono font-black text-emerald-300">R$ 680,00</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── CURSOR VIVO ANIMADO DA SETA DO MOUSE ── */}
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
          className="absolute z-50 pointer-events-none drop-shadow-[0_0_18px_rgba(16,185,129,0.9)] hidden sm:block"
          style={{ top: 0, left: 0 }}
        >
          <div className="relative">
            <MousePointer2 className="w-6 h-6 text-emerald-400 fill-emerald-400 stroke-zinc-950 stroke-2" />
            <div className="absolute top-5 left-4 px-2 py-0.5 rounded-md bg-emerald-500 text-zinc-950 font-black text-[10px] whitespace-nowrap shadow-lg">
              Navegando no DDC...
            </div>
            {cursorTarget.clicking && (
              <span className="absolute -top-1 -left-1 w-8 h-8 rounded-full bg-emerald-400/50 animate-ping" />
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
