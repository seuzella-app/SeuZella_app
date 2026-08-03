/**
 * P0-3: API — TRIAL SELF-SERVICE
 *
 * POST /api/ddc/airb-pro/trial
 *   → Inscreve novo trial, envia magic-link
 *   body: { email, phone?, name?, companyName?, niche?, source?, utmSource?, utmCampaign?, utmMedium? }
 *
 * GET  /api/ddc/airb-pro/trial/verify?token=XXX
 *   → Verifica magic-token e retorna dados para onboarding
 *
 * GET  /api/ddc/airb-pro/trial/stats
 *   → Stats do funil de trial (ZCC only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { apiRatelimit } from '@/lib/rate-limit';
import { randomBytes } from 'crypto';
import {
  type TrialSignupInput,
  type TrialStatus,
  type TrialSource,
  type TrialNiche,
  type TrialFunnelStats,
} from '@/lib/airb-pro/types';

const VALID_SOURCES: TrialSource[] = ['organic', 'ads', 'referral', 'partner'];
const VALID_NICHES: TrialNiche[] = ['pousada', 'airbnb'];

function validateInput(body: unknown): { input?: TrialSignupInput; error?: string } {
  if (!body || typeof body !== 'object') return { error: 'Body inválido' };
  const b = body as Record<string, unknown>;
  if (typeof b.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) {
    return { error: 'Email inválido' };
  }
  if (b.source && !VALID_SOURCES.includes(b.source as TrialSource)) {
    return { error: `source deve ser um de: ${VALID_SOURCES.join(', ')}` };
  }
  if (b.niche && !VALID_NICHES.includes(b.niche as TrialNiche)) {
    return { error: `niche deve ser um de: ${VALID_NICHES.join(', ')}` };
  }

  const input: TrialSignupInput = {
    email: (b.email as string).toLowerCase().trim(),
    phone: b.phone as string | undefined,
    name: b.name as string | undefined,
    companyName: b.companyName as string | undefined,
    niche: (b.niche as TrialNiche) || 'pousada',
    source: (b.source as TrialSource) || 'organic',
    utmSource: b.utmSource as string | undefined,
    utmCampaign: b.utmCampaign as string | undefined,
    utmMedium: b.utmMedium as string | undefined,
  };
  return { input };
}

function generateMagicToken(): string {
  return randomBytes(32).toString('hex');
}

/** Cria ou atualiza um trial signup (idempotente por email) */
export async function POST(request: NextRequest) {
  try {
    const { success: rateOk } = await apiRatelimit.limit('trial-signup');
    if (!rateOk) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const { input, error } = validateInput(body);
    if (error || !input) {
      return NextResponse.json({ success: false, error: error || 'Input inválido' }, { status: 400 });
    }

    const dbOk = await isDatabaseAvailable();
    if (!dbOk) {
      // Modo demo: retorna token simulado
      const demoToken = generateMagicToken();
      return NextResponse.json({
        success: true,
        data: {
          id: `demo-${Date.now()}`,
          email: input.email,
          status: 'started',
          magicToken: demoToken,
          magicLink: `/trial/verify?token=${demoToken}`,
          nextStep: 'verify_email',
        },
        meta: { source: 'demo' },
      });
    }

    // Verifica se já existe um trial com este email
    const existing = await db.airbTrialSignup.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      // Se já converteu, retorna erro amigável
      if (existing.status === 'converted') {
        return NextResponse.json({
          success: false,
          error: 'Este email já possui uma conta ativa. Faça login em /login',
          code: 'ALREADY_CONVERTED',
        }, { status: 409 });
      }
      // Se já está em andamento, reenvia magic-link
      const newToken = generateMagicToken();
      await db.airbTrialSignup.update({
        where: { id: existing.id },
        data: {
          magicToken: newToken,
          name: input.name || existing.name,
          phone: input.phone || existing.phone,
          companyName: input.companyName || existing.companyName,
        },
      });

      // TODO: enviar email com magic-link (placeholder)
      console.log(`[trial] Magic link para ${input.email}: /trial/verify?token=${newToken}`);

      return NextResponse.json({
        success: true,
        data: {
          id: existing.id,
          email: existing.email,
          status: existing.status,
          magicToken: newToken,
          magicLink: `/trial/verify?token=${newToken}`,
          nextStep: 'verify_email',
        },
        meta: { source: 'db', action: 'resent' },
      });
    }

    // Cria novo trial signup
    const magicToken = generateMagicToken();
    const created = await db.airbTrialSignup.create({
      data: {
        email: input.email,
        phone: input.phone || null,
        name: input.name || null,
        companyName: input.companyName || null,
        niche: input.niche,
        source: input.source,
        utmSource: input.utmSource || null,
        utmCampaign: input.utmCampaign || null,
        utmMedium: input.utmMedium || null,
        status: 'started',
        magicToken,
      },
    });

    // TODO: enviar email com magic-link (placeholder)
    console.log(`[trial] Novo signup: ${input.email} → /trial/verify?token=${magicToken}`);

    return NextResponse.json({
      success: true,
      data: {
        id: created.id,
        email: created.email,
        status: created.status,
        magicToken,
        magicLink: `/trial/verify?token=${magicToken}`,
        nextStep: 'verify_email',
      },
      meta: { source: 'db', action: 'created' },
    }, { status: 201 });
  } catch (error) {
    console.error('[airb-pro/trial POST] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao criar trial' }, { status: 500 });
  }
}

