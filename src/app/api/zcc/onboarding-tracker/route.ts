import { NextResponse } from 'next/server';

export interface TenantOnboardingStatus {
  id: string;
  propertyName: string;
  ownerInitials: string;
  plan: 'lite' | 'pro' | 'max' | 'parceiro';
  niche: 'pousada' | 'airbnb';
  createdAt: string;
  steps: {
    paymentConfirmed: boolean;     // TODO(REAL): subscription.status === 'active'
    emailSent: boolean;            // TODO(REAL): tenant.welcomeEmailSent === true
    magicScanExecuted: boolean;    // TODO(REAL): property.scannedAt !== null
    whatsappConnected: boolean;    // TODO(REAL): meta-cloud.getStatus(tenantId) === 'connected'
    autoPinActivated: boolean;     // TODO(REAL): db.lock.count({ tenantId }) > 0
  };
  overallProgressPercent: number;
}

export async function GET() {
  // Mock Data: 5 Tenants em diferentes estágios do funil de onboarding
  const tenantsOnboarding: TenantOnboardingStatus[] = [
    {
      id: 't-101',
      propertyName: 'Pousada Serenity Paraty',
      ownerInitials: 'R.S.',
      plan: 'pro',
      niche: 'pousada',
      createdAt: '2026-08-10T14:20:00Z',
      steps: {
        paymentConfirmed: true,
        emailSent: true,
        magicScanExecuted: true,
        whatsappConnected: true,
        autoPinActivated: true,
      },
      overallProgressPercent: 100,
    },
    {
      id: 't-102',
      propertyName: 'Chalé Vista Mar Búzios',
      ownerInitials: 'F.O.',
      plan: 'pro',
      niche: 'pousada',
      createdAt: '2026-08-10T12:00:00Z',
      steps: {
        paymentConfirmed: true,
        emailSent: true,
        magicScanExecuted: true,
        whatsappConnected: true,
        autoPinActivated: false,
      },
      overallProgressPercent: 80,
    },
    {
      id: 't-103',
      propertyName: 'Flat Studio Copacabana',
      ownerInitials: 'M.S.',
      plan: 'lite',
      niche: 'airbnb',
      createdAt: '2026-08-09T18:30:00Z',
      steps: {
        paymentConfirmed: true,
        emailSent: true,
        magicScanExecuted: true,
        whatsappConnected: false,
        autoPinActivated: false,
      },
      overallProgressPercent: 60,
    },
    {
      id: 't-104',
      propertyName: 'Loft Cyber Jardins SP',
      ownerInitials: 'C.A.',
      plan: 'max',
      niche: 'airbnb',
      createdAt: '2026-08-08T10:15:00Z',
      steps: {
        paymentConfirmed: true,
        emailSent: true,
        magicScanExecuted: false,
        whatsappConnected: false,
        autoPinActivated: false,
      },
      overallProgressPercent: 40,
    },
    {
      id: 't-105',
      propertyName: 'Pousada Vila dos Coqueiros',
      ownerInitials: 'J.P.',
      plan: 'pro',
      niche: 'pousada',
      createdAt: '2026-08-07T09:00:00Z',
      steps: {
        paymentConfirmed: true,
        emailSent: true,
        magicScanExecuted: true,
        whatsappConnected: true,
        autoPinActivated: true,
      },
      overallProgressPercent: 100,
    },
  ];

  // Métricas agregadas do funil de onboarding ZCC
  const metrics = {
    totalTenants: tenantsOnboarding.length,
    fullyOnboarded: tenantsOnboarding.filter(t => t.overallProgressPercent === 100).length,
    whatsappConnectedRate: Math.round((tenantsOnboarding.filter(t => t.steps.whatsappConnected).length / tenantsOnboarding.length) * 100),
    autoPinActivationRate: Math.round((tenantsOnboarding.filter(t => t.steps.autoPinActivated).length / tenantsOnboarding.length) * 100),
  };

  return NextResponse.json({
    success: true,
    data: {
      metrics,
      tenants: tenantsOnboarding,
      timestamp: new Date().toISOString(),
    },
  });
}
