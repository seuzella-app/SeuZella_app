// =============================================================================
// 🛡️ LGPD AUDIT INTEGRITY — Integridade da Trilha de Auditoria sob Carga
// =============================================================================
// Cenário: Validar que TODOS os eventos LGPD são capturados mesmo sob alta
// carga. A LGPD exige que toda operação de processamento de dados pessoais
// (geração, acesso, revogação de PIN) seja auditável.
//
// Validamos:
// 1. Cada PIN gerado → 1 evento 'generated'
// 2. Cada WhatsApp enviado → 1 evento 'delivered'
// 3. Cada WhatsApp falhado → 1 evento 'failed'
// 4. Cada PIN revogado → 1 evento 'revoked'
// 5. Cada pânico → 1 evento 'panic_revoke'
// 6. Cada uso de PIN → 1 evento 'used'
// 7. Eventos NUNCA são perdidos (mesmo com 1000+ operações)
// 8. Metadata contém informações mínimas para auditoria
// 9. TenantId está sempre presente (particionamento)
// 10. Timestamps são monotônicos (não há eventos "no passado")
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LocksTestHarness,
  generatePousadaScenario,
  seedScenario,
  runWithConcurrency,
} from './helpers/locks-test-harness';

describe('🛡️ LGPD Audit Integrity — Auditoria Completa sob Carga', () => {
  let harness: LocksTestHarness;

  beforeEach(() => {
    harness = new LocksTestHarness();
  });

  it('1. COMPLETUDE: 100 PINs gerados → 100 eventos "generated" exatos', async () => {
    const scenario = generatePousadaScenario('pousada-lgpd-1', 100, 1);
    seedScenario(harness, scenario);

    const tasks = scenario.devices.map(({ device, bookings }) => async () => {
      harness.setTenant('pousada-lgpd-1');
      const booking = bookings[0];
      await harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
        sendWhatsApp: false,
      });
    });

    await runWithConcurrency(tasks, 50);

    const events = Array.from(harness.db.events.values());
    const generatedEvents = events.filter((e) => e.eventType === 'generated');

    expect(generatedEvents).toHaveLength(100);

    // Todos os eventos têm tenantId preenchido
    expect(generatedEvents.every((e) => e.tenantId === 'pousada-lgpd-1')).toBe(true);

    // Todos têm codeId preenchido
    expect(generatedEvents.every((e) => e.codeId !== null)).toBe(true);

    // Todos têm deviceId preenchido
    expect(generatedEvents.every((e) => e.deviceId)).toBe(true);

    // Metadata é JSON válido
    for (const ev of generatedEvents) {
      const meta = JSON.parse(ev.metadata);
      expect(meta).toHaveProperty('validFrom');
      expect(meta).toHaveProperty('validTo');
      expect(meta).toHaveProperty('codeType');
      expect(meta).toHaveProperty('source');
    }
  }, 30000);

  it('2. COMPLETUDE: WhatsApp enviado → 1 evento "delivered"', async () => {
    const scenario = generatePousadaScenario('pousada-lgpd-2', 10, 1);
    seedScenario(harness, scenario);

    for (const { device, bookings } of scenario.devices) {
      harness.setTenant('pousada-lgpd-2');
      const booking = bookings[0];
      await harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
        sendWhatsApp: true,
      });
    }

    const deliveredEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'delivered');
    expect(deliveredEvents).toHaveLength(10);

    // Metadata tem método WhatsApp
    for (const ev of deliveredEvents) {
      const meta = JSON.parse(ev.metadata);
      expect(meta.method).toBe('whatsapp');
    }
  });

  it('3. COMPLETUDE: WhatsApp falhado → 1 evento "failed"', async () => {
    harness.whatsapp.reset('all-fail');

    const scenario = generatePousadaScenario('pousada-lgpd-3', 10, 1);
    seedScenario(harness, scenario);

    for (const { device, bookings } of scenario.devices) {
      harness.setTenant('pousada-lgpd-3');
      const booking = bookings[0];
      await harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
        sendWhatsApp: true,
      });
    }

    const failedEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'failed');
    expect(failedEvents).toHaveLength(10);

    // Metadata tem motivo da falha
    for (const ev of failedEvents) {
      const meta = JSON.parse(ev.metadata);
      expect(meta).toHaveProperty('error');
    }
  });

  it('4. COMPLETUDE: PIN revogado → 1 evento "revoked" com motivo', async () => {
    const scenario = generatePousadaScenario('pousada-lgpd-4', 5, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-lgpd-4');

    const pinIds: string[] = [];
    for (const { device, bookings } of scenario.devices) {
      const booking = bookings[0];
      const { code } = await harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
      });
      pinIds.push(code.id);
    }

    // Revoga todos
    for (let i = 0; i < pinIds.length; i++) {
      harness.revokePin(pinIds[i], `Motivo ${i + 1}`);
    }

    const revokedEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'revoked');
    expect(revokedEvents).toHaveLength(5);

    // Cada evento tem o motivo correto
    for (let i = 0; i < 5; i++) {
      const ev = revokedEvents.find((e) => e.codeId === pinIds[i]);
      expect(ev).toBeDefined();
      expect(ev!.message).toContain(`Motivo ${i + 1}`);
      const meta = JSON.parse(ev!.metadata);
      expect(meta.reason).toBe(`Motivo ${i + 1}`);
    }
  });

  it('5. COMPLETUDE: pânico → 1 evento "panic_revoke" com count', async () => {
    const scenario = generatePousadaScenario('pousada-lgpd-5', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-lgpd-5');

    const device = scenario.devices[0].device;
    const booking = scenario.devices[0].bookings[0];

    for (let i = 0; i < 7; i++) {
      await harness.generatePin(device.id, {
        guestName: `Hóspede ${i}`,
        guestPhone: '+5511999999999',
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
      });
    }

    harness.panicRevokeAllPins(device.id, 'Vazamento detectado');

    const panicEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'panic_revoke');
    expect(panicEvents).toHaveLength(1);

    const ev = panicEvents[0];
    expect(ev.message).toContain('7 PIN(s) revogado(s)');
    expect(ev.message).toContain('Vazamento detectado');

    const meta = JSON.parse(ev.metadata);
    expect(meta.count).toBe(7);
    expect(meta.reason).toBe('Vazamento detectado');
  });

  it('6. COMPLETUDE: PIN usado → 1 evento "used"', async () => {
    const scenario = generatePousadaScenario('pousada-lgpd-6', 3, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-lgpd-6');

    const pinIds: string[] = [];
    for (const { device, bookings } of scenario.devices) {
      const booking = bookings[0];
      const { code } = await harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
      });
      pinIds.push(code.id);
    }

    for (const id of pinIds) {
      harness.markPinUsed(id);
    }

    const usedEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'used');
    expect(usedEvents).toHaveLength(3);

    for (const ev of usedEvents) {
      expect(ev.message).toContain('utilizado');
    }
  });

  it('7. CONSISTÊNCIA: eventos têm timestamps monotônicos (sem saltos no passado)', async () => {
    const scenario = generatePousadaScenario('pousada-lgpd-7', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-lgpd-7');

    const device = scenario.devices[0].device;
    const booking = scenario.devices[0].bookings[0];

    const { code } = await harness.generatePin(device.id, {
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      checkInDate: booking.checkIn,
      checkOutDate: booking.checkOut,
      autoGenerate: true,
      sendWhatsApp: true,
    });

    harness.markPinUsed(code.id);
    harness.revokePin(code.id, 'Teste monotônico');

    const events = harness.listEventsByTenant('pousada-lgpd-7');
    expect(events.length).toBeGreaterThanOrEqual(4);

    // Verifica que timestamps são monotônicos crescentes
    for (let i = 1; i < events.length; i++) {
      const prev = new Date(events[i - 1].createdAt).getTime();
      const curr = new Date(events[i].createdAt).getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('8. PARTICIONAMENTO: eventos são isolados por tenantId', async () => {
    const scenarioA = generatePousadaScenario('pousada-A', 5, 1);
    const scenarioB = generatePousadaScenario('pousada-B', 5, 1);
    seedScenario(harness, scenarioA);
    seedScenario(harness, scenarioB);

    // Gera PINs em A e B
    for (const [scenario, tenantId] of [[scenarioA, 'pousada-A'], [scenarioB, 'pousada-B']] as const) {
      harness.setTenant(tenantId);
      for (const { device, bookings } of scenario.devices) {
        const booking = bookings[0];
        await harness.generatePin(device.id, {
          guestName: booking.guestName,
          guestPhone: booking.guestPhone,
          checkInDate: booking.checkIn,
          checkOutDate: booking.checkOut,
          autoGenerate: true,
        });
      }
    }

    const eventsA = harness.listEventsByTenant('pousada-A');
    const eventsB = harness.listEventsByTenant('pousada-B');

    // Cada tenant tem seus eventos isolados
    expect(eventsA.every((e) => e.tenantId === 'pousada-A')).toBe(true);
    expect(eventsB.every((e) => e.tenantId === 'pousada-B')).toBe(true);

    // Nenhum evento de A aparece em B
    const idsA = new Set(eventsA.map((e) => e.id));
    const idsB = new Set(eventsB.map((e) => e.id));
    const intersection = [...idsA].filter((id) => idsB.has(id));
    expect(intersection).toHaveLength(0);
  });

  it('9. COMPLETUDE sob carga: 500 PINs + 500 WhatsApp + 100 revogações + 10 pânicos', async () => {
    const scenario = generatePousadaScenario('pousada-lgpd-9', 100, 5);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-lgpd-9');

    // Gera 500 PINs (100 dispositivos × 5 bookings)
    const pinIds: string[] = [];
    for (const { device, bookings } of scenario.devices) {
      for (const booking of bookings) {
        const { code } = await harness.generatePin(device.id, {
          guestName: booking.guestName,
          guestPhone: booking.guestPhone,
          checkInDate: booking.checkIn,
          checkOutDate: booking.checkOut,
          autoGenerate: true,
          sendWhatsApp: true,
        });
        pinIds.push(code.id);
      }
    }

    expect(pinIds).toHaveLength(500);

    // Revoga 100 PINs (1 por dispositivo, pega o primeiro de cada)
    for (let i = 0; i < 100; i++) {
      harness.revokePin(pinIds[i], 'Teste LGPD');
    }

    // Pânico em 10 dispositivos (com os PINs restantes)
    for (let i = 0; i < 10; i++) {
      harness.panicRevokeAllPins(scenario.devices[i].device.id, 'Pânico LGPD');
    }

    // ==== VALIDAÇÃO FINAL ====
    const allEvents = Array.from(harness.db.events.values());
    const generated = allEvents.filter((e) => e.eventType === 'generated');
    const delivered = allEvents.filter((e) => e.eventType === 'delivered');
    const revoked = allEvents.filter((e) => e.eventType === 'revoked');
    const panicRevoke = allEvents.filter((e) => e.eventType === 'panic_revoke');

    // 500 eventos 'generated'
    expect(generated).toHaveLength(500);

    // 500 eventos 'delivered' (WhatsApp mockado envia todos)
    expect(delivered).toHaveLength(500);

    // 100 eventos 'revoked' individuais + 10 eventos 'panic_revoke'
    // (o pânico revoga os PINs ainda ativos — conta como 1 evento panic_revoke por device)
    expect(panicRevoke).toHaveLength(10);
    expect(revoked.length).toBeGreaterThanOrEqual(100);

    console.log(
      `[LGPD CARGA] generated=${generated.length} | delivered=${delivered.length} | ` +
      `revoked=${revoked.length} | panic_revoke=${panicRevoke.length} | total=${allEvents.length}`,
    );
  }, 60000);

  it('10. METADATA COMPLETA: cada evento tem todos os campos obrigatórios', async () => {
    const scenario = generatePousadaScenario('pousada-lgpd-10', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-lgpd-10');

    const device = scenario.devices[0].device;
    const booking = scenario.devices[0].bookings[0];

    const { code } = await harness.generatePin(device.id, {
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      checkInDate: booking.checkIn,
      checkOutDate: booking.checkOut,
      autoGenerate: true,
      sendWhatsApp: true,
    });

    harness.markPinUsed(code.id);
    harness.revokePin(code.id, 'Fim do teste');

    const events = harness.listEventsByTenant('pousada-lgpd-10');

    for (const ev of events) {
      // Campos obrigatórios
      expect(ev.id).toBeDefined();
      expect(ev.tenantId).toBe('pousada-lgpd-10');
      expect(ev.deviceId).toBeDefined();
      expect(ev.eventType).toBeDefined();
      expect(ev.createdAt).toBeDefined();

      // Metadata é JSON válido
      expect(() => JSON.parse(ev.metadata)).not.toThrow();

      // Message não é vazio
      expect(ev.message).toBeTruthy();
    }
  });
});
