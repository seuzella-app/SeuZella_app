import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

interface MockReservation {
  id: string;
  tenantId: string;
  guestId: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
  totalPrice: number;
  source: string;
}

// In-memory persistent state for realistic concurrency simulation
let reservationsStore: MockReservation[] = [];
let roomsStore = [
  { id: 'room_101', tenantId: 'tenant_pousada_mar_azul', price: 300, propertyId: 'prop_1' },
  { id: 'room_202', tenantId: 'tenant_pousada_sol_e_mar', price: 450, propertyId: 'prop_2' },
];
let guestsStore = [
  { id: 'guest_A', tenantId: 'tenant_pousada_mar_azul', name: 'Hóspede A' },
  { id: 'guest_B', tenantId: 'tenant_pousada_mar_azul', name: 'Hóspede B' },
  { id: 'guest_C', tenantId: 'tenant_pousada_sol_e_mar', name: 'Hóspede C' },
];

// Async lock simulator mimicking PostgreSQL transaction advisory lock (pg_advisory_xact_lock)
const lockQueues = new Map<string, Promise<void>>();

async function acquireSimulatedLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  while (lockQueues.has(key)) {
    await lockQueues.get(key);
  }
  let releaseLock!: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  lockQueues.set(key, lockPromise);

  try {
    return await fn();
  } finally {
    lockQueues.delete(key);
    releaseLock();
  }
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn(async (callback: any) => {
      // Simulate transaction client
      const tx = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        room: {
          findFirst: vi.fn(async ({ where }: any) => {
            return roomsStore.find((r) => r.id === where.id && (!where.tenantId || r.tenantId === where.tenantId)) || null;
          }),
        },
        guest: {
          findFirst: vi.fn(async ({ where }: any) => {
            return guestsStore.find((g) => g.id === where.id && (!where.tenantId || g.tenantId === where.tenantId)) || null;
          }),
        },
        reservation: {
          findFirst: vi.fn(async ({ where }: any) => {
            const { tenantId, roomId, status, AND } = where;
            const notInStatus = status?.notIn || [];
            const checkOutLt = AND?.[0]?.checkIn?.lt;
            const checkInGt = AND?.[1]?.checkOut?.gt;

            return reservationsStore.find((r) => {
              if (r.tenantId !== tenantId) return false;
              if (r.roomId !== roomId) return false;
              if (notInStatus.includes(r.status)) return false;
              // Overlap: checkIn < targetCheckOut AND checkOut > targetCheckIn
              const rCheckIn = new Date(r.checkIn);
              const rCheckOut = new Date(r.checkOut);
              const overlaps = rCheckIn < checkOutLt && rCheckOut > checkInGt;
              return overlaps;
            }) || null;
          }),
          create: vi.fn(async ({ data }: any) => {
            const newRes: MockReservation = {
              id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
              tenantId: data.tenantId,
              guestId: data.guestId,
              roomId: data.roomId,
              checkIn: new Date(data.checkIn),
              checkOut: new Date(data.checkOut),
              status: data.status || 'CONFIRMED',
              totalPrice: data.totalPrice,
              source: data.source,
            };
            reservationsStore.push(newRes);
            return newRes;
          }),
        },
      };
      return callback(tx);
    }),
    room: {
      findFirst: vi.fn(async ({ where }: any) => {
        return roomsStore.find((r) => r.id === where.id && (!where.tenantId || r.tenantId === where.tenantId)) || null;
      }),
      count: vi.fn().mockResolvedValue(10),
    },
    reservation: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn(async ({ where }: any) => {
        return reservationsStore.filter((r) => r.tenantId === where.tenantId);
      }),
    },
  },
  isDatabaseAvailable: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/db/concurrency', () => ({
  withAdvisoryLock: vi.fn(async (lockKey: string, fn: any) => {
    return acquireSimulatedLock(lockKey, async () => {
      const { db } = await import('@/lib/db');
      return (db as any).$transaction(fn);
    });
  }),
  mapConcurrencyError: vi.fn((error: any) => {
    if (error.message === 'ROOM_UNAVAILABLE_OVERLAPPING_DATES') {
      return {
        status: 409,
        code: 'ROOM_UNAVAILABLE',
        message: 'Quarto indisponível para o período solicitado (conflito de reserva concorrente)',
      };
    }
    if (error.message === 'ROOM_NOT_FOUND_OR_NOT_OWNED' || error.message === 'GUEST_NOT_FOUND_OR_NOT_OWNED') {
      return {
        status: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Recurso não encontrado ou não pertence ao tenant autenticado',
      };
    }
    return null;
  }),
}));

vi.mock('@/lib/auth', () => ({
  requireTenant: vi.fn().mockResolvedValue('tenant_pousada_mar_azul'),
}));

vi.mock('@/lib/security/api-shield', () => ({
  withSecurity: (handler: any) => handler,
}));

import { POST as createReservation, GET as listReservations } from '@/app/api/v1/reservations/route';
import { requireTenant } from '@/lib/auth';

