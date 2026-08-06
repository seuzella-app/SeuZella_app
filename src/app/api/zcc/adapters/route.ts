// ============================================================================
// GET /api/zcc/adapters — show the current adapter mode map
// ============================================================================

import { NextResponse } from 'next/server';
import { resolveModeMap, getAdapters } from '@/adapters';

export async function GET() {
  const modeMap = resolveModeMap();
  const adapters = getAdapters();
  return NextResponse.json({
    modeMap,
    adapters: {
      googleAds: { isDigitalTwin: adapters.googleAds.isDigitalTwin() },
      metaAds: { isDigitalTwin: adapters.metaAds.isDigitalTwin() },
      payment: { isDigitalTwin: adapters.payment.isDigitalTwin() },
      crm: { isDigitalTwin: adapters.crm.isDigitalTwin() },
      whatsapp: { isDigitalTwin: adapters.whatsapp.isDigitalTwin() },
      analytics: { isDigitalTwin: adapters.analytics.isDigitalTwin() },
      email: { isDigitalTwin: adapters.email.isDigitalTwin() },
      maps: { isDigitalTwin: adapters.maps.isDigitalTwin() },
    },
  });
}
