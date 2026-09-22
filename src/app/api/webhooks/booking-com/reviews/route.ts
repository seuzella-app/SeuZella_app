// ============================================================================
// ZÉLLA — Booking.com Reviews Webhook (Gap 4)
// ============================================================================
// Recebe webhook HMAC SHA-256 do Booking.com quando uma review é postada.
// Se rating < 3, chama bridgeReviewNegative para notificar o dono.
// Sempre retorna 200 OK (Booking.com exige 200 para não retentar).
//
// Env vars necessárias:
//  - BOOKING_COM_WEBHOOK_SECRET: segredo compartilhado para verificação HMAC
//
// Em dev/mock mode: aceita qualquer payload sem verificar assinatura (log warning).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { bridgeReviewNegative, bridgeSecurityAlert } from '@/lib/notifications/bridges';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export const dynamic = 'force-dynamic';

interface BookingReviewWebhook {
  hotel_id?: string;
  reviewer?: {
    first_name?: string;
    last_name?: string;
    country?: string;
  };
  rating?: number;
  comments?: string;
  review_id?: string;
  timestamp?: string;
}

function verifyBookingSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // RUN14-A (W2): anti-flood fail-closed por IP — 120 req/1min.
  const rlDeny = guardRequest(request, 'webhooks.booking-com.reviews', { points: 120, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:webhooks.booking-com.reviews', what: 'webhooks.booking-com.reviews.entry', resource: 'api', result: 'ALLOW' });
  const startTime = Date.now();
  const rawBody = await request.text();
  const signature = request.headers.get('x-booking-signature') ?? '';
  const webhookSecret = process.env.BOOKING_COM_WEBHOOK_SECRET;

  // ── Security: HMAC verification ──
  let signatureValid = false;
  if (process.env.NODE_ENV === 'production') {
    if (!webhookSecret) {
      console.error('[booking-com-reviews] CRITICAL: BOOKING_COM_WEBHOOK_SECRET not set in production');
      return NextResponse.json({ received: false, error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 503 });
    }
    if (!signature) {
      return NextResponse.json({ received: false, error: 'SIGNATURE_REQUIRED' }, { status: 401 });
    }
    signatureValid = verifyBookingSignature(rawBody, signature, webhookSecret!);
    if (!signatureValid) {
      console.warn('[booking-com-reviews] REJECTED: invalid signature');
      // ── Security bridge: alert about invalid webhook signature ──
      try {
        bridgeSecurityAlert({
          niche: 'all',
          ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
          reason: 'Booking.com webhook invalid signature',
        });
      } catch (notifErr) {
        console.error('[booking-com-reviews] security bridge error:', notifErr);
      }
      // Always return 200 to Booking.com (they retry on non-2xx)
      return NextResponse.json({ received: true, error: 'SIGNATURE_INVALID' }, { status: 200 });
    }
  } else {
    // Dev/Mock mode
    if (webhookSecret && signature) {
      signatureValid = verifyBookingSignature(rawBody, signature, webhookSecret);
      if (!signatureValid) {
        console.warn('[booking-com-reviews] MOCK mode: signature invalid but proceeding');
      }
    } else {
      console.warn('[booking-com-reviews] MOCK mode: no signature verification (dev only)');
    }
  }

  // ── Parse payload ──
  let payload: BookingReviewWebhook;
  try {
    payload = JSON.parse(rawBody);
  } catch (parseErr) {
    console.error('[booking-com-reviews] Failed to parse JSON:', parseErr);
    return NextResponse.json({ received: true, error: 'INVALID_JSON' }, { status: 200 });
  }

  // ── Extract fields ──
  const rating = payload.rating ?? 5;
  const guestName = payload.reviewer?.first_name ?? 'Hóspede';
  const tenantId = payload.hotel_id ?? 'unknown';

  // ── If rating < 3, fire bridgeReviewNegative ──
  if (rating < 3) {
    try {
      bridgeReviewNegative({
        niche: 'all',
        guestName,
        stars: rating,
        platform: 'Booking.com',
        tenantId,
      });
    } catch (bridgeErr) {
      console.error('[booking-com-reviews] bridgeReviewNegative error:', bridgeErr);
    }
  }

  const processingTime = Date.now() - startTime;
  return NextResponse.json({
    received: true,
    signatureValid,
    rating,
    triggeredNegativeReview: rating < 3,
    processingTimeMs: processingTime,
    timestamp: new Date().toISOString(),
  });
}

// ── GET for health check / verification ──
export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/webhooks/booking-com/reviews',
    mode: process.env.NODE_ENV === 'production' ? 'live' : 'mock',
    configured: !!process.env.BOOKING_COM_WEBHOOK_SECRET,
    timestamp: new Date().toISOString(),
  });
}
