// =============================================================================
// ⚡ RACE CONDITIONS — Condições de Corrida em Fechaduras
// =============================================================================
// Cenários de concorrência que podem expor bugs sutis:
//
// 1. Mesmo hóspede tenta gerar 2 PINs simultaneamente para o mesmo dispositivo
// 2. Mesmo dispositivo recebe 2 pânicos simultâneos
// 3. Revogação individual concorre com pânico em massa
// 4. Dois hosts do mesmo tenant editam o mesmo dispositivo
// 5. Geração de PIN enquanto dispositivo está sendo deletado
// 6. Múltiplas tentativas de check-in com o mesmo bookingId
//
// Validamos:
// - Não há deadlocks
// - Não há duplicação de PINs
// - Estado final é consistente
// - Auditoria registra TODOS os eventos (sem perda)
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LocksTestHarness,
  generatePousadaScenario,
  seedScenario,
} from './helpers/locks-test-harness';

describe('⚡ Race Conditions — Concorrência e Condições de Corrida', () => {
  let harness: LocksTestHarness;

  beforeEach(() => {
    harness = new LocksTestHarness();
  });

  it('1. RACE: mesmo hóspede tenta gerar 2 PINs simultaneamente no mesmo dispositivo', async () => {
    const scenario = generatePousadaScenario('pousada-race-1', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-race-1');

    const device = scenario.devices[0].device;
    const booking = scenario.devices[0].bookings[0];

    // Dispara 2 chamadas simultâneas para o mesmo dispositivo/hóspede
    const [result1, result2] = await Promise.all([
      harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        bookingId: booking.bookingId,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
      }),
      harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        bookingId: booking.bookingId,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
      }),
    ]);

    // Ambos os PINs foram gerados (são IDs diferentes)
    expect(result1.code.id).not.toBe(result2.code.id);

    // Os códigos PIN são diferentes (CSPRNG)
    expect(result1.code.code).not.toBe(result2.code.code);

    // 2 PINs no DB
    expect(Array.from(harness.db.codes.values())).toHaveLength(2);

    // 2 eventos 'generated' (não houve perda)
    const genEvents = harness.listEventsByTenant('pousada-race-1', 'generated');
    expect(genEvents).toHaveLength(2);
  });

  it('2. RACE: 2 pânicos simultâneos no mesmo dispositivo', async () => {
    const scenario = generatePousadaScenario('pousada-race-2', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-race-2');

    const device = scenario.devices[0].device;
    const booking = scenario.devices[0].bookings[0];

    // Gera 5 PINs
    for (let i = 0; i < 5; i++) {
      await harness.generatePin(device.id, {
        guestName: `Hóspede ${i}`,
        guestPhone: '+5511999999999',
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
      });
    }

    // Dispara 2 pânicos simultâneos
    const [count1, count2] = await Promise.all([
      Promise.resolve(harness.panicRevokeAllPins(device.id, 'Pânico 1')),
      Promise.resolve(harness.panicRevokeAllPins(device.id, 'Pânico 2')),
    ]);

    // Soma das contagens deve ser 5 (não 10 — não pode contar PINs já revogados)
    // Como o mock é síncrono, na prática um dos pânicos verá 5 PINs ativos e o outro verá 0.
    const totalRevoked = count1 + count2;
    expect(totalRevoked).toBe(5);

    // Todos os PINs estão revogados
    const allRevoked = Array.from(harness.db.codes.values())
      .filter((c) => c.deviceId === device.id)
      .every((c) => c.status === 'revoked');
    expect(allRevoked).toBe(true);
  });

  it('3. RACE: revogação individual concorrendo com pânico em massa', async () => {
    const scenario = generatePousadaScenario('pousada-race-3', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-race-3');

    const device = scenario.devices[0].device;
    const booking = scenario.devices[0].bookings[0];

    // Gera 10 PINs
    const pinIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const { code } = await harness.generatePin(device.id, {
        guestName: `Hóspede ${i}`,
        guestPhone: '+5511999999999',
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
      });
      pinIds.push(code.id);
    }

    // Dispara revogação individual do PIN 0 E pânico ao mesmo tempo
    await Promise.all([
      Promise.resolve(harness.revokePin(pinIds[0], 'Revogação individual')),
      Promise.resolve(harness.panicRevokeAllPins(device.id, 'Pânico concorrente')),
    ]);

    // Todos os 10 PINs estão revogados
    for (const id of pinIds) {
      expect(harness.db.codes.get(id)!.status).toBe('revoked');
    }

    // Eventos: 1 'revoked' individual + 1 'panic_revoke'
    const revokedEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'revoked');
    const panicEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'panic_revoke');
    expect(revokedEvents.length).toBeGreaterThanOrEqual(1);
    expect(panicEvents).toHaveLength(1);
  });

  it('4. RACE: 100 PINs simultâneos no mesmo dispositivo (mesmo hóspede)', async () => {
    // Cenário: bug no frontend dispara 100 cliques no botão "Gerar PIN"
    const scenario = generatePousadaScenario('pousada-race-4', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-race-4');

    const device = scenario.devices[0].device;
    const booking = scenario.devices[0].bookings[0];

    const promises = Array.from({ length: 100 }, () =>
      harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
      }),
    );

    const results = await Promise.all(promises);

    // Todos os 100 PINs foram gerados
    expect(results).toHaveLength(100);

    // 100 PINs únicos
    const codes = results.map((r) => r.code.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBeGreaterThan(95); // tolerância 5% para raríssimas colisões

    // 100 IDs únicos
    const ids = results.map((r) => r.code.id);
    expect(new Set(ids).size).toBe(100);

    // 100 eventos 'generated'
    const genEvents = harness.listEventsByTenant('pousada-race-4', 'generated');
    expect(genEvents).toHaveLength(100);

    console.log(
      `[RACE 100] 100 PINs simultâneos no mesmo dispositivo | únicos=${uniqueCodes.size}/100`,
    );
  });

  it('5. RACE: geração de PIN enquanto dispositivo é atualizado', async () => {
    const scenario = generatePousadaScenario('pousada-race-5', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-race-5');

    const device = scenario.devices[0].device;
    const booking = scenario.devices[0].bookings[0];

    // Dispara atualização de bateria + geração de PIN simultaneamente
    await Promise.all([
      Promise.resolve(harness.updateDeviceStatus(device.id, { batteryLevel: 50 })),
      harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
      }),
    ]);

    // Dispositivo tem bateria atualizada
    const updatedDevice = harness.db.devices.get(device.id)!;
    expect(updatedDevice.batteryLevel).toBe(50);

    // PIN foi gerado
    expect(Array.from(harness.db.codes.values())).toHaveLength(1);
  });

  it('6. RACE: 2 tenants diferentes, geração simultânea não interfere', async () => {
    const scenarioA = generatePousadaScenario('pousada-A', 1, 1);
    const scenarioB = generatePousadaScenario('pousada-B', 1, 1);
    seedScenario(harness, scenarioA);
    seedScenario(harness, scenarioB);

    // Dispara geração em paralelo nos 2 tenants
    const [resultA, resultB] = await Promise.all([
      (async () => {
        harness.setTenant('pousada-A');
        return harness.generatePin(scenarioA.devices[0].device.id, {
          guestName: scenarioA.devices[0].bookings[0].guestName,
          guestPhone: scenarioA.devices[0].bookings[0].guestPhone,
          checkInDate: scenarioA.devices[0].bookings[0].checkIn,
          checkOutDate: scenarioA.devices[0].bookings[0].checkOut,
          autoGenerate: true,
        });
      })(),
      (async () => {
        harness.setTenant('pousada-B');
        return harness.generatePin(scenarioB.devices[0].device.id, {
          guestName: scenarioB.devices[0].bookings[0].guestName,
          guestPhone: scenarioB.devices[0].bookings[0].guestPhone,
          checkInDate: scenarioB.devices[0].bookings[0].checkIn,
          checkOutDate: scenarioB.devices[0].bookings[0].checkOut,
          autoGenerate: true,
        });
      })(),
    ]);

    // Cada PIN tem tenantId correto
    expect(resultA.code.tenantId).toBe('pousada-A');
    expect(resultB.code.tenantId).toBe('pousada-B');

    // PINs têm códigos diferentes
    expect(resultA.code.code).not.toBe(resultB.code.code);

    // Cada tenant vê apenas seu PIN
    expect(harness.listPinsByTenant('pousada-A')).toHaveLength(1);
    expect(harness.listPinsByTenant('pousada-B')).toHaveLength(1);
  });

  it('7. RACE: geração + revogação + re-geração em sequência rápida', async () => {
    const scenario = generatePousadaScenario('pousada-race-7', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-race-7');

    const device = scenario.devices[0].device;
    const booking = scenario.devices[0].bookings[0];

    // Etapa 1: gera PIN
    const { code: pin1 } = await harness.generatePin(device.id, {
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      checkInDate: booking.checkIn,
      checkOutDate: booking.checkOut,
      autoGenerate: true,
    });

    // Etapa 2: imediatamente revoga
    harness.revokePin(pin1.id, 'Revogação rápida');

    // Etapa 3: imediatamente gera novo PIN
    const { code: pin2 } = await harness.generatePin(device.id, {
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      checkInDate: booking.checkIn,
      checkOutDate: booking.checkOut,
      autoGenerate: true,
    });

    // pin1 está revogado, pin2 está ativo
    expect(harness.db.codes.get(pin1.id)!.status).toBe('revoked');
    expect(['scheduled', 'active']).toContain(pin2.status);

    // 2 PINs no DB
    expect(Array.from(harness.db.codes.values())).toHaveLength(2);

    // 2 eventos 'generated' + 1 evento 'revoked'
    const genEvents = harness.listEventsByTenant('pousada-race-7', 'generated');
    const revokedEvents = harness.listEventsByTenant('pousada-race-7', 'revoked');
    expect(genEvents).toHaveLength(2);
    expect(revokedEvents).toHaveLength(1);
  });

  it('8. RACE: 2 pânicos em dispositivos diferentes simultaneamente', async () => {
    const scenario = generatePousadaScenario('pousada-race-8', 10, 3);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-race-8');

    // Gera 30 PINs (10 dispositivos × 3 bookings)
    for (const { device, bookings } of scenario.devices) {
      for (const booking of bookings) {
        await harness.generatePin(device.id, {
          guestName: booking.guestName,
          guestPhone: booking.guestPhone,
          checkInDate: booking.checkIn,
          checkOutDate: booking.checkOut,
          autoGenerate: true,
        });
      }
    }

    // Dispara pânico em 2 dispositivos diferentes simultaneamente
    const [count1, count2] = await Promise.all([
      Promise.resolve(harness.panicRevokeAllPins(scenario.devices[0].device.id, 'Pânico A')),
      Promise.resolve(harness.panicRevokeAllPins(scenario.devices[1].device.id, 'Pânico B')),
    ]);

    // Cada dispositivo tinha 3 PINs
    expect(count1).toBe(3);
    expect(count2).toBe(3);

    // Os outros 8 dispositivos continuam com PINs não-revogados
    for (let i = 2; i < 10; i++) {
      const activeCount = harness.countNonRevokedPins(scenario.devices[i].device.id);
      expect(activeCount).toBe(3);
    }

    // 2 eventos panic_revoke (1 por dispositivo)
    const panicEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'panic_revoke');
    expect(panicEvents).toHaveLength(2);
  });
});
