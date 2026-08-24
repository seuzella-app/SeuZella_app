import { db, isDatabaseAvailable } from '@/lib/db';
import { getBrandInfo, type LockBrand, type LockCodeData } from './types';
import { derivePinStatus } from './pin-generator';
import { deliverPinViaWhatsApp } from './whatsapp-delivery';
import { getProviderModule, hasCredentialsConfigured } from './providers';
import * as manualProvider from './providers/manual';

interface GenerateReservationPinInput {
  tenantId: string;
  deviceId: string;
  reservationId: string;
  guestName: string;
  guestPhone?: string;
  validFrom: Date;
  validTo: Date;
}

export async function generateReservationPin(input: GenerateReservationPinInput): Promise<LockCodeData> {
  if (!(await isDatabaseAvailable())) throw new Error('DATABASE_UNAVAILABLE');

  const device = await db.lockDevice.findFirst({
    where: { id: input.deviceId, tenantId: input.tenantId, status: 'active' },
  });
  if (!device) throw new Error('LOCK_DEVICE_NOT_FOUND');

  const brand = device.brand as LockBrand;
  const info = getBrandInfo(brand);
  if (!info) throw new Error('LOCK_BRAND_NOT_SUPPORTED');

  let providerResult: {
    pin: string;
    source: 'manual' | 'api';
    codeType: 'online_pin' | 'offline_pin' | 'manual' | 'qrcode';
    externalCodeId?: string;
    warnings?: string[];
  };

  if (info.apiAvailable && hasCredentialsConfigured(brand) && device.externalDeviceId) {
    const provider = getProviderModule(brand);
    const module = provider?.module;
    if (!module || typeof module.generatePin !== 'function') {
      throw new Error('LOCK_PROVIDER_GENERATE_PIN_UNAVAILABLE');
    }

    try {
      const result = await module.generatePin({
        deviceId: device.id,
        brand,
        providerType: device.providerType as 'api' | 'manual',
        externalDeviceId: device.externalDeviceId,
        validFrom: input.validFrom,
        validTo: input.validTo,
        guestName: input.guestName,
      });
      providerResult = {
        pin: result.pin,
        source: 'api',
        codeType: result.codeType,
        externalCodeId: result.externalCodeId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LOCK_PROVIDER_GENERATE_FAILED';
      const manual = await manualProvider.generatePin({
        deviceId: device.id,
        brand,
        providerType: 'manual',
        validFrom: input.validFrom,
        validTo: input.validTo,
        autoGenerate: true,
      });
      providerResult = {
        pin: manual.pin,
        source: manual.source,
        codeType: manual.codeType,
        warnings: [
          `API ${brand} indisponível (${message.slice(0, 120)}).`,
          'PIN gerado localmente; cadastro manual no app do provedor pode ser necessário.',
          ...(manual.warnings ?? []),
        ],
      };
    }
  } else {
    const manual = await manualProvider.generatePin({
      deviceId: device.id,
      brand,
      providerType: 'manual',
      validFrom: input.validFrom,
      validTo: input.validTo,
      autoGenerate: true,
    });
    providerResult = {
      pin: manual.pin,
      source: manual.source,
      codeType: manual.codeType,
      warnings: manual.warnings,
    };
  }

  const status = derivePinStatus({ validFrom: input.validFrom, validTo: input.validTo });
  const code = await db.lockCode.create({
    data: {
      deviceId: device.id,
      tenantId: input.tenantId,
      guestName: input.guestName,
      guestPhone: input.guestPhone ?? null,
      bookingId: input.reservationId,
      code: providerResult.pin,
      codeType: providerResult.codeType,
      source: providerResult.source,
      validFrom: input.validFrom,
      validTo: input.validTo,
      status,
      externalCodeId: providerResult.externalCodeId ?? null,
      note: 'Generated after approved reservation payment',
    },
  });

  await db.lockEvent.create({
    data: {
      deviceId: device.id,
      codeId: code.id,
      tenantId: input.tenantId,
      eventType: 'generated',
      message: `PIN programado para reserva ${input.reservationId}`,
      metadata: JSON.stringify({
        reservationId: input.reservationId,
        source: providerResult.source,
        codeType: providerResult.codeType,
        validFrom: input.validFrom.toISOString(),
        validTo: input.validTo.toISOString(),
        warnings: providerResult.warnings ?? [],
      }),
    },
  });

  if (input.guestPhone) {
    try {
      const delivery = await deliverPinViaWhatsApp({
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        pin: providerResult.pin,
        validFrom: input.validFrom,
        validTo: input.validTo,
        deviceNickname: device.nickname,
        brand,
      });
      if (delivery.sent) {
        await db.lockCode.update({
          where: { id: code.id },
          data: { deliveredVia: 'whatsapp', deliveredAt: new Date() },
        });
        await db.lockEvent.create({
          data: {
            deviceId: device.id,
            codeId: code.id,
            tenantId: input.tenantId,
            eventType: 'delivered',
            message: 'PIN entregue via WhatsApp após confirmação do pagamento',
            metadata: JSON.stringify({ method: 'whatsapp', reservationId: input.reservationId }),
          },
        });
      }
    } catch (error) {
      console.warn('[RESERVATION_PAYMENT] PIN WhatsApp delivery failed:', error);
    }
  }

  return {
    ...(code as unknown as LockCodeData),
    device: {
      id: device.id,
      nickname: device.nickname,
      brand,
      propertyType: device.propertyType,
      propertyId: device.propertyId,
    },
  };
}
