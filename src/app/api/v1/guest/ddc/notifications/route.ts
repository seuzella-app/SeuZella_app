/**
 * ============================================================
 * V11 — BFF: Guest DDC Notifications (lightweight poll)
 * ============================================================
 * Path: src/app/api/v1/guest/ddc/notifications/route.ts
 *
 * Purpose:
 *   Companion endpoint to /api/v1/guest/ddc/overview — polled
 *   every 15s by the DdcMobileActions client island via useSWR.
 *   Returns ONLY the notification list (no tenant/reservation
 *   data) so the payload stays tiny (< 4 KB) and the polling
 *   cost on the device battery + 4G data plan is negligible.
 *
 * Contract:
 *   GET /api/v1/guest/ddc/notifications
 *   200 → { notifications: Notification[], generatedAt: ISO8601 }
 *
 * Refs: Volume 6 §Client Islands, Volume 7 §BFF
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { requireTenantId } from '@/lib/security/tenant-context';
import { withSecurity, type SecurityContext } from '@/lib/security/api-shield';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getHandler(_request: NextRequest, _ctx: SecurityContext) {
  // RUN 6 — tenant authority: a sessão é a única autoridade. O fallback para
  // o primeiro tenant do DB / 'demo-tenant' era código morto perigoso
  // (requireTenantId throws antes) — agora sem sessão → 401 explícito.
  let tenantId: string;
  try {
    tenantId = await requireTenantId();
  } catch {
    return NextResponse.json(
      { error: 'unauthorized', reason: 'tenant_context_missing' },
      { status: 401 }
    );
  }

  // ---------------------------------------------------------
  // Build notifications from pending invoices + reservations
  // ending in the next 24h. This is a fast in-memory transform
  // on top of two indexed Prisma queries.
  // ---------------------------------------------------------
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    const [pendingInvoices, upcomingCheckouts] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          tenantId,
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        select: {
          id: true,
          type: true,
          amount: true,
          method: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.reservation.findMany({
        where: {
          tenantId,
          status: 'CHECKED_IN',
          checkOut: { gt: now, lt: in24h },
        },
        select: {
          id: true,
          checkOut: true,
          guest: { select: { name: true } },
          room: { select: { name: true } },
        },
        orderBy: { checkOut: 'asc' },
        take: 5,
      }),
    ]);

    // ---------------------------------------------------------
    // Build notification list with severity scoring.
    // critical: overdue invoices
    // warn:     pending invoices + checkouts in < 6h
    // info:     checkouts in 6-24h
    // ---------------------------------------------------------
    type Severity = 'critical' | 'warn' | 'info';
    interface Notif {
      id: string;
      kind: 'invoice' | 'checkout';
      severity: Severity;
      title: string;
      detail: string;
      timestamp: string;
    }

    const notifications: Notif[] = [];

    for (const inv of pendingInvoices) {
      const severity: Severity = inv.status === 'OVERDUE' ? 'critical' : 'warn';
      const title =
        severity === 'critical'
          ? 'Fatura em atraso'
          : 'Pagamento pendente';
      const detail = `${inv.type} — R$ ${inv.amount.toFixed(2)} (${inv.method})`;
      notifications.push({
        id: `inv-${inv.id}`,
        kind: 'invoice',
        severity,
        title,
        detail,
        timestamp: inv.createdAt.toISOString(),
      });
    }

    for (const res of upcomingCheckouts) {
      const hoursUntilCheckout =
        (res.checkOut.getTime() - now.getTime()) / (1000 * 60 * 60);
      const severity: Severity = hoursUntilCheckout < 6 ? 'warn' : 'info';
      const ts = res.checkOut.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      notifications.push({
        id: `chk-${res.id}`,
        kind: 'checkout',
        severity,
        title: 'Checkout próximo',
        detail: `${res.guest?.name ?? 'Hóspede'} — ${res.room?.name ?? 'Quarto'} às ${ts}`,
        timestamp: res.checkOut.toISOString(),
      });
    }

    // Sort by severity (critical > warn > info) then timestamp desc.
    const severityRank: Record<Severity, number> = {
      critical: 0,
      warn: 1,
      info: 2,
    };
    notifications.sort((a, b) => {
      const sevDiff = severityRank[a.severity] - severityRank[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return b.timestamp.localeCompare(a.timestamp);
    });

    const payload = {
      notifications,
      generatedAt: now.toISOString(),
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, max-age=0, stale-while-revalidate=15',
        'X-Zella-Bff': 'ddc-notifications/v1',
      },
    });
  } catch (err) {
     
    console.error('[BFF_DDC_NOTIF_ERROR]', err);
    return NextResponse.json(
      { error: 'internal', reason: 'notifications_failed' },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(getHandler, {
  requireAuth: false,
});
