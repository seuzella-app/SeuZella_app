import { db, isDatabaseAvailable } from '@/lib/db';
import { BRAND_CATALOG, getBrandInfo, type LockBrand } from './types';
import { derivePinStatus } from './pin-generator';
import { deliverPinViaWhatsApp } from './whatsapp-delivery';
import { getProviderModule, hasCredentialsConfigured } from './providers';
import * as manualProvider from './providers/manual';
import type { LockCodeData } from './types';

interface GenerateReservationPinInput {
  tenantId: string;
  deviceId: string;
  reservationId: string;
  guestName: string;
  guestPhone?: string;
  validFrom: Date;
  validTo: Date;
}

function wrapManual(brand: LockBrand) {
  return {
    async generate(input: { deviceId: string; providerType: 'manual'; validFrom: Date; validTo: Date }) {
      return manualProvider.generatePin({
        deviceId: input.deviceId,
        brand,
        providerType: 'manual',
        validFrom: input.validFrom,
        validTo: input.validTo,
        autoGenerate: true,
      });
    },
  };
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

  let providerResult: { pin: string; source: 'manual' | 'api'; codeType: 'online_pin' | 'offline_pin' | 'manual' | 'qrcode'; externalCodeId?: string };
  if (info.apiAvailable && hasCredentialsConfigured(brand) && device.externalDeviceId) {
    const provider = getProviderModule(brand);
    if (!provider) throw new Error('LOCK_PROVIDER_NOT_AVAILABLE');
    const result = await provider.generatePin({
      externalDeviceId: device.externalDeviceId,
      validFrom: input.validFrom,
      validTo: input.validTo,
      guestName: input.guestName,
    });
    providerResult = { pin: result.pin, source: 'api', codeType: result.codeType, externalCodeId: result.externalCodeId };
  } else {
    const manual = await wrapManual(brand).generate({
      deviceId: device.id,
      providerType: 'manual',
      validFrom: input.validFrom,
      validTo: input.validTo,
    });
    providerResult = { pin: manual.pin, source: manual.source, codeType: manual.codeType };
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
        brand: brand,
      });
      if (delivery.sent) {
        await db.lockCode.update({ where: { id: code.id }, data: { deliveredVia: 'whatsapp', deliveredAt: new Date() } });
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