/** GET /api/ddc/airb-pro/trial?token=XXX — verifica magic-token */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const statsMode = searchParams.get('stats') === 'true';

    if (statsMode) {
      // Apenas ZCC admins — sem auth aqui por simplicidade, mas em prod exigir role
      const dbOk = await isDatabaseAvailable();
      if (!dbOk) {
        return NextResponse.json({
          success: true,
          data: {
            totalStarted: 0,
            totalVerified: 0,
            totalConverted: 0,
            totalAbandoned: 0,
            totalExpired: 0,
            conversionRate: 0,
            dropOff: { startedToVerified: 0, verifiedToConverted: 0 },
            bySource: { organic: 0, ads: 0, referral: 0, partner: 0 },
            byNiche: { pousada: 0, airbnb: 0 },
            byDay: [],
          } as TrialFunnelStats,
          meta: { source: 'demo' },
        });
      }

      const all = await db.airbTrialSignup.findMany({
        select: { status: true, source: true, niche: true, createdAt: true, verifiedAt: true, convertedAt: true },
      });

      const totalStarted = all.length;
      const totalVerified = all.filter(t => t.status === 'verified' || t.status === 'converted').length;
      const totalConverted = all.filter(t => t.status === 'converted').length;
      const totalAbandoned = all.filter(t => t.status === 'abandoned').length;
      const totalExpired = all.filter(t => t.status === 'expired').length;
      const conversionRate = totalStarted > 0 ? (totalConverted / totalStarted) * 100 : 0;
      const dropOff = {
        startedToVerified: totalStarted > 0 ? ((totalStarted - totalVerified) / totalStarted) * 100 : 0,
        verifiedToConverted: totalVerified > 0 ? ((totalVerified - totalConverted) / totalVerified) * 100 : 0,
      };

      const bySource: Record<TrialSource, number> = { organic: 0, ads: 0, referral: 0, partner: 0 };
      const byNiche: Record<TrialNiche, number> = { pousada: 0, airbnb: 0 };
      for (const t of all) {
        if (bySource[t.source as TrialSource] !== undefined) bySource[t.source as TrialSource]++;
        if (byNiche[t.niche as TrialNiche] !== undefined) byNiche[t.niche as TrialNiche]++;
      }

      // Agrupar por dia (últimos 30 dias)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const byDayMap = new Map<string, { started: number; converted: number }>();
      for (const t of all) {
        if (new Date(t.createdAt) < cutoff) continue;
        const day = new Date(t.createdAt).toISOString().slice(0, 10);
        const cur = byDayMap.get(day) || { started: 0, converted: 0 };
        cur.started++;
        if (t.status === 'converted' && t.convertedAt) cur.converted++;
        byDayMap.set(day, cur);
      }
      const byDay = Array.from(byDayMap.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const stats: TrialFunnelStats = {
        totalStarted,
        totalVerified,
        totalConverted,
        totalAbandoned,
        totalExpired,
        conversionRate,
        dropOff,
        bySource,
        byNiche,
        byDay,
      };

      return NextResponse.json({ success: true, data: stats, meta: { source: 'db' } });
    }

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token não fornecido' }, { status: 400 });
    }

    const dbOk = await isDatabaseAvailable();
    if (!dbOk) {
      return NextResponse.json({
        success: true,
        data: {
          id: 'demo',
          email: 'visitante@demo.com',
          name: 'Visitante Demo',
          niche: 'pousada',
          status: 'verified',
          verifiedAt: new Date(),
        },
        meta: { source: 'demo' },
      });
    }

    const trial = await db.airbTrialSignup.findUnique({
      where: { magicToken: token },
    });

    if (!trial) {
      return NextResponse.json({ success: false, error: 'Token inválido ou expirado' }, { status: 404 });
    }

    // Se ainda não verificado, marca como verificado
    if (trial.status === 'started') {
      await db.airbTrialSignup.update({
        where: { id: trial.id },
        data: { status: 'verified', verifiedAt: new Date() },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: trial.id,
        email: trial.email,
        name: trial.name,
        phone: trial.phone,
        companyName: trial.companyName,
        niche: trial.niche,
        status: trial.status === 'started' ? 'verified' : trial.status,
        verifiedAt: trial.verifiedAt || new Date(),
      },
    });
  } catch (error) {
    console.error('[airb-pro/trial GET] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao verificar trial' }, { status: 500 });
  }
}
