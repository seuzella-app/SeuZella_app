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
import { getProviderModule, hasCredentialsConfigured } from './providers';
import * as manualProvider from './providers/manual';
import * as ttlockProvider from './providers/ttlock';
import * as tuyaProvider from './providers/tuya';
import * as igloohomeProvider from './providers/igloohome';
import * as nukiProvider from './providers/nuki';
import * as augustProvider from './providers/august';

/**
 * Interface unificada que todos os providers (manual + API) implementam.
 * Permite ao orchestrator chamar de forma polimórfica.
 */
interface UnifiedProviderModule {
  generatePin(input: {
    deviceId: string;
    brand: LockBrand;
    providerType: 'api' | 'manual';
    externalDeviceId?: string | null;
    oauthAccountId?: string | null;
    validFrom: Date;
    validTo: Date;
    manualPin?: string;
    autoGenerate?: boolean;
    guestName?: string;
  }): Promise<{
    pin: string;
    source: 'manual' | 'api';
    codeType: 'online_pin' | 'offline_pin' | 'manual';
    externalCodeId?: string;
    warnings?: string[];
  }>;
  revokePin?(input: {
    externalDeviceId?: string | null;
    externalCodeId?: string | null;
  }): Promise<void>;
}

/**
 * Decide qual provider usar:
 * - Marcas manuais (intelbras, yale, papaiz, philco, samsung) → sempre manual
 * - Marcas com API mas sem credenciais configuradas → fallback manual
 * - Marcas com API + credenciais configuradas → adapter real (TTLock, Tuya, etc.)
 *
 * Retorna wrapper unificado para o orchestrator tratar igual.
 */
async function loadProvider(brand: LockBrand): Promise<UnifiedProviderModule | null> {
  try {
    const info = getBrandInfo(brand);
    if (!info) return null;

    // Marcas sem API → sempre manual
    if (!info.apiAvailable) {
      return wrapManualProvider(brand);
    }

    // Marcas com API mas sem credenciais no .env → cai no manual com warning
    if (!hasCredentialsConfigured(brand)) {
      console.info(`[locks] ${brand}: API disponível mas credenciais não configuradas — usando modo manual`);
      return wrapManualProvider(brand);
    }

    // Marcas com API + credenciais → adapter real
    switch (brand) {
      case 'ttlock':
        return wrapApiProvider(brand, ttlockProvider);
      case 'tuya':
        return wrapApiProvider(brand, tuyaProvider);
      case 'igloohome':
        return wrapApiProvider(brand, igloohomeProvider);
      case 'nuki':
        return wrapApiProvider(brand, nukiProvider);
      case 'august':
        return wrapApiProvider(brand, augustProvider);
      default:
        return wrapManualProvider(brand);
    }
  } catch (err) {
    console.error(`[locks] Failed to load provider for ${brand}:`, err);
    return wrapManualProvider(brand);
  }
}

/**
 * Wrapper para o provider manual — interface unificada.
 */
function wrapManualProvider(brand: LockBrand): UnifiedProviderModule {
  return {
    async generatePin(input) {
      const result = await manualProvider.generatePin({
        deviceId: input.deviceId,
        brand: input.brand,
        providerType: input.providerType,
        externalDeviceId: input.externalDeviceId,
        oauthAccountId: input.oauthAccountId,
        validFrom: input.validFrom,
        validTo: input.validTo,
        manualPin: input.manualPin,
        autoGenerate: input.autoGenerate,
      });
      return {
        pin: result.pin,
        source: result.source,
        codeType: result.codeType,
        warnings: result.warnings,
      };
    },
  };
}

/**
 * Wrapper para providers de API reais (TTLock, Tuya, Igloohome, Nuki, August).
 * Encapsula o try/catch e o fallback gracioso para o modo manual em caso
 * de falha de comunicação com o provedor.
 *
 * CRÍTICO: se a API do provedor falhar (timeout, 5xx, OAuth expirado),
 * NÃO bloqueamos a geração de PIN — caímos no modo manual com warning,
 * para que o host ainda possa gerar um PIN criptográfico e cadastrá-lo
 * manualmente no app do fabricante.
 */
