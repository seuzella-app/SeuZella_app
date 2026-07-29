'use client';

import { useRef, useState, useMemo } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  Crown,
  Sparkles,
  Rocket,
  Star,
  Zap,
  CreditCard,
  QrCode,
  Shield,
  Gift,
  Loader2,
  Building2,
  CalendarCheck2,
  KeyRound,
  DollarSign,
} from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';
import { getNicheContent } from '@/data/niche-content';
import { CheckoutModal } from '@/components/landing/CheckoutModal';
import { PaymentTrustBadges } from '@/components/landing/PaymentTrustBadges';
import { trackLandingClick } from '@/lib/telemetry/landing-telemetry';

type PaymentMode = 'pix' | 'cartao';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  nameShort: string;
  badge: string;
  badgeAirbnb?: string;
  badgeColor: string;
  badgeColorAirbnb?: string;
  icon: typeof Zap;
  iconBg: string;
  iconColor: string;
  pricePix: number;
  priceCartao: number;
  priceLabel: string;
  /** Airbnb-specific pricing (overrides pricePix/priceCartao when niche=airbnb) */
  pricePixAirbnb?: number;
  priceCartaoAirbnb?: number;
  priceLabelAirbnb?: string;
  onlyCard?: boolean;
  desc: string;
  descAirbnb?: string;
  cta: string;
  ctaStyle: string;
  ctaStyleAirbnb?: string;
  popular: boolean;
  popularAirbnb?: boolean;
  idealParaPousada?: string;
  idealParaAirbnb?: string;
  features: PlanFeature[];
  featuresAirbnb?: PlanFeature[];
  /** Which niches see this plan */
  niches: Array<'pousada' | 'airbnb'>;
  /** Show 7-day free trial badge (Airbnb PRO & MAX) */
  showTrialBadge?: boolean;
  /** Airbnb-specific ROI line shown under the price */
  roiAirbnb?: string;
}

