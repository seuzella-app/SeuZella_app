import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDb } = vi.hoisted(() => {
  const dbInstance = {
    billingIdempotency: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'idem_test' }),
      update: vi.fn().mockResolvedValue({ id: 'idem_test' }),
    },
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'sub_new_123' }),
    },
    user: {
      create: vi.fn().mockResolvedValue({ id: 'user_new_123' }),
    },
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'tenant_new_generated_uuid' }),
    },
    booking: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    conversationLog: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    conversationMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    agentLog: {
      findMany: vi.fn(),
    },
    conversation: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    guest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    trainingPrompt: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    property: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'prop_new_123' }),
    },
    airBProperty: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    target: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    paymentTransaction: {
      create: vi.fn().mockResolvedValue({ id: 'pt_new_123' }),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(dbInstance)),
  };
  return { mockDb: dbInstance };
});

vi.mock('@/lib/email-sender', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/db', () => ({
  db: mockDb,
  isDatabaseAvailable: vi.fn().mockResolvedValue(true),
}));

// Mock withAdvisoryLock to use $transaction with a mock that passes `mockDb` as `tx`
vi.mock('@/lib/db/concurrency', () => ({
  withAdvisoryLock: vi.fn(async (_lockKey: string, fn: (tx: any) => Promise<any>) => {
    return fn(mockDb);
  }),
  withSerializableRetry: vi.fn(async (fn: (tx: any) => Promise<any>) => {
    return fn(mockDb);
  }),
  mapConcurrencyError: vi.fn(() => null),
}));

vi.mock('@/lib/rate-limit', () => ({
  apiRatelimit: { limit: vi.fn().mockResolvedValue({ success: true, reset: 0 }) },
  authRatelimit: { limit: vi.fn().mockResolvedValue({ success: true, reset: 0 }) },
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/ddc/ddc-mapper', () => ({
  resolveTenantId: vi.fn(),
  mapBooking: vi.fn((b) => b),
  mapConversation: vi.fn((c) => c),
  mapGuest: vi.fn((g) => g),
  mapTraining: vi.fn((t) => t),
}));

vi.mock('@/lib/notifications/bridges', () => ({
  bridgeReservationEvent: vi.fn(),
  bridgeSecurityAlert: vi.fn(),
  bridgePaymentEvent: vi.fn(),
}));

vi.mock('@/lib/realtime/emit-tenant-event', () => ({
  emitTenantEvent: vi.fn(),
  buildPushForEvent: vi.fn(),
}));

vi.mock('@/lib/realtime/tenant-pubsub', () => ({
  publishTenantEvent: vi.fn(),
}));

vi.mock('@/lib/ai/zaos-neuro-router', () => ({
  getNeuroRouter: vi.fn().mockResolvedValue({
    generate: vi.fn().mockResolvedValue({ response: 'Olá, quarto confirmado!' }),
  }),
}));

import { getServerSession } from 'next-auth';
import { resolveTenantId } from '@/lib/ddc/ddc-mapper';
import { POST as paymentWebhookPOST } from '@/app/api/webhooks/payment/route';
import { POST as bookingPOST } from '@/app/api/ddc/bookings/route';
import { GET as convMessagesGET, POST as convMessagesPOST } from '@/app/api/ddc/conversations/[id]/messages/route';
import { POST as liveFeedPOST } from '@/app/api/ddc/live-feed/route';
import { GET as agentLogsGET } from '@/app/api/agent-logs/route';
import { GET as conversationsGET } from '@/app/api/conversations/route';
import { GET as guestGET, PUT as guestPUT, DELETE as guestDELETE } from '@/app/api/ddc/guests/[id]/route';
import { PUT as trainingPUT, DELETE as trainingDELETE, POST as trainingPOST } from '@/app/api/ddc/training/[id]/route';
import { GET as propertyGET, PUT as propertyPUT, DELETE as propertyDELETE } from '@/app/api/properties/[id]/route';
import { GET as targetGET, PUT as targetPUT, DELETE as targetDELETE } from '@/app/api/targets/[id]/route';

