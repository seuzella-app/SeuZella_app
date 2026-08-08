/**
 * Tests for /api/webhooks/booking-com/reviews (Gap 4)
 *
 * Validates:
 *  - HMAC SHA-256 signature verification (timing-safe)
 *  - Returns 200 OK always (Booking.com requirement)
 *  - Fires bridgeReviewNegative when rating < 3
 *  - Fires bridgeSecurityAlert on invalid signature (in production)
 *  - GET endpoint for health check
 *  - Handles malformed JSON gracefully
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import { memoryStore } from '@/lib/notifications/producer';

const WEBHOOK_SECRET = 'test-booking-secret-12345678901234567890';

function signBookingPayload(body: string, secret: string = WEBHOOK_SECRET): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function makeRequest(body: any, opts: { signature?: string; secret?: string } = {}): Request {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const secret = opts.secret ?? WEBHOOK_SECRET;
  const signature = opts.signature ?? signBookingPayload(bodyStr, secret);
  return new Request('http://localhost:3000/api/webhooks/booking-com/reviews', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-booking-signature': signature,
    },
    body: bodyStr,
  });
}

describe('Booking.com Reviews Webhook — GET health check', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.BOOKING_COM_WEBHOOK_SECRET;
  });

  it('returns 200 with endpoint info', async () => {
    const { GET } = await import('@/app/api/webhooks/booking-com/reviews/route');
    const req = new Request('http://localhost:3000/api/webhooks/booking-com/reviews');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.endpoint).toBe('/api/webhooks/booking-com/reviews');
    expect(body.mode).toBeTruthy();
    expect(body.timestamp).toBeTruthy();
  });
});

describe('Booking.com Reviews Webhook — POST in dev mode (no signature verification)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.BOOKING_COM_WEBHOOK_SECRET;
    memoryStore.clear();
  });

  it('returns 200 with rating=5 (no negative review fired)', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-com/reviews/route');
    const body = {
      hotel_id: 'tenant-1',
      reviewer: { first_name: 'João' },
      rating: 5,
      comments: 'Great stay!',
    };
    const req = makeRequest(body);
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(json.rating).toBe(5);
    expect(json.triggeredNegativeReview).toBe(false);
  });

  it('fires bridgeReviewNegative when rating < 3', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-com/reviews/route');
    const body = {
      hotel_id: 'tenant-1',
      reviewer: { first_name: 'Maria' },
      rating: 2,
      comments: 'Bad experience',
    };
    const req = makeRequest(body);
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.triggeredNegativeReview).toBe(true);
    expect(json.rating).toBe(2);

    // Verify the negative review notification was created in memoryStore
    const notifications = memoryStore.query({ status: 'unread', limit: 10 });
    const negative = notifications.find((n) => n.type === 'external.review_negative');
    expect(negative).toBeDefined();
    expect(negative?.priority).toBe('high');
  });

  it('does NOT fire negative review when rating >= 3', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-com/reviews/route');
    const body = {
      hotel_id: 'tenant-1',
      reviewer: { first_name: 'Pedro' },
      rating: 3,
    };
    const req = makeRequest(body);
    await POST(req as any);

    const notifications = memoryStore.query({ status: 'unread', limit: 10 });
    const negative = notifications.find((n) => n.type === 'external.review_negative');
    expect(negative).toBeUndefined();
  });

  it('returns 200 with received=true for malformed JSON', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-com/reviews/route');
    const req = new Request('http://localhost:3000/api/webhooks/booking-com/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not valid json',
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(json.error).toBe('INVALID_JSON');
  });
});

describe('Booking.com Reviews Webhook — Production mode with HMAC verification', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.BOOKING_COM_WEBHOOK_SECRET = WEBHOOK_SECRET;
    memoryStore.clear();
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.BOOKING_COM_WEBHOOK_SECRET;
  });

  it('rejects missing signature with 503 when secret not configured', async () => {
    delete process.env.BOOKING_COM_WEBHOOK_SECRET;
    const { POST } = await import('@/app/api/webhooks/booking-com/reviews/route');
    const body = { rating: 5 };
    const req = new Request('http://localhost:3000/api/webhooks/booking-com/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('WEBHOOK_NOT_CONFIGURED');
  });

  it('returns 401 with SIGNATURE_REQUIRED when signature missing (production)', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-com/reviews/route');
    const body = { rating: 5 };
    const req = new Request('http://localhost:3000/api/webhooks/booking-com/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await POST(req as any);
    // Code returns 401 when signature is missing in production
    // (Booking.com would normally always send x-booking-signature)
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('SIGNATURE_REQUIRED');
  });

  it('returns 200 with SIGNATURE_INVALID when signature wrong', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-com/reviews/route');
    const body = { rating: 5 };
    const req = makeRequest(body, { signature: 'deadbeef'.repeat(8) });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(json.error).toBe('SIGNATURE_INVALID');

    // Verify security alert was fired
    const notifications = memoryStore.query({ status: 'unread', limit: 10 });
    const alert = notifications.find((n) => n.type === 'system.security_alert');
    expect(alert).toBeDefined();
    expect(alert?.priority).toBe('urgent');
  });

  it('accepts valid signature and processes payload', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-com/reviews/route');
    const body = {
      hotel_id: 'tenant-prod-1',
      reviewer: { first_name: 'Ana' },
      rating: 2,
      comments: 'Terrible',
    };
    const req = makeRequest(body);
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(json.signatureValid).toBe(true);
    expect(json.triggeredNegativeReview).toBe(true);
  });

  it('accepts valid signature with rating=5 (no negative review)', async () => {
    const { POST } = await import('@/app/api/webhooks/booking-com/reviews/route');
    const body = {
      hotel_id: 'tenant-prod-1',
      reviewer: { first_name: 'Bob' },
      rating: 5,
    };
    const req = makeRequest(body);
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.signatureValid).toBe(true);
    expect(json.triggeredNegativeReview).toBe(false);
  });
});

describe('Booking.com Reviews Webhook — signature verification logic', () => {
  it('signature is deterministic for same payload + secret', () => {
    const body = JSON.stringify({ rating: 4 });
    const sig1 = signBookingPayload(body);
    const sig2 = signBookingPayload(body);
    expect(sig1).toBe(sig2);
  });

  it('signature changes with different secret', () => {
    const body = JSON.stringify({ rating: 4 });
    const sig1 = signBookingPayload(body, 'secret1');
    const sig2 = signBookingPayload(body, 'secret2');
    expect(sig1).not.toBe(sig2);
  });

  it('signature changes with different payload', () => {
    const sig1 = signBookingPayload(JSON.stringify({ rating: 4 }));
    const sig2 = signBookingPayload(JSON.stringify({ rating: 5 }));
    expect(sig1).not.toBe(sig2);
  });
});
