// =============================================================================
// API — Property Detail CRUD
// =============================================================================
// GET    /api/properties/[id] — Busca uma propriedade
// PUT    /api/properties/[id] — Atualiza uma propriedade
// DELETE /api/properties/[id] — Remove (soft delete) uma propriedade
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const { id } = await params;
    const property = await db.airBProperty.findFirst({
      where: { id, tenantId: session.user.tenantId, status: 'active' },
    });

    if (!property) {
      return NextResponse.json({ error: 'Propriedade não encontrada.' }, { status: 404 });
    }

    return NextResponse.json({ property });
  } catch (error) {
    console.error('[api/properties/[id]] GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.airBProperty.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Propriedade não encontrada.' }, { status: 404 });
    }

    // Build update data from body — only include fields that are provided
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'description', 'propertyType', 'accommodates', 'bedrooms', 'beds', 'bathrooms',
      'neighborhood', 'city', 'state', 'country', 'fullAddress', 'latitude', 'longitude',
      'rating', 'reviewCount', 'basePrice', 'currency', 'amenities', 'photos', 'photoCount',
      'houseRules', 'checkInTime', 'checkOutTime', 'hostName', 'hostIsSuperhost',
      'hostResponseRate', 'hostResponseTime', 'aiSummary', 'highlights', 'targetAudience',
      'sellingPoints', 'localTipsFromReviews', 'reviewSentiment', 'keywords',
      'wifiName', 'wifiPassword', 'lockboxCode', 'lockboxLocation', 'accessInstructions',
      'emergencyContact', 'maintenanceContact', 'alarmCode', 'gateCode', 'parkingSpot',
      'personalLocalTips', 'favoriteRestaurants', 'supermarketLocation', 'additionalRules',
      'quietHoursStart', 'quietHoursEnd', 'customCheckInInstructions',
      'customCheckOutInstructions', 'internalNotes', 'scrapingStatus',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Handle JSON fields
        if (['amenities', 'photos', 'highlights', 'targetAudience', 'sellingPoints',
             'localTipsFromReviews', 'keywords'].includes(field)) {
          updateData[field] = typeof body[field] === 'string' ? body[field] : JSON.stringify(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const property = await db.airBProperty.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, property });
  } catch (error) {
    console.error('[api/properties/[id]] PUT Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.airBProperty.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Propriedade não encontrada.' }, { status: 404 });
    }

    // Soft delete
    await db.airBProperty.update({
      where: { id },
      data: { status: 'inactive' },
    });

    return NextResponse.json({ success: true, message: 'Propriedade removida com sucesso.' });
  } catch (error) {
    console.error('[api/properties/[id]] DELETE Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
