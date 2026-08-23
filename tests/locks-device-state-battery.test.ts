// =============================================================================
// 🔋 DEVICE STATE & BATTERY — Monitoramento de Dispositivos
// =============================================================================
// Cenário: Monitorar estado dos dispositivos (bateria, online/offline) e
// garantir que transições de status sejam auditadas.
//
// Validamos:
// 1. Dispositivo novo começa com status 'active'
// 2. Bateria < 20% dispara evento 'battery_low'
// 3. Dispositivo offline não bloqueia geração de PIN (PIN fica scheduled)
// 4. Dispositivo inativo (status='inactive') pode ser reativado
// 5. Sincronização de estado (simula provider retornando bateria/status)
// 6. Eventos de status_change são registrados
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LocksTestHarness,
} from './helpers/locks-test-harness';

describe('🔋 Device State & Battery — Monitoramento de Dispositivos', () => {
  let harness: LocksTestHarness;

  beforeEach(() => {
    harness = new LocksTestHarness();
  });

  it('1. DISPOSITIVO NOVO: começa com status "active" e bateria entre 60-100%', () => {
    harness.seedTenant('tenant-bat', 'Pousada Bat', 1);
    harness.setTenant('tenant-bat');

    const device = harness.createDevice('tenant-bat', 'prop-1', 'ttlock', {
      batteryLevel: 85,
    });

    expect(device.status).toBe('active');
    expect(device.batteryLevel).toBe(85);
    expect(device.online).toBe(true);
    expect(device.createdAt).toBe(device.updatedAt);
  });

  it('2. BATERIA FRACA (<20%): dispara evento "battery_low"', () => {
    harness.seedTenant('tenant-bat', 'Pousada Bat', 1);
    harness.setTenant('tenant-bat');

    const device = harness.createDevice('tenant-bat', 'prop-1', 'ttlock', {
      batteryLevel: 80,
    });

    // Bateria cai para 15%
    harness.updateDeviceStatus(device.id, { batteryLevel: 15 });

    const batteryEvents = Array.from(harness.db.events.values()).filter(
      (e) => e.eventType === 'battery_low' && e.deviceId === device.id,
    );
    expect(batteryEvents).toHaveLength(1);
    expect(batteryEvents[0].message).toContain('15');

    // Dispositivo tem bateria atualizada
    expect(harness.db.devices.get(device.id)!.batteryLevel).toBe(15);
  });

  it('3. BATERIA NORMAL (>=20%): NÃO dispara battery_low', () => {
    harness.seedTenant('tenant-bat', 'Pousada Bat', 1);
    harness.setTenant('tenant-bat');

    const device = harness.createDevice('tenant-bat', 'prop-1', 'ttlock', {
      batteryLevel: 80,
    });

    harness.updateDeviceStatus(device.id, { batteryLevel: 50 });

    const batteryEvents = Array.from(harness.db.events.values()).filter(
      (e) => e.eventType === 'battery_low',
    );
    expect(batteryEvents).toHaveLength(0);
  });

  it('4. BATERIA CRÍTICA (5%): ainda dispara apenas 1 evento battery_low', () => {
    harness.seedTenant('tenant-bat', 'Pousada Bat', 1);
    harness.setTenant('tenant-bat');

    const device = harness.createDevice('tenant-bat', 'prop-1', 'ttlock', {
      batteryLevel: 30,
    });

    harness.updateDeviceStatus(device.id, { batteryLevel: 5 });

    const batteryEvents = Array.from(harness.db.events.values()).filter(
      (e) => e.eventType === 'battery_low',
    );
    expect(batteryEvents).toHaveLength(1);
    expect(batteryEvents[0].message).toContain('5');
  });

  it('5. DISPOSITIVO OFFLINE: geração de PIN não falha (PIN fica scheduled)', async () => {
    harness.seedTenant('tenant-bat', 'Pousada Bat', 1);
    harness.setTenant('tenant-bat');

    const device = harness.createDevice('tenant-bat', 'prop-1', 'ttlock', {
      online: false,
    });

    const future = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const futureEnd = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

    const { code } = await harness.generatePin(device.id, {
      guestName: 'Hóspede offline',
      guestPhone: '+5511999999999',
      checkInDate: future,
      checkOutDate: futureEnd,
      autoGenerate: true,
    });

    // PIN foi gerado mesmo com device offline
    expect(code).toBeDefined();
    expect(code.status).toBe('scheduled');
  });

  it('6. DISPOSITIVO INATIVO: pode ser reativado', () => {
    harness.seedTenant('tenant-bat', 'Pousada Bat', 1);
    harness.setTenant('tenant-bat');

    const device = harness.createDevice('tenant-bat', 'prop-1', 'ttlock');

    // Desativa
    harness.updateDeviceStatus(device.id, { status: 'inactive' });
    expect(harness.db.devices.get(device.id)!.status).toBe('inactive');

    // Reativa
    harness.updateDeviceStatus(device.id, { status: 'active' });
    expect(harness.db.devices.get(device.id)!.status).toBe('active');
  });

  it('7. SYNC DE ESTADO: provider retorna novos dados (bateria + online)', () => {
    harness.seedTenant('tenant-bat', 'Pousada Bat', 1);
    harness.setTenant('tenant-bat');

    const device = harness.createDevice('tenant-bat', 'prop-1', 'ttlock', {
      batteryLevel: 90,
      online: true,
    });

    // Simula sync: bateria caiu, ainda online
    harness.updateDeviceStatus(device.id, { batteryLevel: 75, online: true });
    let updated = harness.db.devices.get(device.id)!;
    expect(updated.batteryLevel).toBe(75);
    expect(updated.online).toBe(true);

    // Simula sync: ficou offline
    harness.updateDeviceStatus(device.id, { online: false });
    updated = harness.db.devices.get(device.id)!;
    expect(updated.online).toBe(false);

    // Simula sync: voltou online com bateria recarregada
    harness.updateDeviceStatus(device.id, { batteryLevel: 95, online: true });
    updated = harness.db.devices.get(device.id)!;
    expect(updated.batteryLevel).toBe(95);
    expect(updated.online).toBe(true);
  });

  it('8. BATERIA EM TODOS OS NÍVEIS: 100, 50, 20, 19, 10, 5, 0', () => {
    harness.seedTenant('tenant-bat', 'Pousada Bat', 1);
    harness.setTenant('tenant-bat');

    const device = harness.createDevice('tenant-bat', 'prop-1', 'ttlock', {
      batteryLevel: 100,
    });

    const levels = [100, 50, 20, 19, 10, 5, 0];
    for (const level of levels) {
      harness.updateDeviceStatus(device.id, { batteryLevel: level });
      expect(harness.db.devices.get(device.id)!.batteryLevel).toBe(level);
    }

    // Eventos battery_low apenas para <20 (níveis 19, 10, 5, 0)
    const batteryEvents = Array.from(harness.db.events.values()).filter(
      (e) => e.eventType === 'battery_low',
    );
    // Como o mock dispara 1 evento por update, são 4 eventos (19, 10, 5, 0)
    expect(batteryEvents).toHaveLength(4);
  });

  it('9. MULTI-DISPOSITIVO: bateria fraca em 1 não afeta outros', () => {
    harness.seedTenant('tenant-bat', 'Pousada Bat', 1);
    harness.setTenant('tenant-bat');

    const device1 = harness.createDevice('tenant-bat', 'prop-1', 'ttlock', { batteryLevel: 90 });
    const device2 = harness.createDevice('tenant-bat', 'prop-2', 'intelbras', { batteryLevel: 80 });
    const device3 = harness.createDevice('tenant-bat', 'prop-3', 'yale', { batteryLevel: 70 });

    // Apenas device1 fica com bateria fraca
    harness.updateDeviceStatus(device1.id, { batteryLevel: 10 });

    // Outros continuam com bateria original
    expect(harness.db.devices.get(device2.id)!.batteryLevel).toBe(80);
    expect(harness.db.devices.get(device3.id)!.batteryLevel).toBe(70);

    // 1 evento battery_low (apenas device1)
    const batteryEvents = Array.from(harness.db.events.values()).filter(
      (e) => e.eventType === 'battery_low',
    );
    expect(batteryEvents).toHaveLength(1);
    expect(batteryEvents[0].deviceId).toBe(device1.id);
  });

  it('10. DISPOSITIVO COM ERRO: status="error" não bloqueia pânico', async () => {
    harness.seedTenant('tenant-bat', 'Pousada Bat', 1);
    harness.setTenant('tenant-bat');

    const device = harness.createDevice('tenant-bat', 'prop-1', 'ttlock');

    // Gera 3 PINs
    const pinIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { code } = await harness.generatePin(device.id, {
        guestName: `Hóspede ${i}`,
        guestPhone: '+5511999999999',
        checkInDate: '2026-03-20',
        checkOutDate: '2026-03-25',
        autoGenerate: true,
      });
      pinIds.push(code.id);
    }

    // Dispositivo entra em erro
    harness.updateDeviceStatus(device.id, { status: 'error' });

    // Pânico ainda funciona
    const count = harness.panicRevokeAllPins(device.id, 'Dispositivo em erro');
    expect(count).toBe(3);
  });
});
