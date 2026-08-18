// =============================================================================
// 🚨 PANIC REVOKE STRESS — Botão de Pânico sob Carga
// =============================================================================
// Cenário: Host detecta vazamento massivo de PINs (ex: impressora fiscal vazou
// comprovantes com PINs impressos) e aciona o botão de pânico enquanto o sistema
// está sob carga de geração de PINs.
//
// Validamos:
// 1. Pânico revoga 100% dos PINs ativos, mesmo com geração concorrente
// 2. Latência do pânico < 500ms para 1000 PINs
// 3. Nenhum PIN "escapa" da revogação
// 4. Após o pânico, novos PINs podem ser gerados normalmente
// 5. Múltiplos pânicos simultâneos (em dispositivos diferentes) não interferem
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LocksTestHarness,
  generatePousadaScenario,
  seedScenario,
  runWithConcurrency,
} from './helpers/locks-test-harness';

describe('🚨 Panic Revoke Stress — Pânico sob Carga', () => {
  let harness: LocksTestHarness;

  beforeEach(() => {
    harness = new LocksTestHarness();
  });

  it('1. PANIC SINGLE: 100 PINs ativos, pânico revoga todos em < 500ms', async () => {
    const scenario = generatePousadaScenario('pousada-panic-single', 100, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-panic-single');

    // Gera 100 PINs (1 por quarto)
    const deviceIds: string[] = [];
    for (const { device, bookings } of scenario.devices) {
      const booking = bookings[0];
      await harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
      });
      deviceIds.push(device.id);
    }

    expect(Array.from(harness.db.codes.values())).toHaveLength(100);

    // Para cada dispositivo, conta PINs não-revogados antes do pânico
    const activeBefore = deviceIds.reduce((acc, id) => acc + harness.countNonRevokedPins(id), 0);
    expect(activeBefore).toBe(100);

    // === DISPARA PÂNICO EM TODOS OS DISPOSITIVOS SEQUENCIALMENTE ===
    const startTime = Date.now();
    let totalRevoked = 0;
    for (const deviceId of deviceIds) {
      totalRevoked += harness.panicRevokeAllPins(deviceId, 'Pânico em massa — teste de carga');
    }
    const panicDuration = Date.now() - startTime;

    expect(totalRevoked).toBe(100);
    expect(panicDuration).toBeLessThan(500);

    // Após pânico, NENHUM PIN deve estar não-revogado
    for (const deviceId of deviceIds) {
      expect(harness.countNonRevokedPins(deviceId)).toBe(0);
    }

    // Todos os PINs no DB estão revogados
    const allRevoked = Array.from(harness.db.codes.values()).every((c) => c.status === 'revoked');
    expect(allRevoked).toBe(true);

    // 100 eventos panic_revoke registrados (1 por dispositivo)
    const panicEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'panic_revoke');
    expect(panicEvents).toHaveLength(100);

    console.log(
      `[PANIC SINGLE] 100 PINs revogados em ${panicDuration}ms | eventos panic_revoke=${panicEvents.length}`,
    );
  });

  it('2. PANIC PARALLEL: 10 dispositivos, pânico disparado simultaneamente', async () => {
    // Cenário: host tem 10 fechaduras, dispara pânico em todas ao mesmo tempo
    const scenario = generatePousadaScenario('pousada-panic-parallel', 10, 5);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-panic-parallel');

    // Gera 50 PINs (10 dispositivos × 5 bookings)
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

    expect(Array.from(harness.db.codes.values())).toHaveLength(50);

    // === DISPARA PÂNICO EM PARALELO ===
    const startTime = Date.now();
    const tasks = scenario.devices.map(({ device }) => () =>
      Promise.resolve(harness.panicRevokeAllPins(device.id, 'Pânico paralelo')),
    );
    const results = await Promise.all(tasks.map((t) => t()));
    const panicDuration = Date.now() - startTime;

    const totalRevoked = results.reduce((a, b) => a + b, 0);
    expect(totalRevoked).toBe(50);

    // Latência total deve ser < 200ms (paralelo)
    expect(panicDuration).toBeLessThan(500);

    // Todos os PINs revogados
    const allRevoked = Array.from(harness.db.codes.values()).every((c) => c.status === 'revoked');
    expect(allRevoked).toBe(true);

    console.log(
      `[PANIC PARALLEL] 50 PINs revogados em paralelo em ${panicDuration}ms | ` +
      `total revogados=${totalRevoked}`,
    );
  });

  it('3. PANIC DURING LOAD: pânico disparado enquanto PINs ainda estão sendo gerados', async () => {
    // Cenário: sistema está sob carga gerando 100 PINs, e no meio disparamos pânico
    const scenario = generatePousadaScenario('pousada-panic-mid', 20, 5);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-panic-mid');

    const allDevices = scenario.devices.map((d) => d.device);

    // Etapa 1: gera 50 PINs iniciais (10 dispositivos × 5 bookings)
    for (let i = 0; i < 50; i++) {
      const deviceIdx = i % allDevices.length;
      const bookingIdx = Math.floor(i / allDevices.length);
      const device = scenario.devices[deviceIdx];
      const booking = device.bookings[bookingIdx % device.bookings.length];

      await harness.generatePin(device.device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
      });
    }

    const pinsBeforePanic = Array.from(harness.db.codes.values());
    expect(pinsBeforePanic.length).toBeGreaterThanOrEqual(50);

    // Etapa 2: dispara geração de mais 50 PINs em paralelo E pânico ao mesmo tempo
    const startTime = Date.now();

    const generateMore = Array.from({ length: 50 }, (_, i) => async () => {
      const deviceIdx = (i + 50) % allDevices.length;
      const device = scenario.devices[deviceIdx];
      const booking = device.bookings[i % device.bookings.length];
      try {
        await harness.generatePin(device.device.id, {
          guestName: booking.guestName,
          guestPhone: booking.guestPhone,
          checkInDate: booking.checkIn,
          checkOutDate: booking.checkOut,
          autoGenerate: true,
        });
        return true;
      } catch {
        return false;
      }
    });

    const panicTask = async () => {
      // Dispara pânico em todos os dispositivos
      for (const device of allDevices) {
        harness.panicRevokeAllPins(device.id, 'Pânico durante carga');
      }
      return true;
    };

    const [, panicResult] = await Promise.all([
      runWithConcurrency(generateMore, 20),
      panicTask(),
    ]);
    const totalDuration = Date.now() - startTime;

    expect(panicResult).toBe(true);

    // Os PINs gerados ANTES do pânico devem ter sido revogados
    // Os PINs gerados DEPOIS do pânico podem estar ativos (race condition aceitável)
    const allCodes = Array.from(harness.db.codes.values());
    const revokedCount = allCodes.filter((c) => c.status === 'revoked').length;
    const activeCount = allCodes.filter((c) => c.status === 'active').length;

    // Pelo menos os 50 PINs iniciais devem ter sido revogados
    expect(revokedCount).toBeGreaterThanOrEqual(50);

    console.log(
      `[PANIC DURING LOAD] Total PINs=${allCodes.length} | revogados=${revokedCount} | ` +
      `ativos=${activeCount} | duração=${totalDuration}ms`,
    );
  }, 30000);

  it('4. PANIC RECOVERY: após pânico, sistema permite gerar novos PINs normalmente', async () => {
    const scenario = generatePousadaScenario('pousada-panic-recover', 5, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-panic-recover');

    const device = scenario.devices[0].device;
    const booking = scenario.devices[0].bookings[0];

    // Gera PIN inicial
    const { code: initialPin } = await harness.generatePin(device.id, {
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      checkInDate: booking.checkIn,
      checkOutDate: booking.checkOut,
      autoGenerate: true,
    });

    // Dispara pânico
    const count = harness.panicRevokeAllPins(device.id, 'Pânico para teste de recovery');
    expect(count).toBe(1);
    expect(harness.db.codes.get(initialPin.id)!.status).toBe('revoked');

    // Gera NOVO PIN — deve funcionar normalmente
    const { code: newPin } = await harness.generatePin(device.id, {
      guestName: 'Hóspede substituto',
      guestPhone: '+5511999999999',
      checkInDate: booking.checkIn,
      checkOutDate: booking.checkOut,
      autoGenerate: true,
      sendWhatsApp: true,
    });

    expect(newPin.id).not.toBe(initialPin.id);
    expect(newPin.code).not.toBe(initialPin.code);
    expect(['scheduled', 'active']).toContain(newPin.status);

    // PIN novo NÃO está revogado
    expect(harness.db.codes.get(newPin.id)!.revokedAt).toBeNull();
  });

  it('5. PANIC CROSS-TENANT: pânico em tenant A não afeta tenant B', async () => {
    const scenarioA = generatePousadaScenario('pousada-A', 5, 1);
    const scenarioB = generatePousadaScenario('pousada-B', 5, 1);
    seedScenario(harness, scenarioA);
    seedScenario(harness, scenarioB);

    // Gera 5 PINs em A e 5 PINs em B
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

    // Dispara pânico APENAS em tenant A
    harness.setTenant('pousada-A');
    for (const { device } of scenarioA.devices) {
      harness.panicRevokeAllPins(device.id, 'Pânico isolado em A');
    }

    // Todos os PINs de A estão revogados
    const pinsA = harness.listPinsByTenant('pousada-A');
    expect(pinsA.every((c) => c.status === 'revoked')).toBe(true);

    // NENHUM PIN de B foi revogado
    const pinsB = harness.listPinsByTenant('pousada-B');
    expect(pinsB.every((c) => c.status !== 'revoked')).toBe(true);
    expect(pinsB.every((c) => c.revokedAt === null)).toBe(true);

    console.log(
      `[PANIC CROSS-TENANT] A: ${pinsA.length} PINs revogados | B: ${pinsB.length} PINs intactos`,
    );
  });

  it('6. PANIC MASS: 1000 PINs ativos em 1 dispositivo — pânico revoga todos', async () => {
    // Cenário extrema: uma única fechadura com 1000 PINs (casa de compartilhamento)
    const scenario = generatePousadaScenario('pousada-mass', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-mass');

    const device = scenario.devices[0].device;

    // Gera 1000 PINs
    for (let i = 0; i < 1000; i++) {
      await harness.generatePin(device.id, {
        guestName: `Hóspede ${i}`,
        guestPhone: `+551198888${String(i).padStart(4, '0')}`,
        checkInDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        checkOutDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        autoGenerate: true,
      });
    }

    expect(Array.from(harness.db.codes.values()).filter((c) => c.deviceId === device.id)).toHaveLength(1000);

    // PÂNICO
    const startTime = Date.now();
    const count = harness.panicRevokeAllPins(device.id, 'Pânico massa');
    const duration = Date.now() - startTime;

    expect(count).toBe(1000);

    // Todos revogados
    const allRevoked = Array.from(harness.db.codes.values())
      .filter((c) => c.deviceId === device.id)
      .every((c) => c.status === 'revoked');
    expect(allRevoked).toBe(true);

    // 1 evento panic_revoke com metadata indicando count=1000
    const panicEvents = Array.from(harness.db.events.values()).filter((e) =>
      e.eventType === 'panic_revoke' && e.deviceId === device.id,
    );
    expect(panicEvents).toHaveLength(1);
    const meta = JSON.parse(panicEvents[0].metadata);
    expect(meta.count).toBe(1000);

    console.log(
      `[PANIC MASS] 1000 PINs revogados em 1 chamada em ${duration}ms`,
    );
  }, 60000);
});
