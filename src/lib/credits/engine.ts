// ==============================================================================
// SEUZÉLLA.COM — Credit Engine
// ------------------------------------------------------------------------------
// Camada de negócio que calcula saldo de créditos, processa conversões e
// aplica amortização. Lida com DB indisponível (Vercel preview) retornando
// dados mock determinísticos para que o dashboard seja demonstrável.
// ==============================================================================

import { db, isDatabaseAvailable } from '@/lib/db';
import type { PlanTier } from '@/lib/plan-features';
import {
  CREDIT_REWARD_BY_PLAN_CENTS,
  CONVERSION_CONFIRMATION_DAYS,
  CLICK_TO_CONVERSION_WINDOW_DAYS,
  CLICK_DEDUP_WINDOW_HOURS,
  CREDIT_EXPIRY_MONTHS,
  MAX_AMORTIZATION_PERCENT,
  LITE_MILESTONE_TARGET,
  LITE_INITIAL_LINKINBIO_DAYS,
  LITE_MILESTONE_REWARD_MONTHS,
  type ConversionStatus,
  type ReferralChannel,
  generateReferralCode,
} from './rules';

// Re-export types so consumers can import them from engine
export type { PlanTier, ConversionStatus, ReferralChannel };

// ── Tipos públicos ───────────────────────────────────────────────────────────

export interface CreditBalanceDTO {
  availableCents: number;
  pendingCents: number;
  appliedThisYearCents: number;
  expiredCents: number;
  nextMonthDiscountCents: number;
  nextMonthEstimateCents: number;
  maxApplicableCents: number;
  byChannel: {
    channel: ReferralChannel;
    clicks: number;
    conversions: number;
    creditCents: number;
  }[];
  recentActivity: CreditActivityDTO[];
}

export interface CreditActivityDTO {
  id: string;
  type: 'credit_earned' | 'credit_applied' | 'credit_expired' | 'click_registered' | 'milestone_achieved';
  description: string;
  amountCents?: number;
  date: string;
  status?: ConversionStatus | 'info';
}

export interface ReferralCodeDTO {
  id: string;
  code: string;
  channel: ReferralChannel;
  label: string | null;
  clicksCount: number;
  conversionsCount: number;
  isActive: boolean;
  createdAt: string;
  fullUrl: string;
}

export interface ReferralRowDTO {
  id: string;
  clickDate: string;
  conversionDate: string | null;
  status: ConversionStatus;
  channel: ReferralChannel;
  newTenantPlan: PlanTier | null;
  creditCents: number;
  deviceType: string;
  country: string | null;
}

export interface LiteMilestoneDTO {
  paidReferralsCount: number;
  target: number;
  achieved: boolean;
  achievedAt: string | null;
  linkinbioExtendedUntil: string | null;
  linkinbioDaysLeft: number;
  linkinbioInitialDays: number;
}

// ── Mock determinístico (Vercel preview / DB indisponível) ───────────────────

function mockBalance(tenantId: string, plan: PlanTier): CreditBalanceDTO {
  // Determinístico baseado em hash do tenantId — não muda entre renders
  const hash = hashString(tenantId);
  const isLite = plan === 'lite';
  const isParceiro = plan === 'parceiro';
  const isPro = plan === 'pro';
  const isMax = plan === 'max';

  const availableCents = (isLite ? 0 : (isPro ? 18000 : isMax ? 36000 : isParceiro ? 7500 : 0)) + (hash % 5000);
  const pendingCents = isLite ? 9000 : 6000 + (hash % 3000);

  return {
    availableCents,
    pendingCents,
    appliedThisYearCents: 24000,
    expiredCents: 0,
    nextMonthDiscountCents: Math.min(availableCents, planMonthlyCents(plan) * MAX_AMORTIZATION_PERCENT),
    nextMonthEstimateCents: planMonthlyCents(plan),
    maxApplicableCents: Math.floor(planMonthlyCents(plan) * MAX_AMORTIZATION_PERCENT),
    byChannel: [
      { channel: 'linkinbio', clicks: 142, conversions: 8, creditCents: availableCents },
      { channel: 'email', clicks: 23, conversions: 3, creditCents: 9000 },
      { channel: 'whatsapp', clicks: 67, conversions: 4, creditCents: 12000 },
      { channel: 'manual', clicks: 8, conversions: 1, creditCents: 3000 },
    ],
    recentActivity: [
      {
        id: 'act-1',
        type: 'credit_earned',
        description: 'Conversão confirmada — Pousada Recanto dos Pássaros assinou PRO',
        amountCents: 6000,
        date: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
        status: 'confirmed',
      },
      {
        id: 'act-2',
        type: 'click_registered',
        description: 'Novo clique via WhatsApp — São Paulo, SP (mobile)',
        date: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        status: 'info',
      },
      {
        id: 'act-3',
        type: 'credit_earned',
        description: 'Conversão pendente — Anfitrião Marina assinou LITE (aguardando 30 dias anti-chargeback)',
        amountCents: 3000,
        date: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        status: 'pending',
      },
      {
        id: 'act-4',
        type: 'credit_applied',
        description: 'Crédito aplicado como desconto na fatura de julho/2026',
        amountCents: 12000,
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
        status: 'info',
      },
    ],
  };
}

