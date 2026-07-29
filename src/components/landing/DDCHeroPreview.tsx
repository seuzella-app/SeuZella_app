'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Brain,
  MessageSquare,
  Smartphone,
  FileText,
  Globe,
  Settings,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Sparkles,
  MousePointer2,
  ArrowUpRight,
  ArrowDownRight,
  QrCode,
  CheckCheck,
  Star,
  MapPin,
  Clock,
  Bed,
  Bot,
  ExternalLink,
  ChevronRight,
  Bell,
} from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';

type DDCSidebarTab =
  | 'financeiro'
  | 'hospedes'
  | 'cerebro'
  | 'simulador'
  | 'connection'
  | 'guia'
  | 'integracoes'
  | 'config';

export function DDCHeroPreview() {
  const { niche, isPousada } = useNiche();
  const [activeTab, setActiveTab] = useState<DDCSidebarTab>('financeiro');
  const [isAutoCursorActive, setIsAutoCursorActive] = useState(true);
  const [cursorTarget, setCursorTarget] = useState({ x: '8%', y: '12%', clicking: false });

  // ── Auto-rotating sidebar items with organic mouse cursor navigation ──
  useEffect(() => {
    if (!isAutoCursorActive) return;

    const sequence: { tab: DDCSidebarTab; pos: { x: string; y: string } }[] = [
      { tab: 'financeiro', pos: { x: '7%', y: '12%' } },
      { tab: 'hospedes', pos: { x: '7%', y: '18%' } },
      { tab: 'cerebro', pos: { x: '7%', y: '24%' } },
      { tab: 'simulador', pos: { x: '7%', y: '30%' } },
      { tab: 'guia', pos: { x: '7%', y: '42%' } },
      { tab: 'integracoes', pos: { x: '7%', y: '48%' } },
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
    }, 5200);

    return () => clearInterval(interval);
  }, [isAutoCursorActive]);

  const handleTabClick = (tab: DDCSidebarTab) => {
    setIsAutoCursorActive(false);
    setActiveTab(tab);
  };

  return (
    <div className="w-full max-w-6xl mx-auto rounded-2xl border border-emerald-500/30 bg-[#0a0a0f] text-left shadow-[0_0_60px_rgba(16,185,129,0.18)] relative overflow-hidden my-8 select-none font-sans text-white">
      {/* Top Hairline Metallic Accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_rgba(16,185,129,0.9)] z-30" />

      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* ═══════════════════════════════════════════════════════════════
            LEFT SIDEBAR — MATCHES EXACT REAL DDC POUSADA LAYOUT
           ═══════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-3 border-r border-white/10 bg-[#0d0e15] flex flex-col justify-between p-3.5 sm:p-4 z-10">
          <div>
            {/* Header Brand */}
            <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-white/10">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-black text-emerald-400 text-xs">
                SZ
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-tight">Seu Zélla</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-mono">
                    CENTRAL DE CONTROLE
                  </span>
                  <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                    GRATUITO
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1 text-xs">
              {[
                { id: 'financeiro' as const, label: 'Visão Financeira', icon: LayoutDashboard },
                { id: 'hospedes' as const, label: 'Controle de Hóspedes', icon: Users },
                { id: 'cerebro' as const, label: 'Cérebro da Pousada', icon: Brain },
                { id: 'simulador' as const, label: 'Simulador Zélla', icon: MessageSquare },
                { id: 'connection' as const, label: 'Connection Center', icon: Smartphone },
                { id: 'guia' as const, label: 'Guia Digital', icon: FileText },
                { id: 'integracoes' as const, label: 'Integrações', icon: Globe },
                { id: 'config' as const, label: 'Configurações', icon: Settings },
              ].map((item) => {
                const IconComp = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-bold shadow-md shadow-emerald-500/10'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <IconComp className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User Footer Profile */}
          <div className="pt-3 mt-4 border-t border-white/10 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-400">
              ZA
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[11px] font-bold text-white truncate">ZCC Admin</h4>
              <p className="text-[10px] text-zinc-400 truncate">
                {isPousada ? 'Pousada Serenity Paraty' : 'Flat Copacabana RJ'}
              </p>
            </div>
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-white/10 font-mono">
              GRATUITO
            </span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            MAIN OPERATIONAL AREA — MATCHES EXACT REAL DDC POUSADA
           ═══════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-9 p-4 sm:p-6 bg-[#0a0a0f] space-y-5">
          {/* Top Bar Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                {isPousada ? 'Pousada Serenity Paraty' : 'Flat Copacabana Premium'}
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase font-mono">
                  {isPousada ? 'POUSADA' : 'AIRBNB'}
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-white/10 font-mono">
                  GRATUITO
                </span>
              </h2>
            </div>

            {/* Status Pill matching the screenshot */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>ZÉLLA ATIVO • Resposta em 0.6s • 80% Economia WhatsApp • Booking.com Sincronizado</span>
            </div>

            <div className="hidden xl:flex items-center gap-2">
              <span className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-zinc-300 font-medium">
                Painel ZCC
              </span>
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center">
                ZA
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* ── TAB 1: VISÃO FINANCEIRA (EXACT MATCH TO USER SCREENSHOT) ── */}
            {activeTab === 'financeiro' && (
              <motion.div
                key="financeiro"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Property Header Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-3 relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-white">
                            {isPousada ? 'Pousada Serenity Paraty' : 'Flat Copacabana Premium'}
                          </h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            Lido pelo Scanner
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          {isPousada
                            ? 'Pousada encantadora no centro histórico de Paraty com vista para a baía.'
                            : 'Studio moderno a 2 quadras da praia de Copacabana com fechadura inteligente.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Specs & Tags */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300 pt-1">
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5">
                      <MapPin className="w-3 h-3 text-emerald-400" /> {isPousada ? 'Paraty, RJ' : 'Rio de Janeiro, RJ'}
                    </span>
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5">
                      <Clock className="w-3 h-3 text-emerald-400" /> Check-In 14:00 / Check-out 12:00
                    </span>
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5">
                      <Bed className="w-3 h-3 text-emerald-400" /> {isPousada ? '12 quartos' : '1 imóvel'}
                    </span>
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5">
                      <Bot className="w-3 h-3 text-emerald-400" /> Acolhedor e profissional
                    </span>
                  </div>

                  {/* Amenities Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {['Wi-Fi', 'Café da manhã', 'Piscina', 'Estacionamento', 'Ar-condicionado', 'Vista mar'].map((a, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 4 Real Metrics Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* MRR Estimado */}
                  <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase font-mono font-bold">MRR ESTIMADO</span>
                    <div className="text-lg sm:text-xl font-mono font-black text-white">R$ 315.000,00</div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                      <ArrowUpRight className="w-3 h-3" /> +12.5% vs mês anterior
                    </div>
                  </div>

                  {/* Taxa de Conversão */}
                  <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase font-mono font-bold">TAXA DE CONVERSÃO</span>
                    <div className="text-lg sm:text-xl font-mono font-black text-white">34.7%</div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                      <ArrowUpRight className="w-3 h-3" /> Contatos → Reservas
                    </div>
                  </div>

                  {/* Hóspedes Ativos */}
                  <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase font-mono font-bold">HÓSPEDES ATIVOS</span>
                    <div className="text-lg sm:text-xl font-mono font-black text-white">10</div>
                    <div className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
                      <Users className="w-3 h-3" /> 5 confirmados
                    </div>
                  </div>

                  {/* Ticket Médio */}
                  <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase font-mono font-bold">TICKET MÉDIO</span>
                    <div className="text-lg sm:text-xl font-mono font-black text-white">R$ 1.229</div>
                    <div className="flex items-center gap-1 text-[10px] text-rose-400 font-semibold">
                      <ArrowDownRight className="w-3 h-3" /> -3.2% vs mês anterior
                    </div>
                  </div>
                </div>

                {/* Bottom Row Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Revenue Line Chart */}
                  <div className="lg:col-span-8 p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">Receita dos Últimos 30 Dias</h4>
                        <p className="text-[10px] text-zinc-400">Evolução diária de faturamento</p>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        100% Reservas Diretas
                      </span>
                    </div>

                    {/* SVG Line Graph representation */}
                    <div className="h-32 w-full pt-2 flex items-end">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 400 100">
                        <path
                          d="M0,80 Q30,70 60,60 T120,40 T180,55 T240,30 T300,20 T360,15 T400,10"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                        />
                        <path
                          d="M0,80 Q30,70 60,60 T120,40 T180,55 T240,30 T300,20 T360,15 T400,10 L400,100 L0,100 Z"
                          fill="url(#emeraldGradient)"
                          opacity="0.25"
                        />
                        <defs>
                          <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                    <div className="flex justify-between text-[9px] text-zinc-500 font-mono pt-1">
                      <span>02/02</span>
                      <span>06/02</span>
                      <span>10/02</span>
                      <span>14/02</span>
                      <span>18/02</span>
                      <span>22/02</span>
                      <span>28/02</span>
                    </div>
                  </div>

                  {/* Payment Donut Chart */}
                  <div className="lg:col-span-4 p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-3">
                    <h4 className="text-xs font-bold text-white">Métodos de Pagamento</h4>
                    <p className="text-[10px] text-zinc-400">Volume por método</p>

                    <div className="flex items-center justify-center py-2">
                      <div className="relative w-24 h-24">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="4"
                            strokeDasharray="60, 100"
                          />
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="4"
                            strokeDasharray="30, 100"
                            strokeDashoffset="-60"
                          />
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#8b5cf6"
                            strokeWidth="4"
                            strokeDasharray="10, 100"
                            strokeDashoffset="-90"
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-zinc-300">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" /> PIX
                        </span>
                        <span className="font-mono font-bold text-white">R$ 18.700,00</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-zinc-300">
                          <span className="w-2 h-2 rounded-full bg-amber-400" /> Cartão
                        </span>
                        <span className="font-mono font-bold text-white">R$ 12.300,00</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-zinc-300">
                          <span className="w-2 h-2 rounded-full bg-purple-400" /> Dinheiro
                        </span>
                        <span className="font-mono font-bold text-white">R$ 3.400,00</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── TAB 2: CONTROLE DE HÓSPEDES ── */}
            {activeTab === 'hospedes' && (
              <motion.div
                key="hospedes"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-white">Controle de Hóspedes & Pipeline CRM</h4>
                    <p className="text-[10px] text-zinc-400">Gestão de estadias e status de check-in em tempo real</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    10 Hóspedes Ativos
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { name: 'Gabriel Alencar', room: 'Suíte 04', dates: '28 Jul - 31 Jul', status: 'Check-in Hoje', color: 'bg-emerald-500/20 text-emerald-300' },
                    { name: 'Mariana Costa', room: 'Bangalô 02', dates: '30 Jul - 02 Ago', status: 'PIX Confirmado', color: 'bg-teal-500/20 text-teal-300' },
                    { name: 'Fernanda Lima', room: 'Suíte 01', dates: '01 Ago - 04 Ago', status: 'Reserva Direta', color: 'bg-amber-500/20 text-amber-300' },
                  ].map((g, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-white">{g.name}</h5>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${g.color}`}>{g.status}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">{g.room} • {g.dates}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── TAB 3: CÉREBRO DA POUSADA ── */}
            {activeTab === 'cerebro' && (
              <motion.div
                key="cerebro"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-white">Cérebro da Pousada — IA Personalizada</h4>
                    <p className="text-[10px] text-zinc-400">Regras, fotos e políticas treinadas automaticamente</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    Magic Scanner Ativo
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      <Brain className="w-4 h-4 text-emerald-400" /> Tom de Atendimento Cadastrado
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Acolhedor e Profissional
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 bg-black/40 p-3 rounded-lg border border-white/5 leading-relaxed">
                    "Instruções treinadas: A pousada possui café da manhã baiano incluso das 07:30 às 10:00, aceitamos animais de pequeno porte e enviamos o código da fechadura após o comprovante PIX."
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── TAB 4: SIMULADOR ZÉLLA ── */}
            {activeTab === 'simulador' && (
              <motion.div
                key="simulador"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-white">Simulador Zélla WhatsApp 24/7</h4>
                    <p className="text-[10px] text-zinc-400">Resposta em 0.6s em balão único consolidado</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    80% Economia Meta
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 space-y-3">
                  <div className="bg-emerald-950/90 border border-emerald-500/40 p-3.5 rounded-xl text-xs space-y-1.5">
                    <p className="font-bold text-emerald-300">Olá! Temos disponibilidade sim! 🌴</p>
                    <p className="text-zinc-200 leading-relaxed text-[11px]">
                      Nossa Suíte Master está por R$ 420/noite com café da manhã. Para confirmar direto sem comissão, utilize o PIX CNPJ 12.345.678/0001-90.
                    </p>
                    <span className="text-[9px] text-emerald-400 font-mono block text-right">✓✓ Resposta em 0.6s • Balão Único</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── TAB 6: GUIA DIGITAL ── */}
            {activeTab === 'guia' && (
              <motion.div
                key="guia"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-white">Guia Digital do Hóspede</h4>
                    <p className="text-[10px] text-zinc-400">Link interativo com QR Code enviado no check-in</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30">
                    Link Automático
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <h5 className="font-bold text-white">Guia Digital Paraty Serenity</h5>
                    <p className="text-[11px] text-zinc-400">Wi-Fi: SerenityGuest2026 • Senha: Paraty#2026</p>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 font-bold text-xs border border-teal-500/30">
                    Ver Guia 🔗
                  </span>
                </div>
              </motion.div>
            )}

            {/* ── TAB 7: INTEGRAÇÕES ── */}
            {activeTab === 'integracoes' && (
              <motion.div
                key="integracoes"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-white">Integrações & Sincronização OTAs</h4>
                    <p className="text-[10px] text-zinc-400">Calendar Sync com Booking.com e Airbnb</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                    iCal Sincronizado
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/10 flex items-center justify-between">
                    <span className="font-bold text-white">Booking.com</span>
                    <span className="text-emerald-400 font-semibold">🟢 Conectado</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/10 flex items-center justify-between">
                    <span className="font-bold text-white">Airbnb</span>
                    <span className="text-emerald-400 font-semibold">🟢 Conectado</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── ORGANIC ANIMATED MOUSE CURSOR ("SETA DO MOUSE VIVA") ── */}
      {isAutoCursorActive && (
        <motion.div
          animate={{
            x: cursorTarget.x,
            y: cursorTarget.y,
            scale: cursorTarget.clicking ? 0.85 : 1,
          }}
          transition={{
            duration: 0.85,
            ease: [0.25, 1, 0.5, 1],
          }}
          className="absolute z-50 pointer-events-none drop-shadow-[0_0_18px_rgba(16,185,129,0.95)] hidden sm:block"
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
