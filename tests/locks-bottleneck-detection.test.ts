// =============================================================================
// 📊 BOTTLENECK DETECTION — Identificação de Gargalos e Benchmarks
// =============================================================================
// Objetivo: medir tempos de execução de cada etapa do pipeline de fechaduras
// para identificar gargalos e definir capacidades máximas.
//
// Métricas coletadas:
// - PIN generation throughput (PINs/sec)
// - Latência P50/P95/P99 por operação
// - Memory footprint (Number of devices × codes × events)
// - WhatsApp delivery throughput
// - Status derivation cost
// - Provider loading time (mock)
// - DB write contention (simulated)
//
// Os resultados são logados para análise em CI.
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LocksTestHarness,
  generatePousadaScenario,
  seedScenario,
  runWithConcurrency,
  measureLatencies,
  throughput,
} from './helpers/locks-test-harness';
import {
  generateRandomPin,
  derivePinStatus,
  calculatePinValidityWindow,
} from '../src/lib/locks/pin-generator';
import { getBrandInfo } from '../src/lib/locks/types';

describe('📊 Bottleneck Detection — Benchmarks e Identificação de Gargalos', () => {
  let harness: LocksTestHarness;

  beforeEach(() => {
    harness = new LocksTestHarness();
  });

  it('1. BENCHMARK: geração pura de PIN criptográfico (CSPRNG)', () => {
    // Mede a capacidade pura do gerador de PIN (sem I/O, sem DB, sem WhatsApp)
    const count = 10000;
    const startTime = Date.now();
    const pins: string[] = [];
    for (let i = 0; i < count; i++) {
      pins.push(generateRandomPin());
    }
    const duration = Date.now() - startTime;
    const tps = throughput(count, duration);

    expect(pins).toHaveLength(count);
    expect(tps).toBeGreaterThan(10000); // pelo menos 10k PINs/sec

    console.log(
      `[BENCH CSPRNG] ${count} PINs em ${duration}ms | throughput=${tps.toFixed(0)} PINs/sec`,
    );
  });

  it('2. BENCHMARK: derivePinStatus (sem I/O)', () => {
    // Mede o custo de derivar status (usado em listPins)
    const count = 10000;
    const pins = Array.from({ length: count }, () => ({
      validFrom: new Date(Date.now() - Math.random() * 86400000),
      validTo: new Date(Date.now() + Math.random() * 86400000),
      usedAt: Math.random() > 0.5 ? new Date() : null,
      revokedAt: Math.random() > 0.9 ? new Date() : null,
    }));

    const startTime = Date.now();
    const statuses = pins.map((p) => derivePinStatus(p));
    const duration = Date.now() - startTime;
    const tps = throughput(count, duration);

    expect(statuses).toHaveLength(count);
    expect(tps).toBeGreaterThan(50000); // pelo menos 50k ops/sec

    console.log(
      `[BENCH derivePinStatus] ${count} em ${duration}ms | throughput=${tps.toFixed(0)} ops/sec`,
    );
  });

  it('3. BENCHMARK: calculatePinValidityWindow (sem I/O)', () => {
    const count = 10000;
    const startTime = Date.now();
    for (let i = 0; i < count; i++) {
      calculatePinValidityWindow(
        '2026-03-20',
        '2026-03-25',
        '14:00',
        '11:00',
      );
    }
    const duration = Date.now() - startTime;
    const tps = throughput(count, duration);

    expect(tps).toBeGreaterThan(10000);

    console.log(
      `[BENCH calcValidityWindow] ${count} em ${duration}ms | throughput=${tps.toFixed(0)} ops/sec`,
    );
  });

  it('4. BENCHMARK: pipeline completo (gerar PIN + DB + evento + WhatsApp) — 100 PINs', async () => {
    const scenario = generatePousadaScenario('pousada-bench-100', 100, 1);
    seedScenario(harness, scenario);

    const tasks = scenario.devices.map(({ device, bookings }) => async () => {
      const startedAt = Date.now();
      harness.setTenant('pousada-bench-100');
      const booking = bookings[0];
      await harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
        sendWhatsApp: true,
      });
      return { startedAt, endedAt: Date.now(), result: null as any };
    });

    const startTime = Date.now();
    const results = await runWithConcurrency(tasks, 50);
    const totalDuration = Date.now() - startTime;

    const latencies = measureLatencies(results);
    const tps = throughput(results.length, totalDuration);

    console.log(
      `[BENCH pipeline-100] ${results.length} PINs em ${totalDuration}ms | ` +
      `p50=${latencies.p50Ms.toFixed(0)}ms p95=${latencies.p95Ms.toFixed(0)}ms ` +
      `p99=${latencies.p99Ms.toFixed(0)}ms | throughput=${tps.toFixed(0)} PINs/sec | ` +
      `WhatsApp sent=${harness.whatsapp.stats.sent} failed=${harness.whatsapp.stats.failed}`,
    );

    expect(results).toHaveLength(100);
    expect(tps).toBeGreaterThan(20);
  }, 30000);

  it('5. BENCHMARK: pipeline completo — 1000 PINs (com concorrência controlada)', async () => {
    const scenario = generatePousadaScenario('pousada-bench-1k', 200, 5);
    seedScenario(harness, scenario);

    const tasks: Array<() => Promise<{ startedAt: number; endedAt: number; result: any }>> = [];
    for (const { device, bookings } of scenario.devices) {
      for (const booking of bookings) {
        tasks.push(async () => {
          const startedAt = Date.now();
          harness.setTenant('pousada-bench-1k');
          await harness.generatePin(device.id, {
            guestName: booking.guestName,
            guestPhone: booking.guestPhone,
            checkInDate: booking.checkIn,
            checkOutDate: booking.checkOut,
            autoGenerate: true,
            sendWhatsApp: false, // Sem WhatsApp para isolar pipeline
          });
          return { startedAt, endedAt: Date.now(), result: null as any };
        });
      }
    }

    expect(tasks).toHaveLength(1000);

    const startTime = Date.now();
    const results = await runWithConcurrency(tasks, 100);
    const totalDuration = Date.now() - startTime;

    const latencies = measureLatencies(results);
    const tps = throughput(results.length, totalDuration);

    // Resultados devem ajudar a identificar gargalos:
    // - Se p99 > 5× p50 → há contenção
    // - Se throughput decai com mais PINs → há saturação
    const p99OverP50 = latencies.p99Ms / Math.max(latencies.p50Ms, 1);

    console.log(
      `[BENCH pipeline-1k] ${results.length} PINs em ${totalDuration}ms | ` +
      `p50=${latencies.p50Ms.toFixed(0)}ms p95=${latencies.p95Ms.toFixed(0)}ms ` +
      `p99=${latencies.p99Ms.toFixed(0)}ms max=${latencies.maxMs.toFixed(0)}ms | ` +
      `throughput=${tps.toFixed(0)} PINs/sec | p99/p50=${p99OverP50.toFixed(1)}x`,
    );

    expect(results).toHaveLength(1000);
    expect(tps).toBeGreaterThan(50);
  }, 60000);

  it('6. BENCHMARK: listPins (DB scan) com 5000 PINs', async () => {
    const scenario = generatePousadaScenario('pousada-bench-list', 100, 50);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-bench-list');

    // Gera 5000 PINs
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

    const totalPins = Array.from(harness.db.codes.values()).length;
    expect(totalPins).toBe(5000);

    // Mede tempo de listagem por tenant
    const iterations = 100;
    const startTime = Date.now();
    for (let i = 0; i < iterations; i++) {
      harness.listPinsByTenant('pousada-bench-list');
    }
    const duration = Date.now() - startTime;
    const opsPerSec = throughput(iterations, duration);

    console.log(
      `[BENCH listPins] ${iterations} scans de 5000 PINs em ${duration}ms | ` +
      `${opsPerSec.toFixed(0)} scans/sec`,
    );

    expect(opsPerSec).toBeGreaterThan(100);
  }, 120000);

  it('7. BENCHMARK: WhatsApp delivery sob carga (200 mensagens em paralelo)', async () => {
    const scenario = generatePousadaScenario('pousada-bench-wa', 200, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-bench-wa');

    const tasks = scenario.devices.map(({ device, bookings }) => async () => {
      const booking = bookings[0];
      const { code } = await harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
        sendWhatsApp: true,
      });
      return code;
    });

    const startTime = Date.now();
    const results = await Promise.all(tasks.map((t) => t()));
    const duration = Date.now() - startTime;

    const waTps = throughput(harness.whatsapp.stats.sent, duration);

    console.log(
      `[BENCH WhatsApp] 200 PINs + WA em ${duration}ms | ` +
      `sent=${harness.whatsapp.stats.sent} failed=${harness.whatsapp.stats.failed} | ` +
      `WA throughput=${waTps.toFixed(0)} msgs/sec`,
    );

    expect(results).toHaveLength(200);
    expect(harness.whatsapp.stats.sent).toBeGreaterThan(150);
  }, 60000);

  it('8. BENCHMARK: brand catalog lookup (getBrandInfo) — 100000 lookups', () => {
    const brands = ['ttlock', 'tuya', 'igloohome', 'nuki', 'august', 'intelbras', 'yale', 'papaiz', 'philco', 'samsung'];
    const count = 100000;

    const startTime = Date.now();
    for (let i = 0; i < count; i++) {
      getBrandInfo(brands[i % brands.length]);
    }
    const duration = Math.max(1, Date.now() - startTime);
    const opsPerSec = throughput(count, duration);

    console.log(
      `[BENCH getBrandInfo] ${count} lookups em ${duration}ms | ${opsPerSec.toFixed(0)} ops/sec`,
    );

    expect(opsPerSec).toBeGreaterThan(100000);
  });

  it('9. GARGALO: identificar se WhatsApp é o bottleneck do pipeline', async () => {
    // Compara throughput com WhatsApp ON vs OFF
    const scenario = generatePousadaScenario('pousada-gargalo', 100, 1);
    seedScenario(harness, scenario);

    // Test 1: sem WhatsApp
    const tasksNoWA = scenario.devices.map(({ device, bookings }) => async () => {
      const booking = bookings[0];
      harness.setTenant('pousada-gargalo');
      await harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
        sendWhatsApp: false,
      });
    });

    const startNoWA = Date.now();
    await runWithConcurrency(tasksNoWA, 50);
    const durationNoWA = Math.max(1, Date.now() - startNoWA);
    const tpsNoWA = throughput(100, durationNoWA);

    // Test 2: com WhatsApp (reset do harness para comparar justamente)
    const harness2 = new LocksTestHarness();
    const scenario2 = generatePousadaScenario('pousada-gargalo-2', 100, 1);
    seedScenario(harness2, scenario2);

    const tasksWithWA = scenario2.devices.map(({ device, bookings }) => async () => {
      const booking = bookings[0];
      harness2.setTenant('pousada-gargalo-2');
      await harness2.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
        sendWhatsApp: true,
      });
    });

    const startWithWA = Date.now();
    await runWithConcurrency(tasksWithWA, 50);
    const durationWithWA = Math.max(1, Date.now() - startWithWA);
    const tpsWithWA = throughput(100, durationWithWA);

    const ratio = tpsNoWA / Math.max(tpsWithWA, 1);

    console.log(
      `[GARGALO WhatsApp] Sem WA: ${tpsNoWA.toFixed(0)} PINs/sec (${durationNoWA}ms) | ` +
      `Com WA: ${tpsWithWA.toFixed(0)} PINs/sec (${durationWithWA}ms) | ` +
      `ratio=${ratio.toFixed(2)}x (WA é ${ratio > 1 ? 'gargalo' : 'não-gargalo'})`,
    );

    // Se ratio > 1.5, WhatsApp é gargalo identificado
    expect(tpsNoWA).toBeGreaterThan(0);
    expect(tpsWithWA).toBeGreaterThan(0);
  }, 60000);

  it('10. BENCHMARK: panicRevoke em dispositivo com 1000 PINs', async () => {
    const scenario = generatePousadaScenario('pousada-bench-panic', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-bench-panic');

    const device = scenario.devices[0].device;

    // Gera 1000 PINs
    for (let i = 0; i < 1000; i++) {
      await harness.generatePin(device.id, {
        guestName: `Hóspede ${i}`,
        guestPhone: '+5511999999999',
        checkInDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        checkOutDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        autoGenerate: true,
      });
    }

    // Mede tempo de panicRevoke
    const startTime = Date.now();
    const count = harness.panicRevokeAllPins(device.id, 'Bench panic');
    const duration = Date.now() - startTime;

    console.log(
      `[BENCH panicRevoke-1k] ${count} PINs revogados em ${duration}ms | ` +
      `${throughput(count, duration).toFixed(0)} ops/sec`,
    );

    expect(count).toBe(1000);
    expect(duration).toBeLessThan(500); // < 500ms para 1000 PINs
  }, 60000);
});
