/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mocks com vi.hoisted para Vitest 3.x ─────────────────────────────────────
const { mockDb, mockOrchestrator } = vi.hoisted(() => {
  const txInstance = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn(),
    reservation: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'res_123', status: 'REFUNDED' }),
    },
    transaction: {
      findFirst: vi.fn(),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'tx_rev_123', ...data })),
    },
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'sub_123' }),
    },
    paymentTransaction: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'pt_123' }),
      update: vi.fn().mockResolvedValue({ id: 'pt_123' }),
    },
    tenant: {
      update: vi.fn().mockResolvedValue({ id: 'tenant_123' }),
    },
  };

  const dbInstance = {
    $transaction: vi.fn(async (callback) => callback(txInstance)),
    reservation: txInstance.reservation,
    transaction: txInstance.transaction,
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif_123' }),
    },
    lockCode: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  const orchestratorInstance = {
    revokeReservationPins: vi.fn().mockResolvedValue({ success: true, revokedCount: 2, status: 'ACCESS_REVOKED' }),
  };

  return {
    mockDb: dbInstance,
    mockTx: txInstance,
    mockOrchestrator: orchestratorInstance,
  };
});

vi.mock('@/lib/db', () => ({
  db: mockDb,
  isDatabaseAvailable: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/locks/orchestrator', () => ({
  revokeReservationPins: mockOrchestrator.revokeReservationPins,
}));

vi.mock('@/lib/notifications/bridges', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/notifications/bridges')>();
  return {
    ...actual,
    bridgePaymentEvent: vi.fn(actual.bridgePaymentEvent),
  };
});

import { validatePaymentWebhookTransition } from '@/lib/payments/webhook-transition';
import { writeReversalTransaction } from '@/lib/payments/reservation-payment-effects';
import { processReservationPaymentWebhookEvent } from '@/lib/payments/process-reservation-webhook';
import { bridgePaymentEvent } from '@/lib/notifications/bridges';
import type { WebhookEvent } from '@/lib/payments/types';

