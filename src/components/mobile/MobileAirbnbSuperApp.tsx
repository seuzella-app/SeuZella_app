'use client';

// ==============================================================================
// SEU ZÉLLA SUPER APP MOBILE — AIRBNB HOST (Native Mobile App Experience)
// ==============================================================================
// - Design System: Cyber-Luxe Glassmorphism (#0a0a0f + Electric Cyan #06b6d4 / Blue #3b82f6)
// - Native Mobile App UX: Touch Targets min-h 48px, Floating HUD, Haptics & Gestures
// - Módulos Nativos: Radar de Economia (vs 15% Airbnb), Fechaduras & PINs, UPSELL Feriados (7%), Escudo Anti-Ban, Link na Bio PIX, Simulador
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
  Unlock,
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
  Battery,
  Flame,
  KeyRound,
  CheckCheck,
  Brush,
  DollarSign,
  Smartphone,
  Sliders,
  Calendar,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

export function MobileAirbnbSuperApp() {
  const [activeTab, setActiveTab] = useState<'financeiro' | 'fechaduras' | 'upsell' | 'shield' | 'linkinbio' | 'simulador'>('financeiro');

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
  const [pinCode, setPinCode] = useState<string>('849201');
  const [unlocking, setUnlocking] = useState<boolean>(false);

  // Multi-Properties list
  const [properties] = useState([
    { id: '1', name: 'Flat Studio Jardins', battery: 94, model: 'Intelbras IFR 7000', pin: '849201', guest: 'Lucas Mendes', checkOut: 'Amanhã 11:00', price: 380 },
    { id: '2', name: 'Loft Copacabana Vista Mar', battery: 18, model: 'Tuya Smart Lock G2', pin: '472091', guest: 'Beatriz Costa', checkOut: 'Hoje 12:00', price: 550 },
    { id: '3', name: 'Studio Paulista Modern', battery: 88, model: 'TTLock Gateway BLE', pin: '310984', guest: 'Vago', checkOut: '-', price: 320 },
  ]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('1');

  // Interactive Drawers
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isSyncingOTAs, setIsSyncingOTAs] = useState<boolean>(false);

  // UPSELL State (Feriados & Fim de Semana)
  const [selectedHoliday, setSelectedHoliday] = useState<'Reveillon' | 'Carnaval' | 'FeriasJan' | 'Setembro7'>('Reveillon');
  const [dailyIncrease, setDailyIncrease] = useState<number>(150);

  const holidaysConfig = {
    Reveillon: { name: 'Réveillon 2026/2027', dates: '29 DEZ - 02 JAN', nights: 4, multiplier: 'Alta Demanda' },
    Carnaval: { name: 'Carnaval 2027', dates: '12 FEV - 16 FEV', nights: 4, multiplier: 'Alta Demanda' },
    FeriasJan: { name: 'Férias de Janeiro', dates: '10 JAN - 24 JAN', nights: 7, multiplier: 'Verão' },
    Setembro7: { name: '7 de Setembro', dates: '05 SET - 08 SET', nights: 3, multiplier: 'Feriado' },
  };

  // Synced Notifications List
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Reserva Direct PIX Confirmada', desc: 'Flat Studio Jardins - R$ 1.850 (Economia de R$ 277 vs taxas Airbnb)', time: 'Há 10 min', unread: true },
    { id: 2, title: 'Escudo Anti-Ban Ativo', desc: 'Tentativa de troca de número no chat filtrada com sucesso', time: 'Há 30 min', unread: true },
    { id: 3, title: 'PIN Digital Gerado', desc: 'PIN 849201 válido até check-out do hóspede Lucas', time: 'Há 1h', unread: false },
    { id: 4, title: 'Alerta de Bateria', desc: 'Loft Copacabana com 18% de bateria na fechadura', time: 'Há 2h', unread: false },
  ]);

  const [chatLog, setChatLog] = useState<Array<{ sender: 'guest' | 'zella'; text: string; time: string }>>([
    { sender: 'guest', text: 'Boa tarde! Qual o código da fechadura e como entro no prédio?', time: '14:20' },
    { sender: 'zella', text: 'Olá Lucas! A portaria já está com seu nome liberado. Na porta do Flat Studio, digite a senha 849201 seguido de #. O Wi-Fi é "Studio_Jardins_5G"!', time: '14:20' },
  ]);
  const [simulatedMsg, setSimulatedMsg] = useState('');

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
      toast.success(next ? '🤖 Cérebro Zélla ATIVADO (Anfitrião 24h)' : '⏸ Cérebro Zélla PAUSADO');
      return next;
    });
  };

  const handleToggleShield = () => {
    setPixShieldActive((prev) => {
      const next = !prev;
      toast.info(next ? '🛡️ PIX Gatekeeper ATIVADO (Escudo Anti-Ban)' : ' Escudo Desativado');
      return next;
    });
  };

  const handleGeneratePIN = async () => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const newPin = (arr[0] % 1000000).toString().padStart(6, '0');
    setPinCode(newPin);
    toast.success(`🔑 Novo PIN Temporário Gerado: ${newPin}`);
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

  const handleRemoteUnlock = (propName: string) => {
    setUnlocking(true);
    toast.info(`🔑 Destrancando fechadura do ${propName}...`);
    setTimeout(() => {
      setUnlocking(false);
      toast.success(`🔓 Fechadura do ${propName} ABERTA COM SUCESSO!`);
    }, 1200);
  };

  const handleSyncOTAs = async () => {
    setIsSyncingOTAs(true);
    toast.info('🔄 Sincronizando iCal do Airbnb e Booking.com...');
    setTimeout(() => {
      setIsSyncingOTAs(false);
      toast.success('✅ Calendários Airbnb & Booking Sincronizados com Sucesso!');
    }, 1200);
  };

  const handleNotifyCleaners = (guestName: string) => {
    toast.success(`🧹 Notificação de Faxina enviada para a diarista (Pós-checkout: ${guestName})`);
  };

  const handleSendSimulatedMsg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedMsg.trim()) return;

    const userText = simulatedMsg;
    setSimulatedMsg('');

    setChatLog((prev) => [...prev, { sender: 'guest', text: userText, time: time || '14:40' }]);

    setTimeout(() => {
      let botResponse = 'Olá! Sou a assistente virtual do anfitrião. Como posso ajudar com sua estadia?';
      const lower = userText.toLowerCase();

      if (lower.includes('senha') || lower.includes('porta') || lower.includes('entrar') || lower.includes('chave')) {
        botResponse = `Sua senha temporária é ${pinCode}#. Basta digitar no teclado numérico da fechadura digital. O check-in é 100% autônomo!`;
      } else if (lower.includes('wi-fi') || lower.includes('wifi')) {
        botResponse = 'A rede Wi-Fi é "Studio_Jardins_5G" e a senha é "superhost2026". Conexão fibra 500 Mega!';
      } else if (lower.includes('limpeza') || lower.includes('toalha') || lower.includes('faxina')) {
        botResponse = 'Nosso apartamento conta com enxoval completo de hotelaria. Se precisar de troca extra ou limpeza avulsa, posso solicitar agora!';
      }

      setChatLog((prev) => [...prev, { sender: 'zella', text: botResponse, time: time || '14:40' }]);
    }, 800);
  };

  const unreadCount = notifications.filter((n) => n.unread).length;
  const currentHoliday = holidaysConfig[selectedHoliday];
  const upsellExcedent = properties.length * currentHoliday.nights * dailyIncrease;
  const hostProfit = upsellExcedent * 0.93;
  const zellaFee = upsellExcedent * 0.07;

  return (
    <div className="w-full min-h-screen bg-[#0a0a0f] text-[#e4e1e9] font-sans flex flex-col pb-28 selection:bg-blue-500/30 relative overflow-x-hidden">
      
      {/* ──
          1. TOP APP BAR CYBER-LUXE AIRBNB (Mobile Header)
      ── */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/95 backdrop-blur-2xl border-b border-white/[0.08] px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:text-white active:scale-95 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Abrir Menu DDC"
          >
            <Menu className="w-5 h-5 text-cyan-400" />
          </button>

          <div className="flex items-center gap-2">
            <img
              src="/SeuZella_Logo_site.png"
              alt="Seu Zélla"
              className="h-7 w-auto object-contain max-w-[110px]"
            />
            <div className="h-4 w-[1px] bg-white/20" />
            <span className="font-mono text-[10px] font-black tracking-widest text-cyan-400 uppercase bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
              ANFITRIÃO
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Cérebro Zélla */}
          <button
            onClick={handleToggleAI}
            className={`px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all min-h-[36px] active:scale-95 ${
              aiActive
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${aiActive ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-500'}`} />
            <span>{aiActive ? 'HOST 24H' : 'PAUSADO'}</span>
          </button>

          {/* Notificações Bell */}
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 relative"
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

      {/* ──
          2. QUICK ACTIONS CHIP BAR (Horizontal Carousel)
      ── */}
      <div className="px-3.5 pt-3 pb-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={handleGeneratePIN}
          className="shrink-0 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold font-mono flex items-center gap-1.5 active:scale-95 transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)]"
        >
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>🔑 Gerar PIN Fechadura ({pinCode})</span>
        </button>

        <button
          onClick={handleToggleShield}
          className={`shrink-0 px-3 py-1.5 rounded-full border text-xs font-bold font-mono flex items-center gap-1.5 active:scale-95 transition-all ${
            pixShieldActive
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
              : 'bg-white/[0.04] border-white/[0.08] text-zinc-400'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>🛡️ Escudo Anti-Ban {pixShieldActive ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={() => setActiveTab('linkinbio')}
          className="shrink-0 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-zinc-200 text-xs font-bold font-mono flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
          <span>🔗 Link na Bio Instagram</span>
        </button>

        <button
          onClick={handleSyncOTAs}
          className="shrink-0 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-zinc-200 text-xs font-bold font-mono flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncingOTAs ? 'animate-spin' : ''}`} />
          <span>Sync Airbnb iCal</span>
        </button>
      </div>

      {/* ──
          3. CONTEÚDO DAS ABAS (Main Container)
      ── */}
      <main className="flex-1 px-3.5 pt-3 space-y-4">
        
        {/* ABA 1: FINANCEIRO & RADAR DE ECONOMIA */}
        {activeTab === 'financeiro' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            {/* Yield Booster (Lucro Extra IA) */}
            <MobileYieldProfitWidget niche="airbnb" />

            <div className="space-y-1">
              <h1 className="font-mono text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <span className="text-cyan-400">&gt;</span> Radar de Lucro Direto
              </h1>
              <p className="text-xs text-zinc-400">Economia real contra taxas abusivas do Airbnb/OTAs</p>
            </div>

            {/* Comparativo de Economia (Taxas Airbnb vs Seu Zélla) */}
            <div className="bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-zinc-900 border border-cyan-500/30 rounded-3xl p-4 space-y-3 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-cyan-400" />
                  <span>ECONOMIA REAL EM TAXAS</span>
                </span>
                <span className="text-[9px] font-mono font-extrabold bg-cyan-500 text-zinc-950 px-2 py-0.5 rounded-full">
                  100% SEU
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-black/40 border border-rose-500/20 space-y-1">
                  <span className="text-[10px] text-zinc-400 font-mono">Pelo Airbnb (-15%)</span>
                  <div className="text-sm font-bold text-rose-400 font-mono">-R$ 1.875</div>
                  <p className="text-[9px] text-zinc-500">Morderiam em comissões</p>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                  <span className="text-[10px] text-emerald-300 font-mono">Pelo Seu Zélla (0%)</span>
                  <div className="text-sm font-bold text-emerald-400 font-mono">+R$ 1.875</div>
                  <p className="text-[9px] text-emerald-400/80">No seu bolso via PIX</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.06]">
                <span className="text-zinc-400">Total Faturado no Mês:</span>
                <span className="font-mono font-extrabold text-white text-sm">R$ 12.500</span>
              </div>
            </div>

            {/* Bento Grid KPIs */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3.5 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Diárias Vendidas</div>
                <div className="text-2xl font-mono font-extrabold text-white">24 noites</div>
                <div className="text-[10px] text-cyan-400 font-medium">85% taxa ocupação</div>
              </div>

              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3.5 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Reservas Diretas</div>
                <div className="text-2xl font-mono font-extrabold text-cyan-400">9 via PIX</div>
                <div className="text-[10px] text-zinc-400 font-medium">0% taxa intermediação</div>
              </div>
            </div>

            {/* Imóveis Conectados */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                <Home className="w-4 h-4 text-cyan-400" />
                <span>SEUS IMÓVEIS & FLATS</span>
              </h3>

              <div className="space-y-2">
                {properties.map((prop) => (
                  <div
                    key={prop.id}
                    className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{prop.name}</div>
                      <div className="text-[10px] font-mono text-zinc-400">Hóspede: {prop.guest} · Check-out: {prop.checkOut}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-cyan-400 font-mono">R$ {prop.price}/dia</div>
                      <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 justify-end">
                        <Battery className={`w-3 h-3 ${prop.battery < 20 ? 'text-rose-400' : 'text-emerald-400'}`} />
                        <span>{prop.battery}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </motion.div>
        )}

        {/* ABA 2: FECHADURAS & CHECK-IN AUTÔNOMO */}
        {activeTab === 'fechaduras' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white font-mono">Fechaduras & Check-in</h2>
                <p className="text-xs text-zinc-400">Acesso autônomo sem chave física 24h</p>
              </div>
              <button
                onClick={handleGeneratePIN}
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs font-mono flex items-center gap-1 active:scale-95 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Gerar PIN</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {properties.map((prop) => (
                <div
                  key={prop.id}
                  className="p-4 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">{prop.name}</h4>
                      <p className="text-[10px] font-mono text-zinc-400">{prop.model}</p>
                    </div>

                    <div className={`flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      prop.battery < 20
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}>
                      <Battery className="w-3.5 h-3.5" />
                      <span>{prop.battery}% {prop.battery < 20 && '⚠️ TROCAR'}</span>
                    </div>
                  </div>

                  <div className="bg-black/30 p-3 rounded-2xl border border-white/[0.04] flex items-center justify-between">
                    <div>
                      <span className="block text-[9px] font-mono text-zinc-500 uppercase">PIN Digital Ativo</span>
                      <span className="font-mono text-base font-extrabold text-amber-400 tracking-widest">{prop.pin}#</span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(prop.pin);
                        toast.success(`Código ${prop.pin} copiado!`);
                      }}
                      className="p-2 rounded-lg bg-white/[0.05] text-zinc-300 hover:text-white"
                      title="Copiar PIN"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
                    <button
                      onClick={() => handleRemoteUnlock(prop.name)}
                      disabled={unlocking}
                      className="flex-1 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 text-xs font-bold font-mono flex items-center justify-center gap-1.5 min-h-[44px] active:scale-95"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>{unlocking ? 'Abrindo...' : 'Abrir Remoto'}</span>
                    </button>

                    <button
                      onClick={() => handleNotifyCleaners(prop.guest)}
                      className="py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/[0.1] text-zinc-200 text-xs font-bold font-mono flex items-center gap-1 min-h-[44px] active:scale-95"
                    >
                      <Brush className="w-3.5 h-3.5 text-amber-400" />
                      <span>Faxina</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </motion.div>
        )}

        {/* ABA 3: UPSELL FERIADOS & FINS DE SEMANA (7% TAXA) */}
        {activeTab === 'upsell' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="bg-gradient-to-br from-amber-500/10 via-cyan-500/10 to-zinc-900 border border-amber-500/30 rounded-3xl p-4 space-y-3 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
                  <div>
                    <h2 className="text-xs font-bold text-white font-mono">UPSELL DE TEMPORADA ANFITRIÃO</h2>
                    <p className="text-[10px] text-zinc-400">Aumento de diária em datas de pico (7% taxa de sucesso)</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  7% TAXA
                </span>
              </div>

              {/* Seletor de Feriado */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-zinc-400 uppercase">Selecione o Feriado / Data</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(holidaysConfig) as Array<keyof typeof holidaysConfig>).map((key) => (
                    <button
                      key={key}
                      onClick={() => setSelectedHoliday(key)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selectedHoliday === key
                          ? 'bg-amber-500/20 border-amber-500/50 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-400'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{holidaysConfig[key].name}</div>
                      <div className="text-[10px] font-mono text-amber-400/80">{holidaysConfig[key].dates}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider de Aumento */}
              <div className="space-y-2 bg-black/40 p-3.5 rounded-2xl border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300 font-medium">Aumento por Imóvel / Diária:</span>
                  <span className="text-base font-extrabold text-amber-400 font-mono">+R$ {dailyIncrease}</span>
                </div>

                <input
                  type="range"
                  min="50"
                  max="400"
                  step="25"
                  value={dailyIncrease}
                  onChange={(e) => setDailyIncrease(Number(e.target.value))}
                  className="w-full accent-amber-400 h-2 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Demonstrativo Matemático */}
              <div className="bg-white/[0.03] p-3 rounded-2xl border border-white/[0.08] space-y-2 text-xs">
                <div className="flex justify-between text-zinc-300">
                  <span>Excedente Bruto:</span>
                  <span className="font-mono font-bold text-white">R$ {upsellExcedent.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between text-cyan-400 font-bold border-t border-white/[0.06] pt-1.5">
                  <span>💰 Seu Lucro Líquido (93%):</span>
                  <span className="font-mono text-sm">R$ {Math.round(hostProfit).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>Taxa Seu Zélla (7%):</span>
                  <span className="font-mono text-amber-400">R$ {Math.round(zellaFee).toLocaleString('pt-BR')}</span>
                </div>
              </div>

              <button
                onClick={() => toast.success(`⚡ UPSELL ATIVADO! +R$ ${dailyIncrease}/diária aplicado para ${currentHoliday.name}`)}
                className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.4)] active:scale-95 transition-all"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>APLICAR AUMENTO NOS FLATS</span>
              </button>
            </div>

          </motion.div>
        )}

        {/* ABA 4: ESCUDO ANTI-BAN */}
        {activeTab === 'shield' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="bg-white/[0.03] backdrop-blur-xl border border-cyan-500/30 rounded-3xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white font-mono">PIX GATEKEEPER & ESCUDO ANTI-BAN</h3>
                </div>
                <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                  {pixShieldActive ? 'ATIVO' : 'DESATIVADO'}
                </span>
              </div>

              <p className="text-xs text-zinc-300">
                O Escudo Zélla sanitiza mensagens no chat do Airbnb, protegendo o anfitrião contra banimentos ao transferir o hóspede para o WhatsApp de forma segura e elegante.
              </p>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06] space-y-1.5 text-xs">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                  <span>3 Tentativas de Bloqueio Sanitizadas</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Os números de contato foram criptografados e convertidos em link seguro sem detecção por bots das OTAs.
                </p>
              </div>

              <button
                onClick={handleToggleShield}
                className="w-full py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-bold font-mono active:scale-95"
              >
                {pixShieldActive ? 'Pausar Proteção Anti-Ban' : 'Ativar Proteção Anti-Ban'}
              </button>
            </div>

          </motion.div>
        )}

        {/* ABA 5: LINK-IN-BIO INSTAGRAM */}
        {activeTab === 'linkinbio' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white font-mono">LINK NA BIO / CATÁLOGO INSTAGRAM</h3>
                </div>
                <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                  0% TAXA
                </span>
              </div>

              <p className="text-xs text-zinc-300">
                Página própria dos seus flats com checkout PIX instantâneo para colocar no Instagram e TikTok.
              </p>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
                <span className="font-mono text-xs text-cyan-300 truncate">seuzella.com/l/studio-jardins</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('https://smart-hotel-zehla.vercel.app/demo/link-in-bio');
                    toast.success('Link do Catálogo copiado com sucesso!');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 text-zinc-950 font-bold text-xs font-mono active:scale-95"
                >
                  Copiar
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-[10px] text-zinc-400 block">Cliques no Mês</span>
                  <span className="text-sm font-extrabold text-white font-mono">428 visitas</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-[10px] text-zinc-400 block">Reservas Diretas</span>
                  <span className="text-sm font-extrabold text-emerald-400 font-mono">R$ 7.200</span>
                </div>
              </div>
            </div>

          </motion.div>
        )}

        {/* ABA 6: SIMULADOR */}
        {activeTab === 'simulador' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-4 space-y-3 flex flex-col h-[380px]">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 text-[10px] font-mono text-zinc-400">
                <span className="text-cyan-400 font-bold">ZÉLLA HOST SIMULATOR</span>
                <span>CONFIDENCE: 99.4%</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 no-scrollbar text-xs">
                {chatLog.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[85%] ${
                      msg.sender === 'guest' ? 'ml-auto items-end' : 'mr-auto items-start'
                    }`}
                  >
                    <div
                      className={`p-3 rounded-2xl ${
                        msg.sender === 'guest'
                          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 rounded-tr-none'
                          : 'bg-white/[0.05] text-zinc-200 border border-white/[0.08] rounded-tl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[9px] font-mono text-zinc-500 mt-1">{msg.time}</span>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendSimulatedMsg} className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                <input
                  type="text"
                  value={simulatedMsg}
                  onChange={(e) => setSimulatedMsg(e.target.value)}
                  placeholder="Perguntar sobre chave, Wi-Fi, limpeza..."
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  type="submit"
                  className="w-10 h-10 rounded-xl bg-cyan-500 text-zinc-950 flex items-center justify-center font-bold active:scale-95 transition-all shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </motion.div>
        )}

      </main>

      {/* ──
          4. NATIVE MOBILE FLOATING BOTTOM NAVIGATION BAR (Fixed at bottom)
      ── */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#0a0a0f]/95 backdrop-blur-2xl border-t border-white/[0.08] px-2 py-2.5 z-50 flex items-center justify-around">
        
        {/* Tab 1: Financeiro */}
        <button
          onClick={() => setActiveTab('financeiro')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'financeiro' ? 'text-cyan-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[9px] font-mono">Radar Lucro</span>
        </button>

        {/* Tab 2: Fechaduras */}
        <button
          onClick={() => setActiveTab('fechaduras')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'fechaduras' ? 'text-amber-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <KeyRound className="w-5 h-5" />
          <span className="text-[9px] font-mono">Fechaduras</span>
        </button>

        {/* Tab 3: UPSELL */}
        <button
          onClick={() => setActiveTab('upsell')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 relative ${
            activeTab === 'upsell' ? 'text-amber-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Flame className="w-5 h-5" />
          <span className="text-[9px] font-mono">UPSELL</span>
          <span className="absolute -top-1 right-0 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        </button>

        {/* Tab 4: Escudo Anti-Ban */}
        <button
          onClick={() => setActiveTab('shield')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'shield' ? 'text-cyan-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-[9px] font-mono">Anti-Ban</span>
        </button>

        {/* Tab 5: Link-in-Bio */}
        <button
          onClick={() => setActiveTab('linkinbio')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'linkinbio' ? 'text-cyan-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <LinkIcon className="w-5 h-5" />
          <span className="text-[9px] font-mono">Bio PIX</span>
        </button>

        {/* Tab 6: Simulador */}
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

      {/* ──
          5. MENU LATERAL DRAWER
      ── */}
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
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2">
                    <img src="/SeuZella_Logo_site.png" alt="Seu Zélla" className="h-6 w-auto" />
                    <span className="font-mono text-xs font-bold text-cyan-400">ANFITRIÃO</span>
                  </div>
                  <button onClick={() => setIsMenuOpen(false)} className="p-1 rounded-lg bg-white/[0.04] text-zinc-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-white/[0.03] p-3 rounded-xl border border-white/[0.08] space-y-1">
                  <div className="text-[10px] font-mono text-zinc-400">PROPRIEDADE CONECTADA</div>
                  <div className="font-bold text-sm text-white">{propertyName}</div>
                  <div className="text-[10px] font-mono text-cyan-400">Superhost Protection Active</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-zinc-400 px-2 pb-1">MENU NATIVO</div>
                  
                  <button
                    onClick={() => { setActiveTab('financeiro'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-cyan-400 transition-all text-left"
                  >
                    <CreditCard className="w-4 h-4 text-cyan-400" />
                    <span>Radar de Economia</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('fechaduras'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-all text-left border border-amber-500/20"
                  >
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>Fechaduras & PINs</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('upsell'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-all text-left border border-amber-500/20"
                  >
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>⚡ UPSELL Temporada (7%)</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('shield'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-cyan-400 transition-all text-left"
                  >
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span>Escudo Anti-Ban</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('linkinbio'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-cyan-400 transition-all text-left"
                  >
                    <LinkIcon className="w-4 h-4 text-cyan-400" />
                    <span>Link na Bio Instagram</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.08] text-[10px] font-mono text-zinc-500 text-center">
                Seu Zélla Airbnb Host Super App v4.0 · Native Mobile
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ──
          6. SHEET CENTRAL DE NOTIFICAÇÕES
      ── */}
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
                  <h3 className="font-bold text-sm text-white font-mono">NOTIFICAÇÕES ANFITRIÃO</h3>
                </div>
                <button onClick={() => setIsNotificationsOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-2xl border transition-all ${
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
