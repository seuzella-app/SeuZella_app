// ==============================================================================
// SEUZÉLLA.COM — Plan Feature Matrix (UNIFIED TAXONOMY)
// ==============================================================================
// Fonte da verdade absoluta para planos: GRATUITO | LITE | PRO | MAX | PARCEIRO
// Espelhado em: prisma/schema.prisma (enum Plan), auth.ts, middleware.ts
//
// Regra: cada upgrade (GRATUITO→LITE→PRO→MAX) dobra a percepção de valor.
// PARCEIRO é um plano à parte (Link-in-Bio + comissão de indicação).
// ==============================================================================

export type PlanTier = 'gratuito' | 'lite' | 'pro' | 'max' | 'parceiro';

export interface FeatureDef {
  id: string;
  label: string;
  description: string;
  icon: string; // lucide icon name for future use
  minTier: PlanTier;
  upgradeTarget?: PlanTier; // para CTAs de upgrade
  category: 'dashboard' | 'messaging' | 'crm' | 'training' | 'analytics' | 'config' | 'support' | 'revenue';
}

// ── Feature Matrix ─────────────────────────────────────────────────────────────

export const PLAN_TIER_ORDER: PlanTier[] = ['gratuito', 'lite', 'pro', 'max', 'parceiro'];

export const PLAN_DISPLAY: Record<PlanTier, { name: string; label: string; color: string; badgeBg: string; badgeBorder: string; badgeText: string; price: number; priceLabel: string }> = {
  gratuito: {
    name: 'Gratuito',
    label: 'GRATUITO',
    color: 'text-zinc-400',
    badgeBg: 'bg-zinc-500/10',
    badgeBorder: 'border-zinc-500/30',
    badgeText: 'text-zinc-400',
    price: 0,
    priceLabel: 'Grátis',
  },
  lite: {
    name: 'LITE',
    label: 'LITE',
    color: 'text-blue-400',
    badgeBg: 'bg-blue-500/10',
    badgeBorder: 'border-blue-500/30',
    badgeText: 'text-blue-400',
    price: 197,
    priceLabel: 'R$197/mês',
  },
  pro: {
    name: 'PRO',
    label: 'PRO',
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10',
    badgeBorder: 'border-emerald-500/30',
    badgeText: 'text-emerald-400',
    price: 397,
    priceLabel: 'R$397/mês',
  },
  max: {
    name: 'MAX',
    label: 'MAX',
    color: 'text-amber-400',
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/30',
    badgeText: 'text-amber-400',
    price: 797,
    priceLabel: 'R$797/mês',
  },
  parceiro: {
    name: 'Parceiro',
    label: 'PARCEIRO',
    color: 'text-purple-400',
    badgeBg: 'bg-purple-500/10',
    badgeBorder: 'border-purple-500/30',
    badgeText: 'text-purple-400',
    price: 247,
    priceLabel: 'R$247/mês',
  },
};

// Tier hierarchy for comparison
const TIER_LEVEL: Record<PlanTier, number> = { gratuito: 0, lite: 1, pro: 2, max: 3, parceiro: 1 };

export function tierLevel(tier: PlanTier): number {
  return TIER_LEVEL[tier] ?? 0;
}

export function hasAccess(currentTier: PlanTier, requiredTier: PlanTier): boolean {
  return tierLevel(currentTier) >= tierLevel(requiredTier);
}

// ── DDC Tabs disponíveis por plano ────────────────────────────────────────────

export interface TabDef {
  id: string;
  label: string;
  minTier: PlanTier;
  upgradeTarget: PlanTier;
  lockedLabel: string;
  lockedDescription: string;
  lockedFeatures: string[];
}

