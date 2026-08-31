// =============================================================================
// ZÉLLA — Feature Gates por Plano
// =============================================================================
// Controla quais funcionalidades cada plano (PRO / MAX) pode acessar.
// Compartilhado entre frontend e backend.
// =============================================================================

export const PLAN_CONFIG = {
  pro: {
    slug: 'pro' as const,
    name: 'PRO',
    priceCents: 39700,
    maxProperties: 4,
    maxWhatsappNumbers: 1,
    features: {
      aiAttendance: true,
      preBookingMode: true,
      postBookingMode: true,
      autoScraping: true,
      magicOnboarding: true,
      oneShotResolution: true,
      dashboard: true,
      conversationHistory: true,
      analytics: false,
      weeklyReports: false,
      publicApi: false,
      abTesting: false,
      customWebhooks: false,
      dataExport: false,
      prioritySupport: false,
      multiWhatsapp: false,
    },
  },
  max: {
    slug: 'max' as const,
    name: 'MAX',
    priceCents: 79700,
    maxProperties: 12,
    maxWhatsappNumbers: 3,
    features: {
      aiAttendance: true,
      preBookingMode: true,
      postBookingMode: true,
      autoScraping: true,
      magicOnboarding: true,
      oneShotResolution: true,
      dashboard: true,
      conversationHistory: true,
      analytics: true,
      weeklyReports: true,
      publicApi: true,
      abTesting: true,
      customWebhooks: true,
      dataExport: true,
      prioritySupport: true,
      multiWhatsapp: true,
    },
  },
  parceiro: {
    slug: 'parceiro' as const,
    name: 'PARCEIRO',
    priceCents: 24700,
    maxProperties: 4, // Exato limite do PRO
    maxWhatsappNumbers: 1, // Exato limite do PRO
    features: {
      aiAttendance: true,
      preBookingMode: true,
      postBookingMode: true,
      autoScraping: true,
      magicOnboarding: true,
      oneShotResolution: true,
      dashboard: true,
      conversationHistory: true,
      analytics: false,
      weeklyReports: false,
      publicApi: false,
      abTesting: false,
      customWebhooks: false,
      dataExport: false,
      prioritySupport: false,
      multiWhatsapp: false,
    },
  },
} as const;

export type PlanSlug = keyof typeof PLAN_CONFIG;
export type FeatureKey = keyof typeof PLAN_CONFIG.pro.features;

/**
 * Verifica se um plano tem acesso a uma feature específica.
 */
export function hasFeature(planSlug: string, feature: FeatureKey): boolean {
  const plan = PLAN_CONFIG[planSlug as PlanSlug];
  if (!plan) return false;
  return plan.features[feature] === true;
}

/**
 * Verifica se o tenant pode adicionar mais propriedades.
 */
export function canAddProperty(planSlug: string, currentCount: number): boolean {
  const plan = PLAN_CONFIG[planSlug as PlanSlug];
  if (!plan) return false;
  return currentCount < plan.maxProperties;
}

/**
 * Retorna o limite máximo de propriedades para o plano.
 */
export function getMaxProperties(planSlug: string): number {
  const plan = PLAN_CONFIG[planSlug as PlanSlug];
  return plan?.maxProperties ?? 0;
}

/**
 * Retorna o preço formatado em BRL.
 */
export function formatPrice(priceCents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(priceCents / 100);
}

/**
 * Retorna o resumo de features do plano para exibição.
 */
export function getPlanSummary(planSlug: string) {
  const plan = PLAN_CONFIG[planSlug as PlanSlug];
  if (!plan) return null;

  const included: string[] = [];
  const notIncluded: string[] = [];

  Object.entries(plan.features).forEach(([key, value]) => {
    const label = FEATURE_LABELS[key as FeatureKey];
    if (value) {
      included.push(label);
    } else {
      notIncluded.push(label);
    }
  });

  return {
    ...plan,
    priceFormatted: formatPrice(plan.priceCents),
    included,
    notIncluded,
  };
}

const FEATURE_LABELS: Record<FeatureKey, string> = {
  aiAttendance: 'Atendimento IA 24/7',
  preBookingMode: 'Modo pré-reserva (vendas)',
  postBookingMode: 'Modo pós-reserva (suporte)',
  autoScraping: 'Raspagem automática Airbnb',
  magicOnboarding: 'Magic Onboarding',
  oneShotResolution: 'One-Shot Resolution',
  dashboard: 'Painel DDC',
  conversationHistory: 'Histórico de conversas',
  analytics: 'Analytics avançado',
  weeklyReports: 'Relatórios semanais',
  publicApi: 'API pública',
  abTesting: 'A/B testing de mensagens',
  customWebhooks: 'Webhooks customizados',
  dataExport: 'Exportação de dados',
  prioritySupport: 'Suporte prioritário (SLA 4h)',
  multiWhatsapp: 'Multi-número WhatsApp',
};
