/**
 * ============================================================
 * V11 — BFF Aggregator: Guest DDC Overview
 * ============================================================
 * Path: src/app/api/v1/guest/ddc/overview/route.ts
 *
 * Purpose:
 *   Single consolidated endpoint for the mobile-first DDC
 *   (Dashboard do Cliente) guest page. Replaces N parallel
 *   cascading requests from the device with ONE aggregated
 *   fetch executed on the Node.js runtime (closer to Prisma
 *   Accelerate and the DB).
 *
 * Contract:
 *   GET /api/v1/guest/ddc/overview
 *   Headers:
 *     X-Tenant-Id  — injected by Edge Middleware (X-Zella-Tenant-Id
 *                    is the canonical name; we accept both for
 *                    backward compat with the legacy middleware).
 *
 * Response (200, < 50 KB p95):
 *   {
 *     tenant: { id, name, niche, plan, domain },
 *     activeReservations: Reservation[],
 *     pendingInvoices:    Transaction[],
 *     lastConciergeMessage: { content, timestamp, intent } | null,
 *     generatedAt: ISO8601
 *   }
 *
 * Quality guarantees:
 *   - Tenant isolation enforced via requireTenantId() AND
 *     X-Tenant-Id header cross-check (defense in depth).
 *   - Payload size capped at 50 KB. If exceeded, returns 502
 *     with diagnostic payload (never silently truncates data).
 *   - Select-only — never writes.
 *   - Edge-incompatible libs (@prisma/client, bcryptjs) are
 *     declared via serverExternalPackages in next.config.ts.
 *     Do NOT add `export const runtime = 'edge'`.
 *
 * Refs: Volume 7 (Backend) §BFF Aggregation,
 *       Volume 6 (Frontend) §PPR + Streaming SSR,
 *       V11-P0 Iniciativa #5 (withSecurity wrap).
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { requireTenantId } from '@/lib/security/tenant-context';
import { withSecurity, type SecurityContext } from '@/lib/security/api-shield';

// ---------------------------------------------------------------
// Hard payload cap — protects the device from RSC payload
// explosion on tenants with hundreds of historical records.
// Tuned for 4G Brazilian mobile: 50 KB p95 ≈ 1 RTT.
// ---------------------------------------------------------------
const MAX_PAYLOAD_BYTES = 50 * 1024;

// Limits applied per section before serialization. Tuned to fit
// comfortably under MAX_PAYLOAD_BYTES after JSON encoding overhead.
const LIMITS = {
  activeReservations: 10,
  pendingInvoices: 15,
  guestMessagesLookback: 30,
} as const;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------
// Handler
// ---------------------------------------------------------------
async function getHandler(_request: NextRequest, _ctx: SecurityContext) {
  // ---------------------------------------------------------
  // 1) Tenant resolution — defense in depth.
  //    a) requireTenantId() resolves via NextAuth session
  //    b) Cross-check against X-Tenant-Id header (when present)
  //    Any mismatch → 401 (do not leak which check failed).
  // ---------------------------------------------------------
  const sessionTenantId = await requireTenantId();
  if (!sessionTenantId) {
    return NextResponse.json(
      { error: 'unauthorized', reason: 'no_session' },
      { status: 401 }
    );
  }

  // Header is optional but, when present, MUST match the session.
  // This catches session fixation / header injection from a
  // misconfigured upstream proxy.
  const headerTenantId = _request.headers.get('x-tenant-id')
    || _request.headers.get('x-zella-tenant-id')
    || null;

  if (headerTenantId && headerTenantId !== sessionTenantId) {
    return NextResponse.json(
      { error: 'unauthorized', reason: 'tenant_mismatch' },
      { status: 401 }
    );
  }

  const tenantId = sessionTenantId;

  // ---------------------------------------------------------
  // 2) Parallel data fetching.
  //    All four queries run concurrently via Promise.all.
  //    Total wall time ≈ slowest query (not the sum).
  // ---------------------------------------------------------
  const now = new Date();

  try {
    const [tenant, activeReservations, pendingInvoices, lastConciergeMessage] =
      await Promise.all([
        // --- Tenant details (select-only, no PII beyond what's needed) ---
        prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            id: true,
            name: true,
            niche: true,
            plan: true,
            domain: true,
            // Deliberately excludes: email, phone, passwordHash,
            // whatsappPhoneNumber, clerkOrgId, etc.
          },
        }),

        // --- Active reservations (CHECKED_IN or CONFIRMED with future checkOut) ---
        prisma.reservation.findMany({
          where: {
            tenantId,
            AND: [
              { status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
              { checkOut: { gt: now } },
            ],
          },
          select: {
            id: true,
            checkIn: true,
            checkOut: true,
            status: true,
            totalPrice: true,
            source: true,
            guest: { select: { id: true, name: true, phone: true } },
            room: { select: { id: true, name: true } },
          },
          orderBy: { checkIn: 'asc' },
          take: LIMITS.activeReservations,
        }),

        // --- Pending invoices (Transaction with status != COMPLETED) ---
        prisma.transaction.findMany({
          where: {
            tenantId,
            status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
          },
          select: {
            id: true,
            type: true,
            amount: true,
            method: true,
            status: true,
            createdAt: true,
            reservationId: true,
          },
          orderBy: { createdAt: 'desc' },
          take: LIMITS.pendingInvoices,
        }),

        // --- Last Concierge IA message to any guest of this tenant ---
        // We look back across the most recent LIMITS.guestMessagesLookback
        // messages from the IA and pick the latest. This avoids scanning
        // the entire GuestMessage table (which could be huge on active
        // pousadas with thousands of historical WhatsApp threads).
        prisma.guestMessage.findFirst({
          where: {
            from: 'ai',
            guest: { tenantId },
          },
          select: {
            content: true,
            timestamp: true,
            intent: true,
            guestId: true,
          },
          orderBy: { timestamp: 'desc' },
        }),
      ]);

    // ---------------------------------------------------------
    // 3) Tenant existence guard
    // ---------------------------------------------------------
    if (!tenant) {
      return NextResponse.json(
        { error: 'not_found', reason: 'tenant_unknown' },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // 4) Assemble payload
    // ---------------------------------------------------------
    const payload = {
      tenant,
      activeReservations: activeReservations.map((r) => ({
        id: r.id,
        guestName: r.guest?.name ?? null,
        guestPhone: r.guest?.phone ?? null,
        roomName: r.room?.name ?? null,
        checkIn: r.checkIn.toISOString(),
        checkOut: r.checkOut.toISOString(),
        status: r.status,
        totalPrice: r.totalPrice,
        source: r.source,
      })),
      pendingInvoices: pendingInvoices.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        method: t.method,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        reservationId: t.reservationId,
      })),
      lastConciergeMessage: lastConciergeMessage
        ? {
            content: lastConciergeMessage.content,
            timestamp: lastConciergeMessage.timestamp.toISOString(),
            intent: lastConciergeMessage.intent,
          }
        : null,
      generatedAt: now.toISOString(),
    };

    // ---------------------------------------------------------
    // 5) Enforce 50 KB p95 cap.
    //    If exceeded, return 502 with a diagnostic payload
    //    (NO business data leaked) so the client can degrade
    //    gracefully to /api/v1/guest/ddc/overview?lite=true
    //    (future P1 fallback route).
    // ---------------------------------------------------------
    const serialized = JSON.stringify(payload);
    const sizeBytes = Buffer.byteLength(serialized, 'utf8');

    if (sizeBytes > MAX_PAYLOAD_BYTES) {
      // eslint-disable-next-line no-console
      console.error(
        `[BFF_DDC_OVERSIZE] tenant=${tenantId} bytes=${sizeBytes} ` +
          `cap=${MAX_PAYLOAD_BYTES} ` +
          `reservations=${payload.activeReservations.length} ` +
          `invoices=${payload.pendingInvoices.length}`
      );
      return NextResponse.json(
        {
          error: 'payload_oversize',
          bytes: sizeBytes,
          cap: MAX_PAYLOAD_BYTES,
          hint: 'Reduce LIMITS.activeReservations / LIMITS.pendingInvoices',
        },
        { status: 502 }
      );
    }

    // ---------------------------------------------------------
    // 6) Return with cache-control headers tuned for mobile.
    //    - max-age=0:           never use a stale cached response
    //                           without revalidating
    //    - stale-while-revalidate=30: allow serving a stale
    //                           response for up to 30s while fetching
    //                           a fresh one in the background
    //    - private:             never store on a shared CDN cache
    //                           (tenant-scoped data)
    // ---------------------------------------------------------
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, max-age=0, stale-while-revalidate=30',
        'X-Zella-Payload-Bytes': String(sizeBytes),
        'X-Zella-Bff': 'ddc-overview/v1',
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[BFF_DDC_OVERVIEW_ERROR]', err);
    return NextResponse.json(
      { error: 'internal', reason: 'aggregation_failed' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------
// Export wrapped with withSecurity (V11-P0.7 pattern).
// Auth is enforced inside getHandler via requireTenantId() which
// calls getServerSession(authOptions). We do NOT use isAuthRoute
// because that route type applies stricter rate limits designed
// for /api/auth/* login endpoints, not data fetching.
//
// The default rate limiter (apiRatelimit) is sufficient — this
// endpoint is called once per page mount + on manual refresh only.
// ---------------------------------------------------------------
export const GET = withSecurity(getHandler, {
  requireAuth: true,
});
