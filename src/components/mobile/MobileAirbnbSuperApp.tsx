'use client';

// ==============================================================================
// SEU ZÉLLA SUPER APP MOBILE — AIRBNB HOST (Native Mobile App Experience)
// ==============================================================================
// - Design System: Cyber-Luxe Glassmorphism (#0a0a0f + Electric Cyan #06b6d4 / Blue #3b82f6)
// - Native Mobile App UX: Touch Targets min-h 48px, Floating HUD, Haptics & Gestures
// - Módulos Nativos: Radar de Economia (vs 15% Airbnb), Fechaduras & PINs, UPSELL Feriados (7%), Escudo Anti-Ban, Link na Bio PIX, Simulador
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useMobileDevicePing } from './useMobileDevicePing';
import { MobileYieldProfitWidget } from './MobileYieldProfitWidget';
import { DDCNotificationCenter } from '@/components/ddc/notifications/DDCNotificationCenter';
import { useDDCMobileNotifications } from '@/lib/notifications/use-mobile-notifications';
import {
  BRAND_CATALOG,
  listAllBrands,
  getBrandInfo,
  type LockBrand,
  type ProviderType,
} from '@/lib/locks/types';
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
  AlertTriangle,
  Cpu,
  Wifi,
  WifiOff,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Plus,
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

  // Visibilidade de Valores Financeiros ("Olhinho")
  const [showFinancialValues, setShowFinancialValues] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zella_show_financial_values');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const handleToggleFinancialValues = () => {
    setShowFinancialValues((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('zella_show_financial_values', String(next));
      }
      toast.info(next ? '👁️ Valores financeiros visíveis' : '🙈 Valores financeiros ocultos');
      return next;
    });
  };

  const formatMoney = (val: number | string) => {
    if (!showFinancialValues) return 'R$ ••••••';
    if (typeof val === 'number') {
      return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    return val.startsWith('R$') ? val : `R$ ${val}`;
  };

  const [propertyName, setPropertyName] = useState<string>('Flat Studio Jardins');
  const [aiActive, setAiActive] = useState<boolean>(true);
  const [pixShieldActive, setPixShieldActive] = useState<boolean>(true);
  const [time, setTime] = useState<string>('');
  const [pinCode, setPinCode] = useState<string>('849201');
  const [unlocking, setUnlocking] = useState<boolean>(false);

  // Multi-Properties list (10 Marcas BR & Staged Pairing)
  const [properties, setProperties] = useState([
    { id: '1', name: 'Flat Studio Jardins', battery: 94, model: 'Intelbras IFR 7000', brand: 'intelbras' as LockBrand, providerType: 'manual' as ProviderType, pairingStatus: 'connected' as const, pin: '849201', pinStatus: 'active' as const, pinValidFrom: '14:00', pinValidTo: '11:00', guest: 'Lucas Mendes', checkOut: 'Amanhã 11:00', price: 380, phone: '(11) 98822-1100' },
    { id: '2', name: 'Loft Copacabana Vista Mar', battery: 18, model: 'Tuya Smart Lock G2', brand: 'tuya' as LockBrand, providerType: 'api' as ProviderType, pairingStatus: 'connected' as const, pin: '472091', pinStatus: 'active' as const, pinValidFrom: '14:00', pinValidTo: '12:00', guest: 'Beatriz Costa', checkOut: 'Hoje 12:00', price: 550, phone: '(21) 99123-4567' },
    { id: '3', name: 'Studio Paulista Modern', battery: 88, model: 'TTLock X20 Gateway BLE', brand: 'ttlock' as LockBrand, providerType: 'api' as ProviderType, pairingStatus: 'connected' as const, pin: '310984', pinStatus: 'scheduled' as const, pinValidFrom: '14:00', pinValidTo: '11:00', guest: 'Vago', checkOut: '-', price: 320, phone: '' },
    { id: '4', name: 'Penthouse Leblon Design', battery: 91, model: 'Nuki Smart Lock 4.0 Pro', brand: 'nuki' as LockBrand, providerType: 'api' as ProviderType, pairingStatus: 'connected' as const, pin: '928104', pinStatus: 'active' as const, pinValidFrom: '15:00', pinValidTo: '12:00', guest: 'Mariana Rios', checkOut: 'Em 2 dias', price: 980, phone: '(21) 97788-1122' },
    { id: '5', name: 'Casa Boutique Trancoso', battery: 82, model: 'Igloohome Deadbolt 2S', brand: 'igloohome' as LockBrand, providerType: 'api' as ProviderType, pairingStatus: 'connected' as const, pin: '604192', pinStatus: 'active' as const, pinValidFrom: '14:00', pinValidTo: '11:00', guest: 'Felipe Alencar', checkOut: 'Amanhã 11:00', price: 1200, phone: '(73) 99881-2233' },
    { id: '6', name: 'Studio Vila Madalena Boho', battery: 65, model: 'August Wi-Fi Smart Lock', brand: 'august' as LockBrand, providerType: 'api' as ProviderType, pairingStatus: 'pairing' as const, pin: '551029', pinStatus: 'scheduled' as const, pinValidFrom: '14:00', pinValidTo: '11:00', guest: 'Vago', checkOut: '-', price: 340, phone: '' },
    { id: '7', name: 'Loft Itaim Bibi Executive', battery: 89, model: 'Yale YDM 4109 Smart', brand: 'yale' as LockBrand, providerType: 'manual' as ProviderType, pairingStatus: 'connected' as const, pin: '741982', pinStatus: 'active' as const, pinValidFrom: '14:00', pinValidTo: '11:00', guest: 'Rodrigo Sanches', checkOut: 'Hoje 11:00', price: 490, phone: '(11) 96655-4433' },
    { id: '8', name: 'Cabana Gramado Serra', battery: 76, model: 'Papaiz Eletronika FR 200', brand: 'papaiz' as LockBrand, providerType: 'manual' as ProviderType, pairingStatus: 'connected' as const, pin: '389104', pinStatus: 'scheduled' as const, pinValidFrom: '14:00', pinValidTo: '11:00', guest: 'Vago', checkOut: '-', price: 620, phone: '' },
    { id: '9', name: 'Flat Moema Prime', battery: 14, model: 'Philco PH200S Smart', brand: 'philco' as LockBrand, providerType: 'manual' as ProviderType, pairingStatus: 'registered' as const, pin: '190842', pinStatus: 'scheduled' as const, pinValidFrom: '14:00', pinValidTo: '11:00', guest: 'Vago', checkOut: '-', price: 410, phone: '' },
    { id: '10', name: 'Cobertura Barra Ocean', battery: 95, model: 'Samsung SHP-DP609 SmartThings', brand: 'samsung' as LockBrand, providerType: 'manual' as ProviderType, pairingStatus: 'connected' as const, pin: '820194', pinStatus: 'active' as const, pinValidFrom: '15:00', pinValidTo: '12:00', guest: 'Carla Vasconcelos', checkOut: 'Em 3 dias', price: 890, phone: '(21) 98112-9900' },
  ]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('1');

  // Locks & Governança state
  const [lockFilter, setLockFilter] = useState<'all' | 'api' | 'manual' | 'battery' | 'pairing'>('all');
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [pairingStep, setPairingStep] = useState<1 | 2 | 3>(1);
  const [pairingBrand, setPairingBrand] = useState<LockBrand>('ttlock');
  const [pairingPropName, setPairingPropName] = useState('');
  const [pairingDeviceId, setPairingDeviceId] = useState('');
  const [selectedLockForPanic, setSelectedLockForPanic] = useState<any | null>(null);
  const [selectedLockForWhatsApp, setSelectedLockForWhatsApp] = useState<any | null>(null);

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

  // Live Synced Notifications Engine
  const { unreadCount, simulateNotification } = useDDCMobileNotifications({
    niche: 'airbnb',
    pollInterval: 15000,
    enableSound: false,
    enableBrowserNotifications: false,
  });

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

  const handleGeneratePIN = async (propId?: string, propName?: string) => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const newPin = (arr[0] % 1000000).toString().padStart(6, '0');
    setPinCode(newPin);

    if (propId) {
      setProperties((prev) => prev.map((p) => p.id === propId ? { ...p, pin: newPin, pinStatus: 'active' as const } : p));
      toast.success(`🔑 Novo PIN Gerado para ${propName || 'Imóvel'}: ${newPin}# (Fail-Closed Ativo)`);
    } else {
      toast.success(`🔑 Novo PIN Temporário Gerado: ${newPin}#`);
    }
    simulateNotification();
  };

  const handleRemoteUnlock = (propName: string, brand?: LockBrand, providerType?: ProviderType) => {
    const isManual = providerType === 'manual';
    if (isManual) {
      toast.info(`🛡️ ${propName} (${brand?.toUpperCase()}): Fechadura offline/manual. Destrancamento remoto requer Gateway BLE/WiFi ativo ou digitação do PIN na porta.`);
      return;
    }
    setUnlocking(true);
    toast.info(`🔑 Enviando sinal criptografado via API ${brand?.toUpperCase()} para ${propName}...`);
    setTimeout(() => {
      setUnlocking(false);
      toast.success(`🔓 Fechadura do ${propName} ABERTA COM SUCESSO! Acesso liberado.`);
    }, 1200);
  };

  const handlePanicRevoke = (propId: string, propName: string) => {
    setProperties((prev) => prev.map((p) => p.id === propId ? { ...p, pin: '------', pinStatus: 'revoked' as const } : p));
    toast.error(`🚨 REVOGAÇÃO DE PÂNICO! PIN de ${propName} foi invalidado e fechadura trancada.`);
    setSelectedLockForPanic(null);
  };

  const handleSendWhatsAppPin = (prop: any) => {
    const phoneClean = (prop.phone || '5511988221100').replace(/\D/g, '');
    const msg = encodeURIComponent(
      `🏠 *${propertyName}* — Acesso ao Imóvel!\n\n` +
      `Olá, ${prop.guest && prop.guest !== 'Vago' ? prop.guest : 'Hóspede'}!\n` +
      `Imóvel: *${prop.name}*\n` +
      `🔑 *Seu PIN Digital:* \`${prop.pin}#\`\n` +
      `⏰ *Check-in a partir das:* ${prop.pinValidFrom || '14:00'} (Check-out até ${prop.pinValidTo || '11:00'})\n\n` +
      `Instruções: Digite os 6 dígitos seguidos de # no teclado da fechadura da porta.\n` +
      `Tenha uma ótima estadia!`
    );
    window.open(`https://wa.me/${phoneClean}?text=${msg}`, '_blank');
    toast.success(`📲 PIN de ${prop.name} enviado via WhatsApp!`);
    setSelectedLockForWhatsApp(null);
  };

  const handlePairNewLock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingPropName) {
      toast.error('Informe o nome do imóvel');
      return;
    }
    const brandInfo = getBrandInfo(pairingBrand);
    const id = (properties.length + 1).toString();
    const newPropObj = {
      id,
      name: pairingPropName,
      battery: 100,
      model: `${brandInfo?.label || pairingBrand} Smart Lock`,
      brand: pairingBrand,
      providerType: (brandInfo?.providerType || 'api') as ProviderType,
      pairingStatus: 'connected' as const,
      pin: Math.floor(100000 + Math.random() * 900000).toString(),
      pinStatus: 'scheduled' as const,
      pinValidFrom: '14:00',
      pinValidTo: '11:00',
      guest: 'Vago',
      checkOut: '-',
      price: 450,
      phone: '',
    };
    setProperties([newPropObj, ...properties]);
    toast.success(`🔐 Fechadura ${brandInfo?.label} pareada e vinculada a ${pairingPropName}!`);
    setIsPairingModalOpen(false);
    setPairingStep(1);
    setPairingPropName('');
    setPairingDeviceId('');
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
          {/* Botão de Status Motor Zélla (Limpo e Espaçado) */}
          <button
            onClick={handleToggleAI}
            className={`p-2 rounded-full border flex items-center justify-center transition-all min-h-[38px] min-w-[38px] active:scale-95 ${
              aiActive
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
            title={aiActive ? 'Motor Zélla: Ativo (Toque para pausar)' : 'Motor Zélla: Pausado (Toque para ativar)'}
            aria-label={aiActive ? 'Motor Zélla Ativo' : 'Motor Zélla Pausado'}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${aiActive ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-500'}`} />
          </button>

          {/* Botão Olhinho (Show / Hide Financial Values) */}
          <button
            onClick={handleToggleFinancialValues}
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 relative"
            title={showFinancialValues ? 'Ocultar valores financeiros' : 'Mostrar valores financeiros'}
            aria-label={showFinancialValues ? 'Ocultar valores financeiros' : 'Mostrar valores financeiros'}
          >
            {showFinancialValues ? <Eye className="w-4 h-4 text-cyan-400" /> : <EyeOff className="w-4 h-4 text-zinc-400" />}
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
          onClick={() => setActiveTab('financeiro')}
          className="shrink-0 px-3 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold font-mono flex items-center gap-1.5 active:scale-95 transition-all shadow-[0_0_12px_rgba(6,182,212,0.15)]"
        >
          <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
          <span>💰 Financeiro ({formatMoney(12500)})</span>
        </button>

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
            <MobileYieldProfitWidget niche="airbnb" showValues={showFinancialValues} />

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
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleFinancialValues}
                    className="p-1 rounded-md bg-white/[0.05] text-zinc-400 hover:text-cyan-400"
                    aria-label="Alternar exibição de valores"
                  >
                    {showFinancialValues ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-400" />}
                  </button>
                  <span className="text-[9px] font-mono font-extrabold bg-cyan-500 text-zinc-950 px-2 py-0.5 rounded-full">
                    100% SEU
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-black/40 border border-rose-500/20 space-y-1">
                  <span className="text-[10px] text-zinc-400 font-mono">Pelo Airbnb (-15%)</span>
                  <div className="text-sm font-bold text-rose-400 font-mono">-{formatMoney(1875)}</div>
                  <p className="text-[9px] text-zinc-500">Morderiam em comissões</p>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                  <span className="text-[10px] text-emerald-300 font-mono">Pelo Seu Zélla (0%)</span>
                  <div className="text-sm font-bold text-emerald-400 font-mono">+{formatMoney(1875)}</div>
                  <p className="text-[9px] text-emerald-400/80">No seu bolso via PIX</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.06]">
                <span className="text-zinc-400">Total Faturado no Mês:</span>
                <span className="font-mono font-extrabold text-white text-sm">{formatMoney(12500)}</span>
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
                      <div className="font-bold text-cyan-400 font-mono">{formatMoney(prop.price)}/dia</div>
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

        {/* ABA 2: FECHADURAS & CHECK-IN AUTÔNOMO (10 MARCAS BR & FAIL-CLOSED) */}
        {activeTab === 'fechaduras' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3.5">
            
            {/* Header & Botão Parear */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white font-mono">Fechaduras & Check-in</h2>
                <p className="text-[11px] text-zinc-400">10 Marcas do Mercado BR · Zero-Trust Fail-Closed</p>
              </div>
              <button
                onClick={() => {
                  setPairingStep(1);
                  setIsPairingModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-extrabold text-xs font-mono flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Parear</span>
              </button>
            </div>

            {/* PROTOCOLO FAIL-CLOSED & ZERO-TRUST BADGE */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-cyan-500/15 via-blue-950/20 to-black/60 border border-cyan-500/30 text-xs text-cyan-200 space-y-1.5 relative overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.08)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-cyan-300 font-mono text-[11px]">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>PROTOCOLO FAIL-CLOSED ATIVO</span>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                  ZERO PIN FALSO
                </span>
              </div>
              <p className="text-[10px] text-zinc-300 leading-relaxed font-mono">
                PINs emitidos exclusivamente após confirmação de reserva/pagamento. Ativação automática 15 min antes do check-in. Isolamento multi-tenant e tokens com Nonce anti-CSRF.
              </p>
            </div>

            {/* KPIs Métricos das 10 Marcas */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center">
                <span className="block text-[9px] font-mono text-zinc-500 uppercase">Total</span>
                <span className="text-sm font-extrabold text-white font-mono">{properties.length}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center">
                <span className="block text-[9px] font-mono text-cyan-400 uppercase">API Nuvem</span>
                <span className="text-sm font-extrabold text-cyan-400 font-mono">
                  {properties.filter((p) => p.providerType === 'api').length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center">
                <span className="block text-[9px] font-mono text-blue-400 uppercase">Manual</span>
                <span className="text-sm font-extrabold text-blue-400 font-mono">
                  {properties.filter((p) => p.providerType === 'manual').length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center">
                <span className="block text-[9px] font-mono text-rose-400 uppercase">Bateria &lt;20%</span>
                <span className={`text-sm font-extrabold font-mono ${properties.some((p) => p.battery < 20) ? 'text-rose-400 animate-pulse' : 'text-zinc-400'}`}>
                  {properties.filter((p) => p.battery < 20).length}
                </span>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-mono">
              <button
                onClick={() => setLockFilter('all')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap border transition-all ${
                  lockFilter === 'all'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-white font-bold'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400'
                }`}
              >
                Todas ({properties.length})
              </button>
              <button
                onClick={() => setLockFilter('api')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap border transition-all ${
                  lockFilter === 'api'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400'
                }`}
              >
                ⚡ API Nuvem ({properties.filter((p) => p.providerType === 'api').length})
              </button>
              <button
                onClick={() => setLockFilter('manual')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap border transition-all ${
                  lockFilter === 'manual'
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 font-bold'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400'
                }`}
              >
                🇧🇷 Modo Manual ({properties.filter((p) => p.providerType === 'manual').length})
              </button>
              <button
                onClick={() => setLockFilter('battery')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap border transition-all ${
                  lockFilter === 'battery'
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400'
                }`}
              >
                ⚠️ Bateria Baixa ({properties.filter((p) => p.battery < 20).length})
              </button>
            </div>

            {/* Grid de Fechaduras dos Imóveis */}
            <div className="space-y-3">
              {properties
                .filter((p) => {
                  if (lockFilter === 'api') return p.providerType === 'api';
                  if (lockFilter === 'manual') return p.providerType === 'manual';
                  if (lockFilter === 'battery') return p.battery < 20;
                  if (lockFilter === 'pairing') return p.pairingStatus === 'pairing' || p.pairingStatus === 'registered';
                  return true;
                })
                .map((prop) => {
                  const brandInfo = getBrandInfo(prop.brand);
                  const isApi = prop.providerType === 'api';
                  const isCriticalBattery = prop.battery < 20;

                  return (
                    <div
                      key={prop.id}
                      className="p-4 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] space-y-3 relative overflow-hidden"
                    >
                      {/* Top row: Property name + Brand & Model */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-lg shrink-0">
                            {brandInfo?.logo || '🔐'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-bold text-white">{prop.name}</h4>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                prop.guest && prop.guest !== 'Vago'
                                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                                  : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400'
                              }`}>
                                {prop.guest && prop.guest !== 'Vago' ? 'OCUPADO' : 'VAGO'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono text-zinc-400">
                              <span className="text-zinc-300 font-bold">{brandInfo?.label || prop.brand}</span>
                              <span>·</span>
                              <span>{prop.model}</span>
                            </div>
                          </div>
                        </div>

                        {/* Battery status */}
                        <div className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-1 rounded-lg border ${
                          isCriticalBattery
                            ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 animate-pulse'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                          <Battery className="w-3.5 h-3.5" />
                          <span>{prop.battery}%</span>
                        </div>
                      </div>

                      {/* Staged Pairing & Provider Status */}
                      <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-white/[0.04]">
                        <div className="flex items-center gap-1.5">
                          {prop.pairingStatus === 'connected' ? (
                            <span className="text-cyan-400 flex items-center gap-1 font-bold">
                              <CheckCircle2 className="w-3 h-3" /> Provider Ready
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1 font-bold">
                              <RefreshCw className="w-3 h-3 animate-spin" /> Pareamento BLE/WiFi
                            </span>
                          )}
                          <span className="text-zinc-600">|</span>
                          {isApi ? (
                            <span className="text-cyan-300 flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5" /> API Cloud
                            </span>
                          ) : (
                            <span className="text-zinc-400 flex items-center gap-0.5">
                              <Cpu className="w-2.5 h-2.5" /> Manual Offline
                            </span>
                          )}
                        </div>

                        {isCriticalBattery && (
                          <button
                            onClick={() => toast.success(`🔋 Alerta de troca de pilhas enviado para o anfitrião (${prop.name})`)}
                            className="text-rose-400 text-[9px] underline font-bold"
                          >
                            Pedir Troca
                          </button>
                        )}
                      </div>

                      {/* PIN Box with Temporal Access Window */}
                      <div className="bg-black/40 p-3 rounded-2xl border border-white/[0.06] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="block text-[9px] font-mono text-zinc-500 uppercase">
                              PIN Digital do Hóspede ({prop.guest || 'Aguardando'})
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-base font-extrabold text-amber-400 tracking-wider">
                                {prop.pin}#
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                {prop.pinStatus === 'active' ? 'ATIVO' : 'AGENDADO (-15m)'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${prop.pin}#`);
                                toast.success(`📋 PIN ${prop.pin}# copiado!`);
                              }}
                              className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/10 text-zinc-300 text-xs active:scale-95"
                              title="Copiar PIN"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleGeneratePIN(prop.id, prop.name)}
                              className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-zinc-300 text-[10px] font-mono active:scale-95"
                            >
                              Novo PIN
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 pt-1 border-t border-white/[0.04]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-zinc-500" />
                            Check-in: {prop.pinValidFrom || '14:00'} → Check-out: {prop.pinValidTo || '11:00'}
                          </span>
                          <span className="text-zinc-500">Digite PIN + #</span>
                        </div>
                      </div>

                      {/* Action Buttons: WhatsApp 1-Clique, Destrancar, Pânico */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          onClick={() => setSelectedLockForWhatsApp(prop)}
                          className="py-2.5 px-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold font-mono flex items-center justify-center gap-1 min-h-[44px] active:scale-95 transition-all"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </button>

                        <button
                          onClick={() => handleRemoteUnlock(prop.name, prop.brand, prop.providerType)}
                          disabled={unlocking}
                          className="py-2.5 px-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold font-mono flex items-center justify-center gap-1 min-h-[44px] active:scale-95 transition-all"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>{unlocking ? 'Abrindo...' : 'Destrancar'}</span>
                        </button>

                        <button
                          onClick={() => setSelectedLockForPanic(prop)}
                          className="py-2.5 px-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-bold font-mono flex items-center justify-center gap-1 min-h-[44px] active:scale-95 transition-all"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Pânico</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                  <span className="text-base font-extrabold text-amber-400 font-mono">+{formatMoney(dailyIncrease)}</span>
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
                  <span className="font-mono font-bold text-white">{formatMoney(upsellExcedent)}</span>
                </div>
                <div className="flex justify-between text-cyan-400 font-bold border-t border-white/[0.06] pt-1.5">
                  <span>💰 Seu Lucro Líquido (93%):</span>
                  <span className="font-mono text-sm">{formatMoney(Math.round(hostProfit))}</span>
                </div>
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>Taxa Seu Zélla (7%):</span>
                  <span className="font-mono text-amber-400">{formatMoney(Math.round(zellaFee))}</span>
                </div>
              </div>

              <button
                onClick={() => toast.success(`⚡ UPSELL ATIVADO! +${formatMoney(dailyIncrease)}/diária aplicado para ${currentHoliday.name}`)}
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
                  ATIVO
                </span>
              </div>

              <p className="text-xs text-zinc-300">
                Página mobile de alta conversão para biografia do Instagram com botão de reserva direta via PIX 1-clique (0% de comissão).
              </p>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
                <div className="text-xs font-mono text-cyan-300 truncate">
                  seuzella.com/p/{propertyName.toLowerCase().replace(/\s+/g, '-')}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://seuzella.com/p/${propertyName.toLowerCase().replace(/\s+/g, '-')}`);
                    toast.success('Link copiado!');
                  }}
                  className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:text-white"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

          </motion.div>
        )}

        {/* ABA 6: SIMULADOR DE DIÁRIAS */}
        {activeTab === 'simulador' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white font-mono">SIMULADOR MOTOR ZÉLLA</h3>
                </div>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  24H ONLINE
                </span>
              </div>

              <div className="h-64 overflow-y-auto space-y-2 pr-1 no-scrollbar text-xs">
                {chatLog.map((chat, index) => (
                  <div
                    key={index}
                    className={`flex flex-col max-w-[85%] ${
                      chat.sender === 'guest' ? 'ml-auto items-end' : 'mr-auto items-start'
                    }`}
                  >
                    <div
                      className={`p-3 rounded-2xl ${
                        chat.sender === 'guest'
                          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 rounded-tr-none'
                          : 'bg-white/[0.05] text-zinc-200 border border-white/[0.08] rounded-tl-none'
                      }`}
                    >
                      {chat.text}
                    </div>
                    <span className="text-[9px] font-mono text-zinc-500 mt-1">{chat.time}</span>
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
          <DollarSign className="w-5 h-5" />
          <span className="text-[9px] font-mono">Financeiro</span>
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
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all text-left border border-cyan-500/20"
                  >
                    <DollarSign className="w-4 h-4 text-cyan-400" />
                    <span>💰 Visão Financeira & Radar</span>
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
          6. SHEET CENTRAL DE NOTIFICAÇÕES (Canônica & Alinhada com DDC)
      ── */}
      <DDCNotificationCenter
        open={isNotificationsOpen}
        onOpenChange={setIsNotificationsOpen}
        niche="airbnb"
      />

      {/* ──
          7. MODAL PAREAMENTO EM 3 ESTÁGIOS (10 MARCAS BR)
      ── */}
      <AnimatePresence>
        {isPairingModalOpen && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#13131a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 shadow-[0_0_35px_rgba(6,182,212,0.2)] max-h-[90vh] overflow-y-auto"
            >
              {/* Header com etapas */}
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h3 className="font-bold text-sm text-white font-mono uppercase">Parear Fechadura</h3>
                    <span className="text-[10px] text-zinc-400 font-mono">Etapa {pairingStep} de 3 · Staged Pairing</span>
                  </div>
                </div>
                <button onClick={() => setIsPairingModalOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Step 1: Escolha da Marca (10 Marcas) */}
              {pairingStep === 1 && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-300">
                    Selecione a fabricante da fechadura instalada no imóvel:
                  </p>

                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {listAllBrands().map((brand) => (
                      <button
                        key={brand.id}
                        type="button"
                        onClick={() => setPairingBrand(brand.id)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          pairingBrand === brand.id
                            ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                            : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base">{brand.logo}</span>
                          <span className={`text-[8px] font-mono px-1 py-0.2 rounded font-bold uppercase ${
                            brand.apiAvailable
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {brand.apiAvailable ? 'API' : 'Manual'}
                          </span>
                        </div>
                        <div className="font-bold text-xs mt-1 text-white truncate">{brand.label}</div>
                        <div className="text-[9px] font-mono text-zinc-500 truncate">{brand.popularModels[0]}</div>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPairingStep(2)}
                    className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold font-mono text-xs shadow-[0_0_15px_#06b6d4] active:scale-95 transition-all"
                  >
                    Avançar para Vinculação &gt;
                  </button>
                </div>
              )}

              {/* Step 2: Imóvel & Hardware ID */}
              {pairingStep === 2 && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200">
                    <span className="font-bold">Marca Selecionada:</span> {getBrandInfo(pairingBrand)?.label} ({getBrandInfo(pairingBrand)?.apiAvailable ? 'API Nuvem' : 'Manual Offline'})
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 uppercase">Nome do Imóvel / Flat *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Studio Jardins Design 402"
                      value={pairingPropName}
                      onChange={(e) => setPairingPropName(e.target.value)}
                      className="w-full mt-1 bg-white/[0.04] border border-white/[0.1] rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 uppercase">
                      {getBrandInfo(pairingBrand)?.apiAvailable ? 'Device ID / MAC Bluetooth *' : 'Código Serial / Identificador (Opcional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: TTLOCK-DEV-9081 ou IFR-7000-02"
                      value={pairingDeviceId}
                      onChange={(e) => setPairingDeviceId(e.target.value)}
                      className="w-full mt-1 bg-white/[0.04] border border-white/[0.1] rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 outline-none font-mono"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPairingStep(1)}
                      className="flex-1 p-2.5 rounded-xl bg-white/[0.04] text-zinc-300 font-bold text-xs"
                    >
                      &lt; Voltar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPairingStep(3)}
                      className="flex-1 p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold font-mono text-xs shadow-[0_0_15px_#06b6d4]"
                    >
                      Verificar &gt;
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Teste Fail-Closed & Conclusão */}
              {pairingStep === 3 && (
                <div className="space-y-3.5 text-center">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <ShieldCheck className="w-7 h-7" />
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white font-mono">Pronto para Pareamento!</h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      O motor Zélla validou as credenciais fail-closed e a fechadura <strong>{getBrandInfo(pairingBrand)?.label}</strong> será integrada ao imóvel <strong>{pairingPropName}</strong>.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] text-left text-[11px] font-mono space-y-1 text-zinc-300">
                    <div><strong>Imóvel:</strong> {pairingPropName}</div>
                    <div><strong>Fabricante:</strong> {getBrandInfo(pairingBrand)?.label}</div>
                    <div><strong>Tipo de PIN:</strong> {getBrandInfo(pairingBrand)?.offlinePinSupported ? 'Online & Offline Algorítmico' : 'Online Temporário'}</div>
                    <div><strong>Segurança:</strong> Zero PIN Simulado · Fail-Closed</div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPairingStep(2)}
                      className="flex-1 p-2.5 rounded-xl bg-white/[0.04] text-zinc-300 font-bold text-xs"
                    >
                      &lt; Voltar
                    </button>
                    <button
                      type="button"
                      onClick={handlePairNewLock}
                      className="flex-1 p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-mono font-extrabold text-xs shadow-[0_0_20px_#06b6d4] active:scale-95 transition-all"
                    >
                      Concluir Pareamento
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ──
          8. MODAL REVOGAÇÃO DE PÂNICO (FAIL-CLOSED)
      ── */}
      <AnimatePresence>
        {selectedLockForPanic && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#181115] border border-rose-500/40 rounded-3xl p-5 space-y-4 shadow-[0_0_35px_rgba(244,63,94,0.25)]"
            >
              <div className="flex items-center gap-3 border-b border-rose-500/20 pb-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-rose-200 font-mono">REVOGAÇÃO DE PÂNICO</h3>
                  <span className="text-[10px] text-rose-400 font-mono">{selectedLockForPanic.name}</span>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Você tem certeza que deseja revogar <strong>imediatamente</strong> o PIN do hóspede ({selectedLockForPanic.guest && selectedLockForPanic.guest !== 'Vago' ? selectedLockForPanic.guest : 'Hóspede Atual'})? A fechadura será bloqueada e o PIN atual deixará de funcionar na mesma hora.
              </p>

              <div className="p-3 rounded-xl bg-black/40 border border-rose-500/20 text-[11px] font-mono text-rose-300">
                ⚠️ Protocolo Fail-Closed: Qualquer tentativa de digitação do PIN anterior será recusada no teclado.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLockForPanic(null)}
                  className="flex-1 p-2.5 rounded-xl bg-white/[0.05] text-zinc-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handlePanicRevoke(selectedLockForPanic.id, selectedLockForPanic.name)}
                  className="flex-1 p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono font-extrabold text-xs shadow-[0_0_15px_rgba(244,63,94,0.4)] active:scale-95"
                >
                  Confirmar Revogação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ──
          9. MODAL DISPARO WHATSAPP DO PIN
      ── */}
      <AnimatePresence>
        {selectedLockForWhatsApp && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#13131a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 shadow-[0_0_35px_rgba(6,182,212,0.2)]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-sm text-white font-mono">DISPARAR PIN VIA WHATSAPP</h3>
                </div>
                <button onClick={() => setSelectedLockForWhatsApp(null)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Preview da Mensagem Oficial</span>
                <div className="p-3.5 rounded-2xl bg-black/50 border border-cyan-500/20 text-xs text-zinc-200 font-mono space-y-2 leading-relaxed">
                  <div className="text-cyan-400 font-bold">🏠 {propertyName} — Acesso Liberado!</div>
                  <div>Olá, {selectedLockForWhatsApp.guest && selectedLockForWhatsApp.guest !== 'Vago' ? selectedLockForWhatsApp.guest : 'Hóspede'}!</div>
                  <div>Imóvel: <strong>{selectedLockForWhatsApp.name}</strong></div>
                  <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-bold">
                    🔑 Seu PIN: {selectedLockForWhatsApp.pin}#
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    ⏰ Janela de Validade: {selectedLockForWhatsApp.pinValidFrom || '14:00'} às {selectedLockForWhatsApp.pinValidTo || '11:00'}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Digite os 6 dígitos seguidos de # na fechadura da porta. Tenha uma ótima estadia!
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLockForWhatsApp(null)}
                  className="flex-1 p-2.5 rounded-xl bg-white/[0.04] text-zinc-300 font-bold text-xs"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => handleSendWhatsAppPin(selectedLockForWhatsApp)}
                  className="flex-1 p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-mono font-extrabold text-xs shadow-[0_0_20px_#06b6d4] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Agora</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