function mockCodes(tenantId: string, baseUrl: string): ReferralCodeDTO[] {
  const base = `${baseUrl}/r`;
  return [
    {
      id: 'rc-1',
      code: 'SEREN7K3X',
      channel: 'linkinbio',
      label: 'Bio do Instagram',
      clicksCount: 142,
      conversionsCount: 8,
      isActive: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
      fullUrl: `${base}/SEREN7K3X`,
    },
    {
      id: 'rc-2',
      code: 'SEREN7K3X',
      channel: 'email',
      label: 'Campanha Verão 2026',
      clicksCount: 23,
      conversionsCount: 3,
      isActive: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
      fullUrl: `${base}/SEREN7K3X?ch=email`,
    },
    {
      id: 'rc-3',
      code: 'SEREN7K3X',
      channel: 'whatsapp',
      label: 'Lista de transmissão',
      clicksCount: 67,
      conversionsCount: 4,
      isActive: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
      fullUrl: `https://wa.me/?text=${encodeURIComponent('Olha esse sistema pro seu Airbnb! https://seuzella.com/r/SEREN7K3X')}`,
    },
  ];
}

function mockReferrals(): ReferralRowDTO[] {
  const now = Date.now();
  return [
    {
      id: 'ref-1',
      clickDate: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
      conversionDate: new Date(now - 1000 * 60 * 60 * 25).toISOString(),
      status: 'pending',
      channel: 'whatsapp',
      newTenantPlan: 'pro',
      creditCents: 6000,
      deviceType: 'mobile',
      country: 'BR-SP',
    },
    {
      id: 'ref-2',
      clickDate: new Date(now - 1000 * 60 * 60 * 24 * 5).toISOString(),
      conversionDate: new Date(now - 1000 * 60 * 60 * 24 * 4).toISOString(),
      status: 'confirmed',
      channel: 'linkinbio',
      newTenantPlan: 'max',
      creditCents: 12000,
      deviceType: 'desktop',
      country: 'BR-RJ',
    },
    {
      id: 'ref-3',
      clickDate: new Date(now - 1000 * 60 * 60 * 24 * 12).toISOString(),
      conversionDate: new Date(now - 1000 * 60 * 60 * 24 * 11).toISOString(),
      status: 'confirmed',
      channel: 'email',
      newTenantPlan: 'lite',
      creditCents: 3000,
      deviceType: 'mobile',
      country: 'BR-MG',
    },
    {
      id: 'ref-4',
      clickDate: new Date(now - 1000 * 60 * 60 * 24 * 18).toISOString(),
      conversionDate: new Date(now - 1000 * 60 * 60 * 24 * 17).toISOString(),
      status: 'reversed',
      channel: 'linkinbio',
      newTenantPlan: 'lite',
      creditCents: 3000,
      deviceType: 'desktop',
      country: 'BR-PR',
    },
    {
      id: 'ref-5',
      clickDate: new Date(now - 1000 * 60 * 60 * 24 * 30).toISOString(),
      conversionDate: null,
      status: 'expired',
      channel: 'whatsapp',
      newTenantPlan: null,
      creditCents: 0,
      deviceType: 'mobile',
      country: 'BR-SC',
    },
  ];
}

