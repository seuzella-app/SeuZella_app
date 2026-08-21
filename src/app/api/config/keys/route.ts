import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encryptText } from '@/lib/encryption';
import { requireTenantId } from '@/lib/security/tenant-context';

const MAX_STRING = 2048;
const ALLOWED_PROVIDERS = new Set(['openai', 'gemini', 'anthropic', 'meta', 'whatsapp', 'asaas', 'mercadopago', 'custom']);

type SafeConfig = {
  id: string;
  tenantId: string;
  provider: string;
  model: string;
  baseUrl: string;
  isActive: boolean;
  usageLimit: number;
  usageCurrent: number;
  notes: string;
  configured: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function safeConfig(config: {
  id: string;
  tenantId: string;
  provider: string;
  model: string;
  baseUrl: string;
  isActive: boolean;
  usageLimit: number;
  usageCurrent: number;
  notes: string;
  apiKey: string;
  createdAt: Date;
  updatedAt: Date;
}): SafeConfig {
  return {
    id: config.id,
    tenantId: config.tenantId,
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    isActive: config.isActive,
    usageLimit: config.usageLimit,
    usageCurrent: config.usageCurrent,
    notes: config.notes,
    configured: Boolean(config.apiKey),
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

function validateProvider(provider: unknown): string {
  if (typeof provider !== 'string' || !ALLOWED_PROVIDERS.has(provider.toLowerCase())) {
    throw new Error('INVALID_PROVIDER');
  }
  return provider.toLowerCase();
}

function validateOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.length > MAX_STRING) throw new Error(`INVALID_${field.toUpperCase()}`);
  return value;
}

function unauthorizedOrServerError(error: unknown, operation: string) {
  if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  if (error instanceof Error && error.message.startsWith('INVALID_')) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  console.error(operation, error instanceof Error ? error.name : 'unknown_error');
  return NextResponse.json({ success: false, error: 'Não foi possível processar a solicitação' }, { status: 500 });
}

export async function GET() {
  try {
    const tenantId = await requireTenantId();
    const rawKeys = await db.apiConfig.findMany({
      where: { tenantId },
      orderBy: { provider: 'asc' },
    });
    return NextResponse.json({ success: true, data: rawKeys.map(safeConfig) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return unauthorizedOrServerError(error, '[CONFIG_KEYS_GET]');
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });

    const provider = validateProvider(body.provider);
    const apiKey = validateOptionalString(body.apiKey, 'apiKey');
    const apiSecret = validateOptionalString(body.apiSecret, 'apiSecret');
    const model = validateOptionalString(body.model, 'model') ?? '';
    const baseUrl = validateOptionalString(body.baseUrl, 'baseUrl') ?? '';
    const notes = validateOptionalString(body.notes, 'notes') ?? '';

    const key = await db.apiConfig.create({
      data: {
        tenantId,
        provider,
        apiKey: apiKey ? encryptText(apiKey) : '',
        apiSecret: apiSecret ? encryptText(apiSecret) : '',
        model,
        baseUrl,
        notes,
      },
    });

    return NextResponse.json({ success: true, data: safeConfig(key) }, { status: 201 });
  } catch (error) {
    return unauthorizedOrServerError(error, '[CONFIG_KEYS_POST]');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();
    const provider = validateProvider(body?.provider);
    const apiKey = validateOptionalString(body?.apiKey, 'apiKey');
    const model = validateOptionalString(body?.model, 'model') ?? '';
    const existing = await db.apiConfig.findFirst({ where: { provider, tenantId } });

    const updateData: Record<string, unknown> = { model };
    if (apiKey) updateData.apiKey = encryptText(apiKey);

    const saved = existing
      ? await db.apiConfig.update({ where: { id: existing.id }, data: updateData })
      : await db.apiConfig.create({ data: { tenantId, provider, apiKey: apiKey ? encryptText(apiKey) : '', model, isActive: true } });

    return NextResponse.json({ success: true, data: safeConfig(saved) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return unauthorizedOrServerError(error, '[CONFIG_KEYS_PUT]');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();
    const provider = validateProvider(body?.provider);
    if (typeof body?.isActive !== 'boolean') return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });

    const existing = await db.apiConfig.findFirst({ where: { provider, tenantId } });
    const saved = existing
      ? await db.apiConfig.update({ where: { id: existing.id }, data: { isActive: body.isActive } })
      : await db.apiConfig.create({ data: { provider, apiKey: '', isActive: body.isActive, tenantId } });

    return NextResponse.json({ success: true, data: safeConfig(saved) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return unauthorizedOrServerError(error, '[CONFIG_KEYS_PATCH]');
  }
}
