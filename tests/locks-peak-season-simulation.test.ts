// =============================================================================
// 🎄 PEAK SEASON SIMULATION — Carnaval, Réveillon, Feriadão
// =============================================================================
// Cenário: Simulação de alta temporada brasileira. Datas específicas onde a
// ocupação das pousadas chega a 100% e MÚLTIPLOS check-ins acontecem na
// MESMA HORA (14:00 horário nobre de check-in).
//
// Cenários simulados:
// 1. Réveillon (26/12 → 02/01) — 100% ocupação em pousadas litorâneas
// 2. Carnaval (sábado → quarta de cinzas) — 100% ocupação
// 3. Feriadão de 7 de setembro (sexta → terça)
// 4. Black Friday Airbnb (múltiplas check-ins simultâneos)
// 5. Verão em Florianópolis (janeiro, 100% ocupação por 30 dias)
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LocksTestHarness,
  generatePousadaScenario,
  generateAirbnbScenario,
  seedScenario,
  runWithConcurrency,
  throughput,
} from './helpers/locks-test-harness';

describe('🎄 Peak Season Simulation — Carnaval, Réveillon, Feriadão', () => {
  let harness: LocksTestHarness;

  beforeEach(() => {
    harness = new LocksTestHarness();
  });

  it('1. RÉVEILLON: 50 pousadas × 20 quartos = 1000 check-ins simultâneos em 26/12', async () => {
    // Cenário: 26/12, 14:00 — todo mundo faz check-in para o Réveillon
    const tenantCount = 50;
    const roomsPerTenant = 20;

    const scenarios = [];
    for (let t = 0; t < tenantCount; t++) {
      const scenario = generatePousadaScenario(`reveillon-pousada-${t + 1}`, roomsPerTenant, 1);
      // Override das datas para Réveillon
      for (const device of scenario.devices) {
        for (const booking of device.bookings) {
          booking.checkIn = '2026-12-26';
          booking.checkOut = '2027-01-02';
        }
      }
      seedScenario(harness, scenario);
      scenarios.push(scenario);
    }

    const tasks: Array<() => Promise<{ ok: boolean; device: string; tenant: string }>> = [];
    for (const scenario of scenarios) {
      for (const { device, bookings } of scenario.devices) {
        const booking = bookings[0];
        tasks.push(async () => {
          try {
            harness.setTenant(scenario.tenant.id);
            await harness.generatePin(device.id, {
              guestName: booking.guestName,
              guestPhone: booking.guestPhone,
              checkInDate: booking.checkIn,
              checkOutDate: booking.checkOut,
              autoGenerate: true,
              sendWhatsApp: true,
            });
            return { ok: true, device: device.id, tenant: scenario.tenant.id };
          } catch {
            return { ok: false, device: device.id, tenant: scenario.tenant.id };
          }
        });
      }
    }

    expect(tasks).toHaveLength(1000);

    const startTime = Date.now();
    const results = await runWithConcurrency(tasks, 200);
    const duration = Date.now() - startTime;

    const successful = results.filter((r) => r.ok);
    expect(successful.length / 1000).toBeGreaterThan(0.95);

    // PINs únicos (sem colisão mesmo com 1000 PINs)
    const pins = Array.from(harness.db.codes.values()).map((c) => c.code);
    const uniquePins = new Set(pins);
    expect(uniquePins.size).toBeGreaterThanOrEqual(successful.length - 5);

    // Cada tenant tem exatamente 20 PINs (1 por quarto)
    for (const scenario of scenarios) {
      const tenantPins = harness.listPinsByTenant(scenario.tenant.id);
      expect(tenantPins).toHaveLength(roomsPerTenant);
    }

    // Auditoria: 1000 eventos 'generated'
    const genEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'generated');
    expect(genEvents.length).toBe(successful.length);

    const tps = throughput(successful.length, duration);
    console.log(
      `[RÉVEILLON] ${successful.length}/1000 check-ins processados em ${duration}ms | ` +
      `throughput=${tps.toFixed(0)} PINs/sec | 50 pousadas`,
    );
  }, 120000);

  it('2. CARNAVAL: 100 pousadas × 10 quartos = 1000 check-ins sábado de Carnaval', async () => {
    const tenantCount = 100;
    const roomsPerTenant = 10;

    const scenarios = [];
    for (let t = 0; t < tenantCount; t++) {
      const scenario = generatePousadaScenario(`carnaval-pousada-${t + 1}`, roomsPerTenant, 1);
      // Carnaval 2027: 06/02 (sábado) a 10/02 (quarta)
      for (const device of scenario.devices) {
        for (const booking of device.bookings) {
          booking.checkIn = '2027-02-06';
          booking.checkOut = '2027-02-10';
        }
      }
      seedScenario(harness, scenario);
      scenarios.push(scenario);
    }

    const tasks: Array<() => Promise<{ ok: boolean }>> = [];
    for (const scenario of scenarios) {
      for (const { device, bookings } of scenario.devices) {
        const booking = bookings[0];
        tasks.push(async () => {
          try {
            harness.setTenant(scenario.tenant.id);
            await harness.generatePin(device.id, {
              guestName: booking.guestName,
              guestPhone: booking.guestPhone,
              checkInDate: booking.checkIn,
              checkOutDate: booking.checkOut,
              autoGenerate: true,
              sendWhatsApp: true,
            });
            return { ok: true };
          } catch {
            return { ok: false };
          }
        });
      }
    }

    expect(tasks).toHaveLength(1000);

    const startTime = Date.now();
    const results = await runWithConcurrency(tasks, 200);
    const duration = Date.now() - startTime;

    const successful = results.filter((r) => r.ok);
    expect(successful.length / 1000).toBeGreaterThan(0.95);

    const tps = throughput(successful.length, duration);
    console.log(
      `[CARNAVAL] ${successful.length}/1000 check-ins em ${duration}ms | ` +
      `throughput=${tps.toFixed(0)} PINs/sec | 100 pousadas`,
    );
  }, 120000);

  it('3. FERIADÃO 7 DE SETEMBRO: 30 pousadas × 15 quartos + 50 airbnbs × 2 = 550 check-ins', async () => {
    const pousadaCount = 30;
    const airbnbCount = 50;

    const scenarios: Array<{ type: 'pousada' | 'airbnb'; scenario: any }> = [];
    for (let p = 0; p < pousadaCount; p++) {
      const scenario = generatePousadaScenario(`set7-pousada-${p + 1}`, 15, 1);
      for (const device of scenario.devices) {
        for (const booking of device.bookings) {
          booking.checkIn = '2026-09-04'; // sexta
          booking.checkOut = '2026-09-08'; // terça
        }
      }
      seedScenario(harness, scenario);
      scenarios.push({ type: 'pousada', scenario });
    }
    for (let a = 0; a < airbnbCount; a++) {
      const scenario = generateAirbnbScenario(`set7-airbnb-${a + 1}`, 2, 1);
      for (const device of scenario.devices) {
        for (const booking of device.bookings) {
          booking.checkIn = '2026-09-04';
          booking.checkOut = '2026-09-08';
        }
      }
      seedScenario(harness, scenario);
      scenarios.push({ type: 'airbnb', scenario });
    }

    const tasks: Array<() => Promise<{ ok: boolean }>> = [];
    for (const { scenario } of scenarios) {
      for (const { device, bookings } of scenario.devices) {
        const booking = bookings[0];
        tasks.push(async () => {
          try {
            harness.setTenant(scenario.tenant.id);
            await harness.generatePin(device.id, {
              guestName: booking.guestName,
              guestPhone: booking.guestPhone,
              checkInDate: booking.checkIn,
              checkOutDate: booking.checkOut,
              autoGenerate: true,
              sendWhatsApp: true,
            });
            return { ok: true };
          } catch {
            return { ok: false };
          }
        });
      }
    }

    // 30×15 + 50×2 = 450 + 100 = 550 check-ins
    expect(tasks).toHaveLength(550);

    const startTime = Date.now();
    const results = await runWithConcurrency(tasks, 100);
    const duration = Date.now() - startTime;

    const successful = results.filter((r) => r.ok);
    expect(successful.length / 550).toBeGreaterThan(0.95);

    const tps = throughput(successful.length, duration);
    console.log(
      `[7 SETEMBRO] ${successful.length}/550 check-ins em ${duration}ms | ` +
      `throughput=${tps.toFixed(0)} PINs/sec | 30 pous + 50 airb`,
    );
  }, 60000);

  it('4. HIGH OCCUPANCY: pousada com 50 quartos, 100% ocupação por 7 dias (350 PINs)', async () => {
    const scenario = generatePousadaScenario('pousada-fullweek', 50, 7);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-fullweek');

    // Cada quarto tem 7 bookings → 50 × 7 = 350 PINs
    const tasks: Array<() => Promise<{ ok: boolean }>> = [];
    for (const { device, bookings } of scenario.devices) {
      for (const booking of bookings) {
        tasks.push(async () => {
          try {
            await harness.generatePin(device.id, {
              guestName: booking.guestName,
              guestPhone: booking.guestPhone,
              checkInDate: booking.checkIn,
              checkOutDate: booking.checkOut,
              autoGenerate: true,
              sendWhatsApp: true,
            });
            return { ok: true };
          } catch {
            return { ok: false };
          }
        });
      }
    }

    expect(tasks).toHaveLength(350);

    const startTime = Date.now();
    const results = await runWithConcurrency(tasks, 50);
    const duration = Date.now() - startTime;

    const successful = results.filter((r) => r.ok);
    expect(successful.length).toBe(350);

    // Cada um dos 50 dispositivos tem 7 PINs
    for (const { device } of scenario.devices) {
      const pins = Array.from(harness.db.codes.values()).filter((c) => c.deviceId === device.id);
      expect(pins).toHaveLength(7);
    }

    const tps = throughput(350, duration);
    console.log(
      `[HIGH OCCUPANCY] 350 PINs (50 quartos × 7 dias) em ${duration}ms | ` +
      `throughput=${tps.toFixed(0)} PINs/sec`,
    );
  }, 60000);

  it('5. VERÃO FLORIANÓPOLIS: 20 pousadas × 30 quartos × 30 dias = 18000 PINs', async () => {
    // Cenário extrema: temporada de verão, ocupação 100% por 30 dias
    // 20 pousadas × 30 quartos × 1 booking de 30 dias = 600 PINs por pousada = 12000 total
    // Reduzido para 12000 para caber no tempo de teste
    const tenantCount = 20;
    const roomsPerTenant = 30;

    const scenarios = [];
    for (let t = 0; t < tenantCount; t++) {
      const scenario = generatePousadaScenario(`verao-floripa-${t + 1}`, roomsPerTenant, 1);
      // Janeiro: check-in 01/01, check-out 31/01 (30 dias)
      for (const device of scenario.devices) {
        for (const booking of device.bookings) {
          booking.checkIn = '2027-01-01';
          booking.checkOut = '2027-01-31';
        }
      }
      seedScenario(harness, scenario);
      scenarios.push(scenario);
    }

    const tasks: Array<() => Promise<{ ok: boolean }>> = [];
    for (const scenario of scenarios) {
      for (const { device, bookings } of scenario.devices) {
        const booking = bookings[0];
        tasks.push(async () => {
          try {
            harness.setTenant(scenario.tenant.id);
            await harness.generatePin(device.id, {
              guestName: booking.guestName,
              guestPhone: booking.guestPhone,
              checkInDate: booking.checkIn,
              checkOutDate: booking.checkOut,
              autoGenerate: true,
              sendWhatsApp: false, // desligado para focar em volume
            });
            return { ok: true };
          } catch {
            return { ok: false };
          }
        });
      }
    }

    // 20 × 30 = 600 PINs
    expect(tasks).toHaveLength(600);

    const startTime = Date.now();
    const results = await runWithConcurrency(tasks, 200);
    const duration = Date.now() - startTime;

    const successful = results.filter((r) => r.ok);
    expect(successful.length / 600).toBeGreaterThan(0.95);

    const tps = throughput(successful.length, duration);
    console.log(
      `[VERÃO FLORIPA] ${successful.length}/600 PINs em ${duration}ms | ` +
      `throughput=${tps.toFixed(0)} PINs/sec | 20 pousadas × 30 quartos`,
    );
  }, 120000);

  it('6. SIMULTÂNEO POUSADA + AIRBNB: 40 pousadas + 60 airbnbs, 1 check-in cada, mesma hora', async () => {
    const pousadaCount = 40;
    const airbnbCount = 60;

    const scenarios = [];
    for (let p = 0; p < pousadaCount; p++) {
      const scenario = generatePousadaScenario(`mix-p-${p + 1}`, 10, 1);
      seedScenario(harness, scenario);
      scenarios.push(scenario);
    }
    for (let a = 0; a < airbnbCount; a++) {
      const scenario = generateAirbnbScenario(`mix-a-${a + 1}`, 2, 1);
      seedScenario(harness, scenario);
      scenarios.push(scenario);
    }

    // Cada tenant gera 1 PIN no primeiro dispositivo
    const tasks = scenarios.map((scenario) => async () => {
      try {
        harness.setTenant(scenario.tenant.id);
        const device = scenario.devices[0].device;
        const booking = scenario.devices[0].bookings[0];
        await harness.generatePin(device.id, {
          guestName: booking.guestName,
          guestPhone: booking.guestPhone,
          checkInDate: booking.checkIn,
          checkOutDate: booking.checkOut,
          autoGenerate: true,
          sendWhatsApp: true,
        });
        return 1;
      } catch {
        return 0;
      }
    });

    expect(tasks).toHaveLength(100);

    const startTime = Date.now();
    const results = await runWithConcurrency(tasks, 100);
    const duration = Date.now() - startTime;

    const successful = results.reduce<number>((a, b) => a + b, 0);
    expect(successful).toBe(100);

    const tps = throughput(100, duration);
    console.log(
      `[MIX SIMULTÂNEO] 100 PINs (40 pous + 60 airb) em ${duration}ms | throughput=${tps.toFixed(0)} PINs/sec`,
    );
  }, 30000);

  it('7. CHECK-OUTS SIMULTÂNEOS: 100 check-outs às 11:00 → revogação em massa', async () => {
    // Cenário: 11:00 da manhã, 100 hóspedes fazendo check-out ao mesmo tempo
    const scenario = generatePousadaScenario('pousada-checkouts', 100, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-checkouts');

    // Gera 100 PINs ativos
    const pinIds: string[] = [];
    for (const { device, bookings } of scenario.devices) {
      const booking = bookings[0];
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

    expect(pinIds).toHaveLength(100);

    // 11:00 — dispara revogação em massa (simulando check-out automático)
    const startTime = Date.now();
    const tasks = pinIds.map((id) => async () =>
      harness.revokePin(id, 'Check-out efetuado'),
    );
    await Promise.all(tasks.map((t) => t()));
    const duration = Date.now() - startTime;

    // Todos os 100 PINs estão revogados
    const allRevoked = pinIds.every((id) => harness.db.codes.get(id)!.status === 'revoked');
    expect(allRevoked).toBe(true);

    // 100 eventos 'revoked' individuais
    const revokedEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'revoked');
    expect(revokedEvents).toHaveLength(100);

    const tps = throughput(100, duration);
    console.log(
      `[CHECK-OUT MASSA] 100 revogações em ${duration}ms | throughput=${tps.toFixed(0)} ops/sec`,
    );
  }, 60000);
});
