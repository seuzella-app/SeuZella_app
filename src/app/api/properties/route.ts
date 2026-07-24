// =============================================================================
// API — Properties CRUD
// =============================================================================
// GET  /api/properties    — Lista propriedades do tenant
// POST /api/properties    — Cria nova propriedade
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { canAddProperty, getMaxProperties } from '@/lib/features';

// Demo tenant ID (in production, this would come from auth)
const DEMO_TENANT_ID = 'demo';

async function getTenantId(request: NextRequest): Promise<string | null> {
  // TODO: In production, extract from auth session
  // For now, find the first tenant
  const tenant = await db.tenant.findFirst({ where: { status: 'active' } });
  return tenant?.id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await getTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const properties = await db.airBProperty.findMany({
      where: { tenantId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        airbnbId: true,
        airbnbUrl: true,
        name: true,
        propertyType: true,
        maxGuests: true,
        bedrooms: true,
        bathrooms: true,
        neighborhood: true,
        city: true,
        state: true,
        pricePerNight: true,
        currency: true,
        amenities: true,
        status: true,
        scrapedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Get tenant info for feature gating
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });

    const currentCount = properties.length;
    const planSlug = tenant?.plan || 'gratuito';
    const maxCount = tenant ? getMaxProperties(planSlug) : 0;

    return NextResponse.json({
      properties,
      count: currentCount,
      maxProperties: maxCount,
      canAddMore: tenant ? canAddProperty(planSlug, currentCount) : false,
    });
  } catch (error) {
    console.error('[api/properties] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await getTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const body = await request.json();
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Check property limit
    const currentCount = await db.airBProperty.count({
      where: { tenantId, status: 'active' },
    });

    const planSlug = tenant.plan || 'gratuito';

    if (!canAddProperty(planSlug, currentCount)) {
      return NextResponse.json(
        { error: `Limite de ${getMaxProperties(planSlug)} imóveis atingido para o plano ${planSlug.toUpperCase()}. Considere fazer upgrade.` },
        { status: 403 }
      );
    }

    const {
      airbnbId,
      airbnbUrl,
      name,
      description,
      propertyType,
      maxGuests,
      bedrooms,
      bathrooms,
      neighborhood,
      city,
      state,
      address,
      latitude,
      longitude,
      pricePerNight,
      currency,
      amenities,
      houseRules,
      checkinTime,
      checkoutTime,
      wifiName,
      wifiPassword,
      lockProvider,
      lockCode,
    } = body;

    if (!airbnbId || !name) {
      return NextResponse.json(
        { error: 'Campos "airbnbId" e "name" são obrigatórios.' },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await db.airBProperty.findFirst({
      where: { tenantId, airbnbId: String(airbnbId) },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Imóvel com código ${airbnbId} já está cadastrado.` },
        { status: 409 }
      );
    }

    const property = await db.airBProperty.create({
      data: {
        tenantId,
        airbnbId: String(airbnbId),
        airbnbUrl,
        name,
        description: description || '',
        propertyType: propertyType || 'apartment',
        maxGuests: maxGuests ? Number(maxGuests) : 2,
        bedrooms: bedrooms ? Number(bedrooms) : 1,
        bathrooms: bathrooms ? Number(bathrooms) : 1,
        neighborhood: neighborhood || '',
        city: city || '',
        state: state || '',
        address: address || '',
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        pricePerNight: pricePerNight ? Number(pricePerNight) : undefined,
        currency: currency || 'BRL',
        amenities: amenities ? (typeof amenities === 'string' ? amenities : JSON.stringify(amenities)) : '[]',
        houseRules: houseRules ? (typeof houseRules === 'string' ? houseRules : JSON.stringify(houseRules)) : '[]',
        checkinTime: checkinTime || '15:00',
        checkoutTime: checkoutTime || '11:00',
        wifiName,
        wifiPassword,
        lockProvider,
        lockCode,
        status: 'active',
        scrapedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, property }, { status: 201 });
  } catch (error) {
    console.error('[api/properties] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