const plans: Plan[] = [
  // ─── PARCEIRO ZÉLLA — Both niches (Link-in-Bio exclusivo) ──
  {
    id: 'parceiro',
    name: 'PARCEIRO ZÉLLA',
    nameShort: 'Parceiro Zélla',
    badge: 'Exclusivo Parceiros',
    badgeAirbnb: 'Exclusivo Parceiros',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    badgeColorAirbnb: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: Crown,
    iconBg: 'from-amber-500/20 to-amber-900/10',
    iconColor: 'text-amber-400',
    pricePix: 247,
    priceCartao: 247,
    priceLabel: 'R$247',
    pricePixAirbnb: 247,
    priceCartaoAirbnb: 247,
    priceLabelAirbnb: 'R$247',
    onlyCard: false,
    desc: 'Plano PRO completo por R$247/mês — preço congelado por 24 meses + selo exclusivo de Parceiro Zélla no seu perfil Link-in-Bio. Atendimento e mensagens ilimitados.',
    descAirbnb: 'Plano PRO completo por R$247/mês — preço congelado por 24 meses + selo exclusivo de Parceiro Zélla no seu perfil. Atendimento automatizado e mensagens ilimitadas.',
    cta: 'Garantir Vaga de Parceiro',
    ctaStyle: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/30',
    ctaStyleAirbnb: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/30',
    popular: true,
    popularAirbnb: true,
    idealParaPousada: '1–5 pousadas',
    idealParaAirbnb: '1–4 imóveis',
    niches: ['pousada', 'airbnb'],
    features: [
      { text: 'Plano PRO completo — R$247/mês', included: true },
      { text: 'Preço congelado por 24 meses', included: true },
      { text: 'Selo exclusivo de Parceiro Zélla no Link-in-Bio', included: true },
      { text: 'Perfil Link-in-Bio fornecido pelo Zélla', included: true },
      { text: 'Link para fixar no perfil do Instagram', included: true },
      { text: 'Atendimento ilimitado', included: true },
      { text: 'Mensagens ilimitadas (sem recargas)', included: true },
      { text: 'WhatsApp com tom 100% personalizado', included: true },
      { text: 'Checkout PIX e Cartão integrados', included: true },
      { text: 'Dashboard completo com campanhas', included: true },
      { text: 'Sugestões de preços inteligentes', included: true },
      { text: 'Análise de sentimento', included: true },
      { text: 'Suporte prioritário', included: true },
      { text: 'Economia de R$150/mês vs. PRO regular', included: true },
    ],
    featuresAirbnb: [
      { text: 'Plano PRO completo — R$247/mês', included: true },
      { text: 'Preço congelado por 24 meses', included: true },
      { text: 'Selo exclusivo de Parceiro Zélla', included: true },
      { text: 'Magic Onboarding — URL do anúncio (5 min)', included: true },
      { text: 'Até 4 imóveis cadastrados', included: true },
      { text: 'Mensagens ilimitadas (sem recargas)', included: true },
      { text: 'Check-in virtual automático', included: true },
      { text: 'PIX Gatekeeper anti-banimento', included: true },
      { text: 'Dashboard com portfólio completo', included: true },
      { text: 'Suporte prioritário', included: true },
      { text: 'Economia de R$150/mês vs. PRO regular', included: true },
    ],
  },

  // ─── LITE — Pousada only ────────────────────────────────────
  {
    id: 'lite',
    name: 'LITE',
    nameShort: 'Lite',
    badge: 'Mais Escolhido',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: Rocket,
    iconBg: 'from-neutral-500/20 to-neutral-600/10',
    iconColor: 'text-neutral-400',
    pricePix: 197,
    priceCartao: 247,
    priceLabel: 'R$197',
    desc: 'Tudo que sua pousada precisa para vender mais pelo WhatsApp. Atendimento 24/7, PIX integrado e dashboard completo.',
    cta: 'Assinar LITE via PIX',
    ctaStyle: 'border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]',
    popular: false,
    idealParaPousada: '1–2 pousadas',
    niches: ['pousada'],
    features: [
      { text: '50 hóspedes atendidos por mês', included: true },
      { text: '500 mensagens mensais', included: true },
      { text: 'Recarga de 250 mensagens por R$97 (se precisar)', included: true },
      { text: 'WhatsApp 24/7 com tom personalizado', included: true },
      { text: 'Checkout PIX integrado (Mercado Pago)', included: true },
      { text: 'Dashboard de métricas completo', included: true },
      { text: 'Relatórios semanais por e-mail', included: true },
      { text: 'Sem marca d\'água ZÉLLA', included: true },
      { text: 'Respostas otimizadas para economia', included: true },
    ],
  },

  // ─── PRO — Both niches ──────────────────────────────────────
  {
    id: 'pro',
    name: 'PRO',
    nameShort: 'Pro',
    badge: 'Mais Popular',
    badgeAirbnb: 'Mais Escolhido',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    badgeColorAirbnb: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: Star,
    iconBg: 'from-emerald-500/20 to-emerald-900/10',
    iconColor: 'text-emerald-400',
    pricePix: 397,
    priceCartao: 397,
    priceLabel: 'R$397',
    pricePixAirbnb: 197,
    priceCartaoAirbnb: 197,
    priceLabelAirbnb: 'R$197',
    onlyCard: true,
    desc: 'Para pousadas que querem crescer sem limites. Mensagens ilimitadas, campanhas automatizadas e suporte prioritário.',
    descAirbnb: 'Seu primeiro imóvel que reserva direto pelo WhatsApp já paga o plano. Atendimento 24/7, Magic Onboarding e check-in virtual automático — você nem precisa pegar no celular.',
    cta: 'Assinar PRO via Cartão',
    ctaStyle: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 shadow-lg shadow-emerald-500/25',
    ctaStyleAirbnb: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-400 hover:to-blue-500 shadow-lg shadow-blue-500/25',
    popular: false,
    popularAirbnb: false,
    idealParaPousada: '3–5 pousadas',
    idealParaAirbnb: '1–4 imóveis',
    niches: ['pousada', 'airbnb'],
    showTrialBadge: false,
    roiAirbnb: '1 reserva direta/mês já paga o plano*',
    features: [
      { text: 'Hóspedes ilimitados', included: true },
      { text: 'Link-in-bio profissional liberado', included: true },
      { text: 'Mensagens ilimitadas (sem recargas)', included: true },
      { text: 'WhatsApp com tom 100% personalizado', included: true },
      { text: 'Checkout Cartão integrado', included: true },
      { text: 'Dashboard completo', included: true },
      { text: 'Sugestões de preços inteligentes', included: true },
      { text: 'Campanhas automatizadas', included: true },
      { text: 'Análise de sentimento', included: true },
      { text: 'Suporte prioritário', included: true },
      { text: 'Economia inteligente nas mensagens', included: true },
    ],
    featuresAirbnb: [
      { text: 'Zélla AirB 24/7 no WhatsApp — responde por você', included: true },
      { text: 'Magic Onboarding — cole a URL do anúncio e pronto (5 min)', included: true },
      { text: 'Até 4 imóveis cadastrados', included: true },
      { text: 'Mensagens ilimitadas (sem recargas)', included: true },
      { text: 'Check-in virtual automático (código da fechadura via WhatsApp)', included: true },
      { text: 'PIX Gatekeeper — bloqueia PIX p/ hóspedes Airbnb (anti-banimento)', included: true },
      { text: 'Lifecycle Hooks automáticos (regras, check-in, avaliação)', included: true },
      { text: 'Respostas sobre vizinhança incluídas (restaurantes, praias, etc.)', included: true },
      { text: 'Dashboard com portfólio completo (ocupação, receita, avaliações)', included: true },
      { text: 'Campanhas de reengajamento para hóspedes recorrentes', included: true },
      { text: 'Análise de sentimento dos hóspedes', included: true },
      { text: 'Suporte prioritário', included: true },
    ],
  },

  // ─── MAX — Both niches ──────────────────────────────────────
  {
    id: 'max',
    name: 'MAX',
    nameShort: 'Max',
    badge: 'High End',
    badgeAirbnb: 'Máximo Valor',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    badgeColorAirbnb: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    icon: Crown,
    iconBg: 'from-amber-500/20 to-amber-900/10',
    iconColor: 'text-amber-400',
    pricePix: 797,
    priceCartao: 797,
    priceLabel: 'R$797',
    pricePixAirbnb: 397,
    priceCartaoAirbnb: 397,
    priceLabelAirbnb: 'R$397',
    onlyCard: true,
    desc: 'Para redes e pousadas de alto padrão. Suporte VIP, consultoria personalizada e recursos exclusivos.',
    descAirbnb: 'Para quem tem 5+ imóveis e quer maximizar receita. Calendar Sync, atendimento treinado para seu portfólio e consultoria mensal — cada reserva direta economiza 15% de comissão Airbnb.',
    cta: 'Assinar MAX via Cartão',
    ctaStyle: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/25',
    ctaStyleAirbnb: 'bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:from-sky-400 hover:to-blue-500 shadow-lg shadow-sky-500/25',
    popular: false,
    popularAirbnb: false,
    idealParaPousada: '6+ pousadas',
    idealParaAirbnb: '5–12 imóveis',
    niches: ['pousada', 'airbnb'],
    showTrialBadge: false,
    roiAirbnb: '2 reservas diretas/mês = R$600+ economizados em comissão*',
    features: [
      { text: 'Tudo do plano PRO', included: true },
      { text: 'Link-in-bio profissional liberado', included: true },
      { text: 'Mensagens ilimitadas (sem recargas)', included: true },
      { text: 'Ajuste de preços inteligente avançado', included: true },
      { text: 'Dashboard completo', included: true },
      { text: 'Split de pagamentos automático', included: true },
      { text: 'Atendimentos 24 por 7', included: true },
      { text: 'Integrações customizadas', included: true },
      { text: 'Gerente de conta Dedicado para Treinamento', included: true },
      { text: 'Consultoria mensal com a equipe', included: true },
      { text: 'Onboarding personalizado', included: true },
      { text: 'SLA garantido 99.9%', included: true },
      { text: 'Treinamento mensal com equipe', included: true },
    ],
    featuresAirbnb: [
      { text: 'Tudo do plano PRO (4 imóveis inclusos)', included: true },
      { text: 'Até 12 imóveis cadastrados', included: true },
      { text: 'Calendar Sync — sincronização Airbnb, Booking, Vrbo (iCal)', included: true },
      { text: 'Atendimento personalizado — treinamento dedicado p/ seu portfólio', included: true },
      { text: 'Integrações customizadas (Airbnb, Booking, Vrbo)', included: true },
      { text: 'Onboarding personalizado com nossa equipe', included: true },
      { text: 'Consultoria mensal de otimização de portfólio', included: true },
      { text: 'Relatórios avançados (PDF/XLSX) para gestão financeira', included: true },
      { text: 'Split de pagamentos automático', included: true },
      { text: 'Suporte VIP prioritário', included: true },
      { text: 'SLA garantido 99.9%', included: true },
    ],
  },
];