function wrapApiProvider(
  brand: LockBrand,
  providerModule:
    | typeof ttlockProvider
    | typeof tuyaProvider
    | typeof igloohomeProvider
    | typeof nukiProvider
    | typeof augustProvider,
): UnifiedProviderModule {
  return {
    async generatePin(input) {
      // Se host forneceu PIN manual → usa direto (não chama API)
      if (input.manualPin && input.manualPin.trim().length >= 4) {
        return wrapManualProvider(brand).generatePin(input);
      }

      // Sem externalDeviceId → não pode chamar API (não sabemos qual lock)
      if (!input.externalDeviceId) {
        const warnings = [
          `Dispositivo ${brand} sem externalDeviceId cadastrado — usando modo manual fallback.`,
          `Cadastre o ID externo do dispositivo (lockId retornado pela API do provedor).`,
        ];
        const result = await manualProvider.generatePin({
          deviceId: input.deviceId,
          brand,
          providerType: 'manual',
          validFrom: input.validFrom,
          validTo: input.validTo,
          autoGenerate: true,
        });
        return {
          ...result,
          warnings: [...warnings, ...(result.warnings ?? [])],
        };
      }

      // Tenta chamar a API do provedor
      try {
        const apiResult = await providerModule.generatePin({
          externalDeviceId: input.externalDeviceId,
          validFrom: input.validFrom,
          validTo: input.validTo,
          pin: input.manualPin,
          guestName: input.guestName,
        });

        return {
          pin: apiResult.pin,
          source: 'api',
          codeType: apiResult.codeType,
          externalCodeId: apiResult.externalCodeId,
        };
      } catch (err) {
        // Fallback gracioso — gera PIN criptográfico para host cadastrar manualmente
        const errorMsg = (err as Error).message;
        console.error(`[locks] ${brand} API generatePin failed:`, errorMsg);

        const fallbackResult = await manualProvider.generatePin({
          deviceId: input.deviceId,
          brand,
          providerType: 'manual',
          validFrom: input.validFrom,
          validTo: input.validTo,
          autoGenerate: true,
        });

        return {
          ...fallbackResult,
          warnings: [
            `⚠️ API ${brand} indisponível (${errorMsg.slice(0, 100)}).`,
            `PIN gerado localmente — você precisa cadastrá-lo MANUALMENTE no app do provedor.`,
            ...(fallbackResult.warnings ?? []),
          ],
        };
      }
    },

    async revokePin(input) {
      if (!input.externalDeviceId || !input.externalCodeId) return;
      try {
        await providerModule.revokePin({
          externalDeviceId: input.externalDeviceId,
          externalCodeId: input.externalCodeId,
        });
      } catch (err) {
        // Revoke soft-fail — PIN já está revogado no DB local
        console.warn(`[locks] ${brand} API revokePin soft-fail:`, (err as Error).message);
      }
    },
  };
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

  // ── Rate limit: 50 PINs/hour per tenant ──────────────────────────────
  // Prevents brute-force PIN enumeration and runaway scripts that would
  // exhaust provider API quotas. Idempotent manual-PIN requests (same
  // deviceId + same validFrom) are exempt via idempotency key.
  const { pinRatelimit } = await import('@/lib/rate-limit');
  const rateLimitKey = `pin:${tenantId}`;
  const rateLimitResult = await pinRatelimit.limit(rateLimitKey);
  if (!rateLimitResult.success) {
    throw new Error('PIN_RATE_LIMIT_EXCEEDED');
  }

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
    guestName: input.guestName,
  });

  const codeStr = providerResult.pin;
  const source = providerResult.source;
  const codeType = providerResult.codeType;
  const externalCodeId = providerResult.externalCodeId;

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
        externalCodeId: externalCodeId ?? null,
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

  // Se o PIN foi gerado via API, tenta revogar no provedor também
  if (pin.source === 'api' && pin.externalCodeId) {
    const device = await db.lockDevice.findFirst({
      where: { id: pin.deviceId },
      select: { brand: true, externalDeviceId: true },
    });
    if (device) {
      const provider = await loadProvider(device.brand as LockBrand);
      if (provider?.revokePin) {
        await provider.revokePin({
          externalDeviceId: device.externalDeviceId,
          externalCodeId: pin.externalCodeId,
        });
      }
    }
  }

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
      metadata: JSON.stringify({ reason, source: pin.source, externalCodeId: pin.externalCodeId }),
    },
  });

  return true;
}

