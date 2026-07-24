import { NextRequest, NextResponse } from 'next/server';
import { recordTelemetryEvent } from '@/lib/cerebro/telemetry-bridge';

// Memory aggregator for fast ZCC Mission Control reads
export const landingMetricsStore = {
  totalClicks: 1420,
  ctaClicks: {
    hero_planos: 412,
    hero_parceiro: 328,
    pousada_demo: 290,
    airbnb_demo: 275,
    final_cta: 115,
  },
  planInterests: {
    LITE: 142,
    PRO: 418,
    MAX: 205,
    PARCEIRO: 395,
  },
  recentEvents: [] as Array<{
    eventName: string;
    category: string;
    label?: string;
    timestamp: string;
  }>,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventName, category, label, planId, metadata } = body;

    // 1. Send directly to Cérebro Zélla Telemetry Bridge
    recordTelemetryEvent({
      type: 'landing_click',
      name: eventName || 'landing.click',
      module: 'landing-page',
      severity: 'info',
      message: `[Landing Page] Evento: ${eventName} (${category}) — ${label || planId || ''}`,
      context: {
        category,
        label,
        planId,
        metadata,
      },
    });

    // 2. Update memory store
    landingMetricsStore.totalClicks++;
    if (category === 'plan_selection' && planId) {
      const p = planId.toUpperCase();
      if (landingMetricsStore.planInterests[p as keyof typeof landingMetricsStore.planInterests] !== undefined) {
        landingMetricsStore.planInterests[p as keyof typeof landingMetricsStore.planInterests]++;
      }
    } else if (eventName && landingMetricsStore.ctaClicks[eventName as keyof typeof landingMetricsStore.ctaClicks] !== undefined) {
      landingMetricsStore.ctaClicks[eventName as keyof typeof landingMetricsStore.ctaClicks]++;
    }

    landingMetricsStore.recentEvents.unshift({
      eventName: eventName || 'click',
      category: category || 'general',
      label: label || planId,
      timestamp: new Date().toISOString(),
    });

    if (landingMetricsStore.recentEvents.length > 50) {
      landingMetricsStore.recentEvents.pop();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Landing telemetry error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: landingMetricsStore,
  });
}
