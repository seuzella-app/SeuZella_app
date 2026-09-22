import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { checkEntitlement } from '@/lib/airb/gatekeeper';
import { generateDemoRegionalKnowledge } from '@/lib/airb/rag-pipeline';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

const demoProperties = [
  {
    id: 'demo-airb-1',
    tenantId: 'demo',
    name: 'Apartamento Vista Mar - Jurerê Internacional',
    airbnbId: '18584298',
    airbnbUrl: 'https://www.airbnb.com.br/rooms/18584298',
    city: 'Florianópolis',
    state: 'SC',
    neighborhood: 'Jurerê Internacional',
    description: 'Apartamento com vista panorâmica para o mar em Jurerê Internacional.',
    propertyType: 'apartment',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    pricePerNight: 350,
    checkinTime: '15:00',
    checkoutTime: '11:00',
    wifiName: 'VistaMar_WiFi',
    wifiPassword: '****2024',
    lockProvider: 'smart',
    lockCode: '****21',
    latitude: -27.4407,
    longitude: -48.4903,
    amenities: '["Wi-Fi","Ar-condicionado","Cozinha","Estacionamento","Piscina","Churrasqueira"]',
    houseRules: '["Proibido fumar","Não permite animais","Proibido festas","Silêncio após 22h"]',
    hostKnowledge: '["A praia de Jurerê é a mais tranquila da região, ideal para crianças","O supermercado Bom Preço faz entrega, peça pelo app","O restaurante Marisqueira fecha às segundas","A farmácia Drogasil funciona 24h"]',
    neighborhoodTips: '[]',
    emergencyContacts: '[{"name":"SAMU","phone":"192","description":"Serviço de Atendimento Móvel de Urgência"},{"name":"Bombeiros","phone":"193","description":"Corpo de Bombeiros"}]',
    scrapingSource: 'demo',
    scrapedAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    _count: { conversations: 3, regionalKnowledge: generateDemoRegionalKnowledge('demo-airb-1', 'Jurerê Internacional').length },
  },
  {
    id: 'demo-airb-2',
    tenantId: 'demo',
    name: 'Studio Moderno - Copacabana',
    airbnbId: '9283741',
    airbnbUrl: 'https://www.airbnb.com.br/rooms/9283741',
    city: 'Rio de Janeiro',
    state: 'RJ',
    neighborhood: 'Copacabana',
    description: 'Studio moderno a 2 quadras da praia de Copacabana. Perfeito para casais.',
    propertyType: 'studio',
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    pricePerNight: 220,
    checkinTime: '14:00',
    checkoutTime: '10:00',
    wifiName: 'StudioCopacabana',
    wifiPassword: '****2024',
    lockProvider: 'nuki',
    lockCode: '****93',
    latitude: -22.9711,
    longitude: -43.1823,
    amenities: '["Wi-Fi","Smart TV","Ar-condicionado","Cozinha americana","Elevador"]',
    houseRules: '["Proibido fumar","Não permite animais","Proibido festas"]',
    hostKnowledge: '["O metrô Cardeal Arcoverde é a 5 min de caminhada","A praia tem posto de salvavidas no posto 6","O Carrefour Express na esquina funciona 24h","Cuidado com celular na praia — área de risco de furto"]',
    neighborhoodTips: '[]',
    emergencyContacts: '[{"name":"SAMU","phone":"192"},{"name":"Polícia","phone":"190"}]',
    scrapingSource: 'demo',
    scrapedAt: new Date(Date.now() - 172800000).toISOString(),
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
    _count: { conversations: 1, regionalKnowledge: generateDemoRegionalKnowledge('demo-airb-2', 'Copacabana').length },
  },
  {
    id: 'demo-airb-3',
    tenantId: 'demo',
    name: 'Casa com Piscina - Campos do Jordão',
    airbnbId: '51928403',
    airbnbUrl: 'https://www.airbnb.com.br/rooms/51928403',
    city: 'Campos do Jordão',
    state: 'SP',
    neighborhood: 'Alto do Capivari',
    description: 'Casa aconchegante com lareira e piscina aquecida. Ideal para famílias.',
    propertyType: 'house',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    pricePerNight: 580,
    checkinTime: '16:00',
    checkoutTime: '12:00',
    wifiName: 'CasaPiscina_WiFi',
    wifiPassword: '****2024',
    lockProvider: 'august',
    lockCode: '****20',
    latitude: -22.7388,
    longitude: -45.5922,
    amenities: '["Wi-Fi","Lareira","Piscina aquecida","Churrasqueira","Estacionamento","Cozinha completa","Máquina de lavar"]',
    houseRules: '["Proibido fumar dentro da casa","Permite animais (até 2)","Proibido festas sem aviso prévio"]',
    hostKnowledge: '["A piscina é aquecida a 28°C — pode usar mesmo no frio","A lareira já vem com lenha para a primeira queima, reposição no mercado","A padaria Suíça tem o melhor chocolate quente da cidade","O teleférico fecha às 17h no inverno"]',
    neighborhoodTips: '[]',
    emergencyContacts: '[{"name":"SAMU","phone":"192"},{"name":"Hospital Santa Cruz","phone":"(12) 3663-1234","description":"Hospital mais próximo, 5 min de carro"}]',
    scrapingSource: 'demo',
    scrapedAt: new Date(Date.now() - 259200000).toISOString(),
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date(Date.now() - 259200000).toISOString(),
    _count: { conversations: 2, regionalKnowledge: generateDemoRegionalKnowledge('demo-airb-3', 'Alto do Capivari').length },
  },
];

