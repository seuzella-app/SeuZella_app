import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { checkEntitlement } from '@/lib/airb/gatekeeper';
import { generateDemoRegionalKnowledge } from '@/lib/airb/rag-pipeline';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

// ── Demo scraping data (for Magic Onboarding demo) ─────────────────────────────

const DEMO_SCRAPES: Record<string, any> = {
  '18584298': {
    airbnbId: '18584298',
    name: 'Apartamento Vista Mar - Jurerê Internacional',
    city: 'Florianópolis',
    state: 'SC',
    neighborhood: 'Jurerê Internacional',
    propertyType: 'apartment',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    pricePerNight: 350,
    checkinTime: '15:00',
    checkoutTime: '11:00',
    description: 'Apartamento com vista panorâmica para o mar em Jurerê Internacional. Wi-Fi rápido, ar-condicionado em todos os quartos, cozinha completa.',
    amenities: ['Wi-Fi', 'Ar-condicionado', 'Cozinha', 'Estacionamento', 'Piscina', 'Churrasqueira'],
    houseRules: ['Proibido fumar', 'Não permite animais', 'Proibido festas', 'Silêncio após 22h'],
    latitude: -27.4407,
    longitude: -48.4903,
  },
  '9283741': {
    airbnbId: '9283741',
    name: 'Studio Moderno - Copacabana',
    city: 'Rio de Janeiro',
    state: 'RJ',
    neighborhood: 'Copacabana',
    propertyType: 'studio',
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    pricePerNight: 220,
    checkinTime: '14:00',
    checkoutTime: '10:00',
    description: 'Studio moderno a 2 quadras da praia de Copacabana. Perfeito para casais. Wi-Fi, smart TV, cozinha americana.',
    amenities: ['Wi-Fi', 'Smart TV', 'Ar-condicionado', 'Cozinha americana', 'Elevador'],
    houseRules: ['Proibido fumar', 'Não permite animais', 'Proibido festas'],
    latitude: -22.9711,
    longitude: -43.1823,
  },
  '51928403': {
    airbnbId: '51928403',
    name: 'Casa com Piscina - Campos do Jordão',
    city: 'Campos do Jordão',
    state: 'SP',
    neighborhood: 'Alto do Capivari',
    propertyType: 'house',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    pricePerNight: 580,
    checkinTime: '16:00',
    checkoutTime: '12:00',
    description: 'Casa aconchegante com lareira e piscina aquecida. Localizada no Alto do Capivari, próxima ao centro. Ideal para famílias.',
    amenities: ['Wi-Fi', 'Lareira', 'Piscina aquecida', 'Churrasqueira', 'Estacionamento', 'Cozinha completa', 'Máquina de lavar'],
    houseRules: ['Proibido fumar dentro da casa', 'Permite animais (até 2)', 'Proibido festas sem aviso prévio'],
    latitude: -22.7388,
    longitude: -45.5922,
  },
};

