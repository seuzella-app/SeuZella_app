import { checkRateLimit, rateLimitResponse } from '../../../../../lib/cerebro/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { checkEntitlement } from '@/lib/airb/gatekeeper';
import {
  ONBOARDING_STEP_ORDER,
} from '@/types/dashboard';
import type { OnboardingStep, OnboardingStatus } from '@/types/dashboard';

// ═══════════════════════════════════════════════════════════════
// GET /api/ddc/airb/onboarding — Retrieve onboarding state for a property
// Query params: ?propertyId=xxx
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  // [RUN10-W2 10B] rate-limit fail-closed (in-memory; Redis opcional no RUN11)
  {
    const __rl = checkRateLimit(request, 'api/ddc/airb/onboarding#GET');
    if (!__rl.ok) return rateLimitResponse(__rl);
  }

  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const dbAvailable = await isDatabaseAvailable();
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId é obrigatório' }, { status: 400 });
    }

    if (!dbAvailable) {
      return NextResponse.json({
        success: true,
        data: {
          propertyId,
          currentStep: 'url_entry',
          status: 'pending',
          progress: 0,
        },
      });
    }

    const property = await db.airBProperty.findFirst({
      where: { id: propertyId, tenantId },
    });

    if (!property) {
      return NextResponse.json({ success: false, error: 'Propriedade não encontrada' }, { status: 404 });
    }

    const status: OnboardingStatus = (property.status as OnboardingStatus) || 'active';
    const currentStep = determineCurrentStep(property);

    const latestScrapeJob = await db.airBScrapingJob.findFirst({
      where: { propertyId: property.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        propertyId: property.id,
        currentStep,
        status,
        airbnbUrl: property.airbnbUrl,
        scrapedAt: property.scrapedAt?.toISOString() || null,
        scrapingJobId: latestScrapeJob?.id || null,
        scrapedData: latestScrapeJob?.result ? JSON.parse(latestScrapeJob.result as string) : null,
        hasWifi: !!property.wifiName,
        hasLockCode: !!property.lockCode,
        hasHostKnowledge: Array.isArray(property.hostKnowledge) && property.hostKnowledge.length > 0,
        isActive: property.status === 'active',
        createdAt: property.createdAt.toISOString(),
        updatedAt: property.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[ONBOARDING] Error fetching state:', error);
    return NextResponse.json({ success: false, error: 'Erro ao buscar estado do onboarding' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/ddc/airb/onboarding — Create/update onboarding state
// Body: { action: 'advance_step' | 'save_manual_data' | 'activate', propertyId, step?, data? }
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  // [RUN10-W2 10B] rate-limit fail-closed (in-memory; Redis opcional no RUN11)
  {
    const __rl = checkRateLimit(request, 'api/ddc/airb/onboarding#POST');
    if (!__rl.ok) return rateLimitResponse(__rl);
  }

  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const dbAvailable = await isDatabaseAvailable();
    const body = await request.json();
    const { action, propertyId, step, data } = body;

    if (!action || !propertyId) {
      return NextResponse.json({ success: false, error: 'action e propertyId são obrigatórios' }, { status: 400 });
    }

    const entitlement = await checkEntitlement(tenantId, 'CREATE_PROPERTY');
    if (!entitlement.allowed) {
      return NextResponse.json({
        success: false,
        error: `Limite atingido: ${entitlement.reason}`,
        data: { currentCount: entitlement.currentCount, maxAllowed: entitlement.maxAllowed },
      }, { status: 403 });
    }

    if (!dbAvailable) {
      return NextResponse.json({
        success: true,
        data: { propertyId, step: step || 'url_entry', status: 'pending', message: 'Demo mode — alterações não persistidas' },
      });
    }

    // Verify property ownership for the tenant
    const property = await db.airBProperty.findFirst({
      where: { id: propertyId, tenantId },
    });

    if (!property) {
      return NextResponse.json({ success: false, error: 'Propriedade não encontrada' }, { status: 404 });
    }

    switch (action) {
      case 'advance_step': {
        if (!step) {
          return NextResponse.json({ success: false, error: 'step é obrigatório para advance_step' }, { status: 400 });
        }

        const nextStep = getNextOnboardingStep(step as OnboardingStep);
        const statusMap: Record<string, OnboardingStatus> = {
          url_entry: 'in_progress',
          scraping: 'scraping',
          review_auto: 'reviewing',
          customize_manual: 'customizing',
          subscription_check: 'activating',
          activate: 'active',
        };

        const newStatus = statusMap[step] || 'in_progress';
        await db.airBProperty.update({
          where: { id: property.id },
          data: { status: step === 'activate' ? 'active' : newStatus },
        });

        return NextResponse.json({
          success: true,
          data: { propertyId: property.id, previousStep: step, currentStep: nextStep, status: newStatus },
        });
      }

      case 'save_manual_data': {
        if (!data) {
          return NextResponse.json({ success: false, error: 'data é obrigatório para save_manual_data' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (data.wifiName !== undefined) updateData.wifiName = data.wifiName;
        if (data.wifiPassword !== undefined) updateData.wifiPassword = data.wifiPassword;
        if (data.lockProvider !== undefined) updateData.lockProvider = data.lockProvider;
        if (data.lockCode !== undefined) updateData.lockCode = data.lockCode;
        if (data.hostKnowledge !== undefined) updateData.hostKnowledge = data.hostKnowledge;
        if (data.neighborhoodTips !== undefined) updateData.neighborhoodTips = data.neighborhoodTips;
        if (data.emergencyContacts !== undefined) updateData.emergencyContacts = data.emergencyContacts;
        if (data.checkinInstructions !== undefined) updateData.checkinInstructions = data.checkinInstructions;
        if (data.houseRules !== undefined) updateData.houseRules = data.houseRules;
        if (data.pixKey !== undefined) updateData.pixKey = data.pixKey;

        await db.airBProperty.update({
          where: { id: property.id },
          data: updateData,
        });

        return NextResponse.json({
          success: true,
          data: { propertyId: property.id, updatedFields: Object.keys(updateData) },
        });
      }

      case 'activate': {
        const missingFields: string[] = [];
        if (!property.wifiName) missingFields.push('wifiName');
        if (!property.lockCode) missingFields.push('lockCode');
        if (!property.hostKnowledge || (Array.isArray(property.hostKnowledge) && property.hostKnowledge.length === 0)) {
          missingFields.push('hostKnowledge');
        }

        if (missingFields.length > 0) {
          return NextResponse.json({
            success: false,
            error: `Campos obrigatórios pendentes: ${missingFields.join(', ')}`,
            data: { missingFields },
          }, { status: 400 });
        }

        await db.airBProperty.update({
          where: { id: property.id },
          data: { status: 'active' },
        });

        return NextResponse.json({
          success: true,
          data: { propertyId: property.id, status: 'active', message: 'Propriedade ativada com sucesso! O Zélla AirB já pode atender hóspedes.' },
        });
      }

      default:
        return NextResponse.json({ success: false, error: `Ação desconhecida: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[ONBOARDING] Error updating state:', error);
    return NextResponse.json({ success: false, error: 'Erro ao atualizar estado do onboarding' }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────

function determineCurrentStep(property: { status: string; wifiName: string | null; lockCode: string | null; name: string | null }): OnboardingStep {
  if (property.status === 'active') return 'activate';
  if (!property.wifiName && !property.lockCode) return 'customize_manual';
  if (!property.name) return 'review_auto';
  return 'customize_manual';
}

function getNextOnboardingStep(current: OnboardingStep): OnboardingStep | null {
  const idx = ONBOARDING_STEP_ORDER.indexOf(current);
  if (idx === -1 || idx >= ONBOARDING_STEP_ORDER.length - 1) return null;
  return ONBOARDING_STEP_ORDER[idx + 1];
}
