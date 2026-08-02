// =============================================================================
// 🔐 SEU ZÉLLA — Orquestrador de Fechaduras Eletrônicas
// =============================================================================
// Camada intermediária entre a UI/API e os providers concretos (TTLock, Tuya,
// Igloohome, Nuki, August, ou fallback manual).
//
// Responsabilidade:
// 1. Receber pedido de geração/revogação de PIN
// 2. Decidir rota: API oficial vs manual
// 3. Delegar ao provider correto
// 4. Em caso de falha da API, cair graciosamente no modo manual
// 5. Auditar tudo via LockEvent
//
// IMPORTANTE: Este módulo é server-only. Não importar em código client.
// =============================================================================


import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import {
  type LockBrand,
  type LockDeviceData,
  type LockCodeData,
  type GeneratePinInput,
  type GeneratePinResult,
  BRAND_CATALOG,
  getBrandInfo,
} from './types';
import { derivePinStatus } from './pin-generator';
import { deliverPinViaWhatsApp } from './whatsapp-delivery';

// Lazy import para evitar carregar todos os providers em memória se não precisar
type ProviderModule = typeof import('./providers/manual');

/** Mapa de providers carregados sob demanda. */
const _providerCache: Partial<Record<string, ProviderModule>> = {};

async function loadProvider(brand: LockBrand): Promise<ProviderModule | null> {
  if (_providerCache[brand]) return _providerCache[brand]!;

  try {
    const info = getBrandInfo(brand);
    if (!info || !info.apiAvailable) {
      // Sempre cai no manual para marcas sem API
      const mod = await import('./providers/manual');
      _providerCache[brand] = mod as unknown as ProviderModule;
      return mod as unknown as ProviderModule;
    }

    // Marcas com API — carrega o adapter específico
    // Por ora, todos retornam o manual porque ainda não temos credenciais OAuth
    // configuradas em produção. Quando TTLOCK_CLIENT_ID etc. estiverem no .env,
    // o import dinâmico abaixo passa a funcionar.
    const envKey = `${brand.toUpperCase()}_CLIENT_ID`;
    if (!process.env[envKey]) {
      // Sem credenciais → cai no manual
      const mod = await import('./providers/manual');
      _providerCache[brand] = mod as unknown as ProviderModule;
      return mod as unknown as ProviderModule;
    }

    // Caminho futuro: carregar adapter oficial
    // const mod = await import(`./providers/${brand}`);
    const mod = await import('./providers/manual');
    _providerCache[brand] = mod as unknown as ProviderModule;
    return mod as unknown as ProviderModule;
  } catch (err) {
    console.error(`[locks] Failed to load provider for ${brand}:`, err);
    // Fallback final — sempre manual
    const mod = await import('./providers/manual');
    _providerCache[brand] = mod as unknown as ProviderModule;
    return mod as unknown as ProviderModule;
  }
}

/** Cria um novo dispositivo de fechadura. */
export async function createLockDevice(
  input: {
    propertyId: string;
    propertyType: 'pousada' | 'airbnb';
    nickname: string;
    location?: string;
    brand: LockBrand;
    model?: string;
    providerType?: 'api' | 'manual';
    serialNumber?: string;
    externalDeviceId?: string;
    oauthAccountId?: string;
    notes?: string;
  },
): Promise<LockDeviceData | null> {
  const tenantId = await resolveTenantId();
  if (!tenantId) throw new Error('Unauthorized');

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    // Demo mode — retorna objeto fake com ID gerado
    return {
      id: `demo-lock-${Date.now()}`,
      tenantId,
      propertyId: input.propertyId,
      propertyType: input.propertyType,
      nickname: input.nickname,
      location: input.location ?? null,
      brand: input.brand,
      model: input.model ?? null,
      providerType: input.providerType ?? (BRAND_CATALOG[input.brand]?.apiAvailable ? 'api' : 'manual'),
      externalDeviceId: input.externalDeviceId ?? null,
      oauthAccountId: input.oauthAccountId ?? null,
      serialNumber: input.serialNumber ?? null,
      status: 'active',
      batteryLevel: null,
      online: false,
      lastSeenAt: null,
      metadata: {},
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _count: { codes: 0, activeCodes: 0 },
    };
  }

  const info = getBrandInfo(input.brand);
  if (!info) throw new Error(`Unknown brand: ${input.brand}`);

  const providerType = input.providerType ?? (info.apiAvailable ? 'api' : 'manual');

  const device = await db.lockDevice.create({
    data: {
      tenantId,
      propertyId: input.propertyId,
      propertyType: input.propertyType,
      nickname: input.nickname,
      location: input.location ?? null,
      brand: input.brand,
      model: input.model ?? null,
      providerType,
      externalDeviceId: input.externalDeviceId ?? null,
      oauthAccountId: input.oauthAccountId ?? null,
      serialNumber: input.serialNumber ?? null,
      notes: input.notes ?? null,
      status: 'active',
    },
  });

  // Auditoria
  await db.lockEvent.create({
    data: {
      deviceId: device.id,
      tenantId,
      eventType: 'status_change',
      message: `Dispositivo "${input.nickname}" (${info.label}) cadastrado`,
      metadata: JSON.stringify({ brand: input.brand, providerType }),
    },
  });

  return device as unknown as LockDeviceData;
}