/** Mask sensitive fields (wifiPassword, lockCode) before sending to the client */
function maskSensitiveFields(property: Record<string, any>) {
  if (property.wifiPassword) {
    property.wifiConfigured = true;
    delete property.wifiPassword;
  }
  if (property.lockCode) {
    property.lockConfigured = true;
    delete property.lockCode;
  }
  return property;
}

// GET /api/ddc/airb/properties — List all Airbnb properties for tenant
export async function GET() {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({ success: true, data: demoProperties.map(p => maskSensitiveFields({ ...p })) });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const properties = await db.airBProperty.findMany({
      where: { tenantId },
      include: { _count: { select: { conversations: true, regionalKnowledge: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: properties.map(p => maskSensitiveFields({ ...p } as Record<string, any>)) });
  } catch (error) {
    console.error('[AIRB] Error listing properties:', error);
    return NextResponse.json({ success: false, error: 'Failed to list properties' }, { status: 500 });
  }
}

// POST /api/ddc/airb/properties — Create new Airbnb property
export async function POST(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'ddc.airb.properties', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:ddc.airb.properties', what: 'ddc.airb.properties.entry', resource: 'api', result: 'ALLOW' });
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({ success: false, error: 'Banco de dados indisponível' }, { status: 503 });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // ── Gatekeeper: Check entitlement before creating ──
    const entitlement = await checkEntitlement(tenantId, 'CREATE_PROPERTY');
    if (!entitlement.allowed) {
      return NextResponse.json({
        success: false,
        error: `Operação não permitida: ${entitlement.reason}. Limite: ${entitlement.maxAllowed} imóveis no plano ${entitlement.planType}.`,
      }, { status: 403 });
    }

    const body = await request.json();
    const { name, airbnbId, airbnbUrl, city, state, propertyType, bedrooms, bathrooms, maxGuests,
            checkinTime, checkoutTime, wifiName, wifiPassword, lockProvider, lockCode, pricePerNight,
            neighborhood, description, latitude, longitude } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Property name is required' }, { status: 400 });
    }

    const property = await db.airBProperty.create({
      data: {
        tenantId,
        name: name.trim(),
        airbnbId: airbnbId || null,
        airbnbUrl: airbnbUrl || null,
        city: city || '',
        state: state || '',
        neighborhood: neighborhood || '',
        description: description || '',
        propertyType: propertyType || 'apartment',
        bedrooms: bedrooms || 1,
        bathrooms: bathrooms || 1,
        maxGuests: maxGuests || 2,
        checkinTime: checkinTime || '15:00',
        checkoutTime: checkoutTime || '11:00',
        wifiName: wifiName || null,
        wifiPassword: wifiPassword || null,
        lockProvider: lockProvider || null,
        lockCode: lockCode || null,
        pricePerNight: pricePerNight || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        scrapingSource: airbnbId ? 'magic_onboarding' : 'manual',
        scrapedAt: airbnbId ? new Date() : null,
      },
    });

    return NextResponse.json({ success: true, data: maskSensitiveFields({ ...property } as Record<string, any>) }, { status: 201 });
  } catch (error) {
    console.error('[AIRB] Error creating property:', error);
    return NextResponse.json({ success: false, error: 'Failed to create property' }, { status: 500 });
  }
}

// PATCH /api/ddc/airb/properties — Update a property (host knowledge, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      // In demo mode, return success
      return NextResponse.json({ success: true });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, hostKnowledge, neighborhoodTips, emergencyContacts } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Property ID is required' }, { status: 400 });
    }

    // Verify ownership
    const property = await db.airBProperty.findFirst({
      where: { id, tenantId },
    });

    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 });
    }

    // Build update data (only allow specific fields)
    const updateData: Record<string, any> = {};
    if (hostKnowledge !== undefined) updateData.hostKnowledge = hostKnowledge;
    if (neighborhoodTips !== undefined) updateData.neighborhoodTips = neighborhoodTips;
    if (emergencyContacts !== undefined) updateData.emergencyContacts = emergencyContacts;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const updated = await db.airBProperty.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: maskSensitiveFields({ ...updated } as Record<string, any>) });
  } catch (error) {
    console.error('[AIRB] Error updating property:', error);
    return NextResponse.json({ success: false, error: 'Failed to update property' }, { status: 500 });
  }
}

// DELETE /api/ddc/airb/properties?id=xxx — Delete a property
export async function DELETE(request: NextRequest) {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({ success: false, error: 'Banco de dados indisponível' }, { status: 503 });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Property ID is required' }, { status: 400 });
    }

    // Verify ownership
    const property = await db.airBProperty.findFirst({
      where: { id, tenantId },
    });

    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 });
    }

    // Delete related regional knowledge first (cascade should handle it, but explicit for safety)
    await db.airBRegionalKnowledge.deleteMany({ where: { propertyId: id } });

    await db.airBProperty.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AIRB] Error deleting property:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete property' }, { status: 500 });
  }
}
