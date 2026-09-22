import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

const MOCK_PROPERTIES = [
  {
    name: 'Apartamento Vista Mar — Copacabana',
    propertyType: 'apartment',
    city: 'Rio de Janeiro',
    state: 'RJ',
    neighborhood: 'Copacabana',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    pricePerNight: 320,
  },
  {
    name: 'Chalé Serrano — Monte Verde',
    propertyType: 'chalet',
    city: 'Monte Verde',
    state: 'MG',
    neighborhood: 'Centro',
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    pricePerNight: 280,
  },
  {
    name: 'Studio Moderno — Jardins',
    propertyType: 'studio',
    city: 'São Paulo',
    state: 'SP',
    neighborhood: 'Jardins',
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    pricePerNight: 210,
  },
];

export async function POST(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'zcc.airbnb.oauth', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.airbnb.oauth', what: 'zcc.airbnb.oauth.entry', resource: 'api', result: 'ALLOW' });
  // ── Security Gate V3 — 6-Layer Protection ──
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {

    const body = await request.json();
    const { tenantId } = body as { tenantId: string };

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: tenantId' },
        { status: 400 }
      );
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // ── Create mock OAuth token ──────────────────────────────────
    const mockAccessToken = `mock_airbnb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const mockRefreshToken = `mock_refresh_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const expiresAt = new Date(Date.now() + 30 * 86400000); // 30 days

    const oauthToken = await db.airbnbOAuthToken.create({
      data: {
        tenantId,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        tokenType: 'Bearer',
        expiresIn: 30 * 86400, // seconds
        scope: 'listings_read,reservations_read,guests_read',
        isMock: true,
        expiresAt,
      },
    });

    // ── Import 3 mock properties ─────────────────────────────────
    const importedProperties = await Promise.all(
      MOCK_PROPERTIES.map((prop) =>
        db.airBProperty.create({
          data: {
            tenantId,
            airbnbId: `mock_${Math.random().toString(36).slice(2, 10)}`,
            airbnbUrl: `https://www.airbnb.com.br/rooms/mock_${Math.random().toString(36).slice(2, 8)}`,
            name: prop.name,
            propertyType: prop.propertyType,
            city: prop.city,
            state: prop.state,
            neighborhood: prop.neighborhood,
            bedrooms: prop.bedrooms,
            bathrooms: prop.bathrooms,
            maxGuests: prop.maxGuests,
            pricePerNight: prop.pricePerNight,
            currency: 'BRL',
            status: 'active',
            scrapedAt: new Date(),
            scrapingSource: 'mock_oauth',
          },
        })
      )
    );

    // Strip sensitive token fields from the response
    const { accessToken: _at, refreshToken: _rt, ...safeOauthToken } = oauthToken;

    return NextResponse.json({
      success: true,
      data: {
        oauthToken: safeOauthToken,
        importedProperties,
        importedCount: importedProperties.length,
      },
    });
  } catch (error) {
    console.error('[ZCC Airbnb OAuth] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