/** Lista todos os dispositivos de um tenant. */
export async function listLockDevices(propertyId?: string): Promise<LockDeviceData[]> {
  const tenantId = await resolveTenantId();
  if (!tenantId) return [];

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    return getDemoDevices();
  }

  const where: Record<string, any> = { tenantId };
  if (propertyId) where.propertyId = propertyId;

  const devices = await db.lockDevice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { codes: true } },
    },
  });

  // Para cada dispositivo, conta PINs ativos
  const now = new Date();
  const result: LockDeviceData[] = [];
  for (const d of devices) {
    const activeCodes = await db.lockCode.count({
      where: {
        deviceId: d.id,
        validFrom: { lte: now },
        validTo: { gte: now },
        revokedAt: null,
      },
    });
    result.push({
      ...(d as unknown as LockDeviceData),
      _count: { codes: (d as any)._count?.codes ?? 0, activeCodes },
    });
  }
  return result;
}

/** Obtém um dispositivo pelo ID (com verificação de propriedade). */
export async function getLockDevice(deviceId: string): Promise<LockDeviceData | null> {
  const tenantId = await resolveTenantId();
  if (!tenantId) return null;

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    return getDemoDevices().find((d) => d.id === deviceId) ?? null;
  }

  const device = await db.lockDevice.findFirst({
    where: { id: deviceId, tenantId },
  });
  return device as unknown as LockDeviceData | null;
}

/** Atualiza um dispositivo. */
export async function updateLockDevice(
  deviceId: string,
  updates: Partial<Pick<LockDeviceData, 'nickname' | 'location' | 'notes' | 'status' | 'model'>>,
): Promise<LockDeviceData | null> {
  const tenantId = await resolveTenantId();
  if (!tenantId) throw new Error('Unauthorized');

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) return null;

  const updateData: Record<string, any> = {};
  if (updates.nickname !== undefined) updateData.nickname = updates.nickname;
  if (updates.location !== undefined) updateData.location = updates.location;
  if (updates.notes !== undefined) updateData.notes = updates.notes;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.model !== undefined) updateData.model = updates.model;

  const updated = await db.lockDevice.update({
    where: { id: deviceId },
    data: updateData,
  });

  await db.lockEvent.create({
    data: {
      deviceId,
      tenantId,
      eventType: 'status_change',
      message: `Dispositivo atualizado`,
      metadata: JSON.stringify({ updates: updateData }),
    },
  });

  return updated as unknown as LockDeviceData;
}

/** Remove um dispositivo (com revogação de todos os PINs ativos). */
export async function deleteLockDevice(deviceId: string): Promise<boolean> {
  const tenantId = await resolveTenantId();
  if (!tenantId) throw new Error('Unauthorized');

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) return true;

  // Revoga todos os PINs ativos primeiro
  await db.lockCode.updateMany({
    where: {
      deviceId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokedReason: 'Dispositivo removido',
      status: 'revoked',
    },
  });

  await db.lockEvent.create({
    data: {
      deviceId,
      tenantId,
      eventType: 'status_change',
      message: `Dispositivo removido — todos os PINs foram revogados`,
    },
  });

  await db.lockDevice.delete({ where: { id: deviceId } });
  return true;
}

