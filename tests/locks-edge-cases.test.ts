// =============================================================================
// 🧪 EDGE CASES — Casos Limite e Entradas Malformadas
// =============================================================================
// Testa casos extremos que podem causar bugs:
//
// 1. Janela de validade invertida (check-out antes de check-in)
// 2. Janela de validade de 0 segundo
// 3. PIN manual com caracteres inválidos
// 4. PIN manual muito longo (>12 chars)
// 5. Telefone inválido (muito curto, com letras)
// 6. Booking com datas no passado
// 7. Booking com mais de 365 dias de estadia
// 8. Hóspede com nome vazio
// 9. Device inexistente
// 10. PIN inexistente para revogação
// 11. Concorrência sobre dispositivo inativo
// 12. Brand inexistente
// 13. Sufixo # duplicado (host colou PIN com # já existente)
// 14. Janela cruzando virada de ano
// 15. Fuso horário (datas UTC vs local)
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LocksTestHarness,
  type LockBrand,
} from './helpers/locks-test-harness';
import {
  generateRandomPin,
  calculatePinValidityWindow,
  derivePinStatus,
} from '../src/lib/locks/pin-generator';

describe('🧪 Edge Cases — Casos Limite e Entradas Malformadas', () => {
  let harness: LocksTestHarness;

  beforeEach(() => {
    harness = new LocksTestHarness();
  });

  describe('1. Janela de validade', () => {
    it('deve rejeitar check-out antes de check-in', () => {
      expect(() =>
        calculatePinValidityWindow('2026-03-25', '2026-03-20', '14:00', '11:00'),
      ).toThrow();
    });

    it('deve rejeitar check-out == check-in (janela 0)', () => {
      expect(() =>
        calculatePinValidityWindow('2026-03-20', '2026-03-20', '14:00', '14:00'),
      ).toThrow();
    });

    it('deve aceitar janela mínima válida (1 minuto)', () => {
      // 23:59 → 00:00 do dia seguinte = 1 min
      const window = calculatePinValidityWindow('2026-03-20', '2026-03-21', '23:59', '00:00');
      const diffMs = window.validTo.getTime() - window.validFrom.getTime();
      expect(diffMs).toBe(60000); // 1 min
    });

    it('deve aceitar janela longa (1 ano)', () => {
      const window = calculatePinValidityWindow('2026-01-01', '2027-01-01');
      const diffDays = (window.validTo.getTime() - window.validFrom.getTime()) / (86400000);
      // Aceita 364-366 dias (variação por ano bissexto e DST)
      expect(diffDays).toBeGreaterThanOrEqual(364);
      expect(diffDays).toBeLessThanOrEqual(366);
    });

    it('deve cruzar virada de ano corretamente', () => {
      const window = calculatePinValidityWindow('2025-12-30', '2026-01-02');
      expect(window.validFrom.getFullYear()).toBe(2025);
      expect(window.validTo.getFullYear()).toBe(2026);
    });
  });

  describe('2. Geração de PIN — entradas inválidas', () => {
    it('deve rejeitar tamanho < 4', () => {
      expect(() => generateRandomPin(3)).toThrow();
      expect(() => generateRandomPin(0)).toThrow();
      expect(() => generateRandomPin(-1)).toThrow();
    });

    it('deve rejeitar tamanho > 8', () => {
      expect(() => generateRandomPin(9)).toThrow();
      expect(() => generateRandomPin(20)).toThrow();
    });

    it('deve aceitar tamanhos 4, 5, 6, 7, 8', () => {
      for (const len of [4, 5, 6, 7, 8]) {
        const pin = generateRandomPin(len);
        expect(pin).toHaveLength(len);
      }
    });
  });

  describe('3. PIN manual — entradas malformadas', () => {
    it('deve aceitar PIN manual com # no final (TTLock)', async () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');
      const device = harness.createDevice('tenant-edge', 'prop-1', 'ttlock');

      const { code } = await harness.generatePin(device.id, {
        manualPin: '123456#',
        checkInDate: '2026-03-20',
        checkOutDate: '2026-03-25',
      });

      // Não deve duplicar o #
      expect(code.code).toBe('123456#');
      expect(code.code).not.toBe('123456##');
    });

    it('deve adicionar # automaticamente quando host não colocou (TTLock)', async () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');
      const device = harness.createDevice('tenant-edge', 'prop-1', 'ttlock');

      const { code } = await harness.generatePin(device.id, {
        manualPin: '123456',
        checkInDate: '2026-03-20',
        checkOutDate: '2026-03-25',
      });

      expect(code.code).toBe('123456#');
    });

    it('NÃO deve adicionar # para Intelbras (sem sufixo)', async () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');
      const device = harness.createDevice('tenant-edge', 'prop-1', 'intelbras');

      const { code } = await harness.generatePin(device.id, {
        manualPin: '123456',
        checkInDate: '2026-03-20',
        checkOutDate: '2026-03-25',
      });

      expect(code.code).toBe('123456');
      expect(code.code.endsWith('#')).toBe(false);
    });

    it('deve aceitar PIN com * (algumas marcas permitem)', async () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');
      const device = harness.createDevice('tenant-edge', 'prop-1', 'intelbras');

      const { code } = await harness.generatePin(device.id, {
        manualPin: '12*34',
        checkInDate: '2026-03-20',
        checkOutDate: '2026-03-25',
      });

      expect(code.code).toBe('12*34');
    });
  });

  describe('4. Telefone inválido', () => {
    it('telefone muito curto deve falhar no envio WhatsApp', async () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');
      const device = harness.createDevice('tenant-edge', 'prop-1', 'ttlock');

      const { delivered, warnings } = await harness.generatePin(device.id, {
        guestName: 'Hóspede',
        guestPhone: '123', // muito curto
        checkInDate: '2026-03-20',
        checkOutDate: '2026-03-25',
        autoGenerate: true,
        sendWhatsApp: true,
      });

      expect(delivered).toBe(false);
      expect(warnings.length).toBeGreaterThan(0);
      expect(harness.whatsapp.stats.invalidPhones).toBeGreaterThan(0);
    });

    it('telefone null deve gerar warning mas não falhar', async () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');
      const device = harness.createDevice('tenant-edge', 'prop-1', 'ttlock');

      const { code, warnings } = await harness.generatePin(device.id, {
        guestName: 'Hóspede sem telefone',
        // guestPhone não fornecido
        checkInDate: '2026-03-20',
        checkOutDate: '2026-03-25',
        autoGenerate: true,
        sendWhatsApp: true,
      });

      expect(code).toBeDefined();
      expect(code.deliveredVia).toBeNull();
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe('5. Dispositivo inexistente', () => {
    it('gerar PIN em device inexistente deve lançar erro', async () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');

      await expect(
        harness.generatePin('device-inexistente-123', {
          guestName: 'Hóspede',
          guestPhone: '+5511999999999',
          checkInDate: '2026-03-20',
          checkOutDate: '2026-03-25',
          autoGenerate: true,
        }),
      ).rejects.toThrow();
    });

    it('revogar PIN inexistente deve retornar false', () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');

      const ok = harness.revokePin('pin-inexistente-123', 'Teste');
      expect(ok).toBe(false);
    });

    it('pânico em device inexistente deve retornar 0', () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');

      const count = harness.panicRevokeAllPins('device-inexistente-123', 'Teste');
      expect(count).toBe(0);
    });
  });

  describe('6. Brand inexistente', () => {
    it('criar device com brand inexistente deve lançar erro', () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');

      expect(() =>
        harness.createDevice('tenant-edge', 'prop-1', 'brand-inexistente' as LockBrand),
      ).toThrow();
    });
  });

  describe('7. Status derivation — casos extremos', () => {
    it('PIN com revokedAt deve sempre retornar "revoked" (prioridade máxima)', () => {
      const past = new Date(Date.now() - 86400000);
      const future = new Date(Date.now() + 86400000);
      const status = derivePinStatus({
        validFrom: past,
        validTo: future,
        revokedAt: new Date(),
      });
      expect(status).toBe('revoked');
    });

    it('PIN com usedAt deve retornar "used" (a menos que esteja revogado)', () => {
      const past = new Date(Date.now() - 86400000);
      const future = new Date(Date.now() + 86400000);
      const status = derivePinStatus({
        validFrom: past,
        validTo: future,
        usedAt: new Date(),
      });
      expect(status).toBe('used');
    });

    it('PIN na fronteira exata de validade deve estar "active"', () => {
      const now = Date.now();
      const past = new Date(now - 1000);
      const future = new Date(now + 1000);
      const status = derivePinStatus({ validFrom: past, validTo: future });
      expect(status).toBe('active');
    });

    it('PIN com validFrom exatamente agora deve estar "active"', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 60000);
      const status = derivePinStatus({ validFrom: now, validTo: future });
      expect(status).toBe('active');
    });
  });

  describe('8. Booking com datas extremas', () => {
    it('booking com check-in no passado distante deve gerar PIN expirado', async () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');
      const device = harness.createDevice('tenant-edge', 'prop-1', 'ttlock');

      const { code } = await harness.generatePin(device.id, {
        guestName: 'Hóspede passado',
        guestPhone: '+5511999999999',
        checkInDate: '2020-01-01',
        checkOutDate: '2020-01-05',
        autoGenerate: true,
      });

      expect(code.status).toBe('expired');
    });

    it('booking com check-in daqui a 1 ano deve gerar PIN scheduled', async () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');
      const device = harness.createDevice('tenant-edge', 'prop-1', 'ttlock');

      const future = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
      const futureEnd = new Date(Date.now() + 366 * 86400000).toISOString().slice(0, 10);

      const { code } = await harness.generatePin(device.id, {
        guestName: 'Hóspede futuro',
        guestPhone: '+5511999999999',
        checkInDate: future,
        checkOutDate: futureEnd,
        autoGenerate: true,
      });

      expect(code.status).toBe('scheduled');
    });
  });

  describe('9. Hóspede sem nome', () => {
    it('deve aceitar hóspede com nome null', async () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');
      const device = harness.createDevice('tenant-edge', 'prop-1', 'ttlock');

      const { code } = await harness.generatePin(device.id, {
        // sem guestName
        guestPhone: '+5511999999999',
        checkInDate: '2026-03-20',
        checkOutDate: '2026-03-25',
        autoGenerate: true,
      });

      expect(code.guestName).toBeNull();
      expect(code.guestPhone).toBe('+5511999999999');
    });
  });

  describe('10. Múltiplos PINs para o mesmo hóspede (casa compartilhada)', () => {
    it('deve permitir N PINs ativos para o mesmo hóspede no mesmo dispositivo', async () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');
      const device = harness.createDevice('tenant-edge', 'prop-1', 'ttlock');

      // Mesma pessoa, 3 janelas diferentes (ex: casa compartilhada com estadias sobrepostas)
      // Usa datas FUTURAS para garantir que os PINs estão scheduled/active (não expired)
      const future1 = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const future2 = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const pinIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const { code } = await harness.generatePin(device.id, {
          guestName: 'João Compartilhado',
          guestPhone: '+5511999999999',
          checkInDate: future1,
          checkOutDate: future2,
          autoGenerate: true,
        });
        pinIds.push(code.id);
      }

      expect(pinIds).toHaveLength(3);
      // Todos únicos
      expect(new Set(pinIds).size).toBe(3);
      // Todos scheduled ou active (não expired nem revoked)
      for (const id of pinIds) {
        expect(['scheduled', 'active']).toContain(harness.db.codes.get(id)!.status);
      }
    });
  });

  describe('11. Revogação com motivo longo', () => {
    it('deve aceitar motivo de revogação com mais de 500 caracteres', async () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');
      const device = harness.createDevice('tenant-edge', 'prop-1', 'ttlock');

      const { code } = await harness.generatePin(device.id, {
        guestName: 'Hóspede',
        guestPhone: '+5511999999999',
        checkInDate: '2026-03-20',
        checkOutDate: '2026-03-25',
        autoGenerate: true,
      });

      const longReason = 'Motivo muito longo: '.repeat(100); // > 2000 chars
      const ok = harness.revokePin(code.id, longReason);
      expect(ok).toBe(true);

      const revoked = harness.db.codes.get(code.id)!;
      expect(revoked.revokedReason).toBe(longReason);
    });
  });

  describe('12. Unicode no nome do hóspede', () => {
    it('deve aceitar nomes com acentos e caracteres especiais', async () => {
      harness.seedTenant('tenant-edge', 'Pousada Edge', 1);
      harness.setTenant('tenant-edge');
      const device = harness.createDevice('tenant-edge', 'prop-1', 'ttlock');

      const { code } = await harness.generatePin(device.id, {
        guestName: 'João D\'Ávilla Çção Ñ',
        guestPhone: '+5511999999999',
        checkInDate: '2026-03-20',
        checkOutDate: '2026-03-25',
        autoGenerate: true,
      });

      expect(code.guestName).toBe('João D\'Ávilla Çção Ñ');
    });
  });
});