const easeOut: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

export function PricingSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('pix');
  const [loadingPlan] = useState<string | null>(null);
  const [checkoutModal, setCheckoutModal] = useState<{
    open: boolean;
    planId: string;
    planName: string;
    price: number;
    paymentMethod: 'pix' | 'cartao';
  }>({ open: false, planId: '', planName: '', price: 0, paymentMethod: 'pix' });
  const { niche, isPousada, isAirbnb } = useNiche();
  const content = getNicheContent(niche);

  // Filter plans by current niche
  const visiblePlans = useMemo(
    () => plans.filter(p => p.niches.includes(niche)),
    [niche]
  );

  // Dynamic grid cols based on plan count
  const gridCols = useMemo(() => {
    const count = visiblePlans.length;
    if (count <= 2) return 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto';
    if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto';
    if (count === 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';
  }, [visiblePlans.length]);

  const handleSubscribe = (planId: string, forcedPaymentMethod?: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      console.error('[PricingSection] Plan not found:', planId, 'Available:', plans.map(p => p.id));
      return;
    }

    trackLandingClick({
      eventName: `plan_select_${planId}`,
      category: 'plan_selection',
      planId,
      label: plan.name,
      metadata: { niche },
    });

    const method = forcedPaymentMethod || paymentMode;
    const effectivePricePix = isAirbnb && plan.pricePixAirbnb != null ? plan.pricePixAirbnb : plan.pricePix;
    const effectivePriceCartao = isAirbnb && plan.priceCartaoAirbnb != null ? plan.priceCartaoAirbnb : plan.priceCartao;
    const price = method === 'pix' ? effectivePricePix : effectivePriceCartao;
    setCheckoutModal({
      open: true,
      planId,
      planName: plan.name,
      price,
      paymentMethod: method as 'pix' | 'cartao',
    });
  };

  return (
    <section ref={ref} id="precos" className="parallax-section parallax-dark py-28 sm:py-36 lg:py-44">
      <div className="relative z-10 max-w-7xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-6 ${
            isPousada
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-blue-500/10 border-blue-500/20'
          }`}>
            <CreditCard className={`w-3.5 h-3.5 ${isPousada ? 'text-emerald-400' : 'text-blue-400'}`} />
            <span className={`text-xs font-medium ${isPousada ? 'text-emerald-400' : 'text-blue-400'}`}>
              Planos & Preços
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6">
            Escolha o plano ideal
            <br />
            <span className={`font-bold ${isPousada ? 'text-emerald-400' : 'text-blue-400'}`}>
              {isPousada ? 'para sua pousada' : 'para seus imóveis'}
            </span>
          </h2>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto mb-4">
            Escolha o plano ideal para alavancar suas reservas diretas e zerar comissões.
          </p>

          {/* Pricing Focus */}
          <AnimatePresence mode="wait">
            <motion.p
              key={niche}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: easeOut }}
              className={`text-sm max-w-lg mx-auto mb-10 flex items-center justify-center gap-1.5 ${
                isPousada ? 'text-emerald-400/80' : 'text-blue-400/80'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                Foco em <strong className={isPousada ? 'text-emerald-400' : 'text-blue-400'}>{content.pricing.focusLabel}</strong> — {content.pricing.focusDesc}
              </span>
            </motion.p>
          </AnimatePresence>

          {/* Payment Toggle — hidden for Airbnb (all plans are card-only) */}
          {isPousada && (
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <button
                onClick={() => setPaymentMode('pix')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 cursor-pointer ${
                  paymentMode === 'pix'
                    ? 'toggle-pix-active shadow-lg shadow-emerald-500/20'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <QrCode className="w-4 h-4" />
                PIX
                <span className="text-[10px] opacity-70">Economize</span>
              </button>
              <button
                onClick={() => setPaymentMode('cartao')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 cursor-pointer ${
                  paymentMode === 'cartao'
                    ? 'toggle-card-active shadow-lg'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Cartão
              </button>
            </div>
          )}
        </motion.div>



        {/* Pricing Cards Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={niche}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className={`pricing-grid grid gap-6 mb-20 ${gridCols}`}
          >
            {visiblePlans.map((plan, i) => {
              const activePaymentMethod = plan.onlyCard ? 'cartao' : paymentMode;
              // Use Airbnb-specific pricing when available
              const effectivePricePix = isAirbnb && plan.pricePixAirbnb != null ? plan.pricePixAirbnb : plan.pricePix;
              const effectivePriceCartao = isAirbnb && plan.priceCartaoAirbnb != null ? plan.priceCartaoAirbnb : plan.priceCartao;
              const effectivePriceLabel = isAirbnb && plan.priceLabelAirbnb ? plan.priceLabelAirbnb : plan.priceLabel;
              const price = activePaymentMethod === 'pix' ? effectivePricePix : effectivePriceCartao;
              const savings = effectivePriceCartao > 0 && !plan.onlyCard ? effectivePriceCartao - effectivePricePix : 0;
              const Icon = plan.icon;
              const isPopular = isAirbnb ? (plan.popularAirbnb ?? plan.popular) : plan.popular;
              const activeCtaStyle = isAirbnb && plan.ctaStyleAirbnb ? plan.ctaStyleAirbnb : plan.ctaStyle;
              const activeBadge = isAirbnb && plan.badgeAirbnb ? plan.badgeAirbnb : plan.badge;
              const activeBadgeColor = isAirbnb && plan.badgeColorAirbnb ? plan.badgeColorAirbnb : plan.badgeColor;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 40 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: i * 0.12 }}
                  className={`relative rounded-2xl p-[1px] transition-all duration-300 ${
                    isPopular
                      ? isPousada
                        ? 'pricing-glow-emerald'
                        : 'pricing-glow-blue'
                      : plan.id === 'max'
                      ? isPousada
                        ? 'pricing-glow-amber'
                        : 'pricing-glow-blue'
                      : ''
                  }`}
                  style={{
                    background: isPopular
                      ? isPousada
                        ? 'linear-gradient(135deg, #10B981, #8B5CF6, #10B981)'
                        : 'linear-gradient(135deg, #3B82F6, #8B5CF6, #3B82F6)'
                      : plan.id === 'max'
                      ? isPousada
                        ? 'linear-gradient(135deg, #F59E0B, #EF4444, #F59E0B)'
                        : 'linear-gradient(135deg, #2563EB, #7C3AED, #2563EB)'
                      : plan.id === 'parceiro'
                      ? 'linear-gradient(135deg, #F59E0B, #D97706, #F59E0B)'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                  }}
                >
                  <div className="relative rounded-2xl bg-[#0a0a0a] p-7 h-full flex flex-col">
                    {/* Popular / Badge */}
                    {isPopular && (
                      <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-xs font-bold shadow-lg ${
                        isPousada
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/30'
                          : 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-blue-500/30'
                      }`}>
                        {isAirbnb ? 'Mais Escolhido' : 'Mais Popular'}
                      </div>
                    )}

                    {/* Plan Header */}
                    <div className="flex items-center justify-between mb-5">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${plan.iconBg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${plan.iconColor}`} />
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${activeBadgeColor}`}>
                        {activeBadge}
                      </span>
                    </div>

                    {/* Plan Details */}
                    <h3 className="text-white font-bold text-xl mb-2">{plan.name}</h3>
                    <p className="text-neutral-400 text-xs mb-2 leading-relaxed">
                      {isAirbnb && plan.descAirbnb
                        ? plan.descAirbnb
                        : plan.desc}
                    </p>

                    {/* Ideal para badge */}
                    <div className="flex items-center gap-1.5 mb-4">
                      {isPousada && plan.idealParaPousada && (
                        <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                          Ideal para {plan.idealParaPousada}
                        </span>
                      )}
                      {isAirbnb && plan.idealParaAirbnb && (
                        <>
                          <Building2 className="w-3 h-3 text-blue-400" />
                          <span className="text-[10px] font-semibold text-blue-300 bg-blue-500/15 border border-blue-500/25 px-2 py-0.5 rounded-full">
                            Ideal para {plan.idealParaAirbnb}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Price */}
                    <div className="mb-6">
                      {price === 0 ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-extrabold text-white">Grátis</span>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm text-neutral-400">R$</span>
                            <span className="text-4xl font-extrabold text-white">{price}</span>
                            <span className="text-neutral-500 text-sm">/mês</span>
                          </div>
                          {/* Airbnb trial badge under price */}
                          {isAirbnb && plan.showTrialBadge && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <CalendarCheck2 className="w-3.5 h-3.5 text-blue-400" />
                              <span className="text-blue-400 text-xs font-semibold">
                                7 dias grátis — cancele quando quiser
                              </span>
                            </div>
                          )}
                          {/* Airbnb ROI line */}
                          {isAirbnb && plan.roiAirbnb && (
                            <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                              <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="text-emerald-400 text-[11px] font-semibold leading-tight">
                                {plan.roiAirbnb}
                              </span>
                            </div>
                          )}
                          {plan.id === 'parceiro' && (
                            <div className="flex flex-col gap-0.5 mt-1">
                              <span className="text-amber-400 text-xs font-semibold">
                                Congelado por 24 meses
                              </span>
                              <span className="text-amber-400/70 text-[10px]">
                                Selo de Parceiro no Link-in-Bio • Fixe no Instagram
                              </span>
                            </div>
                          )}
                          {plan.id !== 'parceiro' && activePaymentMethod === 'pix' && savings > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-neutral-600 text-xs line-through">R${plan.priceCartao}/mês</span>
                              <span className="text-emerald-400 text-xs font-medium">
                                Economia de R${savings}/mês
                              </span>
                            </div>
                          )}
                          {plan.onlyCard && isPousada && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-amber-400/80 text-[9px] font-semibold uppercase tracking-wider bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                Exclusivo no Cartão
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => handleSubscribe(plan.id, activePaymentMethod)}
                      disabled={loadingPlan === plan.id}
                      className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 ${activeCtaStyle} ${loadingPlan === plan.id ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {loadingPlan === plan.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processando...
                        </>
                      ) : price === 0 ? (
                        'Começar Trial Grátis'
                      ) : isAirbnb ? (
                        `Experimentar ${plan.nameShort} — 7 Dias Grátis`
                      ) : (
                        `Assinar ${plan.nameShort} via ${activePaymentMethod === 'pix' ? 'PIX' : 'Cartão'}`
                      )}
                    </button>

                    {/* Divider */}
                    <div className="h-px bg-white/[0.06] my-6" />

                    {/* Features */}
                    <div className="flex-1 space-y-3">
                      {(isAirbnb && plan.featuresAirbnb
                        ? plan.featuresAirbnb
                        : plan.features
                      ).map((feature) => (
                        <div key={feature.text} className="flex items-start gap-2">
                          {feature.included ? (
                            <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isAirbnb ? 'text-blue-400' : 'text-emerald-400'}`} />
                          ) : (
                            <X className="w-4 h-4 text-neutral-700 shrink-0 mt-0.5" />
                          )}
                          <span
                            className={`text-xs leading-relaxed ${
                              feature.included ? 'text-neutral-300' : 'text-neutral-600'
                            }`}
                          >
                            {feature.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Airbnb ROI Value Calculator */}
        <AnimatePresence mode="wait">
          {isAirbnb && (
            <motion.div
              key="airbnb-roi-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="max-w-3xl mx-auto mb-16 mt-4"
            >
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-5 h-5 text-blue-400" />
                  <h4 className="text-white font-bold text-base">Faça a conta: o Zélla se paga sozinho</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-center">
                    <p className="text-neutral-400 text-[10px] uppercase tracking-wider mb-1">Comissão Airbnb</p>
                    <p className="text-2xl font-extrabold text-white">15%</p>
                    <p className="text-neutral-500 text-[10px]">por cada reserva</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-center">
                    <p className="text-neutral-400 text-[10px] uppercase tracking-wider mb-1">Reserva direta média</p>
                    <p className="text-2xl font-extrabold text-emerald-400">R$450</p>
                    <p className="text-neutral-500 text-[10px]">economia em comissão</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-center">
                    <p className="text-neutral-400 text-[10px] uppercase tracking-wider mb-1">PRO R$197/mês</p>
                    <p className="text-2xl font-extrabold text-blue-400">1 reserva</p>
                    <p className="text-neutral-500 text-[10px]">direta já paga o plano</p>
                  </div>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  <span className="text-white font-semibold">Exemplo real:</span> Com 3 imóveis a R$300/noite e ocupação de 70%, você fatura ~R$18.900/mês. 
                  A comissão Airbnb leva <span className="text-rose-400 font-semibold">R$2.835/mês</span>. 
                  Se o Zélla converter apenas 2 reservas/mês para direto, você economiza <span className="text-emerald-400 font-semibold">R$900</span> — 
                  o plano PRO sai de graça e ainda sobra <span className="text-emerald-400 font-semibold">R$703 de lucro</span>. 
                  No MAX, são 4 reservas diretas = <span className="text-emerald-400 font-semibold">R$1.800</span> economizados — 
                  o plano custa R$397 e você ganha <span className="text-emerald-400 font-semibold">R$1.403 líquidos</span>.
                </p>
                <p className="text-neutral-600 text-[10px] mt-3">*Estimativa baseada em ocupação média de 70% e diária de R$300. Resultados variam por região e portfólio.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Payment methods & Trust Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-8"
        >
          <PaymentTrustBadges />
        </motion.div>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        open={checkoutModal.open}
        onClose={() => setCheckoutModal(prev => ({ ...prev, open: false }))}
        planId={checkoutModal.planId}
        planName={checkoutModal.planName}
        price={checkoutModal.price}
        paymentMethod={checkoutModal.paymentMethod}
        niche={niche}
      />
    </section>
  );
}