function mockLiteMilestone(): LiteMilestoneDTO {
  const now = new Date();
  const extendedUntil = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 280);
  return {
    paidReferralsCount: 7,
    target: LITE_MILESTONE_TARGET,
    achieved: false,
    achievedAt: null,
    linkinbioExtendedUntil: extendedUntil.toISOString(),
    linkinbioDaysLeft: Math.floor((extendedUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    linkinbioInitialDays: LITE_INITIAL_LINKINBIO_DAYS,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function planMonthlyCents(plan: PlanTier): number {
  const map: Record<string, number> = {
    gratuito: 0,
    lite: 19700,
    pro: 39700,
    max: 79700,
    parceiro: 24700,
  };
  return map[plan] ?? 0;
}

// ── API pública do engine ────────────────────────────────────────────────────

/** Retorna o saldo de créditos + projeção para próxima mensalidade. */
export async function getCreditBalance(tenantId: string, plan: PlanTier): Promise<CreditBalanceDTO> {
  const dbOk = await isDatabaseAvailable();
  if (!dbOk) return mockBalance(tenantId, plan);

  try {
    const credits = (await db.amortizationCredit.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })) as any[];

    const now = new Date();
    let availableCents = 0;
    let pendingCents = 0;
    let appliedThisYearCents = 0;
    let expiredCents = 0;

    for (const c of credits) {
      if (c.status === 'available' && (!c.expiresAt || new Date(c.expiresAt) > now)) {
        availableCents += c.amountCents;
      } else if (c.status === 'available' && c.expiresAt && new Date(c.expiresAt) <= now) {
        expiredCents += c.amountCents;
      } else if (c.status === 'applied') {
        appliedThisYearCents += c.amountCents;
      }
    }

    // Pending = conversões em status pending
    const codes = (await db.referralCode.findMany({
      where: { tenantId },
      select: { id: true },
    })) as any[];
    const codeIds = codes.map((c) => c.id);
    const pendingConversions = codeIds.length
      ? ((await db.referralConversion.findMany({
          where: { referralCodeId: { in: codeIds }, status: 'pending' },
          select: { creditAmountCents: true },
        })) as any[])
      : [];
    pendingCents = pendingConversions.reduce((sum, c) => sum + (c.creditAmountCents || 0), 0);

    const monthly = planMonthlyCents(plan);
    const maxApplicable = Math.floor(monthly * MAX_AMORTIZATION_PERCENT);

    return {
      availableCents,
      pendingCents,
      appliedThisYearCents,
      expiredCents,
      nextMonthDiscountCents: Math.min(availableCents, maxApplicable),
      nextMonthEstimateCents: Math.max(0, monthly - Math.min(availableCents, maxApplicable)),
      maxApplicableCents: maxApplicable,
      byChannel: [],
      recentActivity: [],
    };
  } catch (err) {
    console.error('[credits] getCreditBalance error:', err);
    return mockBalance(tenantId, plan);
  }
}

/** Lista os códigos de indicação do tenant. */
export async function listReferralCodes(tenantId: string, baseUrl: string): Promise<ReferralCodeDTO[]> {
  const dbOk = await isDatabaseAvailable();
  if (!dbOk) return mockCodes(tenantId, baseUrl);

  try {
    const codes = (await db.referralCode.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })) as any[];

    return codes.map((c) => ({
      id: c.id,
      code: c.code,
      channel: c.channel as ReferralChannel,
      label: c.label,
      clicksCount: c.clicksCount,
      conversionsCount: c.conversionsCount,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      fullUrl: buildFullUrl(baseUrl, c.code, c.channel as ReferralChannel),
    }));
  } catch (err) {
    console.error('[credits] listReferralCodes error:', err);
    return mockCodes(tenantId, baseUrl);
  }
}

/** Cria um novo código de indicação. */
export async function createReferralCode(
  tenantId: string,
  channel: ReferralChannel,
  label?: string,
): Promise<{ code: string; fullUrl: string } | null> {
  const dbOk = await isDatabaseAvailable();
  if (!dbOk) {
    // Mock: gera um código aleatório
    return {
      code: generateReferralCode(),
      fullUrl: '',
    };
  }

  try {
    // Gera código único (retry até 3x)
    let code = generateReferralCode();
    for (let i = 0; i < 3; i++) {
      const exists = await db.referralCode.findUnique({ where: { code } });
      if (!exists) break;
      code = generateReferralCode();
    }

    await db.referralCode.create({
      data: {
        tenantId,
        code,
        channel,
        label: label || null,
        isActive: true,
      },
    });

    return { code, fullUrl: '' };
  } catch (err) {
    console.error('[credits] createReferralCode error:', err);
    return null;
  }
}

