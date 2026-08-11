// ============================================================================
// ZÉLLA — Cron: Payment Overdue Check (every 6h)
// ============================================================================
// Verifica PaymentTransactions com status='pending' cujo dueDate passou.
// Chama bridgePaymentEvent com status='overdue' e daysOverdue calculado.
// Schedule Vercel: 0 */6 * * *
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bridgePaymentEvent } from '@/lib/notifications/bridges';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runOverdueCheck(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runOverdueCheck(request);
}

async function runOverdueCheck(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (process.env.NODE_ENV === 'production') {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
  } else if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[Cron:payment-overdue] No auth — running in mock mode');
  }

  let overdueCount = 0;

  try {
    const now = new Date();

    // ── Find overdue pending transactions ──
    // Mock: consider a transaction overdue if it's been pending for > 24h
    const overdueThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const overdueTransactions = await db.paymentTransaction.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: overdueThreshold },
      },
      select: {
        id: true,
        amount: true,
        externalId: true,
        subscriptionId: true,
        createdAt: true,
      },
    });

    for (const txn of overdueTransactions) {
      try {
        const ageMs = now.getTime() - txn.createdAt.getTime();
        const daysOverdue = Math.max(1, Math.floor(ageMs / (24 * 60 * 60 * 1000)));

        // Look up tenantId via subscription (PaymentTransaction has no direct tenantId)
        let tenantId: string | undefined;
        if (txn.subscriptionId) {
          try {
            const sub = await db.subscription.findUnique({
              where: { id: txn.subscriptionId },
              select: { tenantId: true },
            });
            tenantId = sub?.tenantId;
          } catch {}
        }

        bridgePaymentEvent({
          niche: 'all',
          paymentId: txn.externalId ?? txn.id,
          amount: Number(txn.amount ?? 0),
          guestName: tenantId ?? 'unknown-tenant',
          status: 'overdue',
          daysOverdue,
          tenantId,
        });
        overdueCount++;
      } catch (bridgeErr) {
        console.error(
          `[Cron:payment-overdue] bridgePaymentEvent failed for txn ${txn.id}:`,
          bridgeErr
        );
      }
    }

    const processingTime = Date.now() - startTime;
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      overdueCount,
      processingTimeMs: processingTime,
      mode: 'mock',
      message: `${overdueCount} pagamento(s) em atraso notificado(s)`,
    });
  } catch (error) {
    console.error('[Cron:payment-overdue] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
