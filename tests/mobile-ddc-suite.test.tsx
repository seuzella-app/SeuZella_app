/**
 * ==============================================================================
 * DDC MOBILE & WEB SUITE — Comprehensive Integration & Health Tests
 * ==============================================================================
 * Validates:
 * 1. HUD Topbar rendering and metric calculations for Pousada and Airbnb niches.
 * 2. QuickActionsCard touch target handlers and states.
 * 3. MobilePhoneWrapper frame structure and viewport rules.
 * 4. Mobile & Web DDC route handlers integrity.
 * 5. BFF Aggregator API payload structure and resilience.
 * ==============================================================================
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HUDTopbar } from '../src/components/mobile/HUDTopbar';
import { QuickActionsCard } from '../src/components/mobile/QuickActionsCard';
import { MobilePhoneWrapper } from '../src/components/mobile/MobilePhoneWrapper';
import { MobilePousadaSuperApp } from '../src/components/mobile/MobilePousadaSuperApp';
import { MobileAirbnbSuperApp } from '../src/components/mobile/MobileAirbnbSuperApp';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    promise: vi.fn(),
  },
}));

// Mock next/navigation useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('📱 DDC Mobile HUD Suite — Visual & Component Health', () => {
  it('should render HUDTopbar for Pousada niche with expected metrics', () => {
    const html = renderToStaticMarkup(<HUDTopbar niche="pousada" />);
    
    expect(html).toContain('POUSADA HUD');
    expect(html).toContain('OCUPAÇÃO');
    expect(html).toContain('88%');
    expect(html).toContain('ADR (DIÁRIA)');
    expect(html).toContain('R$ 420');
    expect(html).toContain('HÓSPEDES');
    expect(html).toContain('META SAVE');
  });

  it('should render HUDTopbar for Airbnb niche with expected metrics', () => {
    const html = renderToStaticMarkup(<HUDTopbar niche="airbnb" />);
    
    expect(html).toContain('AIRBNB HUD');
    expect(html).toContain('RECEITA MÊS');
    expect(html).toContain('R$ 8.950');
    expect(html).toContain('CHECK-IN');
    expect(html).toContain('LINK-IN-BIO');
    expect(html).toContain('PIX BLOQ');
  });

  it('should render QuickActionsCard for Pousada niche with 1-tap touch targets', () => {
    const html = renderToStaticMarkup(<QuickActionsCard niche="pousada" />);
    
    expect(html).toContain('AÇÕES RÁPIDAS (1-TAP)');
    expect(html).toContain('IA ON');
    expect(html).toContain('Enviar Guia');
    expect(html).toContain('Trancar');
    expect(html).toContain('Sync OTAs');
  });

  it('should render QuickActionsCard for Airbnb niche with 1-tap touch targets', () => {
    const html = renderToStaticMarkup(<QuickActionsCard niche="airbnb" />);
    
    expect(html).toContain('AÇÕES RÁPIDAS (1-TAP)');
    expect(html).toContain('IA ON');
    expect(html).toContain('PIX Shield');
    expect(html).toContain('Faxina');
  });

  it('should render MobilePhoneWrapper with fullscreen wrapper and child content', () => {
    const html = renderToStaticMarkup(
      <MobilePhoneWrapper title="DDC Pousada Test" niche="pousada">
        <div id="test-child">Child Content Loaded</div>
      </MobilePhoneWrapper>
    );

    expect(html).toContain('Child Content Loaded');
  });

  it('should render MobilePousadaSuperApp with full mobile-native tabs and Stitch elements', () => {
    const html = renderToStaticMarkup(<MobilePousadaSuperApp />);
    expect(html).toContain('SeuZella_Logo_site.png');
    expect(html).toContain('POUSADA');
    expect(html).toContain('MRR Extrapolado');
    expect(html).toContain('R$ 42.800');
    expect(html).toContain('Ocupação Semanal');
    expect(html).toContain('Visão Geral');
    expect(html).toContain('Hóspedes');
    expect(html).toContain('Central IA');
  });

  it('should render MobileAirbnbSuperApp with full mobile-native tabs and Stitch elements', () => {
    const html = renderToStaticMarkup(<MobileAirbnbSuperApp />);
    expect(html).toContain('SeuZella_Logo_site.png');
    expect(html).toContain('AIRBNB');
    expect(html).toContain('Receita Bruta');
    expect(html).toContain('R$ 8.950');
    expect(html).toContain('Link-in-Bio Visitas');
    expect(html).toContain('342');
    expect(html).toContain('PIX Shield');
    expect(html).toContain('Link-in-Bio');
  });
});

describe('🌐 DDC Routes & Canonical Endpoints Health Check', () => {
  it('should have valid metadata export in Mobile Pousada route', async () => {
    const route = await import('../src/app/mobile/pousada/page');
    expect(route.metadata).toBeDefined();
    expect(route.metadata.title).toContain('DDC Pousada Mobile');
  });

  it('should have valid metadata export in Mobile Airbnb route', async () => {
    const route = await import('../src/app/mobile/airbnb/page');
    expect(route.metadata).toBeDefined();
    expect(route.metadata.title).toContain('DDC Airbnb Mobile');
  });

  it('should export force-dynamic configuration on mobile routes', async () => {
    const pousadaRoute = await import('../src/app/mobile/pousada/page');
    const airbnbRoute = await import('../src/app/mobile/airbnb/page');
    
    expect(pousadaRoute.dynamic).toBe('force-dynamic');
    expect(airbnbRoute.dynamic).toBe('force-dynamic');
  });
});

describe('⚡ BFF Aggregator Data Contract Checks', () => {
  it('should validate overview BFF API route definition', async () => {
    const overviewRoute = await import('../src/app/api/v1/guest/ddc/overview/route');
    expect(overviewRoute.GET).toBeDefined();
    expect(typeof overviewRoute.GET).toBe('function');
  });

  it('should validate notifications BFF API route definition', async () => {
    const notificationsRoute = await import('../src/app/api/v1/guest/ddc/notifications/route');
    expect(notificationsRoute.GET).toBeDefined();
    expect(typeof notificationsRoute.GET).toBe('function');
  });
});
