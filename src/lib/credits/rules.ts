// ==============================================================================
// SEUZÉLLA.COM — Créditos de Amortização de Pagamento Mensal
// ------------------------------------------------------------------------------
// Fonte da verdade absoluta para o Programa de Amortização por Indicação.
// Espelhado em: prisma/schema.prisma (ReferralCode, ReferralClick,
// ReferralConversion, AmortizationCredit, LiteMilestone), API routes em
// /api/ddc/credits/*, e na documentação legal /legal/programa-amortizacao.
//
// REGRA DE OURO: Indicações convertidas VIRAM CRÉDITOS. Créditos AMORTIZAM
// (reduzem) o valor da próxima mensalidade. NUNCA há pagamento via PIX do
// Seu Zélla para o referrer — apenas desconto na fatura.
// ==============================================================================

import type { PlanTier } from '@/lib/plan-features';

// ── Elegibilidade por plano ──────────────────────────────────────────────────

/**
 * Planos que participam PLENAMENTE do sistema de amortização:
 * a cada conversão confirmada, geram crédito para abater na próxima mensalidade.
 */
export const FULL_AMORTIZATION_PLANS: PlanTier[] = ['pro', 'max', 'parceiro'];

/**
 * LITE tem regra especial:
 * - Link-in-Bio gratuito por 60 dias apenas
 * - Ao atingir 10 indicações convertidas (qualquer plano) → ganha 12 meses
 *   adicionais de Link-in-Bio + passa a participar da amortização
 */
export const LITE_PLAN: PlanTier = 'lite';

/** Gratuito não participa — precisa assinar no mínimo LITE para ter Link-in-Bio. */
export const EXCLUDED_PLANS: PlanTier[] = ['gratuito'];

/** Quantidade de indicações pagas que LITE precisa trazer para desbloquear o sistema. */
export const LITE_MILESTONE_TARGET = 10;

/** Meses de Link-in-Bio grátis que LITE ganha ao atingir o milestone. */
export const LITE_MILESTONE_REWARD_MONTHS = 12;

/** Dias iniciais de Link-in-Bio para LITE antes de atingir o milestone. */
export const LITE_INITIAL_LINKINBIO_DAYS = 60;

// ── Tabela de crédito por plano do novo cliente ──────────────────────────────

/**
 * Quanto de CRÉDITO (em centavos) o referrer ganha quando um novo cliente
 * assina um plano específico e o pagamento é confirmado.
 *
 * Critério: ~15% do valor da primeira mensalidade do novo cliente.
 * Arredondado para facilitar comunicação.
 */
export const CREDIT_REWARD_BY_PLAN_CENTS: Record<Exclude<PlanTier, 'gratuito'>, number> = {
  lite: 3000,      // R$ 30 por LITE convertido (15% de R$197 ≈ R$29,55)
  pro: 6000,       // R$ 60 por PRO convertido (15% de R$397 ≈ R$59,55)
  max: 12000,      // R$ 120 por MAX convertido (15% de R$797 ≈ R$119,55)
  parceiro: 2500,  // R$ 25 por PARCEIRO convertido (10% de R$247 ≈ R$24,70)
};

// ── Limites e janelas anti-fraude ────────────────────────────────────────────

/** Período de carência para confirmar conversão (proteção contra chargeback). */
export const CONVERSION_CONFIRMATION_DAYS = 30;

/** Janela máxima entre clique e conversão para o clique contar (30 dias). */
export const CLICK_TO_CONVERSION_WINDOW_DAYS = 30;

/** Janela para dedup de cliques do mesmo dispositivo (24h). */
export const CLICK_DEDUP_WINDOW_HOURS = 24;

/** Validade do cookie de rastreamento no navegador do lead (90 dias). */
export const TRACKING_COOKIE_MAX_AGE_DAYS = 90;

/** Validade do crédito não utilizado antes de expirar (12 meses). */
export const CREDIT_EXPIRY_MONTHS = 12;

/**
 * Limite de amortização mensal: o referrer pode abater no máximo 50% da
 * própria mensalidade com créditos. Isso garante que sempre haja pagamento
 * mínimo, evitando que o sistema vire "assinatura grátis indefinidamente".
 */
export const MAX_AMORTIZATION_PERCENT = 0.5;

// ── Canais de indicação ──────────────────────────────────────────────────────

export type ReferralChannel = 'linkinbio' | 'email' | 'whatsapp' | 'manual';

export interface ChannelConfig {
  id: ReferralChannel;
  label: string;
  description: string;
  icon: string;
  /** Função que monta a URL final do canal. */
  buildUrl: (baseUrl: string, code: string, extra?: { email?: string; message?: string }) => string;
}