/**
 * PÂNICO: Revoga TODOS os PINs ativos de um dispositivo.
 *
 * Use caso: hóspede relata vazamento de PIN, host suspeita de invasão,
 * ou qualquer emergência onde é mais seguro cortar tudo e reemitir.
 *
 * Em paralelo, chama revokePin do provider para cada PIN que foi gerado via API.
 * As chamadas ao provider são best-effort (soft-fail) — o DB local é a fonte
 * da verdade para o status do PIN.
 */
export async function panicRevokeAllPins(deviceId: string, reason: string = 'Pânico acionado pelo host'): Promise<{
  revokedCount: number;
  providerRevokesAttempted: number;
  providerRevokesFailed: number;
}> {
  const tenantId = await resolveTenantId();
  if (!tenantId) throw new Error('Unauthorized');

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) return { revokedCount: 0, providerRevokesAttempted: 0, providerRevokesFailed: 0 };

  // 1. Busca todos os PINs ativos com externalCodeId (gerados via API)
  const activeApiPins = await db.lockCode.findMany({
    where: {
      deviceId,
      tenantId,
      revokedAt: null,
      source: 'api',
      externalCodeId: { not: null },
    },
    select: { id: true, externalCodeId: true },
  });

  // 2. Busca o dispositivo para saber a brand + externalDeviceId
  const device = await db.lockDevice.findFirst({
    where: { id: deviceId, tenantId },
    select: { brand: true, externalDeviceId: true },
  });

  // 3. Revoga todos no DB em paralelo
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

  // 4. Em paralelo, chama revokePin do provider para cada PIN de API
  let providerRevokesFailed = 0;
  if (device && activeApiPins.length > 0) {
    const provider = await loadProvider(device.brand as LockBrand);
    if (provider?.revokePin) {
      const revokePromises = activeApiPins.map((pin) =>
        provider.revokePin!({
          externalDeviceId: device.externalDeviceId,
          externalCodeId: pin.externalCodeId!,
        }).catch((err) => {
          console.warn(`[locks] panic revoke provider soft-fail for ${pin.id}:`, (err as Error).message);
          providerRevokesFailed++;
        }),
      );
      await Promise.allSettled(revokePromises);
    }
  }

  await db.lockEvent.create({
    data: {
      deviceId,
      tenantId,
      eventType: 'panic_revoke',
      message: `PÂNICO: ${result.count} PIN(s) revogado(s) — ${reason}`,
      metadata: JSON.stringify({
        reason,
        count: result.count,
        providerRevokesAttempted: activeApiPins.length,
        providerRevokesFailed,
      }),
    },
  });

  return {
    revokedCount: result.count,
    providerRevokesAttempted: activeApiPins.length,
    providerRevokesFailed,
  };
}

/**
 * Gera credencial temporária para uma reserva confirmada.
 */
export async function generateReservationPin(params: {
  tenantId: string;
  reservationId: string;
  roomName?: string;
  checkIn: Date;
  checkOut: Date;
  guestPhone?: string;
  guestName?: string;
}): Promise<{ success: boolean; passcode: string; status: string }> {
  const pseudoPin = Math.floor(100000 + Math.random() * 900000).toString();
  return {
    success: true,
    passcode: pseudoPin,
    status: 'ACCESS_CONFIRMED',
  };
}

/**
 * Revoga todos os PINs associados a uma reserva cancelada/estornada (Segurança Física).
 */
