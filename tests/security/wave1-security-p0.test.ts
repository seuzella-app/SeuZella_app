import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDb } = vi.hoisted(() => {
  const dbInstance = {
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
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
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(dbInstance)),
  };
  return { mockDb: dbInstance };
});

vi.mock('@/lib/db', () => ({
  db: mockDb,
  isDatabaseAvailable: vi.fn().mockResolvedValue(true),
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

import { getServerSession } from 'next-auth';
import { resolveTenantId } from '@/lib/ddc/ddc-mapper';
import { POST as paymentWebhookPOST } from '@/app/api/webhooks/payment/route';
import { POST as bookingPOST } from '@/app/api/ddc/bookings/route';
import { GET as convMessagesGET, POST as convMessagesPOST } from '@/app/api/ddc/conversations/[id]/messages/route';
import { POST as liveFeedPOST } from '@/app/api/ddc/live-feed/route';
import { GET as agentLogsGET } from '@/app/api/agent-logs/route';
import { GET as conversationsGET } from '@/app/api/conversations/route';

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
      // Mock valid signature verification
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

      // Verify that the update was applied to authoritative tenant A, NOT attacker tenant B
      expect(mockDb.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant_authoritative_A' },
        })
      );
    });
  });

  describe('W1-D2: Double Booking Concurrency & Overlap Prevention', () => {
    it('blocks double booking with 409 when room and dates overlap', async () => {
      vi.mocked(resolveTenantId).mockResolvedValueOnce('tenant_sol');

      // Existing booking from Aug 10 to Aug 15
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
          checkIn: '2026-08-12T14:00:00Z', // Overlaps with 10..15
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
      mockDb.booking.findFirst.mockResolvedValueOnce(null); // No overlap
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
  });

  describe('W1-A1: IDOR & Multi-Tenant Access Control', () => {
    it('blocks cross-tenant access to conversation messages with 404 (IDOR prevention)', async () => {
      vi.mocked(resolveTenantId).mockResolvedValueOnce('tenant_attacker');
      // Conversation belongs to tenant_victim, not tenant_attacker
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

    it('requires session and scopes agent-logs to session tenantId', async () => {
      // 1. Unauthenticated -> 401
      vi.mocked(getServerSession).mockResolvedValueOnce(null);
      const req1 = new Request('http://localhost:3000/api/agent-logs');
      const res1 = await agentLogsGET(req1);
      expect(res1.status).toBe(401);

      // 2. Authenticated -> scopes by tenantId
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
      // 1. Unauthenticated -> 401
      vi.mocked(getServerSession).mockResolvedValueOnce(null);
      const req1 = new NextRequest('http://localhost:3000/api/conversations');
      const res1 = await conversationsGET(req1);
      expect(res1.status).toBe(401);

      // 2. Authenticated -> scopes by tenantId
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
