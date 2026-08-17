/**
 * Onboarding Wizard — primeiros 50 clientes (CS personalizado)
 * ============================================================================
 *
 * Passo a passo guiado para novos tenants completarem:
 *   1. Dados básicos da pousada
 *   2. Configurar WhatsApp Business API
 *   3. Cadastrar cartão no Mercado Pago (para comissão UPSELL)
 *   4. Configurar chave PIX (para receber reservas)
 *   5. Configurar personalidade da IA
 *   6. Conectar Google Calendar / Airbnb iCal
 *   7. Primeiro teste (simular hóspede)
 *   8. Go-live (ativar resposta automática)
 * ============================================================================
 */

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  required: boolean;
  completed: boolean;
  helpUrl?: string;
  videoUrl?: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'property-data',
    title: '1. Dados básicos da pousada',
    description: 'Nome, CNPJ, endereço, telefone, email. Esses dados aparecem para os hóspedes.',
    estimatedMinutes: 5,
    required: true,
    completed: false,
    helpUrl: '/docs/onboarding/dados-basicos',
  },
  {
    id: 'whatsapp-business',
    title: '2. WhatsApp Business API',
    description: 'Conectar seu número WhatsApp Business. Você precisa de um número que NÃO esteja em uso no WhatsApp regular.',
    estimatedMinutes: 15,
    required: true,
    completed: false,
    helpUrl: '/docs/onboarding/whatsapp-business',
    videoUrl: 'https://www.youtube.com/watch?v=XXXXX',
  },
  {
    id: 'mercadopago-card',
    title: '3. Cadastrar cartão no Mercado Pago',
    description: 'Cartão de crédito para cobrança automática da comissão Zélla (7% sobre UPSELL). Suporta Visa, Master, Elo, Amex, Hipercard.',
    estimatedMinutes: 5,
    required: true,
    completed: false,
    helpUrl: '/docs/onboarding/mercadopago',
  },
  {
    id: 'pix-key',
    title: '4. Cadastrar chave PIX',
    description: 'Chave PIX que os hóspedes usarão para pagar reservas e depósito. Pode ser CPF, CNPJ, email, telefone ou chave aleatória.',
    estimatedMinutes: 3,
    required: true,
    completed: false,
  },
  {
    id: 'ai-personality',
    title: '5. Personalidade da IA',
    description: 'Escolha o tom de voz que a IA Zélla usará ao conversar com seus hóspedes: formal, casual, divertido, etc.',
    estimatedMinutes: 5,
    required: false,
    completed: false,
    helpUrl: '/docs/onboarding/personalidade-ia',
  },
  {
    id: 'calendar-sync',
    title: '6. Sincronizar calendário',
    description: 'Conecte seu Google Calendar ou Airbnb iCal para evitar reservas duplicadas.',
    estimatedMinutes: 10,
    required: false,
    completed: false,
  },
  {
    id: 'first-test',
    title: '7. Primeiro teste (simular hóspede)',
    description: 'Simule uma conversa completa com a IA para validar o atendimento antes do go-live.',
    estimatedMinutes: 10,
    required: true,
    completed: false,
  },
  {
    id: 'go-live',
    title: '8. Go-live! 🚀',
    description: 'Ativar resposta automática para hóspedes reais. A partir daqui, a IA atende 24/7.',
    estimatedMinutes: 2,
    required: true,
    completed: false,
  },
];

export interface OnboardingProgress {
  tenantId: string;
  startedAt: string;
  currentStep: string;
  completedSteps: string[];
  estimatedMinutesRemaining: number;
  completed: boolean;
  completedAt?: string;
  csManager?: string;
}

export function getOnboardingProgress(tenantId: string, completedSteps: string[] = []): OnboardingProgress {
  const completed = new Set(completedSteps);
  const nextStep = ONBOARDING_STEPS.find(s => !completed.has(s.id) && s.required);

  const estimatedRemaining = ONBOARDING_STEPS
    .filter(s => !completed.has(s.id))
    .reduce((sum, s) => sum + s.estimatedMinutes, 0);

  const allRequiredDone = ONBOARDING_STEPS
    .filter(s => s.required)
    .every(s => completed.has(s.id));

  return {
    tenantId,
    startedAt: new Date().toISOString(),
    currentStep: nextStep?.id || 'completed',
    completedSteps,
    estimatedMinutesRemaining: estimatedRemaining,
    completed: allRequiredDone,
    completedAt: allRequiredDone ? new Date().toISOString() : undefined,
    csManager: 'Equipe Zélla',
  };
}

export const FIRST_50_CUSTOMERS_THRESHOLD = 50;

export function isEligibleForPersonalizedCS(tenantCreatedAt: string, allTenantsCreatedAt: string[]): boolean {
  const sortedTenants = allTenantsCreatedAt
    .filter(d => d < tenantCreatedAt)
    .sort();
  return sortedTenants.length < FIRST_50_CUSTOMERS_THRESHOLD;
}