describe('🔒 Wave 1 — P0 Security Remediations Certification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('W1-C3: Webhook Tenant Isolation & Signature Hardening', () => {
    it('rejects webhooks with invalid HMAC signature with 401 unconditionally', async () => {
      process.env.PAYMENT_WEBHOOK_SECRET = 'secret_test_123';
      const request = new NextRequest('http://localhost:3000/api/webhooks/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'invalid_signature_hex',
        },
        body: JSON.stringify({ event: 'payment.created', status: 'approved' }),
      });

      const response = await paymentWebhookPOST(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('SIGNATURE_INVALID');
    });

    it('derives tenant authority from database Subscription record rather than spoofed metadata.tenantId', async () => {
      process.env.PAYMENT_WEBHOOK_SECRET = '';
      mockDb.subscription.findUnique.mockResolvedValueOnce({
        id: 'sub_real_123',
        tenantId: 'tenant_authoritative_A',
      });
      mockDb.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant_authoritative_A',
        plan: 'gratuito',
      });
      mockDb.tenant.update.mockResolvedValueOnce({ id: 'tenant_authoritative_A' });
      mockDb.subscription.update.mockResolvedValueOnce({ id: 'sub_real_123' });

      const request = new NextRequest('http://localhost:3000/api/webhooks/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'payment.created',
          status: 'approved',
          paymentId: 'pay_999',
          amount: 199.0,
          metadata: {
            subscriptionId: 'sub_real_123',
            tenantId: 'ATTACKER_SPOOFED_TENANT_B', // Spoofed!
          },
        }),
      });

      const response = await paymentWebhookPOST(request);
      expect(response.status).toBe(200);

      expect(mockDb.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant_authoritative_A' },
        })
      );
    });

    it('creates a new tenant and never mutates an existing tenant when subscriptionId is missing even if metadata.tenantId is provided (P1 hardening)', async () => {
      process.env.PAYMENT_WEBHOOK_SECRET = '';
      mockDb.tenant.create.mockResolvedValueOnce({
        id: 'tenant_new_generated_uuid',
        name: 'New Client Hotel',
      });

      const request = new NextRequest('http://localhost:3000/api/webhooks/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'payment.created',
          status: 'approved',
          paymentId: 'pay_1000',
          amount: 199.0,
          payer: {
            first_name: 'Novo',
            last_name: 'Cliente',
            email: 'novocliente@exemplo.com',
          },
          metadata: {
            tenantId: 'VICTIM_TENANT_EXISTING', // Spoofed tenant without valid subscription
            propertyName: 'Pousada Nova',
          },
        }),
      });

      const response = await paymentWebhookPOST(request);
      expect(response.status).toBe(200);

      // Verify that tenant.update was NOT called on VICTIM_TENANT_EXISTING
      expect(mockDb.tenant.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'VICTIM_TENANT_EXISTING' },
        })
      );

      // Verify a new tenant was created
      expect(mockDb.tenant.create).toHaveBeenCalled();
    });

    it('rejects cancellation on unauthorized tenant when subscriptionId is absent or unverified', async () => {
      process.env.PAYMENT_WEBHOOK_SECRET = '';

      const request = new NextRequest('http://localhost:3000/api/webhooks/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'subscription.canceled',
          metadata: {
            tenantId: 'VICTIM_TENANT_TO_SUSPEND', // Spoofed target
          },
        }),
      });

      const response = await paymentWebhookPOST(request);
      expect(response.status).toBe(200);

      // Verify that victim tenant was NOT suspended
      expect(mockDb.tenant.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'VICTIM_TENANT_TO_SUSPEND' },
          data: { status: 'suspended' },
        })
      );
    });
  });

  describe('W1-D2: Double Booking Concurrency & Overlap Prevention', () => {
    it('blocks double booking with 409 when room and dates overlap', async () => {
      vi.mocked(resolveTenantId).mockResolvedValueOnce('tenant_sol');

      mockDb.booking.findFirst.mockResolvedValueOnce({
        id: 'existing_booking_1',
        roomId: 'suite_101',
        checkIn: new Date('2026-08-10T14:00:00Z'),
        checkOut: new Date('2026-08-15T12:00:00Z'),
        status: 'confirmed',
      });

      const request = new NextRequest('http://localhost:3000/api/ddc/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: 'guest_attacker',
          roomId: 'suite_101',
          checkIn: '2026-08-12T14:00:00Z',
          checkOut: '2026-08-18T12:00:00Z',
          total: 800,
        }),
      });

      const response = await bookingPOST(request);
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error.code).toBe('DOUBLE_BOOKING_CONFLICT');
      expect(mockDb.booking.create).not.toHaveBeenCalled();
    });

    it('permits booking when dates do not overlap', async () => {
      vi.mocked(resolveTenantId).mockResolvedValueOnce('tenant_sol');
      mockDb.booking.findFirst.mockResolvedValueOnce(null);
      mockDb.booking.create.mockResolvedValueOnce({
        id: 'new_bk_ok',
        tenantId: 'tenant_sol',
        roomId: 'suite_101',
        totalValue: 500,
        status: 'confirmed',
      });

      const request = new NextRequest('http://localhost:3000/api/ddc/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: 'guest_legit',
          roomId: 'suite_101',
          checkIn: '2026-08-20T14:00:00Z',
          checkOut: '2026-08-25T12:00:00Z',
          total: 500,
        }),
      });

      const response = await bookingPOST(request);
      expect(response.status).toBe(201);
      expect(mockDb.booking.create).toHaveBeenCalled();
    });

    it('maps PostgreSQL exclusion violation (23P01) or booking_no_overlap to HTTP 409 DOUBLE_BOOKING_CONFLICT', async () => {
      vi.mocked(resolveTenantId).mockResolvedValueOnce('tenant_sol');
      mockDb.booking.findFirst.mockResolvedValueOnce(null); // Simulated race condition where findFirst passed
      // Simulated DB exclusion constraint violation on insert
      const exclusionError = new Error('conflicting key value violates exclusion constraint "booking_no_overlap"');
      (exclusionError as unknown as { code: string }).code = '23P01';
      mockDb.booking.create.mockRejectedValueOnce(exclusionError);

      const request = new NextRequest('http://localhost:3000/api/ddc/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: 'guest_race_loser',
          roomId: 'suite_101',
          checkIn: '2026-08-10T14:00:00Z',
          checkOut: '2026-08-15T12:00:00Z',
          total: 800,
        }),
      });

      const response = await bookingPOST(request);
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error.code).toBe('DOUBLE_BOOKING_CONFLICT');
    });
  });

  describe('W1-A1: IDOR & Multi-Tenant Access Control', () => {
    it('blocks cross-tenant access to conversation messages with 404', async () => {
      vi.mocked(resolveTenantId).mockResolvedValueOnce('tenant_attacker');
      mockDb.conversationLog.findFirst.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/ddc/conversations/conv_victim_99/messages');
      const response = await convMessagesGET(request, { params: Promise.resolve({ id: 'conv_victim_99' }) });

      expect(response.status).toBe(404);
      expect(mockDb.conversationMessage.findMany).not.toHaveBeenCalled();
    });

    it('blocks cross-tenant message creation in conversation with 404', async () => {
      vi.mocked(resolveTenantId).mockResolvedValueOnce('tenant_attacker');
      mockDb.conversationLog.findFirst.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/ddc/conversations/conv_victim_99/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'guest', content: 'Injected message' }),
      });

      const response = await convMessagesPOST(request, { params: Promise.resolve({ id: 'conv_victim_99' }) });
      expect(response.status).toBe(404);
      expect(mockDb.conversationMessage.create).not.toHaveBeenCalled();
    });

    it('blocks cross-tenant message injection in live-feed POST with 404', async () => {
      vi.mocked(resolveTenantId).mockResolvedValueOnce('tenant_attacker');
      mockDb.conversationLog.findFirst.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/ddc/live-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'conv_victim_99',
          content: 'Injected live feed message',
          from: 'guest',
        }),
      });

      const response = await liveFeedPOST(request);
      expect(response.status).toBe(404);
      expect(mockDb.conversationMessage.create).not.toHaveBeenCalled();
    });

    it('blocks cross-tenant GET, PUT, DELETE on guests/[id] with 404', async () => {
      vi.mocked(resolveTenantId).mockResolvedValue('tenant_attacker');
      mockDb.guest.findFirst.mockResolvedValue(null);

      const reqGet = new NextRequest('http://localhost:3000/api/ddc/guests/guest_victim_1');
      const resGet = await guestGET(reqGet, { params: Promise.resolve({ id: 'guest_victim_1' }) });
      expect(resGet.status).toBe(404);

      const reqPut = new NextRequest('http://localhost:3000/api/ddc/guests/guest_victim_1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacked Name' }),
      });
      const resPut = await guestPUT(reqPut, { params: Promise.resolve({ id: 'guest_victim_1' }) });
      expect(resPut.status).toBe(404);
      expect(mockDb.guest.update).not.toHaveBeenCalled();

      const reqDel = new NextRequest('http://localhost:3000/api/ddc/guests/guest_victim_1', { method: 'DELETE' });
      const resDel = await guestDELETE(reqDel, { params: Promise.resolve({ id: 'guest_victim_1' }) });
      expect(resDel.status).toBe(404);
      expect(mockDb.guest.delete).not.toHaveBeenCalled();
    });

    it('blocks cross-tenant PUT, DELETE, POST on training/[id] with 404', async () => {
      vi.mocked(resolveTenantId).mockResolvedValue('tenant_attacker');
      mockDb.trainingPrompt.findFirst.mockResolvedValue(null);

      const reqPut = new NextRequest('http://localhost:3000/api/ddc/training/train_victim_1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hacked Prompt' }),
      });
      const resPut = await trainingPUT(reqPut, { params: Promise.resolve({ id: 'train_victim_1' }) });
      expect(resPut.status).toBe(404);
      expect(mockDb.trainingPrompt.update).not.toHaveBeenCalled();

      const reqDel = new NextRequest('http://localhost:3000/api/ddc/training/train_victim_1', { method: 'DELETE' });
      const resDel = await trainingDELETE(reqDel, { params: Promise.resolve({ id: 'train_victim_1' }) });
      expect(resDel.status).toBe(404);
      expect(mockDb.trainingPrompt.delete).not.toHaveBeenCalled();

      const reqPost = new NextRequest('http://localhost:3000/api/ddc/training/train_victim_1', { method: 'POST' });
      const resPost = await trainingPOST(reqPost, { params: Promise.resolve({ id: 'train_victim_1' }) });
      expect(resPost.status).toBe(404);
    });

    it('requires session and scopes properties/[id] to session tenantId', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);
      const req1 = new NextRequest('http://localhost:3000/api/properties/prop_1');
      const res1 = await propertyGET(req1, { params: Promise.resolve({ id: 'prop_1' }) });
      expect(res1.status).toBe(401);

      vi.mocked(getServerSession).mockResolvedValue({
        user: { tenantId: 'tenant_pousada_1' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });
      mockDb.airBProperty.findFirst.mockResolvedValue(null);

      const req2 = new NextRequest('http://localhost:3000/api/properties/prop_victim');
      const res2 = await propertyGET(req2, { params: Promise.resolve({ id: 'prop_victim' }) });
      expect(res2.status).toBe(404);

      const reqPut = new NextRequest('http://localhost:3000/api/properties/prop_victim', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacked Prop' }),
      });
      const resPut = await propertyPUT(reqPut, { params: Promise.resolve({ id: 'prop_victim' }) });
      expect(resPut.status).toBe(404);

      const reqDel = new NextRequest('http://localhost:3000/api/properties/prop_victim', { method: 'DELETE' });
      const resDel = await propertyDELETE(reqDel, { params: Promise.resolve({ id: 'prop_victim' }) });
      expect(resDel.status).toBe(404);
    });

    it('requires session and scopes targets/[id] to session tenantId', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);
      const req1 = new Request('http://localhost:3000/api/targets/target_1');
      const res1 = await targetGET(req1, { params: Promise.resolve({ id: 'target_1' }) });
      expect(res1.status).toBe(401);

      vi.mocked(getServerSession).mockResolvedValue({
        user: { tenantId: 'tenant_pousada_1' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });
      mockDb.target.findFirst.mockResolvedValue(null);

      const req2 = new Request('http://localhost:3000/api/targets/target_victim');
      const res2 = await targetGET(req2, { params: Promise.resolve({ id: 'target_victim' }) });
      expect(res2.status).toBe(404);

      const reqPut = new Request('http://localhost:3000/api/targets/target_victim', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacked Target' }),
      });
      const resPut = await targetPUT(reqPut, { params: Promise.resolve({ id: 'target_victim' }) });
      expect(resPut.status).toBe(404);

      const reqDel = new Request('http://localhost:3000/api/targets/target_victim', { method: 'DELETE' });
      const resDel = await targetDELETE(reqDel, { params: Promise.resolve({ id: 'target_victim' }) });
      expect(resDel.status).toBe(404);
    });

    it('requires session and scopes agent-logs to session tenantId', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);
      const req1 = new Request('http://localhost:3000/api/agent-logs');
      const res1 = await agentLogsGET(req1);
      expect(res1.status).toBe(401);

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { tenantId: 'tenant_pousada_1' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });
      mockDb.agentLog.findMany.mockResolvedValueOnce([]);

      const req2 = new Request('http://localhost:3000/api/agent-logs');
      const res2 = await agentLogsGET(req2);
      expect(res2.status).toBe(200);
      expect(mockDb.agentLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant_pousada_1' },
        })
      );
    });

    it('requires session and scopes conversations list to session tenantId', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);
      const req1 = new NextRequest('http://localhost:3000/api/conversations');
      const res1 = await conversationsGET(req1);
      expect(res1.status).toBe(401);

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { tenantId: 'tenant_pousada_2' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });
      mockDb.conversation.findMany.mockResolvedValueOnce([]);
      mockDb.conversation.count.mockResolvedValue(0);

      const req2 = new NextRequest('http://localhost:3000/api/conversations');
      const res2 = await conversationsGET(req2);
      expect(res2.status).toBe(200);
      expect(mockDb.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant_pousada_2' }),
        })
      );
    });
  });
});