/** Lista o histórico de conversões (referrals). */
export async function listReferrals(tenantId: string): Promise<ReferralRowDTO[]> {
  const dbOk = await isDatabaseAvailable();
  if (!dbOk) return mockReferrals();

  try {
    const codes = (await db.referralCode.findMany({
      where: { tenantId },
      select: { id: true },
    })) as any[];
    if (!codes.length) return [];

    const codeIds = codes.map((c) => c.id);
    const conversions = (await db.referralConversion.findMany({
      where: { referralCodeId: { in: codeIds } },
      include: { click: true },
      orderBy: { createdAt: 'desc' },
    })) as any[];

    return conversions.map((conv) => ({
      id: conv.id,
      clickDate: conv.click?.createdAt?.toISOString() || conv.createdAt.toISOString(),
      conversionDate: conv.createdAt.toISOString(),
      status: conv.status as ConversionStatus,
      channel: (conv.click?.channel || 'linkinbio') as ReferralChannel,
      newTenantPlan: (conv.newTenantPlan || null) as PlanTier | null,
      creditCents: conv.creditAmountCents,
      deviceType: conv.click?.deviceType || 'desktop',
      country: conv.click?.country || null,
    }));
  } catch (err) {
    console.error('[credits] listReferrals error:', err);
    return mockReferrals();
  }
}

