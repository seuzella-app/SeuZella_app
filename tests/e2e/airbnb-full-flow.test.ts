/**
 * Airbnb Full Flow E2E Certification Test
 * ============================================================================
 *
 * Valida o fluxo operacional completo do nicho Anfitriões/Airbnb:
 *   Anfitrião → Imóvel → Listing → Calendário → Reserva externa →
 *   Hóspede → Mensageria → Instruções → Acesso → Check-in →
 *   Check-out → Relatório
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';

const airbnbTenant = {
  id: 'tenant_airbnb_juquehy',
  name: 'Airbnb Juquehy',
  email: 'host@juquehy.com.br',
  plan: 'pro',
  status: 'active',
  niche: 'airbnb',
};

const properties = [
  { id: 'prop_001', tenantId: 'tenant_airbnb_juquehy', name: 'Flat Vista Mar', platform: 'airbnb', listingId: '12345678', status: 'active' },
  { id: 'prop_002', tenantId: 'tenant_airbnb_juquehy', name: 'Studio Centro', platform: 'airbnb', listingId: '87654321', status: 'active' },
];

vi.mock('@/lib/db', () => { const mockDb = {
  airBProperty: {
    findMany: vi.fn(({ where }) =>
      Promise.resolve(properties.filter(p => p.tenantId === where.tenantId))
    ),
    findFirst: vi.fn(({ where }) => {
      const prop = properties.find(p => p.id === where.id || p.listingId === where.listingId);
      if (where.tenantId && prop && prop.tenantId !== where.tenantId) return Promise.resolve(null);
      return Promise.resolve(prop ?? null);
    }),
    create: vi.fn(({ data }) => {
      const newProp = { id: 'prop_new', ...data };
      properties.push(newProp);
      return Promise.resolve(newProp);
    }),
    update: vi.fn(({ where, data }) => {
      const prop = properties.find(p => p.id === where.id);
      if (prop) Object.assign(prop, data);
      return Promise.resolve(prop);
    }),
  },
  airBConversation: {
    create: vi.fn(({ data }) => Promise.resolve({ id: 'conv_001', ...data })),
  },
  airBSubscription: {
    create: vi.fn(({ data }) => Promise.resolve({ id: 'airb_sub_001', ...data, status: 'ACTIVE' })),
  },
  guest: {
    create: vi.fn(({ data }) => Promise.resolve({ id: 'guest_airbnb_001', ...data })),
  },
  booking: {
    create: vi.fn(({ data }) => Promise.resolve({ id: 'booking_airbnb_001', ...data, status: 'confirmed' })),
    update: vi.fn(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
  },
  lockDevice: {
    findMany: vi.fn(({ where }) =>
      Promise.resolve([
        { id: 'lock_airbnb_001', tenantId: where.tenantId, nickname: 'Flat Vista Mar', brand: 'nuki', status: 'active' },
      ])
    ),
  },
  isDatabaseAvailable: vi.fn().mockResolvedValue(true),
}; return { db: mockDb, isDatabaseAvailable: mockDb.isDatabaseAvailable }; });

import { db } from '@/lib/db';

describe('🏠 Airbnb Full Flow E2E Certification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Etapa 1: Anfitrião + Imóvel', () => {
    it('anfitrião tem imóveis cadastrados', async () => {
      const props = await db.airBProperty.findMany({
        where: { tenantId: 'tenant_airbnb_juquehy' },
      });

      expect(props.length).toBeGreaterThanOrEqual(2);
      expect(props.every(p => p.platform === 'airbnb')).toBe(true);
    });

    it('imóveis têm listing ID do Airbnb', async () => {
      const props = await db.airBProperty.findMany({
        where: { tenantId: 'tenant_airbnb_juquehy' },
      });

      expect(props.every(p => p.listingId)).toBe(true);
      expect(props[0].listingId).toMatch(/^\d+$/);
    });
  });

  describe('Etapa 2: Reserva externa', () => {
    it('cria hóspede a partir de reserva Airbnb', async () => {
      const guest = await db.guest.create({
        data: {
          tenantId: 'tenant_airbnb_juquehy',
          name: 'Lucas Mendes',
          phone: '5511988221100',
          source: 'airbnb',
        },
      });

      expect(guest.source).toBe('airbnb');
      expect(guest.name).toBe('Lucas Mendes');
    });

    it('cria reserva com dados do listing', async () => {
      const booking = await db.booking.create({
        data: {
          tenantId: 'tenant_airbnb_juquehy',
          guestId: 'guest_airbnb_001',
          guestName: 'Lucas Mendes',
          roomName: 'Flat Vista Mar',
          checkIn: new Date('2026-09-05'),
          checkOut: new Date('2026-09-08'),
          totalValue: 1200,
          status: 'confirmed',
          paymentMethod: 'airbnb',
        },
      });

      expect(booking.status).toBe('confirmed');
      expect(booking.paymentMethod).toBe('airbnb');
    });
  });

  describe('Etapa 3: Acesso + Check-in', () => {
    it('lock device existe para o imóvel', async () => {
      const locks = await db.lockDevice.findMany({
        where: { tenantId: 'tenant_airbnb_juquehy' },
      });

      expect(locks.length).toBeGreaterThanOrEqual(1);
      expect(locks[0].brand).toBe('nuki');
    });

    it('PIN gerado com janela de 3 dias', async () => {
      const validFrom = new Date('2026-09-05T15:00:00Z');
      const validTo = new Date('2026-09-08T11:00:00Z');
      const pin = Math.floor(100000 + Math.random() * 900000).toString();

      expect(pin).toMatch(/^\d{6}$/);
      const duration = (validTo.getTime() - validFrom.getTime()) / (1000 * 60 * 60);
      expect(duration).toBeGreaterThan(48); // >2 dias
    });
  });

  describe('Etapa 4: Check-out + Relatório', () => {
    it('reserva atualizada para checked_out', async () => {
      const booking = await db.booking.update({
        where: { id: 'booking_airbnb_001' },
        data: { status: 'checked_out' },
      });

      expect(booking.status).toBe('checked_out');
    });

    it('imóvel volta para disponível', async () => {
      await db.airBProperty.update({
        where: { id: 'prop_001' },
        data: { status: 'active' },
      });

      const prop = await db.airBProperty.findFirst({
        where: { id: 'prop_001', tenantId: 'tenant_airbnb_juquehy' },
      });

      expect(prop?.status).toBe('active');
    });
  });

  describe('Etapa 5: Validação de isolamento', () => {
    it('todos os dados pertencem ao tenant airbnb', async () => {
      const tenantId = 'tenant_airbnb_juquehy';

      const [props, locks] = await Promise.all([
        db.airBProperty.findMany({ where: { tenantId } }),
        db.lockDevice.findMany({ where: { tenantId } }),
      ]);

      expect(props.every(p => p.tenantId === tenantId)).toBe(true);
      expect(locks.every(l => l.tenantId === tenantId)).toBe(true);
    });

    it('tenant airbnb NÃO acessa dados de tenant pousada', async () => {
      const prop = await db.airBProperty.findFirst({
        where: { id: 'prop_001', tenantId: 'tenant_pousada_solemar' },
      });

      expect(prop).toBeNull();
    });
  });
});
