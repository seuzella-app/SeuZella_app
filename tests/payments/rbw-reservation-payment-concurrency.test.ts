/**
 * RBW Fase G — concorrência no pagamento de reserva.
 * Prova: REQUEST A + REQUEST B simultâneos → EXATAMENTE UMA cobrança,
 * porque a checagem de pagamento existente roda DENTRO do advisory lock.
 * Simulação local: mutex assíncrono no lugar do advisory lock PostgreSQL
 * (mesma semântica de serialização), gateway mock contando chamadas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createPayment = vi.fn(async (input: any) => {
  createPaymentCalls.push(input);
  return { gateway: 'mock', gatewayPaymentId: `gw_${createPaymentCalls.length}`, status: 'pending', checkoutUrl: 'https://gw.test/pay' };
});
const createPaymentCalls: any[] = [];

vi.mock('@/lib/payments/gateway-factory', () => ({
  getGateway: () => ({
    id: 'mock',
    isConfigured: () => true,
    createPayment,
  }),
}));

// Mutex assíncrono: mesma semântica do withAdvisoryLock (serializa o corpo).
const lockCalls: string[] = [];
let chain: Promise<unknown> = Promise.resolve();
vi.mock('@/lib/db/concurrency', () => ({
  withAdvisoryLock: (key: string, fn: () => Promise<unknown>) => {
    lockCalls.push(key);
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  },
}));

const state = {
  rows: [] as Array<{ id: string; tenant_id: string; reservation_id: string; gateway: string; gateway_payment_id: string; status: string; checkout_url: string | null; metadata: string }>,
};

vi.mock('@/lib/db', () => ({
  db: {
    reservation: {
      findFirst: vi.fn(async (args: any) =>
        args.where.tenantId === 'tenant_A' ? { id: 'res_1', tenantId: 'tenant_A', totalPrice: 350, roomId: 'room_1', guestId: 'g_1', status: 'CONFIRMED', guest: {}, room: {} } : null),
    },
    $queryRaw: vi.fn(async () =>
      state.rows.length > 0 ? state.rows : []),
    $executeRaw: vi.fn(async (...args: unknown[]) => {
      // Simula o INSERT executado pelo serviço: o primeiro parâmetro do tagged
      // template é o paymentId (randomUUID) — a row visível ao próximo SELECT
      // carrega O MESMO id que o serviço devolve (comportamento do PostgreSQL).
      const strings = args[0] as unknown as TemplateStringsArray;
      const paymentId = String(args[1] ?? `pay_${state.rows.length + 1}`);
      void strings;
      state.rows.push({
        id: paymentId,
        tenant_id: 'tenant_A',
        reservation_id: 'res_1',
        gateway: 'mock',
        gateway_payment_id: `gw_${createPaymentCalls.length}`,
        status: 'pending',
        checkout_url: 'https://gw.test/pay',
        metadata: '{}',
      });
      return 1;
    }),
  },
}));

import { createReservationPayment } from '@/lib/payments/reservation-payment-service';
import { db } from '@/lib/db';

const input = {
  tenantId: 'tenant_A',
  reservationId: 'res_1',
  gateway: 'mock' as const,
  paymentMethod: 'pix' as const,
  customer: { name: 'Hóspede Teste', email: 'h@test.com' },
  successUrl: 'https://app.test/ok',
  cancelUrl: 'https://app.test/no',
  webhookUrl: 'https://app.test/api/webhooks/payment',
};

describe('RBW-G · createReservationPayment sob concorrência', () => {
  beforeEach(() => {
    createPaymentCalls.length = 0;
    (createPayment as any).mockClear();
    state.rows = [];
    lockCalls.length = 0;
    vi.clearAllMocks();
  });

  it('REQUEST A + REQUEST B simultâneos → EXATAMENTE UMA cobrança no gateway', async () => {
    const [a, b] = await Promise.all([
      createReservationPayment(input),
      createReservationPayment({ ...input }),
    ]);
    expect(createPaymentCalls).toHaveLength(1);
    // B reencontra o pagamento de A (idempotência determinística).
    expect(b.paymentId).toBe(a.paymentId);
    expect(b.gatewayPaymentId).toBe(a.gatewayPaymentId);
  });

  it('retry após primeira cobrança pendente → reusa checkout existente (sem nova cobrança)', async () => {
    await createReservationPayment(input);
    const second = await createReservationPayment(input);
    expect(createPaymentCalls).toHaveLength(1);
    expect(second.checkoutUrl).toBe('https://gw.test/pay');
  });

  it('chave de lock determinística: tenantId + reservationId + purpose', async () => {
    lockCalls.length = 0;
    await createReservationPayment(input);
    expect(lockCalls).toContain('reservation-payment-create:tenant_A:res_1:reservation');
  });

  it('reserva de outro tenant → RESERVATION_NOT_FOUND (isolamento)', async () => {
    await expect(createReservationPayment({ ...input, tenantId: 'tenant_B' })).rejects.toThrow('RESERVATION_NOT_FOUND');
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});