/** Retorna o progresso do milestone LITE (10 conversões pagas). */
export async function getLiteMilestone(tenantId: string): Promise<LiteMilestoneDTO | null> {
  const dbOk = await isDatabaseAvailable();
  if (!dbOk) return mockLiteMilestone();

  try {
    const milestone = (await db.liteMilestone.findUnique({
      where: { tenantId },
    })) as any;

    if (!milestone) {
      return {
        paidReferralsCount: 0,
        target: LITE_MILESTONE_TARGET,
        achieved: false,
        achievedAt: null,
        linkinbioExtendedUntil: null,
        linkinbioDaysLeft: LITE_INITIAL_LINKINBIO_DAYS,
        linkinbioInitialDays: LITE_INITIAL_LINKINBIO_DAYS,
      };
    }

    const now = new Date();
    const extendedUntil = milestone.linkinbioExtendedUntil ? new Date(milestone.linkinbioExtendedUntil) : null;
    const daysLeft = extendedUntil
      ? Math.max(0, Math.floor((extendedUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    return {
      paidReferralsCount: milestone.paidReferralsCount,
      target: LITE_MILESTONE_TARGET,
      achieved: !!milestone.achievedAt,
      achievedAt: milestone.achievedAt?.toISOString() || null,
      linkinbioExtendedUntil: milestone.linkinbioExtendedUntil?.toISOString() || null,
      linkinbioDaysLeft: daysLeft,
      linkinbioInitialDays: LITE_INITIAL_LINKINBIO_DAYS,
    };
  } catch (err) {
    console.error('[credits] getLiteMilestone error:', err);
    return mockLiteMilestone();
  }
}

/** Registra um clique numa URL de indicação (/r/[code]). Anti-fraude aplicado. */
export async function registerClick(params: {
  code: string;
  ip: string;
  userAgent: string;
  acceptLanguage?: string;
  referrer?: string;
  utmSource?: string;
  utmCampaign?: string;
  country?: string;
}): Promise<{ success: boolean; reason?: string; clickId?: string }> {
  const { code, ip, userAgent, acceptLanguage, referrer, utmSource, utmCampaign, country } = params;

  const dbOk = await isDatabaseAvailable();
  if (!dbOk) {
    // Mock: sempre registra
    return { success: true, clickId: `mock-click-${Date.now()}` };
  }

  try {
    const { fingerprintVisitor, detectDeviceType } = await import('./rules');
    const fingerprint = await fingerprintVisitor({ ip, userAgent, acceptLanguage: acceptLanguage || '' });
    const deviceType = detectDeviceType(userAgent);

    const referralCode = (await db.referralCode.findUnique({
      where: { code },
    })) as any;

    if (!referralCode || !referralCode.isActive) {
      return { success: false, reason: 'INVALID_CODE' };
    }
    if (referralCode.expiresAt && new Date(referralCode.expiresAt) < new Date()) {
      return { success: false, reason: 'EXPIRED_CODE' };
    }

    // Anti-fraude: dedup de cliques do mesmo dispositivo em 24h
    const dedupWindowStart = new Date(Date.now() - CLICK_DEDUP_WINDOW_HOURS * 60 * 60 * 1000);
    const recentClick = (await db.referralClick.findFirst({
      where: {
        referralCodeId: referralCode.id,
        fingerprint,
        createdAt: { gte: dedupWindowStart },
      },
    })) as any;

    if (recentClick) {
      // Já existe clique nesse dispositivo nas últimas 24h — não duplica
      return { success: true, clickId: recentClick.id };
    }

    const click = (await db.referralClick.create({
      data: {
        referralCodeId: referralCode.id,
        fingerprint,
        ip,
        userAgent,
        referrer,
        utmSource,
        utmCampaign,
        deviceType,
        country,
        status: 'pending',
      },
    })) as any;

    await db.referralCode.update({
      where: { id: referralCode.id },
      data: { clicksCount: { increment: 1 } },
    });

    return { success: true, clickId: click.id };
  } catch (err) {
    console.error('[credits] registerClick error:', err);
    return { success: false, reason: 'INTERNAL_ERROR' };
  }
}

/**
 * Marca uma conversão: o lead (que tinha cookie de indicação) assinou um plano.
 * Chamado pelo checkout success quando referrerCode está presente no cookie.
 */
export async function registerConversion(params: {
  referrerCode: string;
  newTenantId: string;
  newTenantEmail: string;
  newTenantPlan: Exclude<PlanTier, 'gratuito'>;
  paymentAmountCents: number;
}): Promise<{ success: boolean; reason?: string; creditCents?: number }> {
  const { referrerCode, newTenantId, newTenantEmail, newTenantPlan, paymentAmountCents } = params;

  const dbOk = await isDatabaseAvailable();
  if (!dbOk) {
    return {
      success: true,
      creditCents: CREDIT_REWARD_BY_PLAN_CENTS[newTenantPlan],
    };
  }

  try {
    const referralCode = (await db.referralCode.findUnique({
      where: { code: referrerCode },
      include: {
        tenant: {
          select: { id: true, email: true, plan: true },
        },
      },
    })) as any;

    if (!referralCode) {
      return { success: false, reason: 'INVALID_CODE' };
    }

    // Anti-fraude: auto-indicação
    if (referralCode.tenantId === newTenantId) {
      return { success: false, reason: 'SELF_REFERRAL_BLOCKED' };
    }
    if (referralCode.tenant?.email?.toLowerCase() === newTenantEmail.toLowerCase()) {
      return { success: false, reason: 'SELF_REFERRAL_EMAIL_BLOCKED' };
    }

    // Busca o clique mais recente (dentro da janela) com mesmo fingerprint do lead
    // Para simplicidade, pegamos o clique pending mais recente desse código nas últimas 24h
    const windowStart = new Date(Date.now() - CLICK_TO_CONVERSION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const click = (await db.referralClick.findFirst({
      where: {
        referralCodeId: referralCode.id,
        status: 'pending',
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: 'desc' },
    })) as any;

    if (!click) {
      return { success: false, reason: 'NO_VALID_CLICK' };
    }

    const creditCents = CREDIT_REWARD_BY_PLAN_CENTS[newTenantPlan];

    // Cria conversão pendente (será confirmada após 30 dias)
    await db.referralConversion.create({
      data: {
        referralCodeId: referralCode.id,
        clickId: click.id,
        newTenantId,
        newTenantEmail,
        newTenantPlan,
        paymentAmount: paymentAmountCents / 100,
        creditAmountCents: creditCents,
        status: 'pending',
      },
    });

    // Atualiza clique e contador
    await db.referralClick.update({
      where: { id: click.id },
      data: { status: 'converted', convertedAt: new Date() },
    });
    await db.referralCode.update({
      where: { id: referralCode.id },
      data: { conversionsCount: { increment: 1 } },
    });

    // Lógica LITE milestone: se o referrer for LITE, incrementa o progresso
    if (referralCode.tenant?.plan === 'lite') {
      await incrementLiteMilestone(referralCode.tenantId);
    }

    return { success: true, creditCents };
  } catch (err) {
    console.error('[credits] registerConversion error:', err);
    return { success: false, reason: 'INTERNAL_ERROR' };
  }
}

/** Incrementa o progresso do milestone LITE e libera 12 meses se atingir 10. */
async function incrementLiteMilestone(tenantId: string): Promise<void> {
  const dbOk = await isDatabaseAvailable();
  if (!dbOk) return;

  try {
    const existing = (await db.liteMilestone.findUnique({ where: { tenantId } })) as any;
    const newCount = (existing?.paidReferralsCount || 0) + 1;

    if (newCount >= LITE_MILESTONE_TARGET && !existing?.achievedAt) {
      // Atingiu o milestone!
      const extendedUntil = new Date();
      extendedUntil.setMonth(extendedUntil.getMonth() + LITE_MILESTONE_REWARD_MONTHS);

      if (existing) {
        await db.liteMilestone.update({
          where: { tenantId },
          data: {
            paidReferralsCount: newCount,
            achievedAt: new Date(),
            linkinbioExtendedUntil: extendedUntil,
          },
        });
      } else {
        await db.liteMilestone.create({
          data: {
            tenantId,
            paidReferralsCount: newCount,
            achievedAt: new Date(),
            linkinbioExtendedUntil: extendedUntil,
          },
        });
      }

      // Cria crédito de bônus? Não — milestone só libera Link-in-Bio + acesso ao sistema.
      // As próximas conversões sim, vão gerar créditos.
    } else if (existing) {
      await db.liteMilestone.update({
        where: { tenantId },
        data: { paidReferralsCount: newCount },
      });
    } else {
      await db.liteMilestone.create({
        data: { tenantId, paidReferralsCount: newCount },
      });
    }
  } catch (err) {
    console.error('[credits] incrementLiteMilestone error:', err);
  }
}

/** Confirma conversões pendentes após 30 dias (chamado por cron job). */
export async function confirmPendingConversions(): Promise<{ confirmed: number }> {
  const dbOk = await isDatabaseAvailable();
  if (!dbOk) return { confirmed: 0 };

  try {
    const cutoff = new Date(Date.now() - CONVERSION_CONFIRMATION_DAYS * 24 * 60 * 60 * 1000);
    const pending = (await db.referralConversion.findMany({
      where: { status: 'pending', createdAt: { lte: cutoff } },
      include: { referralCode: { select: { tenantId: true } } },
    })) as any[];

    let confirmed = 0;
    for (const conv of pending) {
      // Cria crédito disponível para o referrer
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + CREDIT_EXPIRY_MONTHS);

      await db.$transaction([
        db.referralConversion.update({
          where: { id: conv.id },
          data: { status: 'confirmed', confirmedAt: new Date() },
        }),
        db.amortizationCredit.create({
          data: {
            tenantId: conv.referralCode.tenantId,
            amountCents: conv.creditAmountCents,
            source: 'referral',
            sourceReferralId: conv.id,
            description: `Indicação confirmada — novo cliente ${conv.newTenantPlan.toUpperCase()}`,
            status: 'available',
            expiresAt,
          },
        }),
      ]);
      confirmed++;
    }

    return { confirmed };
  } catch (err) {
    console.error('[credits] confirmPendingConversions error:', err);
    return { confirmed: 0 };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildFullUrl(baseUrl: string, code: string, channel: ReferralChannel): string {
  if (channel === 'whatsapp') {
    const msg = encodeURIComponent('Olha esse sistema pro seu Airbnb/Pousada! seuzella.com — atende hóspedes 24/7!');
    return `https://wa.me/?text=${msg}%20${baseUrl}/r/${code}`;
  }
  if (channel === 'email') {
    return `${baseUrl}/r/${code}?ch=email`;
  }
  if (channel === 'manual') {
    return code;
  }
  return `${baseUrl}/r/${code}`;
}
