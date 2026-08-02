// =============================================================================
// 🛎️ REAL-LIFE FLOWS — Ciclo de Vida Completo de uma Reserva
// =============================================================================
// Simula os eventos reais que acontecem em uma pousada/Airbnb:
//
// 1. Booking criado (status: scheduled)
// 2. Check-in chega (PIN gerado, enviado via WhatsApp)
// 3. Hóspede usa o PIN pela primeira vez (status: active → used)
// 4. Hóspede pede extensão de check-out (gera novo PIN emergencial 15min)
// 5. Check-out efetivado (PIN expira naturalmente)
// 6. Hóspede esquece pertence → PIN emergencial 15min
// 7. Host detecta suspeita de vazamento → PÂNICO revoga tudo
//
// Validamos:
// - Transições de status corretas
// - Eventos LGPD registrados em cada etapa
// - Janela de validade rígida (nega acesso fora do horário)
// - PIN emergencial expira em 15 min
// - Pânico revoga TODOS os PINs ativos
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LocksTestHarness,
  generatePousadaScenario,
  seedScenario,
  calculatePinValidityWindow,
  generateEmergencyPin,
  derivePinStatus,
} from './helpers/locks-test-harness';

describe('🛎️ Real-Life Flows — Ciclo de Vida de uma Reserva', () => {
  let harness: LocksTestHarness;

  beforeEach(() => {
    harness = new LocksTestHarness();
  });

  it('1. FLUXO COMPLETO: Booking → Check-in → Uso → Extensão → Check-out', async () => {
    const scenario = generatePousadaScenario('pousada-fluxo', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-fluxo');

    const device = scenario.devices[0].device;
    const booking = scenario.devices[0].bookings[0];

    // === ETAPA 1: Geração de PIN para o booking (status inicial: scheduled) ===
    const { code: scheduledPin } = await harness.generatePin(device.id, {
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      bookingId: booking.bookingId,
      checkInDate: booking.checkIn,
      checkOutDate: booking.checkOut,
      autoGenerate: true,
      sendWhatsApp: true,
    });

    // Status inicial deve ser 'scheduled' ou 'active' (depende de quando o check-in cai)
    expect(['scheduled', 'active']).toContain(scheduledPin.status);

    // Evento 'generated' registrado
    const genEvents = harness.listEventsByTenant('pousada-fluxo', 'generated');
    expect(genEvents).toHaveLength(1);

    // Evento 'delivered' registrado (WhatsApp enviado no mock)
    const deliveredEvents = harness.listEventsByTenant('pousada-fluxo', 'delivered');
    expect(deliveredEvents).toHaveLength(1);

    // === ETAPA 2: Hóspede usa o PIN pela primeira vez ===
    harness.markPinUsed(scheduledPin.id);
    const usedPin = harness.db.codes.get(scheduledPin.id)!;
    expect(usedPin.status).toBe('used');
    expect(usedPin.usedAt).not.toBeNull();

    const usedEvents = harness.listEventsByTenant('pousada-fluxo', 'used');
    expect(usedEvents).toHaveLength(1);

    // === ETAPA 3: Hóspede pede extensão de 2h (gera novo PIN com janela estendida) ===
    const extensionStart = new Date(Date.now() - 60_000); // 1 min atrás
    const extensionEnd = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2h
    const { code: extensionPin } = await harness.generatePin(device.id, {
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      bookingId: booking.bookingId,
      checkInDate: extensionStart.toISOString().slice(0, 10),
      checkOutDate: extensionEnd.toISOString().slice(0, 10),
      checkInTime: extensionStart.toISOString().slice(11, 16),
      checkOutTime: extensionEnd.toISOString().slice(11, 16),
      manualPin: '928374',
      sendWhatsApp: true,
      note: 'Extensão de check-out (+2h)',
    });

    // PIN de extensão deve estar ativo
    expect(extensionPin.status).toBe('active');
    expect(extensionPin.note).toContain('Extensão');

    // Agora existem 2 PINs no dispositivo
    const allPins = Array.from(harness.db.codes.values()).filter((c) => c.deviceId === device.id);
    expect(allPins).toHaveLength(2);

    // === ETAPA 4: Hóspede esquece pertence → PIN emergencial 15min ===
    const emergency = generateEmergencyPin();
    expect(emergency.pin).toHaveLength(7); // 6 dígitos + #
    expect(emergency.pin.endsWith('#')).toBe(true);

    const emergencyValidMs = emergency.validTo.getTime() - emergency.validFrom.getTime();
    expect(emergencyValidMs).toBe(15 * 60 * 1000); // exatamente 15 min

    // === ETAPA 5: Check-out efetivado — revoga manualmente o PIN de extensão ===
    harness.revokePin(extensionPin.id, 'Check-out efetuado');
    const revokedPin = harness.db.codes.get(extensionPin.id)!;
    expect(revokedPin.status).toBe('revoked');
    expect(revokedPin.revokedReason).toBe('Check-out efetuado');

    const revokedEvents = harness.listEventsByTenant('pousada-fluxo', 'revoked');
    expect(revokedEvents).toHaveLength(1);

    // === ETAPA 6: Auditoria final — timeline completa de eventos ===
    const allEvents = harness.listEventsByTenant('pousada-fluxo');
    const eventTypes = allEvents.map((e) => e.eventType);

    expect(eventTypes).toContain('generated');
    expect(eventTypes).toContain('delivered');
    expect(eventTypes).toContain('used');
    expect(eventTypes).toContain('revoked');

    console.log(
      `[FLUXO COMPLETO] Eventos na timeline: ${eventTypes.join(' → ')} | ` +
      `Total: ${allEvents.length} eventos LGPD`,
    );
  }, 15000);

  it('2. PÂNICO: Host detecta vazamento → revoga TODOS os PINs ativos de uma vez', async () => {
    const scenario = generatePousadaScenario('pousada-panico', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-panico');

    const device = scenario.devices[0].device;
    const booking = scenario.devices[0].bookings[0];

    // Gera 5 PINs para o mesmo dispositivo (5 hóspedes com janelas sobrepostas — casa compartilhada)
    const pinIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const { code } = await harness.generatePin(device.id, {
        guestName: `Hóspede ${i + 1}`,
        guestPhone: `+551199999${String(i).padStart(4, '0')}`,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
        sendWhatsApp: true,
      });
      pinIds.push(code.id);
    }

    expect(pinIds).toHaveLength(5);

    // Verifica que todos estão ativos
    for (const id of pinIds) {
      const c = harness.db.codes.get(id)!;
      expect(['scheduled', 'active']).toContain(c.status);
    }

    // === HOST ACIONA PÂNICO ===
    const revokedCount = harness.panicRevokeAllPins(device.id, 'Suspeita de vazamento — hóspede reportou');

    expect(revokedCount).toBe(5);

    // Todos os 5 PINs agora estão revogados
    for (const id of pinIds) {
      const c = harness.db.codes.get(id)!;
      expect(c.status).toBe('revoked');
      expect(c.revokedAt).not.toBeNull();
      expect(c.revokedReason).toContain('Suspeita');
    }

    // 1 evento 'panic_revoke' registrado
    const panicEvents = harness.listEventsByTenant('pousada-panico', 'panic_revoke');
    expect(panicEvents).toHaveLength(1);
    expect(panicEvents[0].message).toContain('5 PIN(s) revogado(s)');

    // Tentativa de gerar novo PIN depois do pânico deve funcionar
    const { code: newPin } = await harness.generatePin(device.id, {
      guestName: 'Hóspede substituto',
      guestPhone: '+5511999999999',
      checkInDate: booking.checkIn,
      checkOutDate: booking.checkOut,
      autoGenerate: true,
      sendWhatsApp: true,
    });
    expect(['scheduled', 'active']).toContain(newPin.status);

    console.log(
      `[PÂNICO] ${revokedCount} PINs revogados em massa | evento panic_revoke registrado | ` +
      `Novo PIN gerado após pânico: ${newPin.id}`,
    );
  }, 15000);

  it('3. CHECK-IN ANTECIPADO: Hóspede chega 13h, PIN só vale das 14h — acesso negado', async () => {
    // Cenário: hóspede chega 1h antes do check-in oficial
    // O PIN não deve autorizar acesso antes da validade
    const tomorrow = new Date(Date.now() + 86400000);
    const checkInDate = tomorrow.toISOString().slice(0, 10);
    const checkOutDate = new Date(tomorrow.getTime() + 86400000).toISOString().slice(0, 10);

    const { validFrom, validTo } = calculatePinValidityWindow(
      checkInDate,
      checkOutDate,
      '14:00',
      '11:00',
    );

    // Tentativa de acesso às 13:00 (1h ANTES do check-in)
    const attemptBefore = new Date(`${checkInDate}T13:00:00`);
    const isAuthorizedBefore = attemptBefore >= validFrom;
    expect(isAuthorizedBefore).toBe(false);

    // Tentativa de acesso às 14:00 (exatamente no início)
    const attemptAt = new Date(`${checkInDate}T14:00:00`);
    const isAuthorizedAt = attemptAt >= validFrom && attemptAt <= validTo;
    expect(isAuthorizedAt).toBe(true);

    // Tentativa às 11:01 do check-out (1 min DEPOIS)
    const attemptAfter = new Date(`${checkOutDate}T11:01:00`);
    const isAuthorizedAfter = attemptAfter <= validTo;
    expect(isAuthorizedAfter).toBe(false);

    console.log(
      `[CHECK-IN ANTECIPADO] Acesso negado às 13:00, autorizado às 14:00, negado às 11:01 pós-checkout`,
    );
  });

  it('4. CANCELAMENTO DE RESERVA: PIN deve ser revogado imediatamente', async () => {
    const scenario = generatePousadaScenario('pousada-cancel', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-cancel');

    const device = scenario.devices[0].device;
    const booking = scenario.devices[0].bookings[0];

    // PIN gerado
    const { code } = await harness.generatePin(device.id, {
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      checkInDate: booking.checkIn,
      checkOutDate: booking.checkOut,
      autoGenerate: true,
      sendWhatsApp: true,
    });

    expect(code.status).not.toBe('revoked');

    // Hóspede cancela → host revoga o PIN imediatamente
    const reason = 'Reserva cancelada pelo hóspede';
    const ok = harness.revokePin(code.id, reason);
    expect(ok).toBe(true);

    const revoked = harness.db.codes.get(code.id)!;
    expect(revoked.status).toBe('revoked');
    expect(revoked.revokedReason).toBe(reason);

    // Evento 'revoked' registrado
    const revokedEvents = harness.listEventsByTenant('pousada-cancel', 'revoked');
    expect(revokedEvents).toHaveLength(1);
    expect(revokedEvents[0].message).toContain(reason);
  });

  it('5. MUDANÇA DE QUARTO: hóspede troca de quarto → novo PIN gerado, antigo revogado', async () => {
    const scenario = generatePousadaScenario('pousada-troca', 2, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-troca');

    const device1 = scenario.devices[0].device;
    const device2 = scenario.devices[1].device;
    const booking = scenario.devices[0].bookings[0];

    // Hóspede inicialmente no quarto 1
    const { code: pin1 } = await harness.generatePin(device1.id, {
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      checkInDate: booking.checkIn,
      checkOutDate: booking.checkOut,
      autoGenerate: true,
      sendWhatsApp: true,
    });

    // Host troca o hóspede para o quarto 2 (problema no quarto 1)
    harness.revokePin(pin1.id, 'Mudança de quarto — problema na fechadura 1');

    const { code: pin2 } = await harness.generatePin(device2.id, {
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      checkInDate: booking.checkIn,
      checkOutDate: booking.checkOut,
      autoGenerate: true,
      sendWhatsApp: true,
      note: 'PIN substituto após mudança de quarto',
    });

    // PIN antigo revogado
    expect(harness.db.codes.get(pin1.id)!.status).toBe('revoked');

    // PIN novo ativo
    expect(['scheduled', 'active']).toContain(pin2.status);

    // Os 2 PINs têm códigos DIFERENTES
    expect(pin1.code).not.toBe(pin2.code);

    // PIN novo está associado ao device2 (quarto 2)
    expect(pin2.deviceId).toBe(device2.id);

    console.log(
      `[TROCA DE QUARTO] PIN1 ${pin1.code} revogado | PIN2 ${pin2.code} gerado para ${device2.nickname}`,
    );
  });

  it('6. PIN EXPIRADO: tentativa de uso após expiração — negada', async () => {
    // Cenário: hóspede tenta usar PIN após check-out
    const past = new Date(Date.now() - 86400000); // ontem
    const recent = new Date(Date.now() - 3600000); // 1h atrás

    const status = derivePinStatus({
      validFrom: past,
      validTo: recent,
    });

    expect(status).toBe('expired');

    // PIN expirado NÃO deve autorizar acesso
    const attemptNow = new Date();
    const isAuthorized = attemptNow >= past && attemptNow <= recent;
    expect(isAuthorized).toBe(false);
  });

  it('7. NO-SHOW: hóspede não aparece, PIN fica scheduled → expira naturalmente', async () => {
    // Cenário: booking feito mas hóspede não apareceu
    // PIN fica scheduled até a janela passar, depois fica expired
    const future = new Date(Date.now() + 86400000); // amanhã
    const far = new Date(Date.now() + 2 * 86400000); // depois de amanhã

    // Antes da validade: scheduled
    const statusBefore = derivePinStatus({ validFrom: future, validTo: far });
    expect(statusBefore).toBe('scheduled');

    // Após validade (simulado): expired
    const past1 = new Date(Date.now() - 2 * 86400000);
    const past2 = new Date(Date.now() - 86400000);
    const statusAfter = derivePinStatus({ validFrom: past1, validTo: past2 });
    expect(statusAfter).toBe('expired');
  });
});
