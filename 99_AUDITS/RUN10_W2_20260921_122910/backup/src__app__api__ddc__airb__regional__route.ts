import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';

// GET /api/ddc/airb/regional?propertyId=xxx — Get regional knowledge for a property
export async function GET(request: NextRequest) {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({ success: true, data: [] });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'Property ID is required' }, { status: 400 });
    }

    // Verify property belongs to tenant
    const property = await db.airBProperty.findFirst({
      where: { id: propertyId, tenantId },
    });
    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 });
    }

    const regionalKnowledge = await db.airBRegionalKnowledge.findMany({
      where: { propertyId },
      orderBy: [{ category: 'asc' }, { distance: 'asc' }],
    });

    return NextResponse.json({ success: true, data: regionalKnowledge });
  } catch (error) {
    console.error('[AIRB] Error listing regional knowledge:', error);
    return NextResponse.json({ success: false, error: 'Failed to list regional knowledge' }, { status: 500 });
  }
}

// POST /api/ddc/airb/regional — Create or update regional knowledge
export async function POST(request: NextRequest) {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({ success: false, error: 'Banco de dados indisponível' }, { status: 503 });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { propertyId, items } = body as { propertyId: string; items: Array<{
      category: string;
      name: string;
      distance?: number;
      walkingTimeMin?: number;
      drivingTimeMin?: number;
      address?: string;
      rating?: number;
      googlePlaceId?: string;
      description?: string;
    }> };

    if (!propertyId || !items || !Array.isArray(items)) {
      return NextResponse.json({ success: false, error: 'propertyId and items array are required' }, { status: 400 });
    }

    // Verify property belongs to tenant
    const property = await db.airBProperty.findFirst({
      where: { id: propertyId, tenantId },
    });
    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 });
    }

    // Delete existing and recreate (full replace)
    await db.airBRegionalKnowledge.deleteMany({ where: { propertyId } });

    const created = await db.airBRegionalKnowledge.createMany({
      data: items.map(item => ({
        tenantId,
        propertyId,
        category: item.category,
        name: item.name,
        distance: item.distance || null,
        walkingTimeMin: item.walkingTimeMin || null,
        drivingTimeMin: item.drivingTimeMin || null,
        address: item.address || null,
        rating: item.rating || null,
        googlePlaceId: item.googlePlaceId || null,
        description: item.description || null,
      })),
    });

    return NextResponse.json({ success: true, data: { count: created.count } }, { status: 201 });
  } catch (error) {
    console.error('[AIRB] Error creating regional knowledge:', error);
    return NextResponse.json({ success: false, error: 'Failed to create regional knowledge' }, { status: 500 });
  }
}

// DELETE /api/ddc/airb/regional?propertyId=xxx — Delete all regional knowledge for a property
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
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'Property ID is required' }, { status: 400 });
    }

    // Verify property belongs to tenant
    const property = await db.airBProperty.findFirst({
      where: { id: propertyId, tenantId },
    });
    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 });
    }

    await db.airBRegionalKnowledge.deleteMany({ where: { propertyId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AIRB] Error deleting regional knowledge:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete regional knowledge' }, { status: 500 });
  }
}