describe('🔒 LOTE 5: Reservations Concurrency & Zero Double Booking Suite', () => {
  beforeEach(() => {
    reservationsStore = [];
    vi.mocked(requireTenant).mockResolvedValue('tenant_pousada_mar_azul');
  });

  it('1. Two simultaneous requests for the exact same room and dates: exactly 1 CONFIRMED (201), 1 CONFLICT (409)', async () => {
    const reqA = new NextRequest('http://localhost:3000/api/v1/reservations', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room_101',
        guestId: 'guest_A',
        checkIn: '2026-10-10T14:00:00Z',
        checkOut: '2026-10-13T12:00:00Z',
        totalPrice: 900,
        source: 'DIRECT',
      }),
    });

    const reqB = new NextRequest('http://localhost:3000/api/v1/reservations', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room_101',
        guestId: 'guest_B',
        checkIn: '2026-10-10T14:00:00Z',
        checkOut: '2026-10-13T12:00:00Z',
        totalPrice: 900,
        source: 'DIRECT',
      }),
    });

    // Fire concurrently
    const [resA, resB] = await Promise.all([createReservation(reqA), createReservation(reqB)]);

    const statuses = [resA.status, resB.status];
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

    // Verify exactly ONE reservation exists in store (Zero Double Booking)
    expect(reservationsStore.length).toBe(1);
    expect(reservationsStore[0].status).toBe('CONFIRMED');
  });

  it('2. Stress test: 10 concurrent requests for the same room & dates results in exactly 1 CONFIRMED, 9 CONFLICT (409)', async () => {
    const requests = Array.from({ length: 10 }).map((_, i) => {
      return new NextRequest('http://localhost:3000/api/v1/reservations', {
        method: 'POST',
        body: JSON.stringify({
          roomId: 'room_101',
          guestId: 'guest_A',
          checkIn: '2026-11-01T14:00:00Z',
          checkOut: '2026-11-05T12:00:00Z',
          totalPrice: 1200,
          source: `DIRECT_CONCURRENT_${i}`,
        }),
      });
    });

    const responses = await Promise.all(requests.map((req) => createReservation(req)));

    const successCount = responses.filter((r) => r.status === 201).length;
    const conflictCount = responses.filter((r) => r.status === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(9);
    expect(reservationsStore.filter((r) => r.roomId === 'room_101' && r.status === 'CONFIRMED').length).toBe(1);
  });

  it('3. Extreme stress: 50 concurrent requests for the same room & dates results in exactly 1 CONFIRMED, 49 CONFLICT (409)', async () => {
    const requests = Array.from({ length: 50 }).map((_, i) => {
      return new NextRequest('http://localhost:3000/api/v1/reservations', {
        method: 'POST',
        body: JSON.stringify({
          roomId: 'room_101',
          guestId: 'guest_A',
          checkIn: '2026-12-28T14:00:00Z',
          checkOut: '2027-01-02T12:00:00Z',
          totalPrice: 3000,
          source: `REVEILLON_TRY_${i}`,
        }),
      });
    });

    const responses = await Promise.all(requests.map((req) => createReservation(req)));

    const successCount = responses.filter((r) => r.status === 201).length;
    const conflictCount = responses.filter((r) => r.status === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(49);
    expect(reservationsStore.filter((r) => r.roomId === 'room_101' && r.status === 'CONFIRMED').length).toBe(1);
  });

  it('4. Adjacent dates permitted: 10->13 and 13->16 for the same room can both be confirmed (201)', async () => {
    const req1 = new NextRequest('http://localhost:3000/api/v1/reservations', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room_101',
        guestId: 'guest_A',
        checkIn: '2026-10-10T14:00:00Z',
        checkOut: '2026-10-13T12:00:00Z',
        totalPrice: 900,
      }),
    });

    const req2 = new NextRequest('http://localhost:3000/api/v1/reservations', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room_101',
        guestId: 'guest_B',
        checkIn: '2026-10-13T14:00:00Z',
        checkOut: '2026-10-16T12:00:00Z',
        totalPrice: 900,
      }),
    });

    const res1 = await createReservation(req1);
    const res2 = await createReservation(req2);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(reservationsStore.length).toBe(2);
  });

  it('5. Cancelled reservation releases dates: rebooking the same dates is allowed after cancellation', async () => {
    // Initial reservation
    reservationsStore.push({
      id: 'res_cancelled_1',
      tenantId: 'tenant_pousada_mar_azul',
      guestId: 'guest_A',
      roomId: 'room_101',
      checkIn: new Date('2026-10-10T14:00:00Z'),
      checkOut: new Date('2026-10-13T12:00:00Z'),
      status: 'CANCELLED',
      totalPrice: 900,
      source: 'DIRECT',
    });

    const reqNew = new NextRequest('http://localhost:3000/api/v1/reservations', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room_101',
        guestId: 'guest_B',
        checkIn: '2026-10-10T14:00:00Z',
        checkOut: '2026-10-13T12:00:00Z',
        totalPrice: 900,
      }),
    });

    const resNew = await createReservation(reqNew);
    expect(resNew.status).toBe(201);

    const activeReservations = reservationsStore.filter((r) => r.status === 'CONFIRMED');
    expect(activeReservations.length).toBe(1);
    expect(activeReservations[0].guestId).toBe('guest_B');
  });

  it('6. Multi-tenant isolation: Tenant A cannot reserve a room belonging to Tenant B (returns 404)', async () => {
    vi.mocked(requireTenant).mockResolvedValue('tenant_pousada_mar_azul');

    const req = new NextRequest('http://localhost:3000/api/v1/reservations', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room_202', // Owned by tenant_pousada_sol_e_mar
        guestId: 'guest_A',
        checkIn: '2026-10-10T14:00:00Z',
        checkOut: '2026-10-13T12:00:00Z',
        totalPrice: 900,
      }),
    });

    const res = await createReservation(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe('RESOURCE_NOT_FOUND');
  });
});
