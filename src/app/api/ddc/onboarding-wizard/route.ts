import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Helper seguro para parse de JSON sem risco de SyntaxError
 */
function safeParseJSON(raw: string | null | undefined, fallback: Record<string, any> = {}): Record<string, any> {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Sanitiza strings para prevenir injeções
 */
function sanitizeStr(val: any, maxLen = 255): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

// Whitelists para validação estrita
const ALLOWED_STEPS = new Set([
  'basic_info',
  'rooms',
  'policies',
  'pix',
  'whatsapp',
  'personality',
  'yield_upsell',
  'autopin',
]);

const ALLOWED_PIX_TYPES = new Set(['cpf', 'cnpj', 'email', 'phone', 'random']);
const ALLOWED_PET_POLICIES = new Set(['allowed_free', 'allowed_fee', 'not_allowed']);
const ALLOWED_CANCEL_POLICIES = new Set(['flexible', 'moderate', 'strict']);
const ALLOWED_AI_TONES = new Set(['formal', 'descontraida', 'divertida', 'profissional']);

/**
 * GET /api/ddc/onboarding-wizard
 *
 * Wave B IDOR fix: tenantId derived from session, not query param.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: 'MISSING_TENANT_ID', message: 'Identificador de tenant não informado.' },
      { status: 400 }
    );
  }

  try {
    if (!db) {
      return NextResponse.json({
        success: true,
        data: { property: null, rooms: [], stepsCompleted: [], source: 'fallback' },
      });
    }

    const property = await (db as any).property.findFirst({
      where: { tenantId },
      include: { rooms: true },
    });

    if (!property) {
      return NextResponse.json({
        success: true,
        data: { property: null, rooms: [], stepsCompleted: [], source: 'empty' },
      });
    }

    const meta = safeParseJSON(property.metadata, {});
    const stepsCompleted = Array.isArray(meta.onboardingStepsCompleted)
      ? meta.onboardingStepsCompleted
      : [];

    return NextResponse.json({
      success: true,
      data: {
        property: {
          id: property.id,
          name: property.name || '',
          description: property.description || '',
          city: property.city || '',
          state: property.state || '',
          address: property.address || '',
          pixKey: property.pixKey || '',
          pixKeyType: property.pixKeyType || 'cpf',
          checkInTime: meta.checkInTime || '14:00',
          checkOutTime: meta.checkOutTime || '12:00',
          petPolicy: meta.petPolicy || 'not_allowed',
          cancellationPolicy: meta.cancellationPolicy || 'flexible',
          aiTone: meta.aiTone || 'descontraida',
          whatsappConnected: Boolean(meta.whatsappConnected),
          autoPinActive: Boolean(meta.autoPinActive),
          highSeasonMultiplierPercent: Number(meta.highSeasonMultiplierPercent) || 40,
          notifyBeforePriceChange: meta.notifyBeforePriceChange ?? true,
          autoUpsellActive: meta.autoUpsellActive ?? true,
          acceptedUpsellSuccessFeeTerms: meta.acceptedUpsellSuccessFeeTerms ?? true,
        },
        rooms: property.rooms || [],
        stepsCompleted,
      },
    });
  } catch (error) {
    console.error('[Onboarding Wizard GET] Erro inesperado:', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Falha ao buscar dados do onboarding.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ddc/onboarding-wizard
 * Body: { step, data }
 *
 * Wave B IDOR fix: tenantId derived from session, not body.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    const tenantId = (session.user as any).tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'MISSING_TENANT_ID', message: 'Tenant não encontrado na sessão.' },
        { status: 400 }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'INVALID_JSON', message: 'Payload JSON mal formatado.' },
        { status: 400 }
      );
    }

    const step = sanitizeStr(body?.step, 50);
    const data = body?.data || {};

    if (!step) {
      return NextResponse.json(
        { success: false, error: 'MISSING_FIELDS', message: 'step é obrigatório.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_STEPS.has(step)) {
      return NextResponse.json(
        { success: false, error: 'INVALID_STEP', message: `Etapa ${step} não é reconhecida.` },
        { status: 400 }
      );
    }

    if (!db) {
      return NextResponse.json({
        success: true,
        data: { step, saved: true, source: 'fallback' },
        message: `Etapa ${step} salva em modo fallback!`,
      });
    }

    let property = await (db as any).property.findFirst({
      where: { tenantId },
      select: { id: true, metadata: true },
    });

    if (!property) {
      property = await (db as any).property.create({
        data: {
          tenantId,
          name: sanitizeStr(data.name, 100) || 'Minha Pousada',
          city: sanitizeStr(data.city, 80) || '',
          state: sanitizeStr(data.state, 2) || '',
          metadata: JSON.stringify({ onboardingStepsCompleted: [step] }),
        },
      });
      return NextResponse.json({
        success: true,
        data: { step, saved: true, propertyId: property.id, stepsCompleted: [step], completedAll: false },
        message: `Etapa ${step} criada e salva!`,
      });
    }

    const meta = safeParseJSON(property.metadata, {});
    const stepsCompleted = new Set<string>(
      Array.isArray(meta.onboardingStepsCompleted) ? meta.onboardingStepsCompleted : []
    );
    stepsCompleted.add(step);
    meta.onboardingStepsCompleted = [...stepsCompleted];

    const updateData: any = { metadata: JSON.stringify(meta) };

    switch (step) {
      case 'basic_info':
        updateData.name = sanitizeStr(data.name, 100);
        updateData.description = sanitizeStr(data.description, 1000);
        updateData.city = sanitizeStr(data.city, 80);
        updateData.state = sanitizeStr(data.state, 2).toUpperCase();
        updateData.address = sanitizeStr(data.address, 200);
        break;

      case 'rooms':
        // Quartos são gerenciados via API dedicada de quartos
        break;

      case 'policies':
        meta.checkInTime = sanitizeStr(data.checkInTime, 10) || '14:00';
        meta.checkOutTime = sanitizeStr(data.checkOutTime, 10) || '12:00';
        meta.petPolicy = ALLOWED_PET_POLICIES.has(data.petPolicy) ? data.petPolicy : 'not_allowed';
        meta.cancellationPolicy = ALLOWED_CANCEL_POLICIES.has(data.cancellationPolicy) ? data.cancellationPolicy : 'flexible';
        updateData.metadata = JSON.stringify(meta);
        break;

      case 'pix':
        updateData.pixKey = sanitizeStr(data.pixKey, 100);
        updateData.pixKeyType = ALLOWED_PIX_TYPES.has(data.pixKeyType) ? data.pixKeyType : 'cpf';
        break;

      case 'whatsapp':
        meta.whatsappConnected = Boolean(data.connected);
        updateData.metadata = JSON.stringify(meta);
        break;

      case 'personality':
        meta.aiTone = ALLOWED_AI_TONES.has(data.tone) ? data.tone : 'descontraida';
        meta.aiExpressions = Array.isArray(data.expressions)
          ? data.expressions.map((e: any) => sanitizeStr(e, 50)).filter(Boolean)
          : [];
        meta.aiGreeting = sanitizeStr(data.greeting, 200);
        meta.aiAssistantName = sanitizeStr(data.assistantName, 50) || 'Zélla';
        updateData.metadata = JSON.stringify(meta);
        break;

      case 'yield_upsell':
        const mult = Number(data.highSeasonMultiplierPercent);
        meta.highSeasonMultiplierPercent = Number.isFinite(mult) ? Math.min(500, Math.max(0, mult)) : 40;
        meta.notifyBeforePriceChange = Boolean(data.notifyBeforePriceChange ?? true);
        meta.autoUpsellActive = Boolean(data.autoUpsellActive ?? true);
        meta.acceptedUpsellSuccessFeeTerms = Boolean(data.acceptedUpsellSuccessFeeTerms ?? true);
        updateData.metadata = JSON.stringify(meta);
        break;

      case 'autopin':
        meta.autoPinActive = Boolean(data.active);
        updateData.metadata = JSON.stringify(meta);
        break;
    }

    await (db as any).property.update({
      where: { id: property.id },
      data: updateData,
    });

    const requiredSteps = ['basic_info', 'rooms', 'policies', 'pix', 'whatsapp', 'personality', 'yield_upsell'];
    const completedAll = requiredSteps.every((s) => stepsCompleted.has(s));

    return NextResponse.json({
      success: true,
      data: {
        step,
        saved: true,
        stepsCompleted: [...stepsCompleted],
        completedAll,
      },
      message: completedAll
        ? 'Onboarding completo! Sua pousada está pronta para receber hóspedes. 🎉'
        : `Etapa ${step} salva com sucesso!`,
    });
  } catch (error) {
    console.error('[Onboarding Wizard POST] Erro inesperado:', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Falha ao processar e salvar a etapa.' },
      { status: 500 }
    );
  }
}