export const REFERRAL_CHANNELS: ChannelConfig[] = [
  {
    id: 'linkinbio',
    label: 'Link-in-Bio',
    description: 'Link curto para colocar na bio do Instagram, Facebook, WhatsApp Business e QR Code em panfletos.',
    icon: 'link',
    buildUrl: (baseUrl, code) => `${baseUrl}/r/${code}`,
  },
  {
    id: 'email',
    label: 'E-mail',
    description: 'Link rastreado com token assinado — prova criptográfica de que o lead veio do seu e-mail.',
    icon: 'mail',
    buildUrl: (baseUrl, code, extra) => {
      const emailParam = extra?.email ? `&e=${encodeURIComponent(btoa(extra.email))}` : '';
      return `${baseUrl}/r/${code}?ch=email${emailParam}`;
    },
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    description: 'Deep link do WhatsApp com mensagem pronta e código de indicação embutido.',
    icon: 'message-circle',
    buildUrl: (baseUrl, code, extra) => {
      const msg = extra?.message || `Olha esse sistema que achei pro seu Airbnb/Pousada: seuzella.com — atende hóspedes no WhatsApp 24/7!`;
      return `https://wa.me/?text=${encodeURIComponent(msg + ' ' + baseUrl + '/r/' + code)}`;
    },
  },
  {
    id: 'manual',
    label: 'Código Manual',
    description: 'Apenas o código curto para o lead digitar manualmente no checkout.',
    icon: 'hash',
    buildUrl: (_baseUrl, code) => code,
  },
];

// ── Status de conversão ──────────────────────────────────────────────────────

export type ConversionStatus = 'pending' | 'confirmed' | 'reversed' | 'expired';

export const CONVERSION_STATUS_LABEL: Record<ConversionStatus, string> = {
  pending: 'Aguardando confirmação (30 dias anti-chargeback)',
  confirmed: 'Confirmado — crédito disponível',
  reversed: 'Estornado (chargeback ou reembolso)',
  expired: 'Expirado sem conversão',
};

