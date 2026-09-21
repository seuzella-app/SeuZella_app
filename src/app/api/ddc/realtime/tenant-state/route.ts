import { logger } from '@/lib/infra/logger';
import { NextRequest } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { subscribeTenantEvents, type TenantStateEvent } from '@/lib/realtime/tenant-pubsub';
import { db, isDatabaseAvailable } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — Vercel serverless SSE cap

/**
 * SSE — Tenant State Realtime Stream
 * ============================================================================
 *
 * Single source of truth: PostgreSQL. This endpoint opens a Server-Sent
 * Events stream that pushes tenant state events to subscribers in real-time.
 *
 * REPLACES the broken localStorage-based "useTenantStateSync" approach
 * which only synced same-browser tabs. This endpoint syncs ANY device
 * (mobile phone, desktop, tablet) that has an authenticated session for
 * the same tenantId.
 *
 * EVENTS EMITTED
 * --------------
 *   - pin:created      PIN gerado para um hóspede
 *   - pin:revoked      PIN revogado (check-out ou cancelamento)
 *   - pin:updated      PIN estendido ou modificado
 *   - room:updated     Estado do quarto mudou (ocupado → livre, etc.)
 *   - reservation:created/updated/cancelled
 *   - guest:updated    Dados do hóspede atualizados
 *   - lock:status_changed  Fechadura abriu/fechou remotamente
 *   - tenant:metadata_updated  Nome do tenant, configs, etc.
 *
 * AUTHENTICATION
 * --------------
 * The endpoint uses NextAuth (getServerSession). The tenantId is resolved
 * from the session — clients CANNOT subscribe to other tenants' channels.
 *
 * RECONNECT / RESUME
 * ------------------
 * Clients send `Last-Event-ID: <seq>` on reconnect. The endpoint replays
 * any events with seq > lastEventId that are still in the in-memory buffer
 * (limited to last 100 events per tenant).
 *
 * HEARTBEAT
 * ---------
 * A `:heartbeat` comment line is sent every 30s to keep the connection
 * alive through proxies (nginx, Cloudflare) that otherwise close idle
 * connections after 60s.
 *
 * BROWSER USAGE
 * -------------
 *   const es = new EventSource('/api/ddc/realtime/tenant-state');
 *   es.addEventListener('pin:created', (e) => {
 *     const data = JSON.parse(e.data);
 *     // data: { deviceId, pin, guestName, validFrom, validTo, seq, timestamp }
 *   });
 *
 * MULTI-INSTANCE LIMITATION
 * -------------------------
 * Vercel serverless functions may run on multiple instances. This endpoint
 * uses in-memory pub/sub — events published on instance A are NOT visible
 * to subscribers on instance B. For full multi-instance sync, replace the
 * pub/sub backend with Redis (see tenant-pubsub.ts comment block).
 */

const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_BUFFER_PER_TENANT = 100;

// In-memory replay buffer per tenant (last N events).
// Used when a client reconnects with Last-Event-ID to deliver missed events.
const replayBuffers = new Map<string, TenantStateEvent[]>();

function bufferEvent(tenantId: string, event: TenantStateEvent): void {
  const buf = replayBuffers.get(tenantId) ?? [];
  buf.push(event);
  if (buf.length > MAX_BUFFER_PER_TENANT) {
    buf.shift();
  }
  replayBuffers.set(tenantId, buf);
}

function getReplayEvents(tenantId: string, afterSeq: number): TenantStateEvent[] {
  const buf = replayBuffers.get(tenantId) ?? [];
  return buf.filter((e) => e.seq > afterSeq);
}

// Subscribe to all tenant events to populate the replay buffer.
// This runs once per server instance (module-level side-effect).
const g = globalThis as typeof globalThis & { __tenantStateBufferInitialized?: boolean };
if (!g.__tenantStateBufferInitialized) {
  // Lazy import to avoid circular dep — pubsub itself has no deps on this module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy require to avoid circular dependency
  const { subscribeAllTenantEvents } = require('@/lib/realtime/tenant-pubsub') as typeof import('@/lib/realtime/tenant-pubsub');
  subscribeAllTenantEvents((event) => {
    bufferEvent(event.tenantId, event);
  });
  g.__tenantStateBufferInitialized = true;
}

interface SSEController {
  enqueue: (data: string) => void;
  close: () => void;
}

function sendEvent(controller: SSEController, event: TenantStateEvent): void {
  const payload = JSON.stringify(event.payload);
  // SSE format: id: <seq>\nevent: <type>\ndata: <payload>\n\n
  controller.enqueue(`id: ${event.seq}\nevent: ${event.type}\ndata: ${payload}\n\n`);
}

function sendHeartbeat(controller: SSEController): void {
  controller.enqueue(`:heartbeat ${Date.now()}\n\n`);
}

function sendError(controller: SSEController, message: string): void {
  controller.enqueue(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
}

export async function GET(request: NextRequest): Promise<Response> {
  // ── Auth: resolve tenantId from session ──
  const tenantId = await resolveTenantId();
  if (!tenantId) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Last-Event-ID for resume ──
  const lastEventId = Number(request.headers.get('Last-Event-ID') || 0);
  const encoder = new TextEncoder();

  // ── Initial state snapshot (best-effort, may fail if DB unavailable) ──
  let initialState: Record<string, unknown> | null = null;
  if (await isDatabaseAvailable()) {
    try {
      const [tenant, lockCount, reservationCount] = await Promise.all([
        db.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true, name: true, niche: true, plan: true, status: true },
        }),
        db.lockDevice.count({ where: { tenantId } }).catch(() => 0),
        db.reservation.count({ where: { tenantId } }).catch(() => 0),
      ]);
      initialState = {
        tenant,
        counts: { locks: lockCount, reservations: reservationCount },
        serverTime: new Date().toISOString(),
      };
    } catch (err) {
      console.warn('[tenant-state SSE] Initial state fetch failed:', err);
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      const sseController: SSEController = {
        enqueue: (data: string) => {
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            // Controller may be closed already.
          }
        },
        close: () => {
          try { controller.close(); } catch { /* already closed */ }
        },
      };

      // 1. Send initial state immediately (event: snapshot)
      if (initialState) {
        sseController.enqueue(
          `event: snapshot\ndata: ${JSON.stringify(initialState)}\n\n`,
        );
      }

      // 2. Replay any events the client missed (Last-Event-ID > 0)
      if (lastEventId > 0) {
        const missed = getReplayEvents(tenantId, lastEventId);
        for (const event of missed) {
          sendEvent(sseController, event);
        }
      }

      // 3. Subscribe to future events for this tenant
      const unsubscribe = subscribeTenantEvents(tenantId, (event) => {
        sendEvent(sseController, event);
      });

      // 4. Heartbeat to keep the connection alive
      const heartbeatTimer = setInterval(() => {
        sendHeartbeat(sseController);
      }, HEARTBEAT_INTERVAL_MS);

      // 5. Cleanup on abort/disconnect
      const cleanup = () => {
        clearInterval(heartbeatTimer);
        unsubscribe();
      };

      request.signal.addEventListener('abort', () => {
        cleanup();
        sseController.close();
      });

      // Next.js doesn't expose a 'close' event on the controller directly,
      // but the abort signal fires when the client disconnects.
    },
    cancel(reason) {
      // Called when the consumer (client) cancels the stream.
      logger.info('[tenant-state SSE] Stream cancelled:', reason);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Allow SSE to be embedded cross-origin (mobile PWA served from
      // different origin in dev). In prod, same-origin.
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Last-Event-ID',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  });
}
