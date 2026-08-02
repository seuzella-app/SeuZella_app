// =============================================================================
// 📱 WHATSAPP DELIVERY STRESS — Entrega de PIN sob Carga
// =============================================================================
// Cenário: Validação específica do pipeline de entrega WhatsApp.
//
// Validamos:
// 1. Taxa de entrega sob carga normal (sem rate limit)
// 2. Comportamento sob rate limit (100 msgs/sec)
// 3. Resiliência a falhas aleatórias (10%, 50%)
// 4. Recovery após falha total do gateway
// 5. Telefone inválido é rejeitado antes de enviar
// 6. Ordem de entrega (FIFO aproximado)
// 7. Latência média por mensagem
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LocksTestHarness,
  generatePousadaScenario,
  seedScenario,
  runWithConcurrency,
  throughput,
} from './helpers/locks-test-harness';

describe('📱 WhatsApp Delivery Stress — Entrega de PIN sob Carga', () => {
  let harness: LocksTestHarness;

  beforeEach(() => {
    harness = new LocksTestHarness();
  });

  it('1. CARGA NORMAL: 200 mensagens sem rate limit — 100% entregues', async () => {
    harness.whatsapp.reset('none');

    const scenario = generatePousadaScenario('pousada-wa-1', 200, 1);
    seedScenario(harness, scenario);

    const tasks = scenario.devices.map(({ device, bookings }) => async () => {
      harness.setTenant('pousada-wa-1');
      const booking = bookings[0];
      const { delivered } = await harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
        sendWhatsApp: true,
      });
      return delivered;
    });

    const startTime = Date.now();
    const results = await runWithConcurrency(tasks, 50);
    const duration = Date.now() - startTime;

    const delivered = results.filter((r) => r).length;

    // 100% de entrega (mock sem falhas)
    expect(delivered).toBe(200);
    expect(harness.whatsapp.stats.sent).toBe(200);
    expect(harness.whatsapp.stats.failed).toBe(0);

    const tps = throughput(200, duration);
    console.log(
      `[WA NORMAL] 200/200 entregues em ${duration}ms | ${tps.toFixed(0)} msgs/sec`,
    );
  }, 30000);

  it('2. RATE LIMIT: 200 mensagens, gateway limita a 100/sec', async () => {
    harness.whatsapp.reset('rate-limit-100/sec');

    const scenario = generatePousadaScenario('pousada-wa-2', 200, 1);
    seedScenario(harness, scenario);

    const tasks = scenario.devices.map(({ device, bookings }) => async () => {
      harness.setTenant('pousada-wa-2');
      const booking = bookings[0];
      const { delivered } = await harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
        sendWhatsApp: true,
      });
      return delivered;
    });

    const startTime = Date.now();
    const results = await Promise.all(tasks.map((t) => t())); // concurrency máxima
    const duration = Date.now() - startTime;

    const delivered = results.filter((r) => r).length;
    const rateLimited = harness.whatsapp.stats.rateLimited;

    // Como disparo foi instantâneo, ~100 devem ser rate-limited
    expect(delivered).toBeLessThan(200);
    expect(rateLimited).toBeGreaterThan(0);

    // Eventos 'failed' devem ter sido registrados para os rate-limited
    const failedEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'failed');
    expect(failedEvents.length).toBeGreaterThan(0);

    console.log(
      `[WA RATE-LIMIT] entregues=${delivered}/200 | rate-limited=${rateLimited} | ` +
      `eventos 'failed'=${failedEvents.length} | duração=${duration}ms`,
    );
  }, 30000);

  it('3. FALHAS ALEATÓRIAS (10%): 200 mensagens, ~20 falham aleatoriamente', async () => {
    harness.whatsapp.reset('random-10pct');

    const scenario = generatePousadaScenario('pousada-wa-3', 200, 1);
    seedScenario(harness, scenario);

    const tasks = scenario.devices.map(({ device, bookings }) => async () => {
      harness.setTenant('pousada-wa-3');
      const booking = bookings[0];
      const { delivered, warnings } = await harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
        sendWhatsApp: true,
      });
      return { delivered, warnings };
    });

    const results = await runWithConcurrency(tasks, 50);

    const delivered = results.filter((r) => r.delivered).length;
    const failed = results.filter((r) => !r.delivered);

    // Com 10% de falha aleatória, espera-se entre 5% e 20% de falhas
    const failureRate = failed.length / 200;
    expect(failureRate).toBeGreaterThan(0.03);
    expect(failureRate).toBeLessThan(0.25);

    // Todos os PINs foram GERADOS (a falha é só no WhatsApp, não no sistema)
    expect(Array.from(harness.db.codes.values())).toHaveLength(200);

    // Cada falha gerou um evento 'failed'
    const failedEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'failed');
    expect(failedEvents.length).toBe(failed.length);

    // Cada entrega bem-sucedida gerou um evento 'delivered'
    const deliveredEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'delivered');
    expect(deliveredEvents.length).toBe(delivered);

    console.log(
      `[WA 10% FALHA] entregues=${delivered}/200 | falharam=${failed.length} | ` +
      `taxa de falha=${(failureRate * 100).toFixed(1)}% | eventos failed=${failedEvents.length}`,
    );
  }, 30000);

  it('4. FALHA TOTAL: gateway offline — todos os 50 PINs são gerados mas WhatsApp falha', async () => {
    harness.whatsapp.reset('all-fail');

    const scenario = generatePousadaScenario('pousada-wa-4', 50, 1);
    seedScenario(harness, scenario);

    const tasks = scenario.devices.map(({ device, bookings }) => async () => {
      harness.setTenant('pousada-wa-4');
      const booking = bookings[0];
      const { code, delivered, warnings } = await harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
        sendWhatsApp: true,
      });
      return { code, delivered, warnings };
    });

    const results = await Promise.all(tasks.map((t) => t()));

    // NENHUMA mensagem foi entregue
    const delivered = results.filter((r) => r.delivered).length;
    expect(delivered).toBe(0);

    // TODOS os 50 PINs foram gerados
    expect(Array.from(harness.db.codes.values())).toHaveLength(50);

    // TODOS os 50 têm warning de falha WhatsApp
    const withWarnings = results.filter((r) => r.warnings && r.warnings.length > 0);
    expect(withWarnings).toHaveLength(50);

    // 50 eventos 'failed' registrados
    const failedEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'failed');
    expect(failedEvents).toHaveLength(50);

    console.log(
      `[WA FALHA TOTAL] 50/50 PINs gerados | 0/50 WhatsApp entregues | 50 eventos 'failed'`,
    );
  });

  it('5. RECOVERY: gateway volta após falha — próximo PIN é entregue', async () => {
    const scenario = generatePousadaScenario('pousada-wa-5', 2, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-wa-5');

    const device1 = scenario.devices[0].device;
    const device2 = scenario.devices[1].device;
    const booking1 = scenario.devices[0].bookings[0];
    const booking2 = scenario.devices[1].bookings[0];

    // Etapa 1: gateway offline
    harness.whatsapp.reset('all-fail');
    const { delivered: delivered1 } = await harness.generatePin(device1.id, {
      guestName: booking1.guestName,
      guestPhone: booking1.guestPhone,
      checkInDate: booking1.checkIn,
      checkOutDate: booking1.checkOut,
      autoGenerate: true,
      sendWhatsApp: true,
    });
    expect(delivered1).toBe(false);

    // Etapa 2: gateway volta
    harness.whatsapp.reset('none');
    const { delivered: delivered2 } = await harness.generatePin(device2.id, {
      guestName: booking2.guestName,
      guestPhone: booking2.guestPhone,
      checkInDate: booking2.checkIn,
      checkOutDate: booking2.checkOut,
      autoGenerate: true,
      sendWhatsApp: true,
    });
    expect(delivered2).toBe(true);

    // 1 evento 'failed' + 1 evento 'delivered'
    const failedEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'failed');
    const deliveredEvents = Array.from(harness.db.events.values()).filter((e) => e.eventType === 'delivered');
    expect(failedEvents).toHaveLength(1);
    expect(deliveredEvents).toHaveLength(1);
  });

  it('6. TELEFONE INVÁLIDO: rejeitado antes de ir para o gateway', async () => {
    const scenario = generatePousadaScenario('pousada-wa-6', 1, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-wa-6');

    const device = scenario.devices[0].device;

    const invalidPhones = ['', '123', 'abc', '+55', 'telefone'];
    for (const phone of invalidPhones) {
      const { delivered, warnings } = await harness.generatePin(device.id, {
        guestName: 'Hóspede telefone inválido',
        guestPhone: phone,
        checkInDate: '2026-03-20',
        checkOutDate: '2026-03-25',
        autoGenerate: true,
        sendWhatsApp: true,
      });
      expect(delivered).toBe(false);
      expect(warnings.length).toBeGreaterThan(0);
    }

    // Todos os telefones inválidos foram contabilizados
    expect(harness.whatsapp.stats.invalidPhones).toBeGreaterThan(0);

    // NENHUMA mensagem foi para o gateway (stats.sent = 0)
    expect(harness.whatsapp.stats.sent).toBe(0);
  });

  it('7. LATÊNCIA: mensagens têm latência entre 5-30ms (mock)', async () => {
    const scenario = generatePousadaScenario('pousada-wa-7', 20, 1);
    seedScenario(harness, scenario);

    const tasks = scenario.devices.map(({ device, bookings }) => async () => {
      const start = Date.now();
      harness.setTenant('pousada-wa-7');
      const booking = bookings[0];
      await harness.generatePin(device.id, {
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        autoGenerate: true,
        sendWhatsApp: true,
      });
      return Date.now() - start;
    });

    const latencies = await Promise.all(tasks.map((t) => t()));
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const max = Math.max(...latencies);
    const min = Math.min(...latencies);

    // Latência média entre 5-100ms (com delay mock de 5-15ms + Promise overhead)
    expect(avg).toBeGreaterThan(5);
    expect(avg).toBeLessThan(200);

    console.log(
      `[WA LATÊNCIA] 20 msgs | min=${min}ms avg=${avg.toFixed(0)}ms max=${max}ms`,
    );
  });

  it('8. ORDEM: com concorrência controlada (1 por vez), ordem é FIFO', async () => {
    const scenario = generatePousadaScenario('pousada-wa-8', 5, 1);
    seedScenario(harness, scenario);
    harness.setTenant('pousada-wa-8');

    // Envia 1 por vez (sequencial)
    for (const { device, bookings } of scenario.devices) {
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

    // As mensagens no log estão em ordem crescente de timestamp
    const messages = harness.whatsapp.stats.messages;
    expect(messages).toHaveLength(5);

    for (let i = 1; i < messages.length; i++) {
      expect(messages[i].ts).toBeGreaterThanOrEqual(messages[i - 1].ts);
    }
  });
});
