'use client';

// ==============================================================================
// SEU ZÉLLA SUPER APP MOBILE — AIRBNB (Google Stitch Cyber-Luxe 100% Fidelity)
// ==============================================================================
// - Design System: Cyber-Luxe Glassmorphism (The Void #0a0a0f + Electric Cyan #06b6d4 / Blue #3b82f6)
// - 100% Faithful to Google Stitch HTML Specs in Downloads
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
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
} from 'lucide-react';

export function MobileAirbnbSuperApp() {
  const [activeTab, setActiveTab] = useState<'financeiro' | 'checkins' | 'shield' | 'linkinbio' | 'simulador'>('financeiro');
  const [aiActive, setAiActive] = useState<boolean>(true);
  const [pixShieldActive, setPixShieldActive] = useState<boolean>(true);
  const [time, setTime] = useState<string>('');
  const [pinCode, setPinCode] = useState<string>('8492');

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
      toast.success(next ? '🤖 IA Zélla ATIVADA (Anfitrião 24h)' : '⏸️ IA Zélla PAUSADA');
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
  };

  const handleNotifyCleaners = (guestName: string) => {
    toast.success(`🧹 Notificação de Faxina pós-checkout enviada para a equipe (Hóspede: ${guestName})`);
  };

  return (
    <div className="w-full min-h-screen bg-[#0a0a0f] text-[#e4e1e9] font-sans flex flex-col pb-24 selection:bg-blue-500/30">
      
      {/* ─────────────────────────────────────────────────────────────
          1. TOP APP BAR CYBER-LUXE AIRBNB (Mobile Header)
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
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
            onClick={() => toast.info('Notificações de Anfitrião Airbnb')}
            className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95"
            aria-label="Notificações"
          >
            <Bell className="w-4 h-4 text-cyan-400" />
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
            
            <div className="space-y-1.5">
              <h1 className="font-mono text-lg font-extrabold text-cyan-400 tracking-tight flex items-center gap-2">
                <span>&gt; zella-airbnb --host-terminal</span>
              </h1>
              <div className="inline-flex items-center gap-2 bg-white/[0.03] backdrop-blur-xl px-3 py-1.5 rounded-lg border border-white/[0.08]">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#06b6d4]" />
                <span className="text-xs text-zinc-200 font-mono">Flat Studio Jardins (Airbnb Superhost)</span>
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
                  <span>Preço dinâmico IA</span>
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
                O simulador da IA do Airbnb responde a perguntas sobre regras da casa, estacionamento, portaria e chaveiro 24 horas por dia.
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

    </div>
  );
}
