'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { DDCHeader } from '@/components/ddc/DDCHeader';
import { RevenueMetrics } from '@/components/ddc/RevenueMetrics';
import { AILiveFeed } from '@/components/ddc/AILiveFeed';

import { TrainingCenter } from '@/components/ddc/TrainingCenter';
import { QuickActionsBar } from '@/components/ddc/QuickActionsBar';
import { useDDCMetrics } from '@/lib/ddc/use-ddc-metrics';
import { useAILiveFeed } from '@/lib/ddc/use-ai-live-feed';
import { useGuestPipeline } from '@/lib/ddc/use-guest-pipeline';
import { useDDCNotifications } from '@/lib/ddc/use-ddc-notifications';
import { useDDCDeliveries } from '@/lib/ddc/use-ddc-deliveries';
import { mockRevenueMetrics } from '@/lib/ddc/mock-data';
import { adaptRevenueMetrics } from '@/lib/ddc/ddc-mapper';
import type { AIStatus } from '@/types/ddc';
import { ZelladorChat } from '@/components/ddc/ZelladorChat';
import { LinkInBioConfig } from '@/components/linkinbio/LinkInBioConfig';
import { LinkInBioDDC } from '@/components/linkinbio/LinkInBioDDC';
import { PlanGate, PlanUpgradeBanner } from '@/components/ddc/PlanGate';
import { ZellaAirBTab } from '@/components/ddc/ZellaAirBTab';
import { LocksTab } from '@/components/ddc/LocksTab';
import { DDCUpsellTab } from '@/components/ddc/DDCUpsellTab';
import { DDCBillingTab } from '@/components/ddc/DDCBillingTab';
import { type PlanTier, DDC_TABS, hasAccess, getNextTier, PLAN_DISPLAY } from '@/lib/plan-features';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Toaster, toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Settings,
  MessageSquare,
  Terminal,
  Building2,
  Smartphone,
  CreditCard,
  Sliders,
  Sparkles,
  Lock,
  CheckCircle2,
  Activity,
  ChevronRight,
  ShieldCheck,
  Save,
  Loader2,
  Info,
  X,
  Zap,
  Phone,
  Compass,
  MessageCircle,
  Users,
  Calendar,
  TrendingUp,
  Bell,
  GraduationCap,
  Search,
  Filter,
  Clock,
  Star,
  CheckCheck,
  Download,
  Plus,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  PhoneCall,
  AlertCircle,
  UserCheck,
  RefreshCw,
  BellOff,
  Copy,
  Home,
} from 'lucide-react';