/**
 * Gera um novo PIN para um dispositivo.
 *
 * Fluxo:
 * 1. Carrega o dispositivo
 * 2. Decide provider (API vs manual)
 * 3. Se manual: gera PIN criptográfico OU usa PIN colado pelo host
 * 4. Se API: chama o adapter específico
 * 5. Persiste PIN no DB
 * 6. Dispara entrega via WhatsApp (se guestPhone fornecido)
 * 7. Registra auditoria
 */
export async function generatePin(input: GeneratePinInput): Promise<GeneratePinResult> {
  const tenantId = await resolveTenantId();
  if (!tenantId) throw new Error('Unauthorized');

  const device = await getLockDevice(input.deviceId);
  if (!device) throw new Error('Dispositivo não encontrado');

  const dbAvailable = await isDatabaseAvailable();

  // Carrega o provider apropriado
  const provider = await loadProvider(device.brand);
  if (!provider) {
    throw new Error(`Não foi possível carregar o provider para a marca ${device.brand}`);
  }

  // Gera o PIN via provider
  const providerResult = await provider.generatePin({
    deviceId: device.id,
    brand: device.brand,
    providerType: device.providerType,
    externalDeviceId: device.externalDeviceId,
    oauthAccountId: device.oauthAccountId,
    validFrom: input.validFrom,
    validTo: input.validTo,
    manualPin: input.manualPin,
    autoGenerate: input.autoGenerate,
  });

  const codeStr = providerResult.pin;
  const source = providerResult.source;
  const codeType = providerResult.codeType;

  const status = derivePinStatus({
    validFrom: input.validFrom,
    validTo: input.validTo,
  });

  let codeId: string;
  if (dbAvailable) {
    const code = await db.lockCode.create({
      data: {
        deviceId: device.id,
        tenantId,
        guestName: input.guestName ?? null,
        guestPhone: input.guestPhone ?? null,
        bookingId: input.bookingId ?? null,
        code: codeStr,
        codeType,
        source,
        validFrom: input.validFrom,
        validTo: input.validTo,
        status,
        note: input.note ?? null,
      },
    });
    codeId = code.id;

    await db.lockEvent.create({
      data: {
        deviceId: device.id,
        codeId,
        tenantId,
        eventType: 'generated',
        message: `PIN ${source === 'api' ? 'gerado via API' : 'gerado manualmente'} para ${input.guestName ?? 'hóspede'}`,
        metadata: JSON.stringify({
          validFrom: input.validFrom.toISOString(),
          validTo: input.validTo.toISOString(),
          codeType,
          source,
        }),
      },
    });
  } else {
    codeId = `demo-pin-${Date.now()}`;
  }

  // Tenta entregar via WhatsApp
  let delivered = false;
  let deliveryMethod: 'whatsapp' | 'email' | 'copy' | 'none' = 'none';
  const warnings: string[] = [];

  if (input.guestPhone) {
    try {
      const result = await deliverPinViaWhatsApp({
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        pin: codeStr,
        validFrom: input.validFrom,
        validTo: input.validTo,
        deviceNickname: device.nickname,
        brand: device.brand,
      });
      delivered = result.sent;
      deliveryMethod = 'whatsapp';

      if (!result.sent) {
        warnings.push(`WhatsApp não enviado: ${result.reason}`);
      } else if (dbAvailable) {
        await db.lockCode.update({
          where: { id: codeId },
          data: {
            deliveredVia: 'whatsapp',
            deliveredAt: new Date(),
          },
        });
        await db.lockEvent.create({
          data: {
            deviceId: device.id,
            codeId,
            tenantId,
            eventType: 'delivered',
            message: `PIN enviado via WhatsApp para ${input.guestName ?? input.guestPhone}`,
            metadata: JSON.stringify({ method: 'whatsapp' }),
          },
        });
      }
    } catch (err) {
      warnings.push(`Erro ao enviar WhatsApp: ${(err as Error).message}`);
    }
  } else {
    warnings.push('Hóspede sem telefone — PIN disponível apenas para copiar');
  }

  // Monta o resultado
  const codeData: LockCodeData = {
    id: codeId,
    deviceId: device.id,
    tenantId,
    guestName: input.guestName ?? null,
    guestPhone: input.guestPhone ?? null,
    bookingId: input.bookingId ?? null,
    code: codeStr,
    codeType,
    source,
    validFrom: input.validFrom.toISOString(),
    validTo: input.validTo.toISOString(),
    usedAt: null,
    revokedAt: null,
    revokedReason: null,
    deliveredVia: deliveryMethod,
    deliveredAt: delivered ? new Date().toISOString() : null,
    status,
    note: input.note ?? null,
    createdAt: new Date().toISOString(),
    device: {
      id: device.id,
      nickname: device.nickname,
      brand: device.brand,
      propertyType: device.propertyType,
      propertyId: device.propertyId,
    },
  };

  return {
    code: codeData,
    delivered,
    deliveryMethod,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/** Lista os PINs de um dispositivo. */
export async function listPins(deviceId: string): Promise<LockCodeData[]> {
  const tenantId = await resolveTenantId();
  if (!tenantId) return [];

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) return getDemoPins(deviceId);

  const pins = await db.lockCode.findMany({
    where: { deviceId, tenantId },
    orderBy: { createdAt: 'desc' },
    include: { device: { select: { id: true, nickname: true, brand: true, propertyType: true, propertyId: true } } },
  });

  // Re-deriva status (DB pode estar desatualizado)
  const now = new Date();
  return pins.map((p: any) => {
    const derivedStatus = derivePinStatus({
      validFrom: new Date(p.validFrom),
      validTo: new Date(p.validTo),
      usedAt: p.usedAt,
      revokedAt: p.revokedAt,
    });
    return {
      ...(p as any),
      status: derivedStatus,
    } as LockCodeData;
  });
}

/** Revoga um PIN específico. */
export async function revokePin(pinId: string, reason: string): Promise<boolean> {
  const tenantId = await resolveTenantId();
  if (!tenantId) throw new Error('Unauthorized');

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) return true;

  const pin = await db.lockCode.findFirst({
    where: { id: pinId, tenantId },
  });
  if (!pin) return false;

  await db.lockCode.update({
    where: { id: pinId },
    data: {
      revokedAt: new Date(),
      revokedReason: reason,
      status: 'revoked',
    },
  });

  await db.lockEvent.create({
    data: {
      deviceId: pin.deviceId,
      codeId: pinId,
      tenantId,
      eventType: 'revoked',
      message: `PIN revogado: ${reason}`,
      metadata: JSON.stringify({ reason }),
    },
  });

  return true;
}

