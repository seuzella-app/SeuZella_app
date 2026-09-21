import { logger } from '@/lib/infra/logger';
// ═══════════════════════════════════════════════════════════════════════════════
// ZCC Pulse Check — Error Capture Endpoint
// ═══════════════════════════════════════════════════════════════════════════════
// Receives error payloads from the VPS interceptors (Pino/Winston)
// and queues them for AI analysis. This is the "Armadilha de Erros".
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

interface ErrorCapture {
  container: string;
  stackTrace: string;
  errorMessage: string;
  timestamp: string;
  environment: string;
  requestId?: string;
  tenantId?: string;
  additionalContext?: string;
}

// In-memory error queue (in production: Redis queue)
const errorQueue: ErrorCapture[] = [];

export async function POST(request: NextRequest) {
  // ── Security Gate V3 — 6-Layer Protection ──
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const body: ErrorCapture = await request.json();

    if (!body.container || !body.stackTrace || !body.errorMessage) {
      return NextResponse.json(
        { error: 'MISSING_FIELDS', message: 'container, stackTrace, and errorMessage are required' },
        { status: 400 }
      );
    }

    const errorCapture: ErrorCapture = {
      ...body,
      timestamp: body.timestamp || new Date().toISOString(),
      environment: body.environment || 'production',
    };

    // Queue for AI analysis
    errorQueue.push(errorCapture);

    logger.info(`[Pulse Capture] Error queued: ${body.container} — ${body.errorMessage.slice(0, 80)}`);

    return NextResponse.json({
      success: true,
      message: 'Error captured and queued for AI analysis',
      queuePosition: errorQueue.length,
      timestamp: errorCapture.timestamp,
    });
  } catch {
    return NextResponse.json(
      { error: 'INVALID_BODY', message: 'Could not parse request body' },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  // ── Security Gate V3 — 6-Layer Protection ──
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  return NextResponse.json({
    queueSize: errorQueue.length,
    recent: errorQueue.slice(-10),
  });
}
