'use client';

// ==============================================================================
// SEU ZÉLLA SUPER APP MOBILE — AIRBNB (Google Stitch Cyber-Luxe 100% Fidelity)
// ==============================================================================
// - Design System: Cyber-Luxe Glassmorphism (The Void #0a0a0f + Electric Cyan #06b6d4 / Blue #3b82f6)
// - 100% Faithful to Google Stitch HTML Specs in Downloads
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useMobileDevicePing } from './useMobileDevicePing';
import { MobileYieldProfitWidget } from './MobileYieldProfitWidget';
import {
  CreditCard,
  Users,
  Brain,
  Bell,
  Zap,
  TrendingUp,
  ShieldCheck,
  QrCode,
  Lock,
  RefreshCw,
  Send,
  Sparkles,
  Link as LinkIcon,
  Copy,
  Power,
  Globe,
  Home,
  CheckCircle2,
  Menu,
  X,
  LayoutGrid,
} from 'lucide-react';

export function MobileAirbnbSuperApp() {
  const [activeTab, setActiveTab] = useState<'financeiro' | 'checkins' | 'shield' | 'linkinbio' | 'simulador'>('financeiro');

  // ZCC Analytics — registra pings de uso Mobile (compara com Desktop)
  useMobileDevicePing({
    niche: 'airbnb',
    route: '/mobile/airbnb',
    tenantId: typeof window !== 'undefined' ? (window as any).__ZELLA_TENANT_ID ?? 'demo-airbnb' : 'demo-airbnb',
    tenantName: typeof window !== 'undefined' ? (window as any).__ZELLA_TENANT_NAME : undefined,
    tabName: activeTab,
  });

  const [propertyName, setPropertyName] = useState<string>('Flat Studio Jardins');
  const [aiActive, setAiActive] = useState<boolean>(true);
  const [pixShieldActive, setPixShieldActive] = useState<boolean>(true);
  const [time, setTime] = useState<string>('');
  const [pinCode, setPinCode] = useState<string>('8492');

  // Interactive Drawers
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isSyncingOTAs, setIsSyncingOTAs] = useState<boolean>(false);

  // Synced Notifications List
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Reserva Direct PIX', desc: 'Flat Studio Jardins - R$ 1.850 (0% comissão)', time: 'Há 10 min', unread: true },
    { id: 2, title: 'Escudo Anti-Ban Ativo', desc: 'Tentativa de troca de número filtrada no chat', time: 'Há 30 min', unread: true },
    { id: 3, title: 'PIN de Acesso Gerado', desc: 'PIN 8492 válido para check-in às 14:00', time: 'Há 1h', unread: false },
    { id: 4, title: 'Notificação de Faxina', desc: 'Equipe de limpeza notificada para checkout às 11h', time: 'Há 2h', unread: false },
  ]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAI = () => {
    setAiActive((prev) => {
      const next = !prev;
      toast.success(next ? '🤖 Cérebro Zélla ATIVADO (Anfitrião 24h)' : '⏸️ Cérebro Zélla PAUSADO');
      return next;
    });
  };

  const handleToggleShield = () => {
    setPixShieldActive((prev) => {
      const next = !prev;
      toast.info(next ? '🛡️ PIX Gatekeeper ATIVADO (Escudo Anti-Ban)' : '⚠️ Escudo Desativado');
      return next;
    });
  };

  const handleGeneratePIN = () => {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    setPinCode(newPin);
    toast.success(`🔑 Novo PIN Digital Gerado: ${newPin}`);
    setNotifications((prev) => [
      {
        id: Date.now(),
        title: 'Novo PIN Digital Gerado',
        desc: `Código de acesso temporário: ${newPin}`,
        time: 'Agora mesmo',
        unread: true,
      },
      ...prev,
    ]);
  };

  const handleSyncOTAs = async () => {
    setIsSyncingOTAs(true);
    toast.info('🔄 Sincronizando iCal da Airbnb e Booking.com...');
    setTimeout(() => {
      setIsSyncingOTAs(false);
      toast.success('✅ Calendários Airbnb & Booking Sincronizados!');
    }, 1200);
  };

  const handleNotifyCleaners = (guestName: string) => {
    toast.success(`🧹 Notificação de Faxina pós-checkout enviada para a equipe (Hóspede: ${guestName})`);
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="w-full min-h-screen bg-[#0a0a0f] text-[#e4e1e9] font-sans flex flex-col pb-24 selection:bg-blue-500/30 relative">
      
      {/* ─────────────────────────────────────────────────────────────
          1. TOP APP BAR CYBER-LUXE AIRBNB (Mobile Header com Hambúrguer)
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:text-white active:scale-95 transition-all"
            aria-label="Abrir Menu DDC"
          >
            <Menu className="w-5 h-5 text-cyan-400" />
          </button>

          <img
            src="/SeuZella_Logo_site.png"
            alt="Seu Zélla"
            className="h-6 w-auto object-contain"
          />
          <div className="h-3.5 w-[1px] bg-white/20" />
          <span className="font-mono text-xs font-extrabold tracking-widest text-cyan-400 uppercase">
            AIRBNB
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-300 bg-white/[0.04] px-2.5 py-1 rounded-full border border-white/[0.08]">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#06b6d4]" />
            <span>ONLINE · {time || '12:00'}</span>
          </div>
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 relative"
            aria-label="Notificações"
          >
            <Bell className="w-4 h-4 text-cyan-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-cyan-500 text-[#0a0a0f] text-[9px] font-mono font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. CONTEÚDO DAS ABAS (Main Container)
      ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 px-4 pt-4 space-y-4">
        
        {/* ABA 1: FINANCEIRO & HUD AIRBNB */}
        {activeTab === 'financeiro' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            {/* Yield Booster — Lucro Extra Gerado pela IA */}
            <MobileYieldProfitWidget niche="airbnb" />

            <div className="space-y-1.5">
              <h1 className="font-mono text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <span className="text-cyan-400">&gt;</span> Dashboard do Anfitrião — {propertyName}
              </h1>
              <div className="inline-flex items-center gap-2 bg-white/[0.03] backdrop-blur-xl px-3 py-1.5 rounded-lg border border-white/[0.08]">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#06b6d4]" />
                <span className="text-xs text-zinc-200 font-mono">Superhost Anti-Ban Protected</span>
                <span className="bg-cyan-500 text-[#0a0a0f] text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded ml-1">
                  PROTECTED
                </span>
              </div>
            </div>

            {/* Quick Actions (1-Tap Touch Targets min-h-[48px]) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleToggleShield}
                className={`p-3 rounded-xl border font-bold text-xs flex items-center gap-2.5 min-h-[48px] active:scale-95 transition-all ${
                  pixShieldActive
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                    : 'bg-white/[0.04] border-white/[0.08] text-zinc-400'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="text-left">
                  <div className="font-bold">PIX Shield</div>
                  <div className="text-[9px] font-mono text-cyan-400/80">
                    {pixShieldActive ? 'Anti-Ban ON' : 'Desativado'}
                  </div>
                </div>
              </button>

              <button
                onClick={handleGeneratePIN}
                className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-200 font-bold text-xs flex items-center gap-2.5 min-h-[48px] active:scale-95 transition-all"
              >
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="text-left">
                  <div className="font-bold">PIN Fechadura</div>
                  <div className="text-[9px] font-mono text-amber-400">1-Tap Code</div>
                </div>
              </button>
            </div>

            {/* Bento Grid KPIs Airbnb */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3.5 space-y-2">
                <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Receita Bruta</div>
                <div className="text-2xl font-mono font-extrabold text-white">R$ 8.950</div>
                <div className="flex items-center text-[10px] text-cyan-400 font-medium gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>+18% vs mês anterior</span>
                </div>
              </div>

              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3.5 space-y-2">
                <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Diária Média</div>
                <div className="text-2xl font-mono font-extrabold text-white">R$ 380</div>
                <div className="flex items-center text-[10px] text-emerald-400 font-medium gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Preço dinâmico Zélla</span>
                </div>
              </div>

              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3.5 space-y-2">
                <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Link-in-Bio Visitas</div>
                <div className="text-2xl font-mono font-extrabold text-white">342</div>
                <div className="flex items-center text-[10px] text-blue-400 font-medium gap-1">
                  <LinkIcon className="w-3 h-3" />
                  <span>Reservas Diretas</span>
                </div>
              </div>

              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3.5 space-y-2">
                <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Bloqueios Anti-Ban</div>
                <div className="text-2xl font-mono font-extrabold text-white">5</div>
                <div className="flex items-center text-[10px] text-cyan-400 font-medium gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>PIX Protegido</span>
                </div>
              </div>
            </div>

          </motion.div>
        )}

        {/* ABA 2: CHECK-INS & PIN DIGITAL */}
        {activeTab === 'checkins' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-amber-400 tracking-wider">[MODULE // SMART_LOCK_PIN]</span>
              <h2 className="text-sm font-bold text-white font-mono">Self Check-in & Fechadura Digital</h2>
            </div>

            {/* Card PIN Destaque */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-5 space-y-4 text-center">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-400 font-mono">
                <Lock className="w-4 h-4" />
                <span>PIN DIGITAL ATIVO DO FLAT</span>
              </div>

              <div className="text-4xl font-mono font-extrabold tracking-widest text-amber-400 bg-amber-500/10 py-3 px-6 rounded-2xl border border-amber-500/30 inline-block shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                {pinCode}
              </div>

              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pinCode);
                    toast.success('📋 PIN copiado para a área de transferência!');
                  }}
                  className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-white flex items-center gap-1.5 min-h-[44px] active:scale-95 transition-all"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Copiar PIN</span>
                </button>

                <button
                  onClick={handleGeneratePIN}
                  className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 min-h-[44px] active:scale-95 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Gerar Novo PIN</span>
                </button>
              </div>
            </div>

            {/* Ações de Checkout & Faxina */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white font-mono">GESTÃO DE FAXINA PÓS-CHECKOUT</h3>

              <div className="space-y-2">
                {[
                  { name: 'Lucas Mendes', checkin: '08-11 AGO', status: 'Checkout Realizado' },
                  { name: 'Juliana Costa', checkin: '12-15 AGO', status: 'Check-in Confirmado' },
                ].map((g, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div>
                      <div className="text-xs font-bold text-white">{g.name}</div>
                      <div className="text-[10px] font-mono text-zinc-400">{g.checkin} · {g.status}</div>
                    </div>
                    <button
                      onClick={() => handleNotifyCleaners(g.name)}
                      className="px-3 py-1.5 rounded bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-[10px] font-mono font-bold min-h-[40px] active:scale-95 transition-all"
                    >
                      Notificar Faxina
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </motion.div>
        )}

        {/* ABA 3: PIX SHIELD (Escudo Anti-Banismo) */}
        {activeTab === 'shield' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-cyan-400 tracking-wider">[MODULE // PIX_GATEKEEPER]</span>
              <h2 className="text-sm font-bold text-white font-mono">Escudo Anti-Banismo do Airbnb</h2>
            </div>

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white font-mono">STATUS DO ESCUDO</h3>
                </div>
                <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  PROTEÇÃO ATIVA
                </span>
              </div>

              <p className="text-xs text-zinc-300">
                O Escudo Anti-Banismo intercepta automaticamente palavras sensíveis no chat do Airbnb (como "chave PIX", "WhatsApp", números de telefone) e direciona o convidado com segurança para a conversão direta sem risco de penalização da conta.
              </p>

              <div className="space-y-2 text-xs pt-2">
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                  <span>Tentativas Interceptadas</span>
                  <span className="font-mono font-bold text-cyan-400">12 Bloqueios</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                  <span>Taxa de Conversão PIX</span>
                  <span className="font-mono font-bold text-emerald-400">100% Segura</span>
                </div>
              </div>
            </div>

          </motion.div>
        )}

        {/* ABA 4: LINK-IN-BIO INSTAGRAM */}
        {activeTab === 'linkinbio' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-blue-400 tracking-wider">[MODULE // INSTAGRAM_ADDON]</span>
              <h2 className="text-sm font-bold text-white font-mono">Instagram Link-in-Bio Addon</h2>
            </div>

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3 border-b border-white/[0.06] pb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-0.5">
                  <div className="w-full h-full rounded-full bg-[#0a0a0f] flex items-center justify-center font-bold text-white text-xs">
                    ST
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white font-mono">@studiojardins.zehla</h3>
                  <p className="text-[10px] text-zinc-400">Link-in-Bio Direto para Reservas</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                  <span>Visitas no Perfil</span>
                  <span className="font-mono font-bold text-white">342 cliques</span>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                  <span>Reservas Diretas Concluídas</span>
                  <span className="font-mono font-bold text-emerald-400">12 (R$ 0 taxa)</span>
                </div>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText('https://smart-hotel-zehla.vercel.app/mobile/airbnb');
                  toast.success('📋 Link-in-Bio copiado!');
                }}
                className="w-full py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px] active:scale-95 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Link do Instagram</span>
              </button>
            </div>

          </motion.div>
        )}

        {/* ABA 5: SIMULADOR AIRBNB */}
        {activeTab === 'simulador' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-cyan-400 tracking-wider">[MODULE // AIRBNB_SIMULATOR]</span>
              <h2 className="text-sm font-bold text-white font-mono">Simulador 24h para Anfitriões</h2>
            </div>

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-cyan-400 mx-auto" />
              <p className="text-xs text-zinc-300">
                O simulador do Cérebro Zélla no Airbnb responde a perguntas sobre regras da casa, estacionamento, portaria e chaveiro 24 horas por dia.
              </p>
            </div>
          </motion.div>
        )}

      </main>

      {/* ─────────────────────────────────────────────────────────────
          3. CYBER-LUXE BOTTOM NAVIGATION BAR AIRBNB (Fixed at bottom)
      ───────────────────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#0a0a0f]/95 backdrop-blur-2xl border-t border-white/[0.08] px-2 py-2.5 z-50 flex items-center justify-around">
        <button
          onClick={() => setActiveTab('financeiro')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'financeiro' ? 'text-cyan-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[9px] font-mono">Financeiro</span>
        </button>

        <button
          onClick={() => setActiveTab('checkins')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'checkins' ? 'text-cyan-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Lock className="w-5 h-5" />
          <span className="text-[9px] font-mono">Check-ins</span>
        </button>

        <button
          onClick={() => setActiveTab('shield')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'shield' ? 'text-cyan-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-[9px] font-mono">PIX Shield</span>
        </button>

        <button
          onClick={() => setActiveTab('linkinbio')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'linkinbio' ? 'text-cyan-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <LinkIcon className="w-5 h-5" />
          <span className="text-[9px] font-mono">Link-in-Bio</span>
        </button>

        <button
          onClick={() => setActiveTab('simulador')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'simulador' ? 'text-cyan-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[9px] font-mono">Simulador</span>
        </button>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          4. MENU LATERAL DRAWER (Hambúrguer Menu Anfitrião)
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed top-0 left-0 bottom-0 w-[82%] max-w-[320px] bg-[#0d0d14] border-r border-white/[0.08] z-50 p-5 flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <div className="flex items-center gap-2">
                    <img src="/SeuZella_Logo_site.png" alt="Seu Zélla" className="h-6 w-auto" />
                    <span className="font-mono text-xs font-bold text-cyan-400">AIRBNB</span>
                  </div>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-1 rounded-lg bg-white/[0.04] text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-white/[0.03] p-3 rounded-xl border border-white/[0.08] space-y-1">
                  <div className="text-[10px] font-mono text-zinc-400">PROPRIEDADE CONECTADA</div>
                  <div className="font-bold text-sm text-white">{propertyName}</div>
                  <div className="text-[10px] font-mono text-cyan-400">Superhost Protection Active</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-zinc-400 px-2 pb-1">NAVEGAÇÃO RÁPIDA</div>
                  
                  <button
                    onClick={() => { setActiveTab('financeiro'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-cyan-400 transition-all text-left"
                  >
                    <CreditCard className="w-4 h-4 text-cyan-400" />
                    <span>Financeiro & Painel Host</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('checkins'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-cyan-400 transition-all text-left"
                  >
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span>Gerador de PIN Fechadura</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('shield'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-cyan-400 transition-all text-left"
                  >
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span>PIX Shield (Anti-Ban)</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('linkinbio'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-cyan-400 transition-all text-left"
                  >
                    <LinkIcon className="w-4 h-4 text-cyan-400" />
                    <span>Addon Instagram Link-in-Bio</span>
                  </button>

                  <div className="h-[1px] bg-white/[0.06] my-2" />

                  <button
                    onClick={() => { handleSyncOTAs(); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all text-left border border-cyan-500/20"
                  >
                    <RefreshCw className="w-4 h-4 text-cyan-400" />
                    <span>Sincronizar OTAs</span>
                  </button>

                  <button
                    onClick={() => { setIsNotificationsOpen(true); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] transition-all text-left"
                  >
                    <Bell className="w-4 h-4 text-cyan-400" />
                    <span>Central de Notificações</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.08] text-[10px] font-mono text-zinc-500 text-center">
                Seu Zélla Airbnb Host v3.2 · Live Mobile
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          5. SHEET CENTRAL DE NOTIFICAÇÕES (Sincronizada)
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isNotificationsOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end justify-center">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="w-full max-w-md bg-[#13131a] border-t border-white/[0.1] rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-sm text-white font-mono">NOTIFICAÇÕES ANFITRIÃO AIRBNB</h3>
                </div>
                <button onClick={() => setIsNotificationsOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-xl border transition-all ${
                      notif.unread
                        ? 'bg-cyan-500/10 border-cyan-500/30'
                        : 'bg-white/[0.02] border-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-xs text-white">{notif.title}</div>
                      <span className="text-[9px] font-mono text-zinc-400">{notif.time}</span>
                    </div>
                    <p className="text-xs text-zinc-300 font-sans">{notif.desc}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
                  toast.success('Todas as notificações foram marcadas como lidas');
                }}
                className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono font-bold text-zinc-300 hover:text-white"
              >
                Marcar todas como lidas
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