/**
 * PÂNICO: Revoga TODOS os PINs ativos de um dispositivo.
 *
 * Use caso: hóspede relata vazamento de PIN, host suspeita de invasão,
 * ou qualquer emergência onde é mais seguro cortar tudo e reemitir.
 */
export async function panicRevokeAllPins(deviceId: string, reason: string = 'Pânico acionado pelo host'): Promise<{
  revokedCount: number;
}> {
  const tenantId = await resolveTenantId();
  if (!tenantId) throw new Error('Unauthorized');

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) return { revokedCount: 0 };

  const result = await db.lockCode.updateMany({
    where: {
      deviceId,
      tenantId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokedReason: reason,
      status: 'revoked',
    },
  });

  await db.lockEvent.create({
    data: {
      deviceId,
      tenantId,
      eventType: 'panic_revoke',
      message: `PÂNICO: ${result.count} PIN(s) revogado(s) — ${reason}`,
      metadata: JSON.stringify({ reason, count: result.count }),
    },
  });

  return { revokedCount: result.count };
}

/** Lista eventos de auditoria (LGPD). */
export async function listLockEvents(
  deviceId?: string,
  limit: number = 50,
): Promise<Array<{
  id: string;
  deviceId: string;
  codeId: string | null;
  eventType: string;
  message: string | null;
  createdAt: string;
}>> {
  const tenantId = await resolveTenantId();
  if (!tenantId) return [];

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) return [];

  const where: Record<string, any> = { tenantId };
  if (deviceId) where.deviceId = deviceId;

  const events = await db.lockEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return events.map((e: any) => ({
    id: e.id,
    deviceId: e.deviceId,
    codeId: e.codeId ?? null,
    eventType: e.eventType,
    message: e.message ?? null,
    createdAt: e.createdAt.toISOString(),
  }));
}

// =============================================================================
// Dados demo (quando DB não está disponível — modo Vercel serverless)
// =============================================================================

