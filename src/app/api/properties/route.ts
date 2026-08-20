// =============================================================================
// API — Properties CRUD
// =============================================================================
// Security: tenant comes only from authenticated server context; secrets are
// never returned to clients; all client input is bounded before persistence.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { canAddProperty, getMaxProperties } from '@/lib/features';
import { requireTenantId } from '@/lib/security/tenant-context';

const MAX_BODY_BYTES = 256 * 1024;
const MAX_TEXT = 5000;
const MAX_DESCRIPTION = 20000;

function text(value: unknown, max = MAX_TEXT): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error('INVALID_TEXT_FIELD');
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error('TEXT_FIELD_TOO_LONG');
  return trimmed;
}

function finiteNumber(value: unknown, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error('INVALID_NUMERIC_FIELD');
  return n;
}

function boundedJsonString(value: unknown, max = 20000): string {
  if (value === undefined || value === null) return '[]';
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  if (!raw || raw.length > max) throw new Error('STRUCTURED_FIELD_TOO_LARGE');
  if (typeof value === 'string') {
    try { JSON.parse(value); } catch { throw new Error('INVALID_JSON_FIELD'); }
  }
  return raw;
}

async function parseBody(request: NextRequest): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
  const body = await request.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('INVALID_JSON_BODY');
  return body as Record<string, unknown>;
}

export async function GET() {
  try {
    const tenantId = await requireTenantId();
    const properties = await db.airBProperty.findMany({
      where: { tenantId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, airbnbId: true, airbnbUrl: true, name: true, propertyType: true,
        maxGuests: true, bedrooms: true, bathrooms: true, neighborhood: true,
        city: true, state: true, pricePerNight: true, currency: true,
        amenities: true, status: true, scrapedAt: true, createdAt: true, updatedAt: true,
      },
    });
    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
    const currentCount = properties.length;
    const planSlug = tenant?.plan || 'gratuito';
    const maxCount = tenant ? getMaxProperties(planSlug) : 0;
    return NextResponse.json({ properties, count: currentCount, maxProperties: maxCount, canAddMore: tenant ? canAddProperty(planSlug, currentCount) : false });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED:')) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    console.error('[api/properties] GET failed');
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await parseBody(request);
    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, plan: true } });
    if (!tenant) return NextResponse.json({ error: 'TENANT_NOT_FOUND' }, { status: 404 });

    const currentCount = await db.airBProperty.count({ where: { tenantId, status: 'active' } });
    const planSlug = tenant.plan || 'gratuito';
    if (!canAddProperty(planSlug, currentCount)) return NextResponse.json({ error: 'PROPERTY_LIMIT_REACHED' }, { status: 403 });

    const airbnbId = text(body.airbnbId, 200);
    const name = text(body.name, 200);
    if (!airbnbId || !name) return NextResponse.json({ error: 'REQUIRED_FIELDS_MISSING' }, { status: 400 });

    const airbnbUrl = text(body.airbnbUrl, 2048);
    if (airbnbUrl) {
      let parsed: URL;
      try { parsed = new URL(airbnbUrl); } catch { return NextResponse.json({ error: 'INVALID_AIRBNB_URL' }, { status: 400 }); }
      if (parsed.protocol !== 'https:') return NextResponse.json({ error: 'INVALID_AIRBNB_URL' }, { status: 400 });
    }

    const existing = await db.airBProperty.findFirst({ where: { tenantId, airbnbId } });
    if (existing) return NextResponse.json({ error: 'PROPERTY_ALREADY_EXISTS' }, { status: 409 });

    const property = await db.airBProperty.create({
      data: {
        tenantId, airbnbId, airbnbUrl, name,
        description: text(body.description, MAX_DESCRIPTION) || '',
        propertyType: text(body.propertyType, 100) || 'apartment',
        maxGuests: finiteNumber(body.maxGuests, 1, 100) ?? 2,
        bedrooms: finiteNumber(body.bedrooms, 0, 100) ?? 1,
        bathrooms: finiteNumber(body.bathrooms, 0, 100) ?? 1,
        neighborhood: text(body.neighborhood) || '', city: text(body.city) || '', state: text(body.state, 100) || '',
        address: text(body.address, 1000) || '', latitude: finiteNumber(body.latitude, -90, 90), longitude: finiteNumber(body.longitude, -180, 180),
        pricePerNight: finiteNumber(body.pricePerNight, 0, 100000000), currency: text(body.currency, 10) || 'BRL',
        amenities: boundedJsonString(body.amenities), houseRules: boundedJsonString(body.houseRules),
        checkinTime: text(body.checkinTime, 20) || '15:00', checkoutTime: text(body.checkoutTime, 20) || '11:00',
        wifiName: text(body.wifiName, 200), wifiPassword: text(body.wifiPassword, 500),
        lockProvider: text(body.lockProvider, 100), lockCode: text(body.lockCode, 500),
        status: 'active', scrapedAt: new Date(),
      },
      select: {
        id: true, airbnbId: true, airbnbUrl: true, name: true, description: true, propertyType: true,
        maxGuests: true, bedrooms: true, bathrooms: true, neighborhood: true, city: true, state: true, address: true,
        latitude: true, longitude: true, pricePerNight: true, currency: true, amenities: true, houseRules: true,
        checkinTime: true, checkoutTime: true, wifiName: true, lockProvider: true, status: true, scrapedAt: true, createdAt: true, updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, property }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('UNAUTHORIZED:')) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (['PAYLOAD_TOO_LARGE', 'INVALID_JSON_BODY', 'INVALID_TEXT_FIELD', 'TEXT_FIELD_TOO_LONG', 'INVALID_NUMERIC_FIELD', 'STRUCTURED_FIELD_TOO_LARGE', 'INVALID_JSON_FIELD'].includes(message)) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
    console.error('[api/properties] POST failed');
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}