export const CONVERSION_STATUS_COLOR: Record<ConversionStatus, string> = {
  pending: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  confirmed: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  reversed: 'bg-red-500/10 border-red-500/30 text-red-400',
  expired: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Verifica se o plano tem acesso ao sistema completo de amortização. */
export function hasFullAmortizationAccess(plan: PlanTier): boolean {
  return FULL_AMORTIZATION_PLANS.includes(plan);
}

/** Verifica se o plano está no programa piloto LITE (60 dias + milestone). */
export function isLitePilot(plan: PlanTier): boolean {
  return plan === LITE_PLAN;
}

/** Verifica se o plano pode participar de qualquer forma do programa. */
export function isEligibleForReferral(plan: PlanTier): boolean {
  return !EXCLUDED_PLANS.includes(plan);
}

/** Calcula o valor máximo de crédito aplicável a uma mensalidade. */
export function maxApplicableCreditCents(monthlyAmountCents: number): number {
  return Math.floor(monthlyAmountCents * MAX_AMORTIZATION_PERCENT);
}

/** Formata valor em centavos para BRL. */
export function formatCentsAsBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Gera um código de indicação curto, único e fácil de digitar. */
export function generateReferralCode(): string {
  // 8 caracteres: 4 letras + 4 números — evita ambiguidades (sem 0/O, 1/I/L)
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // sem I, L, O
  const digits = '23456789'; // sem 0, 1
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  for (let i = 0; i < 4; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}

/** Calcula o fingerprint SHA-256 do visitante para anti-fraude. */
export async function fingerprintVisitor(params: {
  ip: string;
  userAgent: string;
  acceptLanguage?: string;
}): Promise<string> {
  const { ip, userAgent, acceptLanguage = '' } = params;
  const raw = `${ip}::${userAgent}::${acceptLanguage}`;
  // Use Web Crypto API (available in Node.js 18+ and browsers)
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Detecta tipo de dispositivo a partir do User-Agent. */
export function detectDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sphone/.test(ua)) return 'mobile';
  return 'desktop';
}

// ── Documentação das regras (espelhada no rodapé) ───────────────────────────

export interface ProgramRule {
  number: string;
  title: string;
  description: string;
}

export const PROGRAM_RULES: ProgramRule[] = [
  {
    number: '1',
    title: 'Natureza da Recompensa',
    description:
      'O Programa de Amortização por Indicação não paga valores via PIX ao referrer. ' +
      'Toda indicação convertida gera CRÉDITOS que AMORTIZAM (reduzem) o valor da mensalidade ' +
      'do referrer na próxima fatura. Créditos não são conversíveis em dinheiro, transferíveis ' +
      'ou acumuláveis entre contas.',
  },
  {
    number: '2',
    title: 'Elegibilidade por Plano',
    description:
      'Participam plenamente do sistema de amortização: PRO, MAX e PARCEIRO (geram crédito a ' +
      'cada conversão confirmada). LITE participa do programa piloto: tem 60 dias iniciais de ' +
      'Link-in-Bio gratuito e, ao atingir 10 indicações pagas, ganha 12 meses adicionais de ' +
      'Link-in-Bio e passa a gerar créditos de amortização. GRATUITO não participa.',
  },
  {
    number: '3',
    title: 'Valor do Crédito por Conversão',
    description:
      'Por cada novo cliente que assinar um plano pago via sua indicação, o referrer recebe: ' +
      'R$ 30 (LITE), R$ 60 (PRO), R$ 120 (MAX) e R$ 25 (PARCEIRO). Os valores são fixos e ' +
      'referem-se à primeira mensalidade paga pelo novo cliente. Mensalidades subsequentes ' +
      'do mesmo cliente não geram novos créditos.',
  },
  {
    number: '4',
    title: 'Canais de Rastreamento Válidos',
    description:
      'A indicação é comprovada por um destes três canais: (a) Link-in-Bio curto (/r/CODIGO) ' +
      'que grava cookie de 90 dias no navegador do lead; (b) E-mail com token assinado ' +
      'criptograficamente; (c) Deep link do WhatsApp com código embutido. Cliques sem cookie ' +
      'válido não geram crédito. O lead deve usar o mesmo navegador/dispositivo do clique ' +
      'no momento da assinatura.',
  },
  {
    number: '5',
    title: 'Mecanismos Anti-Fraude',
    description:
      'Aplicamos fingerprint SHA-256(IP + User-Agent + Accept-Language) e deduplicação de ' +
      'cliques por dispositivo a cada 24 horas. Auto-indicação (mesmo e-mail, mesmo IP ou ' +
      'mesmo dispositivo) é bloqueada. Conversões exigem: cookie de indicação presente, ' +
      'assinatura paga confirmada, e-mail do novo cliente diferente do referrer, e pelo menos ' +
      '24h entre o clique e a conversão.',
  },
  {
    number: '6',
    title: 'Janela de Confirmação (Anti-Chargeback)',
    description:
      'Todo crédito fica em status "pending" por 30 dias após a conversão. Em caso de ' +
      'reembolso, chargeback ou cancelamento do novo cliente dentro desse período, o crédito ' +
      'é estornado (status "reversed") e não amortiza a mensalidade do referrer. Após 30 ' +
      'dias sem chargeback, o crédito passa a "confirmed" e fica disponível para uso.',
  },
  {
    number: '7',
    title: 'Limite Mensal de Amortização',
    description:
      'O referrer pode abater no máximo 50% do valor da própria mensalidade com créditos. ' +
      'Créditos excedentes permanecem disponíveis para o mês seguinte. Isso garante que ' +
      'sempre haja um pagamento mínimo mensal, impedindo que o sistema vire "assinatura ' +
      'gratuita indefinida".',
  },
  {
    number: '8',
    title: 'Validade dos Créditos',
    description:
      'Créditos não utilizados expiram 12 meses após a data de confirmação. O sistema ' +
      'aplica automaticamente os créditos mais antigos primeiro (FIFO) para evitar perda ' +
      'por expiração.',
  },
  {
    number: '9',
    title: 'Regra Especial LITE — Milestone de 10 Conversões',
    description:
      'O plano LITE tem apenas 60 dias iniciais de Link-in-Bio gratuito. Ao atingir 10 ' +
      'indicações convertidas (qualquer plano), recebe automaticamente: (a) 12 meses ' +
      'adicionais de Link-in-Bio gratuito; (b) acesso permanente ao sistema de amortização ' +
      '(a partir de então, novas conversões geram créditos). Esta bonificação é definitiva ' +
      'e não é revogada mesmo se o plano mudar.',
  },
  {
    number: '10',
    title: 'Mudança de Plano',
    description:
      'Se o referrer fizer upgrade de LITE para PRO/MAX antes de atingir o milestone, ' +
      'passa imediatamente a gerar créditos por conversões (antigas e novas). Os créditos ' +
      'gerados pós-milestone permanecem válidos. Em caso de downgrade para GRATUITO, ' +
      'créditos existentes são preservados mas não podem ser aplicados (gratuito não tem ' +
      'mensalidade para amortizar) — ficam congelados até novo upgrade.',
  },
  {
    number: '11',
    title: 'Encerramento e Suspensão',
    description:
      'O Seu Zélla reserva-se o direito de suspender ou encerrar contas que tentem burlar ' +
      'o sistema de indicação (auto-indicação, cliques artificiais, IPs de datacenter, ' +
      'farms de contas). Créditos obtidos fraudulentamente são anulados retroativamente. ' +
      'O programa pode ser descontinuado com aviso prévio de 30 dias, preservando créditos ' +
      'já confirmados.',
  },
];

/** Resumo curto para exibir em telas pequenas e tooltips. */
export const PROGRAM_SUMMARY =
  'Cada indicação sua que vira cliente pago gera créditos que abatem até 50% da sua próxima mensalidade. ' +
  'PRO, MAX e PARCEIRO participam plenamente. LITE ganha 12 meses extra de Link-in-Bio ao trazer 10 clientes pagos.';