describe('🔒 C4: Refund & Cancellation Lifecycle Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Payment State Machine Transition Validation', () => {
    it('allows valid transition from PAID to REFUNDED', () => {
      const result = validatePaymentWebhookTransition('approved', 'refunded');
      expect(result.accepted).toBe(true);
      expect(result.nextState).toBe('REFUNDED');
    });

    it('allows valid transition from CONFIRMED to CANCELLED', () => {
      const result = validatePaymentWebhookTransition('confirmed', 'cancelled');
      expect(result.accepted).toBe(true);
      expect(result.nextState).toBe('CANCELLED');
    });

    it('PROHIBITS illegal transition from REFUNDED to APPROVED / PAID (terminal state)', () => {
      const result = validatePaymentWebhookTransition('refunded', 'approved');
      expect(result.accepted).toBe(false);
      expect(result.nextState).toBe('REFUNDED');
      if (!result.accepted) {
        expect(result.reason).toContain('Transição proibida de REFUNDED para PAID');
      }
    });

    it('PROHIBITS illegal transition from CANCELLED to APPROVED / PAID', () => {
      const result = validatePaymentWebhookTransition('cancelled', 'approved');
      expect(result.accepted).toBe(false);
      expect(result.nextState).toBe('CANCELLED');
    });

    it('treats duplicate refund as idempotent no-op', () => {
      const result = validatePaymentWebhookTransition('refunded', 'refunded');
      expect(result.accepted).toBe(true);
      expect(result.nextState).toBe('REFUNDED');
    });
  });

  describe('2. Reversal Transaction Ledger (writeReversalTransaction)', () => {
    it('creates negative amount reversal transaction with REFUNDED status', async () => {
      const mockTx = {
        transaction: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'tx_rev_1', ...data })),
        },
      };

      const result = await writeReversalTransaction(mockTx as any, {
        tenantId: 'tenant_alpha',
        reservationId: 'res_alpha_1',
        amount: 350.0,
        gateway: 'asaas',
        providerEventId: 'pay_event_99',
      });

      expect(result.alreadyReversed).toBe(false);
      expect(result.transactionId).toBe('tx_rev_1');
      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant_alpha',
          reservationId: 'res_alpha_1',
          type: 'RESERVATION_REFUND:asaas',
          amount: -350.0,
          method: 'asaas',
          status: 'REFUNDED',
        },
      });
    });

    it('is idempotent and skips duplicate reversal if already recorded', async () => {
      const mockTx = {
        transaction: {
          findFirst: vi.fn().mockResolvedValue({ id: 'tx_existing_reversal' }),
          create: vi.fn(),
        },
      };

      const result = await writeReversalTransaction(mockTx as any, {
        tenantId: 'tenant_alpha',
        reservationId: 'res_alpha_1',
        amount: 350.0,
        gateway: 'asaas',
      });

      expect(result.alreadyReversed).toBe(true);
      expect(result.transactionId).toBe('tx_existing_reversal');
      expect(mockTx.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('3. Process Reservation Webhook: Refund & Cancellation Execution', () => {
    it('processes refund webhook, writes reversal ledger, and invokes PIN revocation', async () => {
      const event: WebhookEvent = {
        gateway: 'asaas',
        event: 'PAYMENT_REFUNDED',
        status: 'refunded',
        providerEventId: 'evt_refund_101',
        gatewayPaymentId: 'pay_gateway_101',
        referenceId: 'res_booking_555',
        amount: 500.0,
        receivedAt: new Date().toISOString(),
        raw: {},
      };

      // Mock database state
      mockDb.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          $executeRaw: vi.fn().mockResolvedValue(1),
          $queryRaw: vi.fn()
            .mockResolvedValueOnce([]) // duplicate check -> not duplicate
            .mockResolvedValueOnce([{ id: 'rp_1', status: 'approved' }]), // existing payment status was approved
          reservation: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'res_booking_555',
              tenantId: 'tenant_hotel_1',
              checkIn: new Date(),
              checkOut: new Date(),
              status: 'CONFIRMED',
              guest: { name: 'Mariana Lima', phone: '11999998888' },
            }),
            update: vi.fn().mockResolvedValue({ id: 'res_booking_555', status: 'REFUNDED' }),
          },
          transaction: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'tx_refund_new' }),
          },
        };
        return callback(tx);
      });

      const result = await processReservationPaymentWebhookEvent(event);

      expect(result.deduplicated).toBe(false);
      expect(result.reservationId).toBe('res_booking_555');

      // Verifies physical security side-effect: PINs revoked with proper tenant boundary
      expect(mockOrchestrator.revokeReservationPins).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant_hotel_1',
          reservationId: 'res_booking_555',
        })
      );
    });

    it('processes cancellation webhook and invokes PIN revocation', async () => {
      const event: WebhookEvent = {
        gateway: 'mercadopago',
        event: 'payment.cancelled',
        status: 'cancelled',
        providerEventId: 'evt_cancel_202',
        gatewayPaymentId: 'mp_pay_202',
        referenceId: 'res_booking_777',
        amount: 250.0,
        receivedAt: new Date().toISOString(),
        raw: {},
      };

      mockDb.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          $executeRaw: vi.fn().mockResolvedValue(1),
          $queryRaw: vi.fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'rp_2', status: 'pending' }]),
          reservation: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'res_booking_777',
              tenantId: 'tenant_hotel_2',
              checkIn: new Date(),
              checkOut: new Date(),
              status: 'CONFIRMED',
              guest: { name: 'Lucas Silva', phone: '21988887777' },
            }),
            update: vi.fn().mockResolvedValue({ id: 'res_booking_777', status: 'CANCELLED' }),
          },
          transaction: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'tx_cancel_new' }),
          },
        };
        return callback(tx);
      });

      const result = await processReservationPaymentWebhookEvent(event);

      expect(result.deduplicated).toBe(false);
      expect(mockOrchestrator.revokeReservationPins).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant_hotel_2',
          reservationId: 'res_booking_777',
        })
      );
    });

    it('rejects out-of-order re-activation attempt when reservation was already refunded', async () => {
      const outOfOrderApprovedEvent: WebhookEvent = {
        gateway: 'asaas',
        event: 'PAYMENT_RECEIVED',
        status: 'approved',
        providerEventId: 'evt_late_approved_303',
        gatewayPaymentId: 'pay_late_303',
        referenceId: 'res_booking_888',
        amount: 400.0,
        receivedAt: new Date().toISOString(),
        raw: {},
      };

      mockDb.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          $executeRaw: vi.fn().mockResolvedValue(1),
          $queryRaw: vi.fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'rp_3', status: 'refunded' }]), // Already REFUNDED!
          reservation: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'res_booking_888',
              tenantId: 'tenant_hotel_3',
              checkIn: new Date(),
              checkOut: new Date(),
              status: 'REFUNDED',
              guest: { name: 'Roberto Carlos', phone: '41977776666' },
            }),
            update: vi.fn(),
          },
          transaction: {
            findFirst: vi.fn(),
            create: vi.fn(),
          },
        };
        return callback(tx);
      });

      const result = await processReservationPaymentWebhookEvent(outOfOrderApprovedEvent);

      // Must be safely discarded/deduplicated without reviving the reservation
      expect(result.deduplicated).toBe(true);
      expect(result.reservationId).toBe('res_booking_888');
    });
  });

  describe('4. Notification Bridge for Refund Events', () => {
    it('dispatches payment.refunded notification correctly through bridgePaymentEvent', () => {
      const result = bridgePaymentEvent({
        niche: 'pousada',
        paymentId: 'pay_ref_test_1',
        amount: 450.0,
        guestName: 'Ana Paula',
        status: 'refunded',
        tenantId: 'tenant_pousada_1',
      });

      expect(result.success).toBe(true);
      expect(result.notification?.type).toBe('payment.refunded');
      expect(result.notification?.title).toBe('Estorno processado');
      expect(result.notification?.message).toContain('R$ 450.00 estornado para Ana Paula');
    });
  });
});
