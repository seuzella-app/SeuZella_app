import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

export interface TenantOnboardingStatus {
  id: string;
  propertyName: string;
  ownerInitials: string;
  plan: 'lite' | 'pro' | 'max' | 'parceiro';
  niche: 'pousada' | 'airbnb';
  createdAt: string;
  isTestTenant: boolean;
  steps: {
    paymentConfirmed: boolean;
    emailSent: boolean;
    magicScanExecuted: boolean;
    whatsappConnected: boolean;
    autoPinActivated: boolean;
  };
  overallProgressPercent: number;
}

const EVENT_ACTIONS = {
  emailSent: ['WELCOME_EMAIL_SENT', 'ONBOARDING_EMAIL_SENT'],
  magicScanExecuted: ['MAGIC_SCAN_EXECUTED', 'ONBOARDING_MAGIC_SCAN_COMPLETED'],
  autoPinActivated: ['AUTO_PIN_ACTIVATED', 'ONBOARDING_AUTO_PIN_ACTIVATED'],
} as const;

function hasAuditAction(auditLogs: Array<{ action: string }>, actions: readonly string[]) {
  const accepted = new Set(actions);
  return auditLogs.some((entry) => accepted.has(entry.action.toUpperCase()));
}

function toPlan(value: string): TenantOnboardingStatus['plan'] {
  const normalized = value.toLowerCase();
  if (normalized === 'pro' || normalized === 'max' || normalized === 'parceiro' || normalized === 'lite') {
    return normalized;
  }
  return 'lite';
}

function toNiche(value: string): TenantOnboardingStatus['niche'] {
  return value.toLowerCase() === 'airbnb' ? 'airbnb' : 'pousada';
}

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const tenants = await db.tenant.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        property: { select: { name: true } },
        subscriptions: {
          select: { status: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        lockDevices: { select: { id: true } },
        lockCodes: { select: { id: true } },
        auditLogs: {
          select: { action: true },
          where: {
            action: {
              in: [
                ...EVENT_ACTIONS.emailSent,
                ...EVENT_ACTIONS.magicScanExecuted,
                ...EVENT_ACTIONS.autoPinActivated,
              ],
            },
          },
        },
      },
    });

    const tenantsOnboarding: TenantOnboardingStatus[] = tenants.map((tenant) => {
      const auditLogs = tenant.auditLogs;
      const paymentConfirmed = tenant.subscriptions[0]?.status?.toLowerCase() === 'active';
      const emailSent = hasAuditAction(auditLogs, EVENT_ACTIONS.emailSent);
      const magicScanExecuted = hasAuditAction(auditLogs, EVENT_ACTIONS.magicScanExecuted);
      const whatsappConnected = Boolean(tenant.whatsappBusinessId && tenant.whatsappPhoneNumber);
      const autoPinActivated = hasAuditAction(auditLogs, EVENT_ACTIONS.autoPinActivated)
        || (tenant.lockDevices.length > 0 && tenant.lockCodes.length > 0);

      const completedSteps = [
        paymentConfirmed,
        emailSent,
        magicScanExecuted,
        whatsappConnected,
        autoPinActivated,
      ].filter(Boolean).length;

      return {
        id: tenant.id,
        propertyName: tenant.property?.name || tenant.name,
        ownerInitials: tenant.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => `${part[0]}.`)
          .join(''),
        plan: toPlan(tenant.plan),
        niche: toNiche(tenant.niche),
        createdAt: tenant.createdAt.toISOString(),
        isTestTenant: tenant.isTestTenant,
        steps: {
          paymentConfirmed,
          emailSent,
          magicScanExecuted,
          whatsappConnected,
          autoPinActivated,
        },
        overallProgressPercent: completedSteps * 20,
      };
    });

    const totalTenants = tenantsOnboarding.length;
    const fullyOnboarded = tenantsOnboarding.filter((tenant) => tenant.overallProgressPercent === 100).length;
    const whatsappConnectedCount = tenantsOnboarding.filter((tenant) => tenant.steps.whatsappConnected).length;
    const autoPinActivationCount = tenantsOnboarding.filter((tenant) => tenant.steps.autoPinActivated).length;

    return NextResponse.json(
      {
        success: true,
        source: 'database',
        data: {
          metrics: {
            totalTenants,
            fullyOnboarded,
            whatsappConnectedRate: totalTenants > 0 ? Math.round((whatsappConnectedCount / totalTenants) * 100) : 0,
            autoPinActivationRate: totalTenants > 0 ? Math.round((autoPinActivationCount / totalTenants) * 100) : 0,
          },
          tenants: tenantsOnboarding,
          timestamp: new Date().toISOString(),
        },
      },
      { headers: { 'X-ZCC-Data-Source': 'postgresql' } },
    );
  } catch (error) {
    console.error('[ZCC Onboarding Tracker]', error);
    return NextResponse.json(
      {
        success: false,
        source: 'database',
        error: 'ONBOARDING_DATA_UNAVAILABLE',
        message: 'Onboarding tracker requires the operational PostgreSQL database. Mock data is disabled.',
      },
      {
        status: 503,
        headers: { 'X-ZCC-Data-Source': 'postgresql' },
      },
    );
  }
}