export default function DDCDashboardContent() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login?callbackUrl=/ddc');
    }
  }, [sessionStatus, router]);

  // Custom hooks
  const { metrics, aiStatus, isLoading } = useDDCMetrics('today', true);
  const { deliveries } = useDDCDeliveries('month', true);
  const { conversations, selectedConversation, selectConversation, sendMessage, escalateConversation } = useAILiveFeed();
  const { allGuests } = useGuestPipeline();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useDDCNotifications(true);

  // Local state — navigation
  const [activeTab, setActiveTab] = useState('overview');
  const [propertyName, setPropertyName] = useState('Minha Pousada');
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('gratuito');
  const [isBetaPartner, setIsBetaPartner] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);

  // Settings states
  const [subTab, setSubTab] = useState('geral');
  const [showRecargaMock, setShowRecargaMock] = useState(false);
  const [showCancelFlow, setShowCancelFlow] = useState(false);
  const [cancelStep, setCancelStep] = useState<'warning' | 'offer'>('warning');
  const [isLinkInBioOnly, setIsLinkInBioOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editPropertyName, setEditPropertyName] = useState('');
  const [aiVoiceTone, setAiVoiceTone] = useState('friendly');

  // Bookings state
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsFilter, setBookingsFilter] = useState('all');

  // Analytics state — raw API data (avoids RevenueMetrics type mismatch)
  const [analyticsData, setAnalyticsData] = useState<Record<string, any>>({
    today: {}, week: {}, month: {}
  });
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Fetch raw analytics data when analytics tab is active
  useEffect(() => {
    if (activeTab !== 'analytics') return;
    setAnalyticsLoading(true);
    Promise.all([
      fetch('/api/ddc/metrics?period=today').then(r => r.json()),
      fetch('/api/ddc/metrics?period=week').then(r => r.json()),
      fetch('/api/ddc/metrics?period=month').then(r => r.json()),
    ]).then(([todayRes, weekRes, monthRes]) => {
      setAnalyticsData({
        today: todayRes?.data || {},
        week: weekRes?.data || {},
        month: monthRes?.data || {},
      });
    }).catch(() => {}).finally(() => setAnalyticsLoading(false));
  }, [activeTab]);

  // Guests state
  const [guestSearch, setGuestSearch] = useState('');
  const [guestStatusFilter, setGuestStatusFilter] = useState('all');

  // Messages state
  const [msgSearch, setMsgSearch] = useState('');
  const [msgStatusFilter, setMsgStatusFilter] = useState('all');

  // Quick Actions states
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);
  const [pixAmount, setPixAmount] = useState('50');
  const [pixReason, setPixReason] = useState('Taxa de Higienização de Pet');
  const [generatedPixPayload, setGeneratedPixPayload] = useState<string | null>(null);
  const [isSendingPix, setIsSendingPix] = useState(false);

  // New Chat modal states
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatMsg, setNewChatMsg] = useState('Olá! Gostaria de saber mais sobre as diárias.');
  const [isConnectingWhatsApp, setIsConnectingWhatsApp] = useState(false);

  const handleCreateNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatName.trim() || !newChatPhone.trim()) {
      toast.error('Preencha o nome e o telefone do hóspede.');
      return;
    }
    const cleanPhone = newChatPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      toast.error('Insira um telefone válido com DDD.');
      return;
    }

    toast.promise(
      fetch('/api/ddc/simulate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newChatMsg,
          guestName: newChatName.trim(),
          guestPhone: cleanPhone
        }),
      }).then(async r => {
        if (!r.ok) throw new Error();
        const res = await r.json();
        // Se a conversa foi criada com sucesso, seleciona ela e atualiza a UI
        if (res?.data?.conversationId) {
          selectConversation(res.data.conversationId);
        }
        return res;
      }),
      {
        loading: 'Enviando mensagem inicial e conectando...',
        success: 'Nova conversa criada! Zélla assumiu o atendimento no WhatsApp.',
        error: 'Erro ao iniciar conversa.'
      }
    );

    setIsNewChatOpen(false);
    setNewChatName('');
    setNewChatPhone('');
  };

  // Trial Onboarding states
  const [onboardingChecked, setOnboardingChecked] = useState<{
    voiceTone: boolean;
    faq: boolean;
    linkinbio: boolean;
    simulator: boolean;
  }>({
    voiceTone: false,
    faq: false,
    linkinbio: false,
    simulator: false,
  });

  // Load from localStorage on client-side mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('zehla_ddc_onboarding');
      if (saved) {
        setOnboardingChecked(JSON.parse(saved));
      } else {
        const initial = {
          voiceTone: true,
          faq: true,
          linkinbio: false,
          simulator: false,
        };
        setOnboardingChecked(initial);
        localStorage.setItem('zehla_ddc_onboarding', JSON.stringify(initial));
      }
    } catch {}
  }, []);

  const markOnboardingStep = (step: 'voiceTone' | 'faq' | 'linkinbio' | 'simulator', value: boolean) => {
    setOnboardingChecked(prev => {
      const next = { ...prev, [step]: value };
      try {
        localStorage.setItem('zehla_ddc_onboarding', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const getCompletedCount = () => {
    let count = 0;
    if (onboardingChecked.voiceTone) count++;
    if (onboardingChecked.faq) count++;
    if (onboardingChecked.linkinbio) count++;
    if (onboardingChecked.simulator) count++;
    return count;
  };

  const progressPercentage = Math.round((getCompletedCount() / 4) * 100);

  const handleQuickActionClick = (actionId: string) => {
    if (actionId === 'whatsapp') {
      if (!selectedConversation) {
        toast.error('Selecione uma conversa ativa no Live Feed para abrir no WhatsApp.');
        return;
      }
      const phone = selectedConversation.phoneNumber;
      if (!phone) {
        toast.error('Telefone do hóspede não encontrado.');
        return;
      }
      toast.success(`Abrindo WhatsApp Web para ${selectedConversation.guestName || 'Hóspede'}...`);
      window.open(`https://web.whatsapp.com/send?phone=${phone}`, '_blank');
      return;
    }

    setActiveQuickAction(actionId);
    setGeneratedPixPayload(null);
  };

  const generatePix = () => {
    const val = parseFloat(pixAmount);
    if (isNaN(val) || val <= 0) {
      toast.error('Por favor, insira um valor válido maior que zero.');
      return;
    }
    const cleanReason = pixReason.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15);
    const cleanAmount = val.toFixed(2);
    const payload = `00020101021226870014br.gov.bcb.pix2565pix@seuzella.com.br52040000530398654${cleanAmount.length.toString().padStart(2, '0')}${cleanAmount}5802BR5916Pousada Serenity6009Paraty62070503${cleanReason}`;
    setGeneratedPixPayload(payload);
    toast.success('Chave Pix copia e cola gerada com sucesso!');
  };

  const sendPixToChat = async () => {
    if (!selectedConversation || !generatedPixPayload) return;
    setIsSendingPix(true);
    try {
      const messageText = `Olá, ${selectedConversation.guestName}! Para facilitar, segue o código Pix copia e cola gerado referente a: *${pixReason}* no valor de *R$ ${parseFloat(pixAmount).toFixed(2)}*.\n\nCopia e Cola:\n\`\`\`${generatedPixPayload}\`\`\`\n\nPor favor, envie o comprovante por aqui assim que concluir!`;
      await sendMessage(selectedConversation.id, messageText);
      toast.success('Pix enviado diretamente no WhatsApp do hóspede!');
      setActiveQuickAction(null);
      setGeneratedPixPayload(null);
    } catch {
      toast.error('Falha ao enviar mensagem de Pix no chat.');
    } finally {
      setIsSendingPix(false);
    }
  };

  // Use session plan as initial value, then refine from API
  useEffect(() => {
    // Set plan from session immediately if available
    if (session?.user) {
      const sessionPlan = (session.user as any)?.plan;
      if (sessionPlan) {
        setCurrentPlan(sessionPlan as PlanTier);
      }
    }
  }, [session]);

  useEffect(() => {
    fetch('/api/ddc/property-name')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        const name = d.name || 'Minha Pousada';
        setPropertyName(name);
        setEditPropertyName(name);
        setCurrentPlan(d.plan || 'gratuito');
      })
      .catch(() => {
        setPropertyName('Minha Pousada');
        setEditPropertyName('Minha Pousada');
        // Keep session plan if available, otherwise default to gratuito
        if (!(session?.user as any)?.plan) {
          setCurrentPlan('gratuito' as PlanTier);
        }
      });
  }, [session]);

  // Fetch bookings when tab is active
  useEffect(() => {
    if (activeTab !== 'bookings') return;
    setBookingsLoading(true);
    const params = bookingsFilter !== 'all' ? `?status=${bookingsFilter}` : '';
    fetch(`/api/ddc/bookings${params}`)
      .then(r => r.json())
      .then(d => setBookings(d?.data?.items || []))
      .catch(() => setBookings([]))
      .finally(() => setBookingsLoading(false));
  }, [activeTab, bookingsFilter]);

  const aiStatusLocal: AIStatus = aiStatus?.status || 'online';

  const handleActionClick = (action: string) => {
    setActiveTab(action);
  };

  const handleNotificationClick = () => {
    setActiveTab('notifications');
  };

  async function handleSaveGeral(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch('/api/ddc/property-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editPropertyName }),
      });
      if (response.ok) {
        setPropertyName(editPropertyName);
        toast.success('Configurações da pousada salvas com sucesso!');
      } else {
        toast.error('Erro ao salvar configurações.');
      }
    } catch {
      toast.error('Erro de conexão ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  }

  const fadeIn = {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: 'easeOut' as const }
    }
  } as const;

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.07 }
    }
  };

  // ── Helpers 
  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      active: { label: 'Ativo', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      escalated: { label: 'Escalado', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
      resolved: { label: 'Resolvido', cls: 'bg-zinc-700/50 text-zinc-400 border-zinc-700' },
      pending: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      confirmed: { label: 'Confirmada', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      checked_in: { label: 'Check-in', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      checked_out: { label: 'Check-out', cls: 'bg-zinc-700/50 text-zinc-400 border-zinc-700' },
      cancelled: { label: 'Cancelada', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
      new: { label: 'Novo', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    };
    const cfg = map[status] || { label: status, cls: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
    return (
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${cfg.cls}`}>
        {cfg.label}
      </span>
    );
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (d: string | Date) => {
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  // ── Section Header Component (inline) 
  const SectionHeader = ({
    icon: Icon,
    title,
    subtitle,
    actions,
  }: {
    icon: React.ElementType;
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
  }) => (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-sm font-extrabold text-white">{title}</h2>
          {subtitle && <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );

  // ── VIEW RENDERER 
  const renderActiveTab = () => {
    // ── OVERVIEW (Dashboard) 
    if (activeTab === 'overview') {
      return (
        <div className="space-y-5">
          {/* Top Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* LEFT PANEL — 1/3 width */}
            <div className="space-y-4">
              <AnimatePresence>
                {showOnboarding && (
                  <motion.div
                    initial={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="bg-gradient-to-b from-[#121216]/90 to-[#0a0a0f]/90 border border-white/[0.06] rounded-xl overflow-hidden shadow-2xl backdrop-blur-md"
                  >
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🚀</span>
                          <span className="text-xs font-extrabold text-white uppercase tracking-wider">Ativação do Trial</span>
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 rounded font-bold uppercase">7 dias grátis</span>
                        </div>
                        <button
                          onClick={() => { setShowOnboarding(false); toast.info('Painel de trial ocultado.'); }}
                          className="p-1 rounded hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-zinc-400 font-bold">{getCompletedCount()} de 4 etapas concluídas</span>
                          <span className="text-emerald-400 font-extrabold font-mono">{progressPercentage}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.02]">
                          <motion.div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercentage}%` }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Steps Checklist */}
                    <div className="p-4 space-y-3.5">
                      {/* Step 1: Tom de Voz */}
                      <div className="flex items-start gap-3 group">
                        <button
                          onClick={() => markOnboardingStep('voiceTone', !onboardingChecked.voiceTone)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer mt-0.5 shrink-0 ${
                            onboardingChecked.voiceTone
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-zinc-700 hover:border-zinc-500 bg-transparent'
                          }`}
                        >
                          {onboardingChecked.voiceTone && <CheckCircle2 className="w-3.5 h-3.5 text-black stroke-[3px]" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <button
                            onClick={() => {
                              setActiveTab('settings');
                              setSubTab('geral');
                              markOnboardingStep('voiceTone', true);
                              toast.info('Personalize o Tom de Voz nas configurações da IA.');
                            }}
                            className="text-left font-bold text-xs text-white hover:text-emerald-400 transition-colors block"
                          >
                            1. Definir tom de voz da IA
                          </button>
                          <span className="text-[10px] text-zinc-500 block mt-0.5 leading-relaxed">
                            Escolha a personalidade do Zélla (ex: simpático, formal ou direto).
                          </span>
                        </div>
                      </div>

                      {/* Step 2: Indexar FAQ */}
                      <div className="flex items-start gap-3 group border-t border-white/[0.03] pt-3">
                        <button
                          onClick={() => markOnboardingStep('faq', !onboardingChecked.faq)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer mt-0.5 shrink-0 ${
                            onboardingChecked.faq
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-zinc-700 hover:border-zinc-500 bg-transparent'
                          }`}
                        >
                          {onboardingChecked.faq && <CheckCircle2 className="w-3.5 h-3.5 text-black stroke-[3px]" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <button
                            onClick={() => {
                              setActiveTab('training');
                              markOnboardingStep('faq', true);
                              toast.info('Indexe regras no Centro de Treinamento.');
                            }}
                            className="text-left font-bold text-xs text-white hover:text-emerald-400 transition-colors block"
                          >
                            2. Indexar regras & FAQ da pousada
                          </button>
                          <span className="text-[10px] text-zinc-500 block mt-0.5 leading-relaxed">
                            Ensine políticas de pets, horários de check-in e comodidades.
                          </span>
                        </div>
                      </div>

                      {/* Step 3: Link-in-Bio */}
                      <div className="flex items-start gap-3 group border-t border-white/[0.03] pt-3">
                        <button
                          onClick={() => markOnboardingStep('linkinbio', !onboardingChecked.linkinbio)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer mt-0.5 shrink-0 ${
                            onboardingChecked.linkinbio
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-zinc-700 hover:border-zinc-500 bg-transparent'
                          }`}
                        >
                          {onboardingChecked.linkinbio && <CheckCircle2 className="w-3.5 h-3.5 text-black stroke-[3px]" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <button
                            onClick={() => {
                              setActiveTab('settings');
                              setSubTab('linkinbio');
                              markOnboardingStep('linkinbio', true);
                              toast.info('Personalize o seu Link-in-Bio.');
                            }}
                            className="text-left font-bold text-xs text-white hover:text-emerald-400 transition-colors block"
                          >
                            3. Customizar página Link-in-Bio
                          </button>
                          <span className="text-[10px] text-zinc-500 block mt-0.5 leading-relaxed">
                            Sua vitrine virtual de reservas para o Instagram ou WhatsApp.
                          </span>
                        </div>
                      </div>

                      {/* Step 4: Conectar WhatsApp */}
                      <div className="flex items-start gap-3 group border-t border-white/[0.03] pt-3">
                        <button
                          onClick={() => markOnboardingStep('simulator', !onboardingChecked.simulator)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer mt-0.5 shrink-0 ${
                            onboardingChecked.simulator
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-zinc-700 hover:border-zinc-500 bg-transparent'
                          }`}
                        >
                          {onboardingChecked.simulator && <CheckCircle2 className="w-3.5 h-3.5 text-black stroke-[3px]" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-xs text-white block">
                            4. Vincular WhatsApp Oficial
                          </span>
                          <span className="text-[10px] text-zinc-500 block mt-0.5 leading-relaxed">
                            Vincule o número da pousada via QR Code para que o Zélla comece a responder.
                          </span>

                          <div className="mt-3 bg-[#0a0a0f] p-3 rounded-lg border border-white/[0.04] space-y-3">
                            {onboardingChecked.simulator ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold bg-emerald-500/5 border border-emerald-500/10 p-2 rounded">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                  WhatsApp Pareado: +55 (12) 99745-8120
                                </div>
                                <button
                                  onClick={() => {
                                    markOnboardingStep('simulator', false);
                                    toast.info('Instância do WhatsApp desconectada.');
                                  }}
                                  className="w-full h-7 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-[10px] rounded transition-colors active:scale-[0.98] cursor-pointer"
                                >
                                  Desconectar Aparelho
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {/* QR Code Container */}
                                <div className="relative w-32 h-32 mx-auto bg-white rounded-lg p-2 flex items-center justify-center overflow-hidden group/qr">
                                  {isConnectingWhatsApp ? (
                                    <div className="absolute inset-0 bg-black/90 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1.5 p-2">
                                      <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                                      <span className="text-[8px] font-bold text-zinc-400 text-center">Conectando...</span>
                                    </div>
                                  ) : (
                                    <>
                                      {/* Mock QR Code Pattern using SVG */}
                                      <svg className="w-full h-full text-zinc-900" viewBox="0 0 100 100" fill="currentColor">
                                        <path d="M0,0h25v8H8v17H0Z M75,0h25v25h-8V8H75Z M0,75h8v17h17v8H0Z M92,75h8v25H75v-8h17Z" />
                                        <path d="M12,12h20v20H12Z M16,16h12v12H16Z M20,20h4v4h-4Z" />
                                        <path d="M68,12h20v20H68Z M72,16h12v12H72Z M76,20h4v4h-4Z" />
                                        <path d="M12,68h20v20H12Z M16,72h12v12H16Z M20,76h4v4h-4Z" />
                                        <path d="M44,12h4v8h-4Z M52,16h8v4h-8Z M44,24h12v4H44Z M60,24h4v8h-4Z M12,44h8v4h-8Z M24,44h4v8h-4Z M44,40h8v4h-8Z M68,44h12v4H68Z M84,44h4v12h-4Z M44,52h4v8h-4Z M52,56h12v4H52Z M76,56h8v4h-8Z M68,68h8v4h-8Z M80,68h8v8h-8Z M44,76h12v4H44Z M60,76h4v8h-4Z M68,80h12v4H68Z M84,80h4v12h-4Z" />
                                      </svg>
                                      {/* Scanning glow light overlay */}
                                      <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-400 opacity-60 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
                                    </>
                                  )}
                                </div>
                                
                                <style jsx global>{`
                                  @keyframes scan {
                                    0%, 100% { top: 4%; }
                                    50% { top: 96%; }
                                  }
                                `}</style>

                                <div className="text-center text-[9px] text-zinc-500 leading-normal">
                                  Abra o WhatsApp no celular ➔ Aparelhos Conectados ➔ Conectar um Aparelho  Escaneie o QR Code.
                                </div>

                                <Button
                                  onClick={() => {
                                    setIsConnectingWhatsApp(true);
                                    setTimeout(() => {
                                      setIsConnectingWhatsApp(false);
                                      markOnboardingStep('simulator', true);
                                      toast.success('Dispositivo pareado com sucesso! Zélla está online no seu WhatsApp.');
                                    }, 1800);
                                  }}
                                  className="w-full h-7 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded flex items-center justify-center gap-1.5 cursor-pointer transition-colors active:scale-[0.98]"
                                >
                                  <Smartphone className="w-3.5 h-3.5" /> Simular Pareamento
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* RIGHT PANEL — 2/3 width */}
            <div className="lg:col-span-2 space-y-5">
              <motion.div variants={fadeIn} initial="hidden" animate="visible">
                <RevenueMetrics
                  metrics={adaptRevenueMetrics(metrics) || mockRevenueMetrics}
                  deliveriesData={deliveries}
                  aiStatusData={aiStatus}
                  occupancyRate={metrics?.today ? undefined : undefined}
                  aiAutonomy={deliveries?.oneShotResolution?.oneShotRate}
                  guestSatisfaction={undefined}
                />
              </motion.div>
              <motion.div variants={fadeIn} initial="hidden" animate="visible">
                <AILiveFeed
                  conversations={conversations}
                  isConnected={true}
                  onReply={(cId, msg) => sendMessage(cId, msg)}
                  onEscalate={(cId) => escalateConversation(cId)}
                  onViewDetails={(cId) => selectConversation(cId)}
                />
              </motion.div>
            </div>
          </div>

          {/* FULL WIDTH BOTTOM PANEL — Terminal de Processamento Cognitivo do Zélla */}
          <div className="w-full">
            <div className="bg-[#050508] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl font-mono">
              {/* Terminal Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#0d0d12] border-b border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-zinc-300 tracking-wide uppercase">zella_brain_console v2.4.0</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <span className="text-[8px] text-emerald-400 font-bold">LIVE_FEED_STREAM</span>
                </div>
              </div>

              {/* Terminal Monitor Stats */}
              <div className="px-4 py-2 bg-black/40 border-b border-white/[0.03] grid grid-cols-3 gap-1 text-[9px] text-zinc-500">
                <div>[STATUS: <span className="text-emerald-400 capitalize">{aiStatusLocal}</span>]</div>
                <div className="text-center border-x border-white/[0.04]">[ATENDIDOS: <span className="text-white font-bold">{metrics?.today?.aiAttended ?? 45}</span>]</div>
                <div className="text-right">[SPEED: <span className="text-white font-bold">{aiStatus?.averageResponseTime ?? 2.3}s</span>]</div>
              </div>

              {/* Terminal Body Console log lines */}
              <div className="p-3 max-h-[360px] overflow-y-auto space-y-2 select-none scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                {(() => {
                  // Sort conversations: active ones first, resolved/closed ones later
                  const sortedLogs = [...conversations].sort((a, b) => {
                    const timeA = new Date(a.messages && a.messages.length > 0 ? a.messages[a.messages.length - 1].createdAt || a.updatedAt || a.createdAt || 0 : 0).getTime();
                    const timeB = new Date(b.messages && b.messages.length > 0 ? b.messages[b.messages.length - 1].createdAt || b.updatedAt || b.createdAt || 0 : 0).getTime();
                    return timeA - timeB;
                  });

                  if (sortedLogs.length === 0) {
                    return (
                      <div className="text-zinc-600 text-center py-8 text-[10px] leading-relaxed">
                        &gt; [INIT_ZELADOR_SYSTEM]... OK<br />
                        &gt; [AWAITING_INCOMING_WHATSAPP_CONNECTIONS]...<br />
                        &gt; [NENHUMA CONVERSA ATIVA NO LOG DO TERMINAL]
                      </div>
                    );
                  }

                  return sortedLogs.map(c => {
                    const lastMsg = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : null;
                    const lastMsgTime = lastMsg?.createdAt || c.updatedAt || c.createdAt;
                    
                    const timeStr = lastMsgTime ? new Date(lastMsgTime).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    }) : '17:00:00';

                    const dateStr = lastMsgTime ? new Date(lastMsgTime).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit'
                    }) : '03/07';

                    const isOpen = c.status !== 'closed' && c.status !== 'resolved';
                    const isUser = lastMsg?.role === 'user' || lastMsg?.from === 'user';
                    const senderTag = isUser ? 'GUEST_IN' : 'ZELLA_OUT';

                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          setActiveTab('messages');
                          selectConversation(c.id);
                          toast.success(`Console: abrindo chat com ${c.guestName}`);
                        }}
                        className="p-2 rounded bg-black/60 hover:bg-emerald-950/20 border border-white/[0.02] hover:border-emerald-500/20 transition-all cursor-pointer group flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between text-[9px]">
                          <div className="flex items-center gap-1.5 text-zinc-500">
                            <span>[{dateStr} {timeStr}]</span>
                            <span className={isUser ? 'text-teal-400 font-bold' : 'text-violet-400 font-bold'}>
                              [{senderTag}]
                            </span>
                          </div>
                          <span className={`text-[8px] font-bold px-1 rounded-sm ${isOpen ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse' : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50'}`}>
                            {isOpen ? 'ABERTO' : 'RESOLVIDO'}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-300 group-hover:text-emerald-300 transition-colors leading-relaxed truncate">
                          <span className="text-white font-extrabold">{c.guestName}:</span>{' '}
                          <span className="text-zinc-400 font-mono text-[9.5px]">
                            {lastMsg?.content ? `"${lastMsg.content}"` : '(conversa iniciada)'}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Terminal Footer */}
              <div className="bg-[#0d0d12] px-4 py-2 border-t border-white/[0.05] flex items-center justify-between text-[9px] text-zinc-500">
                <span className="animate-pulse">&gt;_ Console de Acompanhamento</span>
                <span className="text-zinc-600 font-bold uppercase">Zella_OS v2.4</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ── MESSAGES (Mensagens) 
    if (activeTab === 'messages') {
      const filtered = conversations.filter(c => {
        const matchSearch = !msgSearch || c.guestName?.toLowerCase().includes(msgSearch.toLowerCase()) || c.guestPhone?.includes(msgSearch);
        const matchStatus = msgStatusFilter === 'all' || c.status === msgStatusFilter;
        return matchSearch && matchStatus;
      });

      return (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
          <SectionHeader
            icon={MessageCircle}
            title="Mensagens"
            subtitle={`${conversations.length} conversa${conversations.length !== 1 ? 's' : ''} ativa${conversations.length !== 1 ? 's' : ''} — atualiza em tempo real via IA`}
            actions={
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input
                    value={msgSearch}
                    onChange={e => setMsgSearch(e.target.value)}
                    placeholder="Buscar por nome ou telefone..."
                    className="pl-8 pr-3 py-1.5 bg-[#121216] border border-white/[0.06] rounded-lg text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/30 w-52"
                  />
                </div>
                <select
                  value={msgStatusFilter}
                  onChange={e => setMsgStatusFilter(e.target.value)}
                  className="bg-[#121216] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/30"
                >
                  <option value="all">Todos os status</option>
                  <option value="active">Ativo</option>
                  <option value="escalated">Escalado</option>
                  <option value="resolved">Resolvido</option>
                </select>
                <button
                  onClick={() => setIsNewChatOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 text-xs font-bold rounded-lg transition-all cursor-pointer active:scale-[0.98]"
                >
                  <Plus className="w-3.5 h-3.5" /> Nova Conversa
                </button>
              </>
            }
          />

          {/* Full-width AILiveFeed + detail panel */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            {/* Lista */}
            <div className="xl:col-span-2 bg-[#121216] border border-white/[0.04] rounded-xl overflow-hidden">
              <div className="p-3 border-b border-white/[0.04] flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-white uppercase tracking-wider">Conversas ({filtered.length})</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[9px] text-emerald-400 font-mono">LIVE</span>
                </div>
              </div>
              <div className="divide-y divide-white/[0.02] max-h-[600px] overflow-y-auto">
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <MessageCircle className="w-8 h-8 text-zinc-700" />
                    <p className="text-xs text-zinc-500">Nenhuma conversa encontrada</p>
                  </div>
                )}
                {filtered.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectConversation(c.id)}
                    className={`w-full text-left p-3 hover:bg-white/[0.02] transition-all group ${selectedConversation?.id === c.id ? 'bg-emerald-500/5 border-l-2 border-emerald-500/50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/15 flex items-center justify-center shrink-0 text-xs font-bold text-emerald-400">
                        {(c.guestName || 'H')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-white truncate">{c.guestName || 'Hóspede'}</span>
                          {getStatusBadge(c.status)}
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate">{c.lastMessage || 'Nenhuma mensagem'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-2.5 h-2.5 text-zinc-600" />
                          <span className="text-[9px] text-zinc-600">{c.guestPhone || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat / Detail */}
            <div className="xl:col-span-3">
              <AILiveFeed
                conversations={conversations}
                isConnected={true}
                onReply={(cId, msg) => sendMessage(cId, msg)}
                onEscalate={(cId) => escalateConversation(cId)}
                onViewDetails={(cId) => selectConversation(cId)}
              />
            </div>
          </div>
        </motion.div>
      );
    }

    // ── GUESTS (Hóspedes) 
    if (activeTab === 'guests') {
      // Plan gate: CRM Pipeline requires PRO or above
      if (!hasAccess(currentPlan, 'pro')) {
        return (
          <PlanGate
            currentPlan={currentPlan}
            requiredPlan="pro"
            title="CRM de Hóspedes"
            description="Pipeline completo com score de IA que acompanha cada hóspede do primeiro contato até a reserva. Acompanhe Cold → Warm → Hot → Reservado → Perdido."
            features={['Pipeline Kanban com drag & drop', 'Score IA por hóspede', 'Filtros avançados por status', 'Histórico completo de interações', 'Ações rápidas por hóspede']}
            variant="full"
            onUpgrade={() => { setActiveTab('settings'); setSubTab('faturamento'); }}
          />
        );
      }
      const filteredGuests = allGuests.filter(g => {
        const matchSearch = !guestSearch || g.name?.toLowerCase().includes(guestSearch.toLowerCase()) || g.phone?.includes(guestSearch);
        const matchStatus = guestStatusFilter === 'all' || g.status === guestStatusFilter;
        return matchSearch && matchStatus;
      });

      const statusCounts = allGuests.reduce((acc: Record<string, number>, g) => {
        acc[g.status] = (acc[g.status] || 0) + 1;
        return acc;
      }, {});

      return (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
          <SectionHeader
            icon={Users}
            title="Hóspedes"
            subtitle={`${allGuests.length} hóspede${allGuests.length !== 1 ? 's' : ''} no banco de dados`}
            actions={
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input
                    value={guestSearch}
                    onChange={e => setGuestSearch(e.target.value)}
                    placeholder="Buscar por nome ou telefone..."
                    className="pl-8 pr-3 py-1.5 bg-[#121216] border border-white/[0.06] rounded-lg text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/30 w-52"
                  />
                </div>
                <select
                  value={guestStatusFilter}
                  onChange={e => setGuestStatusFilter(e.target.value)}
                  className="bg-[#121216] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/30"
                >
                  <option value="all">Todos</option>
                  <option value="new">Novos</option>
                  <option value="active">Ativos</option>
                  <option value="confirmed">Confirmados</option>
                  <option value="checked_in">Check-in</option>
                  <option value="checked_out">Check-out</option>
                </select>
              </>
            }
          />

          {/* KPI pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(statusCounts).map(([status, count]) => (
              <button
                key={status}
                onClick={() => setGuestStatusFilter(guestStatusFilter === status ? 'all' : status)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${guestStatusFilter === status ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-[#121216] text-zinc-500 border-white/[0.04] hover:border-white/[0.08]'}`}
              >
                <span>{count}</span>
                <span className="capitalize">{status === 'new' ? 'Novos' : status === 'active' ? 'Ativos' : status === 'confirmed' ? 'Confirmados' : status === 'checked_in' ? 'Check-in' : status === 'checked_out' ? 'Check-out' : status}</span>
              </button>
            ))}
          </div>

          {/* Guests Table & Mobile Cards Container */}
          <div className="w-full">
            {/* 1. VISÃO DESKTOP: TABELA TRADICIONAL (Aparece apenas em md:) */}
            <div className="hidden md:block bg-[#121216] border border-white/[0.04] rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 px-4 py-2.5 border-b border-white/[0.04] text-[9px] font-extrabold text-zinc-600 uppercase tracking-wider">
                <div className="col-span-4">Hóspede</div>
                <div className="col-span-2">Telefone</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Conversas</div>
                <div className="col-span-2 text-right">Ações</div>
              </div>
              <div className="divide-y divide-white/[0.02] max-h-[500px] overflow-y-auto">
                {filteredGuests.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Users className="w-10 h-10 text-zinc-700" />
                    <p className="text-xs text-zinc-500">Nenhum hóspede encontrado</p>
                    <p className="text-[10px] text-zinc-600">Simule uma mensagem no Dashboard para criar o primeiro hóspede</p>
                  </div>
                )}
                {filteredGuests.map(guest => (
                  <div key={guest.id} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-white/[0.01] transition-all group">
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/15 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                        {(guest.name || 'H')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{guest.name || 'Hóspede'}</div>
                        {guest.email && <div className="text-[9px] text-zinc-600 truncate max-w-[140px]">{guest.email}</div>}
                      </div>
                    </div>
                    <div className="col-span-2 text-[10px] text-zinc-400 font-mono">{guest.phone || '—'}</div>
                    <div className="col-span-2">{getStatusBadge(guest.status || 'new')}</div>
                    <div className="col-span-2 text-xs font-mono text-zinc-400">{guest.conversations || 0}</div>
                    <div className="col-span-2 flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setActiveTab('messages'); }}
                        className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Ver mensagens"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setActiveTab('bookings'); }}
                        className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Ver reservas"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {filteredGuests.length > 0 && (
                <div className="px-4 py-2.5 border-t border-white/[0.04] flex items-center justify-between">
                  <span className="text-[10px] text-zinc-600">{filteredGuests.length} hóspede{filteredGuests.length !== 1 ? 's' : ''}</span>
                  <button
                    onClick={() => toast.info('Exportação de hóspedes em desenvolvimento.')}
                    className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> Exportar CSV
                  </button>
                </div>
              )}
            </div>

            {/* 2. VISÃO MOBILE: CARDS EXPANSÍVEIS (Aparece apenas abaixo de md:) */}
            <div className="space-y-3 md:hidden">
              {filteredGuests.length === 0 && (
                <div className="p-6 rounded-xl border border-white/[0.04] bg-[#121216] text-center space-y-2">
                  <Users className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400 font-medium">Nenhum hóspede cadastrado</p>
                </div>
              )}
              {filteredGuests.map(guest => (
                <article key={guest.id} className="p-4 rounded-xl border border-white/[0.08] bg-[#121216] shadow-lg space-y-3">
                  {/* Cabeçalho do Card: Nome + Avatar + Badge */}
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400">
                        {(guest.name || 'H')[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white">{guest.name || 'Hóspede'}</h3>
                        <span className="text-[10px] font-mono text-zinc-500">{guest.phone || '—'}</span>
                      </div>
                    </div>
                    {getStatusBadge(guest.status || 'new')}
                  </div>

                  {/* Grid Interno 2 Colunas */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="block text-[10px] text-zinc-500">Conversas IA</span>
                      <span className="text-xs font-bold font-mono text-zinc-300">{guest.conversations || 0} msgs</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">E-mail</span>
                      <span className="text-xs text-zinc-400 truncate block">{guest.email || 'Não informado'}</span>
                    </div>
                  </div>

                  {/* Thumb Zone Actions */}
                  <div className="pt-2 flex items-center justify-between border-t border-white/[0.04] min-h-[44px]">
                    <button
                      onClick={() => setActiveTab('messages')}
                      className="px-3 py-2 rounded-lg bg-white/[0.04] text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 min-h-[44px] active:scale-95 transition-all"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Mensagens</span>
                    </button>
                    
                    <button
                      onClick={() => setActiveTab('bookings')}
                      className="px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition-all active:scale-95 min-h-[44px]"
                    >
                      Ver Reservas
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

        </motion.div>
      );
    }

    // ── TRAINING (Treinamento) 
    if (activeTab === 'training') {
      // Plan gate: Training Center requires PRO or above
      if (!hasAccess(currentPlan, 'pro')) {
        return (
          <PlanGate
            currentPlan={currentPlan}
            requiredPlan="pro"
            title="Centro de Treinamento da IA"
            description="Treine o Zélla para responder exatamente do jeito que sua pousada atende. Crie prompts personalizados para cada situação: persona, respostas, escalonamento e mensagens proativas."
            features={['Criar prompts personalizados', 'Testar respostas da IA', '4 categorias de treino', 'Ativar/desativar prompts', 'Simulação de hóspede']}
            variant="full"
            onUpgrade={() => { setActiveTab('settings'); setSubTab('faturamento'); }}
          />
        );
      }
      return (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
          <SectionHeader
            icon={GraduationCap}
            title="Treinamento da IA"
            subtitle="Gerencie a base de conhecimento e treino do assistente cognitivo"
            actions={
              <button
                onClick={() => toast.info('Nova entrada de treinamento em desenvolvimento.')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Nova Entrada
              </button>
            }
          />
          <TrainingCenter />
        </motion.div>
      );
    }

    // ── BOOKINGS (Reservas) 
    if (activeTab === 'bookings') {
      const filterOptions = [
        { val: 'all', label: 'Todas' },
        { val: 'pending', label: 'Pendentes' },
        { val: 'confirmed', label: 'Confirmadas' },
        { val: 'checked_in', label: 'Check-in' },
        { val: 'checked_out', label: 'Check-out' },
        { val: 'cancelled', label: 'Canceladas' },
      ];

      const totalRevenue = bookings.reduce((s, b) => s + (b.totalValue || b.total || 0), 0);
      const confirmedCount = bookings.filter(b => ['confirmed', 'checked_in'].includes(b.status)).length;

      return (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
          <SectionHeader
            icon={Calendar}
            title="Reservas"
            subtitle="Gerencie e acompanhe todas as reservas da pousada"
            actions={
              <>
                <button
                  onClick={() => { setBookingsLoading(true); fetch(`/api/ddc/bookings${bookingsFilter !== 'all' ? `?status=${bookingsFilter}` : ''}`).then(r => r.json()).then(d => setBookings(d?.data?.items || [])).catch(() => setBookings([])).finally(() => setBookingsLoading(false)); toast.success('Reservas atualizadas.'); }}
                  className="p-1.5 rounded-lg bg-[#121216] border border-white/[0.06] text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${bookingsLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => toast.info('Criação de reserva manual em desenvolvimento.')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Nova Reserva
                </button>
              </>
            }
          />

          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total de Reservas', value: bookings.length, icon: Calendar, color: 'text-blue-400' },
              { label: 'Confirmadas', value: confirmedCount, icon: CheckCircle2, color: 'text-emerald-400' },
              { label: 'Receita Total', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-amber-400' },
              { label: 'Cancelamentos', value: bookings.filter(b => b.status === 'cancelled').length, icon: X, color: 'text-red-400' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-[#121216] border border-white/[0.04] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                  <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-wider">{kpi.label}</span>
                </div>
                <div className="text-lg font-extrabold text-white font-mono">{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {filterOptions.map(opt => (
              <button
                key={opt.val}
                onClick={() => setBookingsFilter(opt.val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shrink-0 ${bookingsFilter === opt.val ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/[0.02]'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Bookings Table & Mobile Cards Container */}
          <div className="w-full">
            {/* 1. VISÃO DESKTOP: TABELA TRADICIONAL (Aparece apenas em md:) */}
            <div className="hidden md:block bg-[#121216] border border-white/[0.04] rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 px-4 py-2.5 border-b border-white/[0.04] text-[9px] font-extrabold text-zinc-600 uppercase tracking-wider">
                <div className="col-span-3">Hóspede</div>
                <div className="col-span-2">Check-in</div>
                <div className="col-span-2">Check-out</div>
                <div className="col-span-1">Noites</div>
                <div className="col-span-2">Valor</div>
                <div className="col-span-2 text-right">Status</div>
              </div>
              <div className="divide-y divide-white/[0.02] max-h-[480px] overflow-y-auto">
                {bookingsLoading && (
                  <div className="flex items-center justify-center py-12 gap-3">
                    <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                    <span className="text-xs text-zinc-500">Carregando reservas...</span>
                  </div>
                )}
                {!bookingsLoading && bookings.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Calendar className="w-10 h-10 text-zinc-700" />
                    <p className="text-xs text-zinc-500">Nenhuma reserva encontrada</p>
                    <p className="text-[10px] text-zinc-600">As reservas feitas via WhatsApp pelo Seu Zélla aparecerão aqui</p>
                  </div>
                )}
                {!bookingsLoading && bookings.map(booking => (
                  <div key={booking.id} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-white/[0.01] transition-all group">
                    <div className="col-span-3">
                      <div className="text-xs font-bold text-white">{booking.guestName || booking.guest?.name || 'Hóspede'}</div>
                      <div className="text-[9px] text-zinc-600">{booking.roomName || booking.room || '—'}</div>
                    </div>
                    <div className="col-span-2 text-[10px] text-zinc-400">{booking.checkIn ? formatDate(booking.checkIn) : '—'}</div>
                    <div className="col-span-2 text-[10px] text-zinc-400">{booking.checkOut ? formatDate(booking.checkOut) : '—'}</div>
                    <div className="col-span-1 text-[10px] font-mono text-zinc-400">{booking.nights || '—'}</div>
                    <div className="col-span-2 text-xs font-bold text-white font-mono">{booking.totalValue !== undefined ? formatCurrency(booking.totalValue) : '—'}</div>
                    <div className="col-span-2 flex justify-end items-center gap-2">
                      {getStatusBadge(booking.status)}
                      {['confirmed', 'checked_in'].includes(booking.status) && (
                        <button
                          title="Gerar PIN da Fechadura (pós-pagamento)"
                          onClick={() => {
                            setActiveTab('locks');
                            toast.info(`Abra Fechaduras Eletrônicas para gerar o PIN de ${booking.guestName || booking.guest?.name || 'hóspede'}`, {
                              description: 'Use as datas de check-in/out da reserva para o PIN.',
                            });
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-emerald-500/15 text-emerald-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. VISÃO MOBILE: CARDS EXPANSÍVEIS (Aparece apenas abaixo de md:) */}
            <div className="space-y-3 md:hidden">
              {bookingsLoading && (
                <div className="p-6 rounded-xl border border-white/[0.04] bg-[#121216] text-center">
                  <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mx-auto mb-2" />
                  <span className="text-xs text-zinc-400">Carregando reservas...</span>
                </div>
              )}
              {!bookingsLoading && bookings.length === 0 && (
                <div className="p-6 rounded-xl border border-white/[0.04] bg-[#121216] text-center space-y-2">
                  <Calendar className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400 font-medium">Nenhuma reserva encontrada</p>
                </div>
              )}
              {!bookingsLoading && bookings.map(booking => (
                <article key={booking.id} className="p-4 rounded-xl border border-white/[0.08] bg-[#121216] shadow-lg space-y-3">
                  {/* Cabeçalho do Card: Hóspede/Quarto + Status Badge */}
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-wide text-zinc-500">Reserva</span>
                      <h3 className="text-xs font-bold text-white">{booking.guestName || booking.guest?.name || 'Hóspede'}</h3>
                      <p className="text-[10px] text-emerald-400/90 font-medium">{booking.roomName || booking.room || 'Acomodação Standard'}</p>
                    </div>
                    {getStatusBadge(booking.status)}
                  </div>

                  {/* Grid 2 Colunas */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="block text-[10px] text-zinc-500">Check-in</span>
                      <span className="text-xs font-medium text-zinc-300">{booking.checkIn ? formatDate(booking.checkIn) : '—'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">Check-out</span>
                      <span className="text-xs font-medium text-zinc-300">{booking.checkOut ? formatDate(booking.checkOut) : '—'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">Valor Total</span>
                      <span className="text-sm font-bold font-mono text-emerald-400">{booking.totalValue !== undefined ? formatCurrency(booking.totalValue) : '—'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">Permanência</span>
                      <span className="text-xs font-mono text-zinc-400">{booking.nights || 1} noite(s)</span>
                    </div>
                  </div>

                  {/* Thumb Zone Actions */}
                  <div className="pt-2 flex items-center justify-between border-t border-white/[0.04] min-h-[44px]">
                    <button
                      onClick={() => toast.info(`Reserva de ${booking.guestName || 'Hóspede'} — Status: ${booking.status}`)}
                      className="px-3 py-2 rounded-lg bg-white/[0.04] text-zinc-300 hover:text-white text-xs font-medium min-h-[44px] active:scale-95 transition-all"
                    >
                      Detalhes
                    </button>

                    {['confirmed', 'checked_in'].includes(booking.status) ? (
                      <button
                        onClick={() => {
                          setActiveTab('locks');
                          toast.info(`PIN gerado para ${booking.guestName || 'hóspede'}`);
                        }}
                        className="px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 min-h-[44px] active:scale-95 transition-all"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Gerar PIN Fechadura</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => toast.info('Aguardando confirmação do pagamento')}
                        className="px-3 py-2 rounded-lg bg-zinc-800/80 text-zinc-500 text-xs font-medium min-h-[44px]"
                      >
                        Aguardando PIX
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </motion.div>
      );
    }

    // ── ANALYTICS 
    if (activeTab === 'analytics') {
      // Plan gate: Analytics requires PRO or above
      if (!hasAccess(currentPlan, 'pro')) {
        return (
          <PlanGate
            currentPlan={currentPlan}
            requiredPlan="pro"
            title="Analytics Avançado"
            description="Gráficos detalhados de desempenho, tendências de conversão e relatórios comparativos por período. Entenda exatamente como a IA está impactando suas reservas."
            features={['Gráficos por período (hoje/semana/mês)', 'Tendências de conversão', 'Análise de sentimento das conversas', 'Exportar relatórios', 'Comparativo entre períodos']}
            variant="full"
            onUpgrade={() => { setActiveTab('settings'); setSubTab('faturamento'); }}
          />
        );
      }
      const pd = analyticsData[analyticsPeriod] || {};
      const kpis = [
        { label: 'Atendimentos', value: pd.attendedToday ?? metrics?.today?.aiAttended ?? 0, unit: '', delta: pd.attendedChange ?? 0, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Reservas Fechadas', value: pd.bookingsClosed ?? 0, unit: '', delta: pd.bookingsChange ?? 0, icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Receita', value: formatCurrency(pd.revenue ?? 0), unit: '', delta: pd.revenueChange ?? 0, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        { label: 'Taxa de Conversão', value: `${pd.conversion ?? 0}%`, unit: '', delta: pd.conversionChange ?? 0, icon: BarChart2, color: 'text-violet-400', bg: 'bg-violet-500/10' },
        { label: 'Ocupação', value: `${pd.occupancy ?? 0}%`, unit: '', delta: pd.occupancyChange ?? 0, icon: UserCheck, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        { label: 'Score IA', value: `${pd.aiScore ?? 92}`, unit: '%', delta: pd.aiScoreChange ?? 0, icon: Star, color: 'text-rose-400', bg: 'bg-rose-500/10' },
      ];

      const DeltaIcon = ({ delta }: { delta: number }) => {
        if (delta > 0) return <ArrowUpRight className="w-3 h-3 text-emerald-400" />;
        if (delta < 0) return <ArrowDownRight className="w-3 h-3 text-red-400" />;
        return <Minus className="w-3 h-3 text-zinc-500" />;
      };

      return (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
          <SectionHeader
            icon={BarChart2}
            title="Analytics"
            subtitle="Métricas de desempenho do atendimento e conversão da pousada"
            actions={
              <div className="flex items-center gap-1 bg-[#121216] border border-white/[0.06] rounded-lg p-0.5">
                {(['today', 'week', 'month'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setAnalyticsPeriod(p)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${analyticsPeriod === p ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {p === 'today' ? 'Hoje' : p === 'week' ? '7 dias' : '30 dias'}
                  </button>
                ))}
              </div>
            }
          />

          {analyticsLoading && (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
              <span className="text-xs text-zinc-500">Carregando métricas...</span>
            </div>
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {kpis.map(kpi => (
              <div key={kpi.label} className="bg-[#121216] border border-white/[0.04] rounded-xl p-4 group hover:border-white/[0.08] transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                    <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                  <div className="flex items-center gap-1">
                    <DeltaIcon delta={kpi.delta} />
                    <span className={`text-[10px] font-bold ${kpi.delta > 0 ? 'text-emerald-400' : kpi.delta < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                      {kpi.delta !== 0 ? `${Math.abs(kpi.delta)}%` : '—'}
                    </span>
                  </div>
                </div>
                <div className="text-xl font-extrabold text-white font-mono">{kpi.value}{kpi.unit}</div>
                <div className="text-[10px] text-zinc-500 mt-1">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Trend bars */}
          <div className="bg-[#121216] border border-white/[0.04] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider">Atendimentos por Hora — Hoje</span>
              <span className="text-[10px] text-zinc-500">Simulação de atividade</span>
            </div>
            <div className="flex items-end gap-1 h-24">
              {Array.from({ length: 24 }, (_, h) => {
                const activity = [2, 1, 0, 0, 0, 1, 3, 8, 12, 15, 18, 14, 10, 16, 20, 18, 22, 19, 15, 12, 8, 6, 4, 3];
                const val = activity[h];
                const max = Math.max(...activity);
                const height = max > 0 ? (val / max) * 100 : 0;
                const isActive = new Date().getHours() === h;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-sm transition-all ${isActive ? 'bg-emerald-400' : val > 15 ? 'bg-emerald-500/60' : val > 8 ? 'bg-emerald-500/30' : 'bg-white/[0.04]'}`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${h}h: ${val} atendimentos`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[9px] text-zinc-700">00h</span>
              <span className="text-[9px] text-zinc-700">12h</span>
              <span className="text-[9px] text-zinc-700">23h</span>
            </div>
          </div>

          {/* Summary table */}
          <div className="bg-[#121216] border border-white/[0.04] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.04]">
              <span className="text-[10px] font-extrabold text-white uppercase tracking-wider">Resumo do Período</span>
            </div>
            <div className="divide-y divide-white/[0.02]">
              {[
                { metric: 'Total de Atendimentos', value: pd.attendedToday ?? metrics?.today?.aiAttended ?? 0, note: 'Conversas iniciadas pela IA' },
                { metric: 'Reservas Confirmadas', value: pd.bookingsClosed ?? 0, note: 'Conversões de atendimento em reserva' },
                { metric: 'Taxa de Escalamento', value: `${conversations.length > 0 ? ((conversations.filter(c => c.status === 'escalated').length / conversations.length) * 100).toFixed(1) : 0}%`, note: 'Chats que precisaram de atenção manual' },
                { metric: 'Tempo Médio de Resposta', value: `${aiStatus?.averageResponseTime ?? 2.3}s`, note: 'Velocidade média de resposta da IA' },
                { metric: 'Hóspedes no CRM', value: allGuests.length, note: 'Total de hóspedes cadastrados via WhatsApp' },
                { metric: 'Score Cognitivo da IA', value: `${pd.aiScore ?? 92}%`, note: 'Índice de confiança médio das respostas' },
              ].map(row => (
                <div key={row.metric} className="grid grid-cols-3 px-4 py-3 items-center hover:bg-white/[0.01] transition-all">
                  <div className="col-span-2">
                    <div className="text-xs font-semibold text-white">{row.metric}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">{row.note}</div>
                  </div>
                  <div className="text-right text-sm font-extrabold text-white font-mono">{row.value}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      );
    }

    // ── NOTIFICATIONS (Notificações) 

    if (activeTab === 'notifications') {
      const unread = notifications.filter(n => n.status === 'unread');
      const read = notifications.filter(n => n.status !== 'unread');

      const priorityIcon = (p: string) => {
        if (p === 'urgent') return <AlertCircle className="w-4 h-4 text-red-400" />;
        if (p === 'high') return <Bell className="w-4 h-4 text-amber-400" />;
        return <Info className="w-4 h-4 text-blue-400" />;
      };

      return (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
          <SectionHeader
            icon={Bell}
            title="Notificações"
            subtitle={`${unread.length} não lida${unread.length !== 1 ? 's' : ''} — ${notifications.length} total`}
            actions={
              <>
                {unread.length > 0 && (
                  <button
                    onClick={() => { markAllAsRead(); toast.success('Todas as notificações marcadas como lidas.'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121216] hover:bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:text-zinc-200 text-xs font-bold rounded-lg transition-all cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Marcar todas como lidas
                  </button>
                )}
              </>
            }
          />

          {notifications.length === 0 && (
            <div className="bg-[#121216] border border-white/[0.04] rounded-xl flex flex-col items-center justify-center py-20 gap-4">
              <BellOff className="w-12 h-12 text-zinc-700" />
              <p className="text-sm text-zinc-500">Nenhuma notificação ainda</p>
              <p className="text-xs text-zinc-600">As notificações da IA e do sistema aparecerão aqui</p>
            </div>
          )}

          {/* Unread section */}
          {unread.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider px-1">Não Lidas ({unread.length})</div>
              {unread.map(notif => (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-[#121216] border border-emerald-500/10 rounded-xl p-4 cursor-pointer hover:border-emerald-500/20 transition-all group"
                  onClick={() => { markAsRead(notif.id); toast.success('Notificação marcada como lida.'); }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0a0a0f] border border-white/[0.06] flex items-center justify-center shrink-0">
                      {priorityIcon(notif.priority)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-white">{notif.title}</div>
                          <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{notif.message}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          <span className="text-[9px] text-zinc-600 font-mono whitespace-nowrap">
                            {notif.timestamp ? formatDate(notif.timestamp) : 'Agora'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${notif.priority === 'urgent' ? 'bg-red-500/10 text-red-400 border-red-500/20' : notif.priority === 'high' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                      {notif.priority === 'urgent' ? 'URGENTE' : notif.priority === 'high' ? 'ALTA' : 'NORMAL'}
                    </span>
                    <span className="text-[10px] text-emerald-400 group-hover:text-emerald-300 transition-colors">Marcar como lida →</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Read section */}
          {read.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider px-1">Lidas ({read.length})</div>
              <div className="bg-[#121216] border border-white/[0.04] rounded-xl divide-y divide-white/[0.02]">
                {read.map(notif => (
                  <div key={notif.id} className="flex items-start gap-3 p-4 opacity-60 hover:opacity-80 transition-opacity">
                    <div className="w-7 h-7 rounded-lg bg-[#0a0a0f] border border-white/[0.04] flex items-center justify-center shrink-0">
                      {priorityIcon(notif.priority)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white">{notif.title}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{notif.message}</div>
                    </div>
                    <span className="text-[9px] text-zinc-700 font-mono shrink-0 whitespace-nowrap">
                      {notif.timestamp ? formatDate(notif.timestamp) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      );
    }

    // ── LINK-IN-BIO (Tab Principal) 
    if (activeTab === 'linkinbio') {
      return (
        <motion.div variants={fadeIn} initial="hidden" animate="visible">
          <LinkInBioDDC
            currentPlan={currentPlan}
            isBetaPartner={isBetaPartner}
            propertyName={propertyName}
            isLinkInBioOnly={isLinkInBioOnly}
          />
        </motion.div>
      );
    }

    // ── SETTINGS (Configurações) 
    if (activeTab === 'settings') {
      return (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="bg-[#121216] border border-white/[0.04] rounded-xl p-6 sm:p-8">
          <SectionHeader
            icon={Settings}
            title="Configurações da Pousada"
            subtitle="Personalize o comportamento do Seu Zélla para a sua propriedade"
          />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Sub-abas laterais */}
            <div className="md:col-span-1 flex flex-col gap-1.5 select-none">
              <button
                onClick={() => setSubTab('geral')}
                className={`px-4 py-2.5 rounded-lg text-left text-xs font-bold transition-all cursor-pointer flex items-center gap-2.5 border ${subTab === 'geral' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-sm' : 'text-zinc-400 border-transparent hover:bg-white/[0.02] hover:text-zinc-200'}`}
              >
                <Sliders className="w-4 h-4" /> Geral &amp; IA
              </button>
              <button
                onClick={() => setSubTab('linkinbio')}
                className={`px-4 py-2.5 rounded-lg text-left text-xs font-bold transition-all cursor-pointer flex items-center gap-2.5 border ${subTab === 'linkinbio' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-sm' : 'text-zinc-400 border-transparent hover:bg-white/[0.02] hover:text-zinc-200'}`}
              >
                <Smartphone className="w-4 h-4" /> Link-in-Bio Profissional
              </button>
              <button
                onClick={() => setSubTab('faturamento')}
                className={`px-4 py-2.5 rounded-lg text-left text-xs font-bold transition-all cursor-pointer flex items-center gap-2.5 border ${subTab === 'faturamento' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-sm' : 'text-zinc-400 border-transparent hover:bg-white/[0.02] hover:text-zinc-200'}`}
              >
                <CreditCard className="w-4 h-4" /> Faturamento &amp; Consumo
              </button>
            </div>

            {/* Conteúdo da sub-aba */}
            <div className="md:col-span-3 bg-[#0a0a0f]/40 border border-white/[0.04] rounded-lg p-6">
              {subTab === 'geral' && (
                <form onSubmit={handleSaveGeral} className="space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Configurações Gerais</h3>
                    <p className="text-zinc-400 text-xs mt-1">Ajuste o tom de voz do seu assistente cognitivo e as informações básicas da sua pousada.</p>
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="prop-name" className="text-zinc-300 text-xs font-semibold">Nome da Pousada</Label>
                      <Input id="prop-name" type="text" value={editPropertyName} onChange={e => setEditPropertyName(e.target.value)} className="bg-[#121216] border-white/[0.08] rounded-lg text-xs text-white" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ai-tone" className="text-zinc-300 text-xs font-semibold">Tom de Voz da IA</Label>
                      <select id="ai-tone" value={aiVoiceTone} onChange={e => setAiVoiceTone(e.target.value)} className="w-full bg-[#121216] border border-white/[0.08] rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/30">
                        <option value="friendly">Receptivo &amp; Amigável (Padrão)</option>
                        <option value="sophisticated">Formal &amp; Sofisticado</option>
                      </select>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button type="submit" disabled={isSaving} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-lg flex items-center gap-2 cursor-pointer transition-colors active:scale-[0.98]">
                      {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</> : <><Save className="w-3.5 h-3.5" /> Salvar Alterações</>}
                    </Button>
                  </div>
                </form>
              )}

              {subTab === 'linkinbio' && (
                <LinkInBioConfig
                  currentPlan={currentPlan}
                  isBetaPartner={isBetaPartner}
                  propertyName={propertyName}
                  slug={propertyName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}
                />
              )}

              {subTab === 'faturamento' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Faturamento &amp; Consumo</h3>
                    <p className="text-zinc-400 text-xs mt-1">Gerencie a assinatura e acompanhe as cotas de mensagens mensais.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#121216] border border-white/[0.06] rounded-lg p-4">
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Plano Ativo</div>
                      <div className="text-base font-extrabold text-white mt-1.5 uppercase font-mono">{currentPlan}</div>
                    </div>
                    <div className="bg-[#121216] border border-white/[0.06] rounded-lg p-4">
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Mensagens Consumidas</div>
                      <div className="text-base font-extrabold text-white mt-1.5 font-mono">
                        {currentPlan === 'lite' ? '512 / 500' : '924 / Ilimitado'}
                      </div>
                    </div>
                  </div>
                  {currentPlan === 'lite' && (
                    <div className="bg-[#1c1214] border border-red-500/10 rounded-lg p-4 space-y-3">
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                          <Info className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">Mensagens Excedidas</h4>
                          <p className="text-[10px] text-zinc-400 leading-relaxed mt-0.5">Você atingiu 512 mensagens neste ciclo (limite de 500). Adquira créditos adicionais para que o assistente do Seu Zélla continue atendendo no WhatsApp.</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-[11px] text-zinc-300">
                          Adicionar pacote de <strong>250 mensagens extras</strong> por <strong className="text-emerald-400">R$ 97,00</strong>
                        </div>
                        <button
                          onClick={() => { setShowRecargaMock(true); toast.success('QR Code do PIX gerado com sucesso!'); }}
                          className="w-full sm:w-auto px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Comprar via PIX
                        </button>
                      </div>
                    </div>
                  )}
                  {showRecargaMock && (
                    <div className="bg-[#121216] border border-white/[0.04] rounded-lg p-4 text-center space-y-4">
                      <p className="text-xs text-white font-bold">Pagamento da Recarga de Créditos (PIX)</p>
                      <div className="w-32 h-32 bg-white p-2 mx-auto rounded-lg flex items-center justify-center border border-white/[0.08]">
                        <span className="text-black font-mono text-[8px] break-all select-all font-bold">ZELLAPAY-RECARGA-PIX-MOCK-2026</span>
                      </div>
                      <div className="flex gap-2 justify-center">
                        <button onClick={() => { toast.success('Pagamento PIX confirmado! 250 mensagens adicionadas.'); setShowRecargaMock(false); }} className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 text-[10px] font-bold rounded-lg cursor-pointer transition-colors">Confirmar Pagamento</button>
                        <button onClick={() => setShowRecargaMock(false)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-bold rounded-lg cursor-pointer transition-colors">Cancelar</button>
                      </div>
                    </div>
                  )}

                  {/* ── Cancel Subscription Section  */}
                  {currentPlan !== 'gratuito' && (
                    <div className="pt-4 border-t border-white/[0.04]">
                      <button
                        onClick={() => { setShowCancelFlow(true); setCancelStep('warning'); }}
                        className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors font-semibold underline underline-offset-2 cursor-pointer"
                      >
                        Deseja cancelar sua assinatura?
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      );
    }

    // ── UPSELL (Comissão Zélla 7% sobre valores extras por quarto)
    if (activeTab === 'upsell') {
      return (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
          <DDCUpsellTab />
        </motion.div>
      );
    }

    // ── FECHADURAS ELETRÔNICAS 
    if (activeTab === 'locks') {
      if (!hasAccess(currentPlan, 'lite')) {
        return (
          <PlanGate
            currentPlan={currentPlan}
            requiredPlan="lite"
            title="Fechaduras Eletrônicas"
            description="Gerencie fechaduras inteligentes e PINs temporários automáticos. Compatível com 10 marcas brasileiras."
            features={['10 marcas (TTLock, Intelbras, Yale, Igloohome, etc.)', 'PINs com validade rígida por minuto', 'Envio automático via WhatsApp pós-PIX', 'Revogação de emergência 1-clique', 'Auditoria LGPD completa']}
            variant="full"
            onUpgrade={() => { setActiveTab('settings'); setSubTab('faturamento'); }}
          />
        );
      }
      return (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
          <LocksTab niche="pousada" />
        </motion.div>
      );
    }

    // ── ZÉLLA AIRB (Airbnb Management) 
    if (activeTab === 'airb') {
      if (!hasAccess(currentPlan, 'pro')) {
        return (
          <PlanGate
            currentPlan={currentPlan}
            requiredPlan="pro"
            title="Zélla AirB"
            description="Seu zelador digital para imóveis Airbnb. Responda hóspedes como o dono que sabe tudo."
            features={['Magic Onboarding via link Airbnb', 'Cadastro automático de imóveis', 'IA anfitrião 24/7 no WhatsApp', 'Detecção pré/pós-reserva', 'Até 4 imóveis no PRO, 12 no MAX']}
            variant="full"
            onUpgrade={() => { setActiveTab('settings'); setSubTab('faturamento'); }}
          />
        );
      }
      return (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
          <ZellaAirBTab
            currentPlan={currentPlan}
            onUpgrade={() => { setActiveTab('settings'); setSubTab('faturamento'); }}
          />
        </motion.div>
      );
    }

    // ── ZELLADOR (Suporte) 
    if (activeTab === 'zellador') {
      return (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="max-w-3xl mx-auto">
          <ZelladorChat userPlan={currentPlan} />
        </motion.div>
      );
    }

    // ── FATURAMENTO & ASSINATURA (ASAAS GATEWAY)
    if (activeTab === 'billing' || activeTab === 'payment') {
      return (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
          <DDCBillingTab tenantId="demo-pousada" />
        </motion.div>
      );
    }

    return null;
  };

  // ── RENDER 
  // Show loading while checking session
  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white antialiased font-sans">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <DDCHeader
        propertyName={propertyName}
        aiStatus={aiStatusLocal}
        notificationCount={unreadCount}
        onOpenNotifications={handleNotificationClick}
        currentPlan={currentPlan}
        attendedToday={metrics?.today?.aiAttended ?? undefined}
        conversionRate={metrics?.today?.conversionRate ?? undefined}
      />

      {/* Plan Upgrade Banner (LITE sees PRO nudge, PRO sees MAX nudge) */}
      {currentPlan !== 'gratuito' && currentPlan !== 'max' && (
        <PlanUpgradeBanner currentPlan={currentPlan} />
      )}

      {/* Trial Banner */}
      {currentPlan === 'gratuito' && (
        <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-[#0a0a0f] border-b border-emerald-500/10 px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap select-none">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <p className="text-[11px] text-zinc-300">
              Você está no <strong>Período de Teste Grátis de 7 Dias</strong>. Teste a inteligência artificial do Seu Zélla enviando uma mensagem simulada!
            </p>
          </div>
          <button
            onClick={() => {
              setActiveTab('overview');
              setTimeout(() => {
                const el = document.getElementById('simulation-msg');
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 100);
            }}
            className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold cursor-pointer transition-colors active:scale-95"
          >
            Simular Hóspede Agora ⚡
          </button>
        </div>
      )}

      {/* Navigation Tabs (Zellador + Dashboard Geral + AirB) */}
      <div className="flex items-center gap-1.5 px-6 pt-4 max-w-[1920px] mx-auto select-none border-b border-white/[0.02] pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${activeTab !== 'zellador' && activeTab !== 'airb' ? 'bg-white/[0.04] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Compass className="w-3.5 h-3.5" />
          Dashboard Geral
        </button>
        <button
          onClick={() => setActiveTab('airb')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${activeTab === 'airb' ? 'bg-[#FF5A5F]/10 text-[#FF5A5F] border border-[#FF5A5F]/20' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Home className="w-3.5 h-3.5" />
          Zélla AirB
        </button>
        <button
          onClick={() => setActiveTab('zellador')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${activeTab === 'zellador' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Fale com seu Zelador (Suporte)
        </button>
      </div>

      {/* Main Content */}
      <div className="p-6 max-w-[1920px] mx-auto space-y-6">
        {/* QuickActionsBar — always visible (except Zellador/AirB tabs) */}
        {activeTab !== 'zellador' && activeTab !== 'airb' && (
          <motion.div variants={fadeIn} initial="hidden" animate="visible">
            <QuickActionsBar 
              onActionClick={handleActionClick} 
              onQuickActionClick={handleQuickActionClick} 
              activeAction={activeTab} 
              currentPlan={currentPlan}
              dynamicCounts={{
                messages: conversations?.length ?? undefined,
                guests: allGuests?.length ?? undefined,
                bookings: deliveries?.planLimits?.messagesUsed ?? undefined,
                notifications: unreadCount ?? undefined,
              }}
            />
          </motion.div>
        )}

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {renderActiveTab()}
          </motion.div>
        </AnimatePresence>

        {/* Bottom Status Bar — always visible except zellador/airb */}
        {activeTab !== 'zellador' && activeTab !== 'airb' && (
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="bg-[#121216] border border-white/[0.04] rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-zinc-500 font-mono">ZELLA COGNITIVE OS v2.4.1</span>
                </div>
                <div className="hidden sm:block h-4 w-px bg-white/[0.06]" />
                <span className="text-[10px] text-zinc-500 font-mono">Propriedade: {propertyName}</span>
                <div className="hidden sm:block h-4 w-px bg-white/[0.06]" />
                <span className="text-[10px] text-zinc-500 font-mono">
                  {allGuests.length} hóspedes • {conversations.length} conversas ativas
                </span>
              </div>
              <span className="text-[9px] text-emerald-400 font-semibold font-mono uppercase tracking-wider">
                Sistemas operacionais 100% ativos
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* QUICK ACTIONS MODALS */}
      {/* 1. CALL MODAL */}
      <Dialog open={activeQuickAction === 'call'} onOpenChange={(open) => !open && setActiveQuickAction(null)}>
        <DialogContent className="bg-[#0a0a0f] border border-white/[0.08] text-white max-w-sm p-6 rounded-xl shadow-2xl">
          <DialogHeader className="border-b border-white/[0.04] pb-3">
            <DialogTitle className="text-sm font-extrabold text-white flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              Discar para Hóspede
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-[11px]">
              Faça ligações diretas em caso de emergência ou no-show.
            </DialogDescription>
          </DialogHeader>

          {selectedConversation ? (
            <div className="space-y-4 pt-3">
              <div className="bg-[#121216] border border-white/[0.04] rounded-lg p-3">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Hóspede</span>
                <span className="text-sm font-bold text-white mt-0.5 block">{selectedConversation.guestName}</span>
                <span className="text-xs text-zinc-400 font-mono block mt-1">{selectedConversation.phoneNumber}</span>
              </div>
              <a
                href={`tel:${selectedConversation.phoneNumber}`}
                onClick={() => {
                  toast.success(`Disparando chamada para ${selectedConversation.guestName}`);
                  setActiveQuickAction(null);
                }}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
              >
                <Phone className="w-4 h-4" /> Ligar Agora
              </a>
              <span className="text-[10px] text-zinc-500 text-center block leading-relaxed">
                Nota: Esta ação abrirá o discador de telefone do seu celular ou aplicativo de VoIP padrão.
              </span>
            </div>
          ) : (
            <div className="space-y-3 pt-3">
              <p className="text-xs text-zinc-400 text-center py-4">
                Selecione uma conversa no Live Feed para discar diretamente para o hóspede.
              </p>
              <div className="border-t border-white/[0.04] pt-3 flex justify-end">
                <Button 
                  onClick={() => setActiveQuickAction(null)} 
                  className="bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs font-bold"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 2. PAYMENT MODAL */}
      <Dialog open={activeQuickAction === 'payment'} onOpenChange={(open) => !open && setActiveQuickAction(null)}>
        <DialogContent className="bg-[#0a0a0f] border border-white/[0.08] text-white max-w-md p-6 rounded-xl shadow-2xl">
          <DialogHeader className="border-b border-white/[0.04] pb-3">
            <DialogTitle className="text-sm font-extrabold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-400" />
              Gerador Manual de Pix
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-[11px]">
              Gere chaves Pix para cobranças manuais extras e envie no WhatsApp do hóspede.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-3">
            {/* Presets */}
            <div>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Atalhos Rápidos (Presets)</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setPixAmount('50'); setPixReason('Taxa de Pet (Adicional)'); }}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    pixAmount === '50' && pixReason === 'Taxa de Pet (Adicional)'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : 'bg-[#121216]/50 border-white/[0.03] text-zinc-400 hover:bg-[#121216] hover:border-zinc-700'
                  }`}
                >
                  <span className="text-[10px] font-bold block">🐾 Pet</span>
                  <span className="text-xs font-mono font-extrabold mt-0.5 block">R$ 50,00</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setPixAmount('80'); setPixReason('Check-out Tardio (Late)'); }}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    pixAmount === '80' && pixReason === 'Check-out Tardio (Late)'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : 'bg-[#121216]/50 border-white/[0.03] text-zinc-400 hover:bg-[#121216] hover:border-zinc-700'
                  }`}
                >
                  <span className="text-[10px] font-bold block">🕒 Late Out</span>
                  <span className="text-xs font-mono font-extrabold mt-0.5 block">R$ 80,00</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setPixAmount('35'); setPixReason('Café da Manhã Extra'); }}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    pixAmount === '35' && pixReason === 'Café da Manhã Extra'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : 'bg-[#121216]/50 border-white/[0.03] text-zinc-400 hover:bg-[#121216] hover:border-zinc-700'
                  }`}
                >
                  <span className="text-[10px] font-bold block">☕ Café Extra</span>
                  <span className="text-xs font-mono font-extrabold mt-0.5 block">R$ 35,00</span>
                </button>
              </div>
            </div>

            {/* Custom Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pix-amount" className="text-[10px] text-zinc-400 font-bold uppercase">Valor (R$)</Label>
                <Input
                  id="pix-amount"
                  type="number"
                  value={pixAmount}
                  onChange={(e) => { setPixAmount(e.target.value); setGeneratedPixPayload(null); }}
                  className="bg-[#121216] border-white/[0.08] mt-1 h-9 text-xs text-white text-left font-mono"
                />
              </div>
              <div>
                <Label htmlFor="pix-reason" className="text-[10px] text-zinc-400 font-bold uppercase">Descrição</Label>
                <Input
                  id="pix-reason"
                  type="text"
                  value={pixReason}
                  onChange={(e) => { setPixReason(e.target.value); setGeneratedPixPayload(null); }}
                  className="bg-[#121216] border-white/[0.08] mt-1 h-9 text-xs text-white"
                />
              </div>
            </div>

            <Button
              onClick={generatePix}
              className="w-full h-9 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Gerar Código Pix
            </Button>

            {/* Generated Pix Info */}
            <AnimatePresence>
              {generatedPixPayload && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 pt-2 border-t border-white/[0.04]"
                >
                  {/* Pix Copy and Paste String */}
                  <div className="bg-[#121216] border border-white/[0.04] p-3 rounded-lg space-y-2">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Pix Copia e Cola</span>
                    <div className="flex items-center gap-2 bg-[#0a0a0f] p-2 rounded border border-white/[0.04] min-w-0">
                      <span className="text-[9px] text-zinc-400 font-mono truncate flex-1 block">{generatedPixPayload}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedPixPayload);
                          toast.success('Pix copiado!');
                        }}
                        className="p-1 rounded hover:bg-white/[0.04] text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Send to Chat Options */}
                  {selectedConversation ? (
                    <Button
                      onClick={sendPixToChat}
                      disabled={isSendingPix}
                      className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      {isSendingPix ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4" /> Enviar Chave Pix no WhatsApp
                        </>
                      )}
                    </Button>
                  ) : (
                    <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                      Selecione uma conversa no Live Feed para poder enviar este Pix diretamente para o WhatsApp do hóspede via Zélla.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Conversa */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="bg-[#0a0a0f] border border-white/[0.08] text-white max-w-md p-6 rounded-xl shadow-2xl">
          <DialogHeader className="border-b border-white/[0.04] pb-3">
            <DialogTitle className="text-sm font-extrabold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" /> Iniciar Nova Conversa
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-[11px]">
              Insira os dados do hóspede e a mensagem de início para que o Zélla inicie a conversa no WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateNewChat} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Nome do Hóspede</label>
              <Input
                type="text"
                placeholder="Ex: Carlos Silva"
                value={newChatName}
                onChange={e => setNewChatName(e.target.value)}
                className="bg-[#121216] border-white/[0.08] rounded-lg text-xs text-white"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Telefone (WhatsApp)</label>
              <Input
                type="text"
                placeholder="Ex: 12997458120"
                value={newChatPhone}
                onChange={e => setNewChatPhone(e.target.value)}
                className="bg-[#121216] border-white/[0.08] rounded-lg text-xs text-white"
                required
              />
              <span className="text-[9px] text-zinc-500 block leading-tight">
                Insira apenas números com código de área (DDD). Exemplo: 12997458120.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Mensagem de Abertura</label>
              <textarea
                placeholder="Ex: Olá Carlos, tudo bem? Aqui é o Zélla..."
                value={newChatMsg}
                onChange={e => setNewChatMsg(e.target.value)}
                className="w-full bg-[#121216] border border-white/[0.08] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/30 min-h-[70px] resize-none"
                required
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewChatOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-transparent border border-white/[0.06] hover:bg-white/[0.02] text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <Button
                type="submit"
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" /> Iniciar Chat
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── CANCEL FLOW DIALOG  */}
      <Dialog open={showCancelFlow} onOpenChange={(open) => { if (!open) { setShowCancelFlow(false); setCancelStep('warning'); } }}>
        <DialogContent className="bg-[#0a0a0f] border border-white/[0.08] text-white max-w-md p-6 rounded-xl shadow-2xl">
          <AnimatePresence mode="wait">
            {cancelStep === 'warning' ? (
              <motion.div
                key="warning"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <DialogHeader className="border-b border-white/[0.04] pb-3">
                  <DialogTitle className="text-sm font-extrabold text-white flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    Cancelar Assinatura
                  </DialogTitle>
                  <DialogDescription className="text-zinc-500 text-[11px]">
                    Tem certeza que deseja cancelar? Essa ação desativará todos os recursos do Zélla.
                  </DialogDescription>
                </DialogHeader>

                <div className="bg-red-500/[0.04] border border-red-500/10 rounded-lg p-3 space-y-2">
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Ao cancelar, você perderá acesso a:
                  </p>
                  <ul className="text-[10px] text-zinc-400 space-y-1 ml-3 list-disc">
                    <li>IA Zélla respondendo automaticamente no WhatsApp</li>
                    <li>CRM de Hóspedes com score de IA</li>
                    <li>Centro de Treinamento da IA</li>
                    <li>Analytics e relatórios avançados</li>
                    <li>Gerador de PIX integrado</li>
                  </ul>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={() => setCancelStep('offer')}
                    className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-lg cursor-pointer transition-colors"
                  >
                    Quero cancelar mesmo assim
                  </Button>
                  <Button
                    onClick={() => setShowCancelFlow(false)}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-lg cursor-pointer transition-colors"
                  >
                    Manter minha assinatura
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="offer"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <DialogHeader className="border-b border-white/[0.04] pb-3">
                  <DialogTitle className="text-sm font-extrabold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Oferta Especial: Link-in-Bio Zélla
                  </DialogTitle>
                  <DialogDescription className="text-zinc-500 text-[11px]">
                    Antes de ir, que tal manter apenas o seu Link-in-Bio Profissional?
                  </DialogDescription>
                </DialogHeader>

                <div className="bg-gradient-to-br from-emerald-950/40 to-[#0a0a0f] border border-emerald-500/15 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-white">Somente Link-in-Bio Zélla</h4>
                      <p className="text-[10px] text-emerald-400 font-bold">por R$ 47,00/mês</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[10px] text-zinc-400 leading-relaxed">
                    <div className="flex items-center gap-2">
                      <CheckCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Página profissional de links personalizada</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Links ilimitados com destaque e emojis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Preview ao vivo e link personalizado (seuzella.com/seu-nome)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Selo &quot;Powered by Zélla&quot; no perfil</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-500/[0.05] border border-amber-500/15 rounded-lg p-3">
                  <div className="flex gap-2">
                    <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-300/80 leading-relaxed">
                      <strong className="text-amber-300">Importante:</strong> Neste plano, o Zélla IA <strong>não</strong> responderá as mensagens do WhatsApp. Você ou alguém da pousada responderá diretamente.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={() => {
                      setShowCancelFlow(false);
                      setIsLinkInBioOnly(true);
                      setActiveTab('linkinbio');
                      toast.success('Plano Link-in-Bio ativado por R$47/mês! Configure seu perfil — sem Zélla IA.');
                    }}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-lg cursor-pointer transition-colors"
                  >
                    Quero manter o Link-in-Bio por R$ 47/mês
                  </Button>
                  <Button
                    onClick={() => {
                      setShowCancelFlow(false);
                      toast.info('Seu cancelamento será processado. Você ainda tem acesso até o fim do ciclo.');
                    }}
                    className="w-full py-2.5 bg-transparent border border-white/[0.06] hover:bg-white/[0.02] text-zinc-500 hover:text-zinc-300 font-bold text-xs rounded-lg cursor-pointer transition-colors"
                  >
                    Cancelar tudo (perder acesso ao Link-in-Bio também)
                  </Button>
                  <Button
                    onClick={() => { setShowCancelFlow(false); setCancelStep('warning'); }}
                    className="w-full py-1.5 text-zinc-600 hover:text-zinc-400 text-[10px] font-semibold cursor-pointer transition-colors"
                  >
                    Voltar
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

    </div>
  );
}
