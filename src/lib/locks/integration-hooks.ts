/**
 * Lock Integration Hooks — Pontes entre locks e outros subsistemas
 * =================================================================
 *
 * Conecta fechaduras eletrônicas com:
 *   1. FNRH Digital — quando hóspede completa cadastro → PIN gerado automaticamente
 *   2. Upsell — check-in antecipado/check-out estendido → PIN estendido
 *   3. Depósito PIX — depósito retida → PIN revogado; depósito coletada → PIN ativo
 *
 * Cada função é safe-fail: se a integração falhar, o fluxo principal NÃO bloqueia.
 */

import { listLockDevices, generatePin, revokePin } from './orchestrator';
import { deliverPinViaWhatsApp } from './whatsapp-delivery';
import { db } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// 1. FNRH → PIN GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chamado quando FNRH do hóspede é completada.
 * Gera PIN de fechadura automaticamente e envia via WhatsApp.
 *
 * @param params { tenantId, guestName, guestPhone, bookingId, checkIn, checkOut, propertyId }
 */
export async function onFNRHCompleted(params: {
  tenantId: string;
  guestName: string;
  guestPhone?: string;
  bookingId?: string;
  checkIn: Date;
  checkOut: Date;
  propertyId?: string;
}): Promise<{ pinGenerated: boolean; pinCode?: string; error?: string }> {
  try {
    // Busca lock devices do tenant (para a propriedade específica se fornecida)
    const devices = await listLockDevices(params.propertyId ?? undefined);
    if (devices.length === 0) {
      return { pinGenerated: false, error: 'Nenhum dispositivo de fechadura cadastrado' };
    }

    // Usa o primeiro device ativo
    const device = devices.find((d: any) => d.status === 'active') ?? devices[0];
    if (!device) {
      return { pinGenerated: false, error: 'Nenhum dispositivo ativo' };
    }

    // Gera PIN via orchestrator (CSPRNG + persistido + auditado)
    const result = await generatePin({
      deviceId: device.id,
      guestName: params.guestName,
      guestPhone: params.guestPhone,
      bookingId: params.bookingId,
      validFrom: params.checkIn,
      validTo: params.checkOut,
      autoGenerate: true,
      note: 'PIN gerado automaticamente via FNRH Digital',
    });

    if (!result.code) {
      return { pinGenerated: false, error: 'Falha ao gerar PIN' };
    }

    // Envia PIN via WhatsApp se telefone disponível
    if (params.guestPhone) {
      try {
        await deliverPinViaWhatsApp({
          guestName: params.guestName,
          guestPhone: params.guestPhone,
          pin: result.code.code,
          validFrom: params.checkIn,
          validTo: params.checkOut,
          deviceNickname: device.nickname,
          brand: device.brand as any,
        });
      } catch (deliveryErr) {
        // Falha no WhatsApp não bloqueia — PIN já está no banco
        console.warn('[LOCK_HOOKS] WhatsApp delivery falhou (PIN já no banco):', deliveryErr);
      }
    }

    return { pinGenerated: true, pinCode: result.code.code };
  } catch (err: any) {
    console.error('[LOCK_HOOKS] FNRH → PIN falhou:', err);
    return { pinGenerated: false, error: err?.message ?? 'erro desconhecido' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. UPSELL → PIN EXTENSION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chamado quando hóspede paga upsell (check-in antecipado / check-out estendido).
 * Revoga PIN antigo e gera novo com validade estendida.
 *
 * @param params { tenantId, bookingId, extensionHours, extensionType }
 */
export async function onUpsellPaid(params: {
  tenantId: string;
  bookingId?: string;
  extensionHours: number;
  extensionType: 'early_checkin' | 'late_checkout';
}): Promise<{ pinExtended: boolean; newPinCode?: string; error?: string }> {
  try {
    if (!params.bookingId) {
      return { pinExtended: false, error: 'bookingId necessário para estender PIN' };
    }

    // Busca PIN ativo do booking
    const activePins = await db.lockCode.findMany({
      where: {
        bookingId: params.bookingId,
        status: { in: ['scheduled', 'active'] },
      },
      orderBy: { validFrom: 'desc' },
      take: 1,
    });

    if (activePins.length === 0) {
      return { pinExtended: false, error: 'Nenhum PIN ativo encontrado para este booking' };
    }

    const oldPin = activePins[0];

    // Calcula nova validade
    const newValidTo = new Date(oldPin.validTo);
    if (params.extensionType === 'early_checkin') {
      // Early check-in: antecipa validFrom
      const newValidFrom = new Date(oldPin.validFrom);
      newValidFrom.setHours(newValidFrom.getHours() - params.extensionHours);
      // Revoga PIN antigo
      await revokePin(oldPin.id, `Upsell: early check-in +${params.extensionHours}h`);
      // Gera novo PIN com validFrom estendido
      const result = await generatePin({
        deviceId: oldPin.deviceId,
        guestName: oldPin.guestName ?? undefined,
        guestPhone: oldPin.guestPhone ?? undefined,
        bookingId: oldPin.bookingId ?? undefined,
        validFrom: newValidFrom,
        validTo: oldPin.validTo,
        autoGenerate: true,
        note: `PIN estendido via upsell: early check-in +${params.extensionHours}h`,
      });
      if (result.code) {
        return { pinExtended: true, newPinCode: result.code.code };
      }
    } else {
      // Late checkout: estende validTo
      newValidTo.setHours(newValidTo.getHours() + params.extensionHours);
      // Revoga PIN antigo
      await revokePin(oldPin.id, `Upsell: late checkout +${params.extensionHours}h`);
      // Gera novo PIN com validTo estendido
      const result = await generatePin({
        deviceId: oldPin.deviceId,
        guestName: oldPin.guestName ?? undefined,
        guestPhone: oldPin.guestPhone ?? undefined,
        bookingId: oldPin.bookingId ?? undefined,
        validFrom: oldPin.validFrom,
        validTo: newValidTo,
        autoGenerate: true,
        note: `PIN estendido via upsell: late checkout +${params.extensionHours}h`,
      });
      if (result.code) {
        return { pinExtended: true, newPinCode: result.code.code };
      }
    }

    return { pinExtended: false, error: 'Falha ao gerar novo PIN' };
  } catch (err: any) {
    console.error('[LOCK_HOOKS] Upsell → PIN extension falhou:', err);
    return { pinExtended: false, error: err?.message ?? 'erro desconhecido' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CAUÇÃO PIX → LOCK PIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chamado quando status da depósito muda.
 * - 'collected' → garante PIN ativo
 * - 'retained' → revoga PIN imediatamente (hóspede perdeu acesso)
 * - 'returned' → mantém PIN até check-out
 *
 * @param params { tenantId, bookingId, depositStatus }
 */
export async function onDepositStatusChange(params: {
  tenantId: string;
  bookingId?: string;
  depositStatus: 'pending' | 'collected' | 'held' | 'returned' | 'retained';
}): Promise<{ action: string; success: boolean; error?: string }> {
  try {
    if (!params.bookingId) {
      return { action: 'skip', success: true };
    }

    // Busca PINs ativos do booking
    const activePins = await db.lockCode.findMany({
      where: {
        bookingId: params.bookingId,
        status: { in: ['scheduled', 'active'] },
      },
    });

    if (activePins.length === 0) {
      return { action: 'no_pins', success: true };
    }

    if (params.depositStatus === 'retained') {
      // Depósito retida → revoga TODOS os PINs ativos
      for (const pin of activePins) {
        await revokePin(pin.id, 'Depósito PIX retida — acesso revogado');
      }
      return { action: 'revoked_all', success: true };
    }

    if (params.depositStatus === 'collected') {
      // Depósito coletada → garante que PINs estão ativos (nada a fazer se já ativos)
      return { action: 'ensured_active', success: true };
    }

    // 'pending', 'held', 'returned' → não altera PINs
    return { action: 'no_action', success: true };
  } catch (err: any) {
    console.error('[LOCK_HOOKS] Depósito → PIN falhou:', err);
    return { action: 'error', success: false, error: err?.message ?? 'erro desconhecido' };
  }
}
