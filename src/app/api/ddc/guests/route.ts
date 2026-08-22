import { NextRequest, NextResponse } from 'next/server';
import { publishTenantEvent } from '@/lib/realtime/tenant-pubsub';
import { db, isDatabaseAvailable } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { resolveTenantId, mapGuest } from '@/lib/ddc/ddc-mapper';
import { apiRatelimit } from '@/lib/rate-limit';
import { withApiGuard } from '@/lib/security/api-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const demoGuests = [
  { id: 'demo-g-1', name: 'Maria Silva', phoneNumber: '5511977665544', status: 'hot' as const, score: 92, propertyId: 'demo', messageCount: 8, value: 1500.00, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-g-2', name: 'João Santos', phoneNumber: '5521966554433', status: 'warm' as const, score: 78, propertyId: 'demo', messageCount: 3, value: 0, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'demo-g-3', name: 'Carlos Mendes', phoneNumber: '5541988776655', status: 'closed' as const, score: 96, propertyId: 'demo', messageCount: 6, value: 700.00, lastMessage: 'Pagamento via PIX realizado', createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'demo-g-4', name: 'Ana Costa', phoneNumber: '5531955443322', status: 'warm' as const, score: 85, propertyId: 'demo', messageCount: 4, value: 0, lastMessage: 'Interessada em passeios', createdAt: new Date(Date.now() - 259200000).toISOString(), updatedAt: new Date(Date.now() - 14400000).toISOString() },
  { id: 'demo-g-5', name: 'Pedro Oliveira', phoneNumber: '5521987654321', status: 'cold' as const, score: 45, propertyId: 'demo', messageCount: 1, value: 0, createdAt: new Date(Date.now() - 345600000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'demo-g-6', name: 'Fernanda Lima', phoneNumber: '5511987654321', status: 'closed' as const, score: 88, propertyId: 'demo', messageCount: 5, value: 2200.00, lastMessage: 'Reserva confirmada para o feriado', createdAt: new Date(Date.now() - 432000000).toISOString(), updatedAt: new Date(Date.now() - 43200000).toISOString() },
  { id: 'demo-g-7', name: 'Ricardo Alves', phoneNumber: '5521966554499', status: 'warm' as const, score: 70, propertyId: 'demo', messageCount: 2, value: 0, lastMessage: 'Perguntou sobre pet policy', createdAt: new Date(Date.now() - 518400000).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'demo-g-8', name: 'Beatriz Souza', phoneNumber: '5541987654321', status: 'hot' as const, score: 90, propertyId: 'demo', messageCount: 7, value: 3500.00, lastMessage: 'Quarto executivo com vista mar', createdAt: new Date(Date.now() - 604800000).toISOString(), updatedAt: new Date(Date.now() - 1800000).toISOString() },
];

export async function GET(request: NextRequest) {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({
        success: true,
        data: { items: demoGuests, total: demoGuests.length, page: 1, limit: demoGuests.length, totalPages: 1 },
      });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const scoreMin = searchParams.get('scoreMin');
    const scoreMax = searchParams.get('scoreMax');
    const search = searchParams.get('search');

    const where: any = { tenantId };
    if (status) where.status = status;
    if (scoreMin) where.aiScore = { ...where.aiScore, gte: parseInt(scoreMin) };
    if (scoreMax) where.aiScore = { ...where.aiScore, lte: parseInt(scoreMax) };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const guests = await db.guest.findMany({ where, orderBy: { lastContact: 'desc' } });
    return NextResponse.json({
      success: true,
      data: {
        items: guests.map(mapGuest),
        total: guests.length,
        page: 1,
        limit: guests.length,
        totalPages: 1,
      }
    });
  } catch (error) {
    console.error('[DDC guests] Prisma error:', error);
    return NextResponse.json({
      success: true,
      data: { items: [], total: 0, page: 1, limit: 0, totalPages: 0 }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const body = await request.json();
    if (!body.name || !body.phoneNumber) {
      return NextResponse.json({ success: false, error: { code: '400', message: 'Missing required fields: name and phoneNumber' } }, { status: 400 });
    }
    const guest = await db.guest.create({
      data: {
        tenantId,
        name: body.name,
        phone: body.phoneNumber,
        email: body.email,
        status: body.status === 'hot' || body.status === 'warm' ? body.status : 'cold',
        aiScore: body.score || 50,
        source: body.source || 'whatsapp',
        value: body.value || 0,
        notes: body.notes,
        checkIn: body.checkIn ? new Date(body.checkIn) : null,
        checkOut: body.checkOut ? new Date(body.checkOut) : null,
      }
    });
    // Publish realtime event AFTER DB write succeeds.
    publishTenantEvent(tenantId, 'guest:updated', {
      guestId: guest.id,
      action: 'created',
      name: guest.name,
      phone: guest.phone,
    });

    return NextResponse.json({ success: true, data: mapGuest(guest) }, { status: 201 });
  } catch (error) {
    console.error('[DDC guests POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: '500', message: 'Failed to create guest', details: error instanceof Error ? error.message : 'Unknown error' } }, { status: 500 });
  }
}