function extractAirbnbId(url: string): string | null {
  // Try to extract from URL patterns
  const patterns = [
    /airbnb\.com\.br\/rooms\/(\d+)/,
    /airbnb\.com\/rooms\/(\d+)/,
    /airbnb\.br\/rooms\/(\d+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  // If it's just a number
  if (/^\d+$/.test(url.trim())) return url.trim();
  return null;
}

// POST /api/ddc/airb/scrape — Scrape Airbnb listing data
export async function POST(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'ddc.airb.scrape', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:ddc.airb.scrape', what: 'ddc.airb.scrape.entry', resource: 'api', result: 'ALLOW' });
  let jobId: string | null = null;

  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // ── Gatekeeper: Check entitlement before scraping ──
    const entitlement = await checkEntitlement(tenantId, 'START_SCRAPING_JOB');
    if (!entitlement.allowed) {
      return NextResponse.json({
        success: false,
        error: `Operação não permitida: ${entitlement.reason}.`,
      }, { status: 403 });
    }

    const dbAvailable = await isDatabaseAvailable();

    const body = await request.json();
    const { url } = body;

    if (!url || !url.trim()) {
      return NextResponse.json({ success: false, error: 'URL or Airbnb ID is required' }, { status: 400 });
    }

    const airbnbId = extractAirbnbId(url);

    if (!airbnbId) {
      return NextResponse.json({
        success: false,
        error: 'Não foi possível extrair o ID do Airbnb. Use o formato: https://www.airbnb.com.br/rooms/NUMERO ou apenas o número.',
      }, { status: 400 });
    }

    const airbnbUrl = `https://www.airbnb.com.br/rooms/${airbnbId}`;

    // ── Create scraping job record if DB is available ──
    if (dbAvailable) {
      const idempotencyKey = `scrape-${tenantId}-${airbnbId}-${Date.now()}`;
      try {
        const job = await db.airBScrapingJob.create({
          data: {
            tenantId,
            airbnbUrl,
            status: 'running',
            idempotencyKey,
            scrapingSource: 'demo',
            startedAt: new Date(),
          },
        });
        jobId = job.id;
      } catch (jobError) {
        console.error('[AIRB] Error creating scraping job:', jobError);
        // Continue even if job creation fails
      }
    }

    // Try demo data first
    const demoData = DEMO_SCRAPES[airbnbId];
    if (demoData) {
      // Generate regional knowledge for demo
      const regionalKnowledge = generateDemoRegionalKnowledge(`demo-${airbnbId}`, demoData.neighborhood);

      // Update job status to completed if DB available
      if (dbAvailable && jobId) {
        try {
          await db.airBScrapingJob.update({
            where: { id: jobId },
            data: {
              status: 'completed',
              result: JSON.stringify(demoData),
              completedAt: new Date(),
            },
          });
        } catch { /* non-critical */ }
      }

      return NextResponse.json({
        success: true,
        data: {
          ...demoData,
          airbnbUrl,
          scrapingSource: 'demo',
        },
        regionalKnowledge,
        meta: { source: 'demo', note: 'Dados de demonstração. Em produção, serão raspados do Airbnb.', jobId },
      });
    }

    // For non-demo IDs, return a simulated response
    // In production, this would use the 3-layer scraping engine (API → AI Extractor → Manual)
    const simulatedData = {
      airbnbId,
      airbnbUrl,
      name: `Imóvel Airbnb #${airbnbId}`,
      city: '',
      state: '',
      neighborhood: '',
      propertyType: 'apartment',
      bedrooms: 1,
      bathrooms: 1,
      maxGuests: 2,
      pricePerNight: null,
      checkinTime: '15:00',
      checkoutTime: '11:00',
      description: '',
      amenities: [],
      houseRules: [],
      latitude: null,
      longitude: null,
      scrapingSource: 'simulated',
    };

    // Generate generic regional knowledge
    const regionalKnowledge = generateDemoRegionalKnowledge(`sim-${airbnbId}`, '');

    // Update job status to completed if DB available
    if (dbAvailable && jobId) {
      try {
        await db.airBScrapingJob.update({
          where: { id: jobId },
          data: {
            status: 'completed',
            result: JSON.stringify(simulatedData),
            completedAt: new Date(),
          },
        });
      } catch { /* non-critical */ }
    }

    return NextResponse.json({
      success: true,
      data: simulatedData,
      regionalKnowledge,
      meta: { source: 'simulated', note: 'Dados simulados. Em produção, a raspagem real será feita via StayingAPI/AirROI ou GPT-4o-mini.', jobId },
    });
  } catch (error) {
    console.error('[AIRB] Error scraping:', error);

    // Update job status to failed if we have a job ID
    if (jobId) {
      try {
        const dbAvailable = await isDatabaseAvailable();
        if (dbAvailable) {
          await db.airBScrapingJob.update({
            where: { id: jobId },
            data: {
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      } catch { /* non-critical */ }
    }

    return NextResponse.json({ success: false, error: 'Failed to scrape property data' }, { status: 500 });
  }
}