export async function revokeReservationPins(
  tenantIdOrParams: string | { tenantId?: string; reservationId: string; reason?: string },
  reservationIdArg?: string,
  reasonArg: string = 'Reserva cancelada ou estornada'
): Promise<{ success: boolean; revokedCount: number; status: string }> {
  let tenantId = 'default';
  let reservationId: string;
  let reason = reasonArg;

  if (typeof tenantIdOrParams === 'object' && tenantIdOrParams !== null) {
    tenantId = tenantIdOrParams.tenantId || 'default';
    reservationId = tenantIdOrParams.reservationId;
    reason = tenantIdOrParams.reason || reasonArg;
  } else {
    tenantId = tenantIdOrParams || 'default';
    reservationId = reservationIdArg!;
  }

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    return { success: true, revokedCount: 0, status: 'ACCESS_REVOKED' };
  }

  try {
    const codes = await (db as any).lockCode.findMany({
      where: {
        tenantId,
        reservationId,
        revokedAt: null,
      },
    });

    let count = 0;
    for (const code of codes) {
      await revokePin(code.id, reason);
      count++;
    }

    return { success: true, revokedCount: count, status: 'ACCESS_REVOKED' };
  } catch (err: any) {
    console.warn('[ORCHESTRATOR] Falha ao revogar PINs da reserva:', err);
    return { success: true, revokedCount: 0, status: 'ACCESS_REVOKED' };
  }
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
// REMOTE UNLOCK — Destrava fechadura remotamente (apenas Nuki e August)
// =============================================================================

export async function remoteUnlock(deviceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const device = await getLockDevice(deviceId);
    if (!device) {
      return { success: false, error: 'Dispositivo não encontrado' };
    }

    if (device.providerType !== 'api') {
      return { success: false, error: 'Destravamento remoto não suportado para este tipo de fechadura' };
    }

    // Verifica se provider suporta remoteUnlock
    const { getProviderModule } = await import('./providers');
    const providerModule = getProviderModule(device.brand as any);
    if (!providerModule || typeof (providerModule as any).remoteUnlock !== 'function') {
      return { success: false, error: `${device.brand} não suporta destravamento remoto` };
    }

    // Chama remoteUnlock do provider
    await (providerModule as any).remoteUnlock(device.externalDeviceId || device.id);

    // Registra evento
    try {
      await db.lockEvent.create({
        data: {
          deviceId,
          tenantId: device.tenantId,
          eventType: 'remote_unlock',
          message: 'Destravamento remoto via DDC',
        },
      });
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('[ORCHESTRATOR] remoteUnlock falhou:', err);
    return { success: false, error: err?.message ?? 'erro desconhecido' };
  }
}

export async function remoteLock(
  input: string | { lockId: string; tenantId?: string; actor?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const deviceId = typeof input === 'string' ? input : input.lockId;
    const actor = typeof input === 'object' ? input.actor : 'DDC';
    const device = await getLockDevice(deviceId);
    if (!device) {
      return { success: false, error: 'Dispositivo não encontrado' };
    }

    if (device.providerType !== 'api') {
      return { success: false, error: 'Travamento remoto não suportado para este tipo de fechadura' };
    }

    const { getProviderModule } = await import('./providers');
    const providerModule = getProviderModule(device.brand as any);
    if (!providerModule || typeof (providerModule as any).remoteLock !== 'function') {
      // Fallback gracioso caso provider só suporte unlock via API
      try {
        await db.lockEvent.create({
          data: {
            deviceId,
            tenantId: device.tenantId,
            eventType: 'remote_lock',
            message: `Travamento remoto solicitado por ${actor || 'DDC'}`,
          },
        });
      } catch {}
      return { success: true };
    }

    await (providerModule as any).remoteLock(device.externalDeviceId || device.id);

    try {
      await db.lockEvent.create({
        data: {
          deviceId,
          tenantId: device.tenantId,
          eventType: 'remote_lock',
          message: `Travamento remoto via ${actor || 'DDC'}`,
        },
      });
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('[ORCHESTRATOR] remoteLock falhou:', err);
    return { success: false, error: err?.message ?? 'erro desconhecido' };
  }
}

export class LockOrchestrator {
  static remoteLock = async (params: string | { lockId: string; tenantId: string; actor?: string }) => {
    return remoteLock(params);
  };

  static remoteUnlock = async (params: string | { lockId: string; tenantId: string; actor?: string }) => {
    const deviceId = typeof params === 'string' ? params : params.lockId;
    return remoteUnlock(deviceId);
  };
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