function getDemoDevices(): LockDeviceData[] {
  return [
    {
      id: 'demo-lock-1',
      tenantId: 'demo',
      propertyId: 'demo-prop-1',
      propertyType: 'pousada',
      nickname: 'Suíte Master 104',
      location: 'Porta frontal',
      brand: 'ttlock',
      model: 'TTLock X15',
      providerType: 'api',
      externalDeviceId: null,
      oauthAccountId: null,
      serialNumber: 'TTL2024X15-001',
      status: 'active',
      batteryLevel: 87,
      online: true,
      lastSeenAt: new Date(Date.now() - 3600000).toISOString(),
      metadata: {},
      notes: 'Fechadura principal da suíte premium',
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      _count: { codes: 12, activeCodes: 2 },
    },
    {
      id: 'demo-lock-2',
      tenantId: 'demo',
      propertyId: 'demo-prop-1',
      propertyType: 'pousada',
      nickname: 'Suíte Standby 102',
      location: 'Porta frontal',
      brand: 'intelbras',
      model: 'Intelbras FR 1100',
      providerType: 'manual',
      externalDeviceId: null,
      oauthAccountId: null,
      serialNumber: 'INT2024FR1100-002',
      status: 'active',
      batteryLevel: 92,
      online: false,
      lastSeenAt: new Date(Date.now() - 86400000).toISOString(),
      metadata: {},
      notes: 'Fechadura manual — host cola PIN do app Intelbras',
      createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      _count: { codes: 8, activeCodes: 1 },
    },
    {
      id: 'demo-lock-3',
      tenantId: 'demo',
      propertyId: 'demo-prop-1',
      propertyType: 'pousada',
      nickname: 'Portão Lateral',
      location: 'Acesso externo',
      brand: 'igloohome',
      model: 'Igloohome Deadbolt 2S',
      providerType: 'api',
      externalDeviceId: null,
      oauthAccountId: null,
      serialNumber: 'IGL2024DB2S-003',
      status: 'active',
      batteryLevel: 65,
      online: true,
      lastSeenAt: new Date(Date.now() - 7200000).toISOString(),
      metadata: {},
      notes: 'Único PIN offline real do mercado',
      createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
      _count: { codes: 5, activeCodes: 1 },
    },
  ];
}

function getDemoPins(deviceId: string): LockCodeData[] {
  const now = Date.now();
  const day = 86400000;
  return [
    {
      id: `demo-pin-${deviceId}-1`,
      deviceId,
      tenantId: 'demo',
      guestName: 'João Silva',
      guestPhone: '+5511999990001',
      bookingId: 'BK-001',
      code: '4821#',
      codeType: 'online_pin',
      source: 'api',
      validFrom: new Date(now - 3600000).toISOString(),
      validTo: new Date(now + day).toISOString(),
      usedAt: null,
      revokedAt: null,
      revokedReason: null,
      deliveredVia: 'whatsapp',
      deliveredAt: new Date(now - 7200000).toISOString(),
      status: 'active',
      note: 'Check-in 14h / Check-out 11h',
      createdAt: new Date(now - 7200000).toISOString(),
    },
    {
      id: `demo-pin-${deviceId}-2`,
      deviceId,
      tenantId: 'demo',
      guestName: 'Maria Souza',
      guestPhone: '+5511999990002',
      bookingId: 'BK-002',
      code: '7729',
      codeType: 'manual',
      source: 'manual',
      validFrom: new Date(now + 3600000).toISOString(),
      validTo: new Date(now + day * 2).toISOString(),
      usedAt: null,
      revokedAt: null,
      revokedReason: null,
      deliveredVia: 'whatsapp',
      deliveredAt: new Date(now - 3600000).toISOString(),
      status: 'scheduled',
      note: 'Check-in amanhã 14h',
      createdAt: new Date(now - 3600000).toISOString(),
    },
    {
      id: `demo-pin-${deviceId}-3`,
      deviceId,
      tenantId: 'demo',
      guestName: 'Carlos Lima',
      guestPhone: '+5511999990003',
      bookingId: 'BK-003',
      code: '1193#',
      codeType: 'online_pin',
      source: 'api',
      validFrom: new Date(now - day * 2).toISOString(),
      validTo: new Date(now - day).toISOString(),
      usedAt: new Date(now - day * 1.5).toISOString(),
      revokedAt: null,
      revokedReason: null,
      deliveredVia: 'whatsapp',
      deliveredAt: new Date(now - day * 2).toISOString(),
      status: 'used',
      note: 'Hóspede já fez check-out',
      createdAt: new Date(now - day * 2).toISOString(),
    },
  ];
}
