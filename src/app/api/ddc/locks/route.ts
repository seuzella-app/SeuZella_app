import { NextRequest, NextResponse } from 'next/server';
import {
  listLockDevices,
  createLockDevice,
} from '@/lib/locks/orchestrator';
import { BRAND_CATALOG, type LockBrand } from '@/lib/locks/types';
import { withApiGuard } from '@/lib/security/api-guard';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/ddc/locks — Lista dispositivos do tenant (opcionalmente por propertyId)
export async function GET(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId') ?? undefined;
    const devices = await listLockDevices(propertyId);
    return NextResponse.json({ success: true, data: devices });
  } catch (error) {
    console.error('[LOCKS] Error listing devices:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list lock devices' },
      { status: 500 },
    );
  }
}

// POST /api/ddc/locks — Cria novo dispositivo
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, propertyType, nickname, location, brand, model, providerType, serialNumber, externalDeviceId, oauthAccountId, notes } = body;

    if (!nickname || !nickname.trim()) {
      return NextResponse.json(
        { success: false, error: 'Apelido do dispositivo é obrigatório' },
        { status: 400 },
      );
    }
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'propertyId é obrigatório' },
        { status: 400 },
      );
    }
    if (!brand || !BRAND_CATALOG[brand as LockBrand]) {
      return NextResponse.json(
        { success: false, error: `Marca inválida. Marcas suportadas: ${Object.keys(BRAND_CATALOG).join(', ')}` },
        { status: 400 },
      );
    }

    const device = await createLockDevice({
      propertyId,
      propertyType: propertyType ?? 'pousada',
      nickname: nickname.trim(),
      location: location?.trim() || undefined,
      brand: brand as LockBrand,
      model: model?.trim() || undefined,
      providerType: providerType ?? (BRAND_CATALOG[brand as LockBrand].apiAvailable ? 'api' : 'manual'),
      serialNumber: serialNumber?.trim() || undefined,
      externalDeviceId: externalDeviceId?.trim() || undefined,
      oauthAccountId: oauthAccountId?.trim() || undefined,
      notes: notes?.trim() || undefined,
    });

    return NextResponse.json({ success: true, data: device }, { status: 201 });
  } catch (error) {
    console.error('[LOCKS] Error creating device:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to create lock device' },
      { status: 500 },
    );
  }
}