export const DDC_TABS: TabDef[] = [
  {
    id: 'overview',
    label: 'Dashboard',
    minTier: 'gratuito',
    upgradeTarget: 'lite',
    lockedLabel: 'Dashboard Geral',
    lockedDescription: 'Acesse métricas em tempo real, receita, conversão e status da IA.',
    lockedFeatures: ['Métricas de receita', 'Status da IA', 'Atendimentos do dia', 'Simular mensagem'],
  },
  {
    id: 'messages',
    label: 'Mensagens',
    minTier: 'gratuito',
    upgradeTarget: 'lite',
    lockedLabel: 'Mensagens AI',
    lockedDescription: 'Acompanhe em tempo real todas as conversas da IA com seus hóspedes.',
    lockedFeatures: ['Feed em tempo real', 'Escalonar para humano', 'Votação de respostas'],
  },
  {
    id: 'guests',
    label: 'Hóspedes',
    minTier: 'pro',
    upgradeTarget: 'pro',
    lockedLabel: 'CRM de Hóspedes',
    lockedDescription: 'Pipeline completo com score de IA: Cold → Warm → Hot → Reservado → Perdido.',
    lockedFeatures: ['Pipeline Kanban', 'Score IA por hóspede', 'Filtros avançados', 'Histórico completo'],
  },
  {
    id: 'training',
    label: 'Treinamento',
    minTier: 'pro',
    upgradeTarget: 'pro',
    lockedLabel: 'Centro de Treinamento',
    lockedDescription: 'Treine a IA para responder exatamente do jeito que sua pousada atende.',
    lockedFeatures: ['Prompts personalizados', 'Testar respostas', 'Persona da IA', '4 categorias de treino'],
  },
  {
    id: 'bookings',
    label: 'Reservas',
    minTier: 'lite',
    upgradeTarget: 'lite',
    lockedLabel: 'Reservas',
    lockedDescription: 'Acompanhe todas as reservas e check-ins/outs da sua pousada.',
    lockedFeatures: ['Lista de reservas', 'Filtros por status', 'Calendário'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    minTier: 'pro',
    upgradeTarget: 'pro',
    lockedLabel: 'Analytics Avançado',
    lockedDescription: 'Gráficos detalhados de desempenho, tendências e relatórios comparativos.',
    lockedFeatures: ['Gráficos por período', 'Tendências de conversão', 'Análise de sentimento', 'Exportar relatórios'],
  },
  {
    id: 'settings',
    label: 'Configurações',
    minTier: 'gratuito',
    upgradeTarget: 'lite',
    lockedLabel: 'Configurações',
    lockedDescription: 'Personalize o WhatsApp AI, dados da propriedade e integrações.',
    lockedFeatures: ['WhatsApp AI', 'Dados da propriedade', 'Check-in/out', 'Chave PIX'],
  },
  {
    id: 'airb',
    label: 'Zélla AirB',
    minTier: 'pro',
    upgradeTarget: 'pro',
    lockedLabel: 'Zélla AirB',
    lockedDescription: 'Seu zelador digital para imóveis Airbnb. Responda hóspedes como o dono que sabe tudo.',
    lockedFeatures: ['Magic Onboarding via link Airbnb', 'Cadastro automático de imóveis', 'IA anfitrião 24/7 no WhatsApp', 'Detecção pré/pós-reserva', 'Até 4 imóveis no PRO, 12 no MAX'],
  },
  {
    id: 'credits',
    label: 'Créditos de Amortização',
    minTier: 'lite',
    upgradeTarget: 'lite',
    lockedLabel: 'Créditos de Amortização',
    lockedDescription: 'Indique o Seu Zélla e ganhe créditos que abatem até 50% da sua mensalidade. LITE, PRO, MAX e PARCEIRO participam.',
    lockedFeatures: ['Link-in-Bio rastreado', 'Código por e-mail e WhatsApp', 'Anti-fraude com fingerprint', 'Saldo de créditos em tempo real', 'Milestone LITE: 10 conversões = 12 meses grátis'],
  },
  // ── Sprint 3, Day 13-14: MAX tab — BI Avançado ─────────────────────────
  // Available to MAX plan (R$797). Without this tab, MAX had ZERO additional
  // DDC tabs vs PRO (R$397) — massive value perception problem.
  {
    id: 'bi',
    label: 'BI Avançado',
    minTier: 'max',
    upgradeTarget: 'max',
    lockedLabel: 'Business Intelligence',
    lockedDescription: 'Heatmap de ocupação, previsão de demanda, benchmark vs mercado e alertas de churn.',
    lockedFeatures: ['Heatmap de ocupação por canal', 'Previsão de demanda (7/30 dias)', 'Benchmark vs mercado regional', 'Alertas de churn preditivo', 'Análise de ADR por período'],
  },
  // ── Sprint 3, Day 13-14: MAX tab — Multi-propriedades ──────────────────
  // MAX supports up to 12 properties (PRO = 4). Without a dedicated tab to
  // switch/manage properties, multi-property operation was impossible.
  {
    id: 'properties',
    label: 'Propriedades',
    minTier: 'max',
    upgradeTarget: 'max',
    lockedLabel: 'Gestão Multi-Propriedades',
    lockedDescription: 'Gerencie até 12 propriedades em uma única conta com troca rápida.',
    lockedFeatures: ['Até 12 propriedades', 'Troca rápida entre propriedades', 'Visão consolidada', 'Relatórios por propriedade', 'Permissões por equipe'],
  },
];

// ── Sub-features dentro de Configurações ──────────────────────────────────────

export interface SettingsFeature {
  id: string;
  label: string;
  minTier: PlanTier;
  upgradeTarget: PlanTier;
  lockedDescription: string;
}

export const SETTINGS_FEATURES: SettingsFeature[] = [
  {
    id: 'whatsapp-ai',
    label: 'WhatsApp AI',
    minTier: 'gratuito',
    upgradeTarget: 'lite',
    lockedDescription: 'Configure o tom e comportamento da IA no WhatsApp.',
  },
  {
    id: 'property-info',
    label: 'Dados da Propriedade',
    minTier: 'gratuito',
    upgradeTarget: 'lite',
    lockedDescription: 'Nome, telefone, horários de check-in/out.',
  },
  {
    id: 'checkin-hours',
    label: 'Horários Check-in/out',
    minTier: 'gratuito',
    upgradeTarget: 'lite',
    lockedDescription: 'Defina horários personalizados.',
  },
  {
    id: 'pix-config',
    label: 'Configuração PIX',
    minTier: 'lite',
    upgradeTarget: 'lite',
    lockedDescription: 'Receba pagamentos via PIX integrado.',
  },
  {
    id: 'linkinbio',
    label: 'Link-in-Bio Profissional',
    minTier: 'lite',
    upgradeTarget: 'pro',
    lockedDescription: 'LITE: Zélla IA com 500 msgs/mês | PRO: Zélla IA humanizada, msgs ilimitadas | MAX: Zélla IA completa + envio ativo | Standalone R$47: só Link-in-Bio sem IA.',
  },
  {
    id: 'ical-sync',
    label: 'Sincronização iCal',
    minTier: 'pro',
    upgradeTarget: 'pro',
    lockedDescription: 'Sincronize com Booking.com e Airbnb automaticamente.',
  },
  {
    id: 'ai-persona',
    label: 'Persona IA Avançada',
    minTier: 'pro',
    upgradeTarget: 'pro',
    lockedDescription: 'Personalize 100% o tom, estilo e conhecimento da IA.',
  },
  {
    id: 'campaigns',
    label: 'Campanhas Automatizadas',
    minTier: 'pro',
    upgradeTarget: 'pro',
    lockedDescription: 'Crie campanhas de remarketing e reengajamento automáticas.',
  },
  {
    id: 'faturamento',
    label: 'Faturamento',
    minTier: 'gratuito',
    upgradeTarget: 'lite',
    lockedDescription: 'Gerencie assinatura e acompanhe cotas.',
  },
];

// ── Quick Actions por plano ──────────────────────────────────────────────────

export interface QuickActionDef {
  id: string;
  label: string;
  minTier: PlanTier;
  upgradeTarget: PlanTier;
}

export const QUICK_ACTIONS: QuickActionDef[] = [
  { id: 'dashboard', label: 'Dashboard', minTier: 'gratuito', upgradeTarget: 'lite' },
  { id: 'messages', label: 'Mensagens', minTier: 'gratuito', upgradeTarget: 'lite' },
  { id: 'guests', label: 'Hóspedes', minTier: 'pro', upgradeTarget: 'pro' },
  { id: 'training', label: 'Treinamento', minTier: 'pro', upgradeTarget: 'pro' },
  { id: 'bookings', label: 'Reservas', minTier: 'lite', upgradeTarget: 'lite' },
  { id: 'analytics', label: 'Analytics', minTier: 'pro', upgradeTarget: 'pro' },
  { id: 'notifications', label: 'Notificações', minTier: 'gratuito', upgradeTarget: 'lite' },
  { id: 'settings', label: 'Configurações', minTier: 'gratuito', upgradeTarget: 'lite' },
  { id: 'airb', label: 'Zélla AirB', minTier: 'pro', upgradeTarget: 'pro' },
];

// ── Feature highlights por plano (para upgrade nudges) ────────────────────────

export const PLAN_HIGHLIGHTS: Record<PlanTier, { headline: string; features: string[]; valueProposition: string }> = {
  gratuito: {
    headline: 'Comece a testar agora mesmo',
    features: ['IA 24/7 respondendo hóspedes', 'Checkout PIX integrado', 'Dashboard de métricas'],
    valueProposition: 'Para conhecer o Zélla na prática antes de assinar.',
  },
  lite: {
    headline: 'Tudo essencial para vender pelo WhatsApp',
    features: [
      'IA 24/7 respondendo hóspedes',
      'Checkout PIX integrado',
      'Link-in-Bio profissional',
      'Zélla IA com 500 msgs/mês',
      'Dashboard de métricas',
      'Relatórios semanais por e-mail',
    ],
    valueProposition: 'Para a pousada que quer automatizar o atendimento e não perder mais hóspedes.',
  },
  pro: {
    headline: 'Cresça sem limites com IA inteligente',
    features: [
      'Mensagens ILIMITADAS (Zero Taxas por Mensagem)',
      'Conexão Instantânea via QR Code (sem burocracia)',
      'Clone Digital de Tom de Voz (aprende seu estilo exato de fala)',
      'CRM Pipeline com score IA',
      'Centro de Treinamento da IA',
      'Analytics avançado com gráficos',
      'Link-in-Bio + Zélla IA humanizada',
      'Campanhas automatizadas',
      'Análise de sentimento',
      'Sincronização iCal (Booking/Airbnb)',
      'Persona IA 100% personalizada',
    ],
    valueProposition: 'Para a pousada que quer escalar operação, treinar a IA e fechar mais reservas.',
  },
  max: {
    headline: 'Operação de alto padrão com suporte dedicado',
    features: [
      'TUDO do plano PRO',
      'Conexão Instantânea via QR Code (Zero Taxas por Mensagem)',
      'Clone Digital de Tom de Voz Avançado (aprende sotaque e gírias locais)',
      'Gerente de Treinamento IA Dedicado (Zellador)',
      'Split de pagamentos automático',
      'Integrações customizadas',
      'Exportação avançada (PDF/XLSX)',
      'SLA garantido 99.9%',
      'Onboarding personalizado',
      'Consultoria mensal com a equipe',
    ],
    valueProposition: 'Para redes e pousadas de alto padrão que querem um parceiro estratégico.',
  },
  parceiro: {
    headline: 'Parceiro Zélla — Ganhe indicando',
    features: [
      'Selo Parceiro Zélla verificado',
      'Link-in-Bio profissional personalizado',
      'Comissão por indicação convertida',
      'Dashboard de indicações',
      'Acesso antecipado a novas features',
    ],
    valueProposition: 'Para quem quer monetizar sua rede e ser parceiro oficial Zélla.',
  },
};

// ── Link-in-Bio Standalone (sem Zélla IA) ────────────────────────────────────

export const LINKINBIO_STANDALONE_PRICE = 47; // R$ 47/mês
export const LINKINBIO_STANDALONE_LABEL = 'R$47/mês';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getTabAccess(tier: PlanTier): Record<string, boolean> {
  const access: Record<string, boolean> = {};
  for (const tab of DDC_TABS) {
    access[tab.id] = hasAccess(tier, tab.minTier);
  }
  return access;
}

export function getNextTier(currentTier: PlanTier): PlanTier | null {
  const idx = PLAN_TIER_ORDER.indexOf(currentTier);
  if (idx < 0 || idx >= PLAN_TIER_ORDER.length - 1) return null;
  return PLAN_TIER_ORDER[idx + 1];
}

export function getUpgradePrice(currentTier: PlanTier): { target: PlanTier; currentPrice: number; newPrice: number; diff: number } | null {
  const next = getNextTier(currentTier);
  if (!next) return null;
  const current = PLAN_DISPLAY[currentTier].price;
  const nextPrice = PLAN_DISPLAY[next].price;
  return { target: next, currentPrice: current, newPrice: nextPrice, diff: nextPrice - current };
}

// ── Legacy Migration Helper ───────────────────────────────────────────────────
// Converte valores antigos para a nova taxonomia
export function migratePlanLegacy(oldPlan: string): PlanTier {
  const map: Record<string, PlanTier> = {
    trial: 'gratuito',
    starter: 'lite',
    professional: 'pro',
    business: 'max',
    gratuito: 'gratuito',
    lite: 'lite',
    pro: 'pro',
    max: 'max',
    parceiro: 'parceiro',
    fundador: 'max', // fundador → max
  };
  return map[oldPlan.toLowerCase()] || 'gratuito';
}
