import { NextRequest, NextResponse } from 'next/server';
import { listLockDevices, createLockDevice } from '@/lib/locks/orchestrator';
import { BRAND_CATALOG, type LockBrand } from '@/lib/locks/types';
import { getProviderCapabilities } from '@/lib/locks/provider-capabilities';
import { resolveTenantId } from '@/lib/ddc/auth-utils';

const MAX_BODY_BYTES = 16 * 1024;

export async function GET(request: NextRequest) {
  try {
    if (!(await resolveTenantId())) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    const propertyId = new URL(request.url).searchParams.get('propertyId') ?? undefined;
    if (propertyId && propertyId.length > 128) return NextResponse.json({ success: false, error: 'INVALID_PROPERTY_ID' }, { status: 400 });
    const devices = await listLockDevices(propertyId);
    return NextResponse.json({ success: true, data: devices }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[LOCKS] Error listing devices:', error);
    return NextResponse.json({ success: false, error: 'LOCK_DEVICE_LIST_FAILED' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await resolveTenantId())) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) return NextResponse.json({ success: false, error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ success: false, error: 'INVALID_JSON_BODY' }, { status: 400 }); }
    if (!body || typeof body !== 'object') return NextResponse.json({ success: false, error: 'INVALID_PAYLOAD' }, { status: 400 });

    const source = body as Record<string, unknown>;
    const propertyId = typeof source.propertyId === 'string' ? source.propertyId.trim() : '';
    const nickname = typeof source.nickname === 'string' ? source.nickname.trim() : '';
    const brand = typeof source.brand === 'string' ? source.brand.trim().toLowerCase() : '';
    const propertyType = source.propertyType === 'airbnb' ? 'airbnb' : 'pousada';

    if (!propertyId || propertyId.length > 128) return NextResponse.json({ success: false, error: 'INVALID_PROPERTY_ID' }, { status: 400 });
    if (!nickname || nickname.length > 120) return NextResponse.json({ success: false, error: 'INVALID_DEVICE_NICKNAME' }, { status: 400 });
    if (!(brand in BRAND_CATALOG)) return NextResponse.json({ success: false, error: 'UNSUPPORTED_LOCK_BRAND' }, { status: 400 });

    const lockBrand = brand as LockBrand;
    const capabilities = getProviderCapabilities(lockBrand);
    const requestedProviderType = source.providerType === 'manual' || source.providerType === 'api' ? source.providerType : capabilities.providerType;
    if (requestedProviderType !== capabilities.providerType) return NextResponse.json({ success: false, error: 'LOCK_PROVIDER_TYPE_MISMATCH' }, { status: 400 });

    const cleanOptional = (key: string, max: number) => {
      const value = source[key];
      if (value === undefined || value === null) return undefined;
      if (typeof value !== 'string' || value.trim().length > max) throw new Error(`INVALID_${key.toUpperCase()}`);
      return value.trim() || undefined;
    };

    const externalDeviceId = cleanOptional('externalDeviceId', 256);
    // API devices may be created before OAuth pairing. They become eligible for
    // provider commands only after the external device identifier is attached.
    if (externalDeviceId && !capabilities.requiresExternalDeviceId) {
      return NextResponse.json({ success: false, error: 'EXTERNAL_DEVICE_ID_NOT_SUPPORTED' }, { status: 400 });
    }

    const device = await createLockDevice({
      propertyId,
      propertyType,
      nickname,
      location: cleanOptional('location', 200),
      brand: lockBrand,
      model: cleanOptional('model', 120),
      providerType: requestedProviderType,
      serialNumber: cleanOptional('serialNumber', 120),
      externalDeviceId,
      oauthAccountId: cleanOptional('oauthAccountId', 256),
      notes: cleanOptional('notes', 500),
    });

    return NextResponse.json({ success: true, data: device }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[LOCKS] Error creating device:', error);
    return NextResponse.json({ success: false, error: 'LOCK_DEVICE_CREATE_FAILED' }, { status: 503 });
  }
}
