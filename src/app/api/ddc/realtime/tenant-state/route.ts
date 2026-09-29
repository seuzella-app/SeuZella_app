import { logger } from '@/lib/infra/logger';
import { NextRequest } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { subscribeTenantEvents, type TenantStateEvent } from '@/lib/realtime/tenant-pubsub';
import { TenantReplayBuffer } from '@/lib/realtime/replay';
import { db, isDatabaseAvailable } from '@/lib/db';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';
import { buildSseCorsHeaders } from '@/lib/security/origin-allowlist';

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
 * Clients send `Last-Event-ID: <seq>` (native EventSource reconnect) or
 * `?afterSeq=<seq>` (manual reconnects — EventSource cannot send custom
 * headers). The endpoint replays any events with seq > lastEventId that are
 * still in the per-instance buffer (last 100 events per tenant). If the
 * buffer cannot prove continuity (gap), a FRESH SNAPSHOT is sent instead of
 * a partial replay — the client never silently misses events.
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
 * MULTI-INSTANCE (F28-E)
 * ----------------------
 * Transport is Redis pub/sub (via tenant-pubsub → redis-pubsub): events
 * published on instance A ARE visible to subscribers on instance B. The
 * per-tenant seq is GLOBAL (Redis INCR), so Last-Event-ID resume and gap
 * detection work across instances. The per-instance replay buffer covers
 * the last 100 events; anything older is bridged by the snapshot resync.
 * Dev/test without REDIS_URL transparently uses the in-memory transport.
 */

const HEARTBEAT_INTERVAL_MS = 30_000;

// F28-E: replay strategy extracted to @/lib/realtime/replay (unit-testable).
const replayBuffers = new TenantReplayBuffer();

// Subscribe to all tenant events to populate the replay buffer.
// This runs once per server instance (module-level side-effect).
const g = globalThis as typeof globalThis & { __tenantStateBufferInitialized?: boolean };
if (!g.__tenantStateBufferInitialized) {
  // Lazy import to avoid circular dep — pubsub itself has no deps on this module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy require to avoid circular dependency
  const { subscribeAllTenantEvents } = require('@/lib/realtime/tenant-pubsub') as typeof import('@/lib/realtime/tenant-pubsub');
  subscribeAllTenantEvents((event) => {
    replayBuffers.bufferEvent(event.tenantId, event);
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

export async function OPTIONS(request: NextRequest): Promise<Response> {
  // F27: preflight explícito — nunca reflete Origin desconhecida, nunca wildcard.
  return new Response(null, { status: 204, headers: buildSseCorsHeaders(request) });
}

async function fetchSnapshot(tenantId: string): Promise<Record<string, unknown> | null> {
  // Initial state snapshot (best-effort, may fail if DB unavailable).
  if (!(await isDatabaseAvailable())) return null;
  try {
    const [tenant, lockCount, reservationCount] = await Promise.all([
      db.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, niche: true, plan: true, status: true },
      }),
      db.lockDevice.count({ where: { tenantId } }).catch(() => 0),
      db.reservation.count({ where: { tenantId } }).catch(() => 0),
    ]);
    return {
      tenant,
      counts: { locks: lockCount, reservations: reservationCount },
      serverTime: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[tenant-state SSE] Snapshot fetch failed:', err);
    return null;
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'ddc.realtime.tenant-state', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:ddc.realtime.tenant-state', what: 'ddc.realtime.tenant-state.entry', resource: 'api', result: 'ALLOW' });
  // ── Auth: resolve tenantId from session ──
  const tenantId = await resolveTenantId();
  if (!tenantId) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Last-Event-ID for resume: native SSE header OR ?afterSeq= (manual
  // reconnects — EventSource cannot send custom headers). F28-E.
  const lastEventId = Number(
    request.headers.get('Last-Event-ID') ||
      request.nextUrl.searchParams.get('afterSeq') ||
      0,
  );
  const encoder = new TextEncoder();

  // ── Initial state snapshot (best-effort, may fail if DB unavailable) ──
  const initialState = await fetchSnapshot(tenantId);

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

      // 2. Replay any events the client missed (Last-Event-ID > 0).
      // F28-E: if the buffer cannot prove continuity (gap), send a FRESH
      // snapshot instead of a partial replay — the client never silently
      // skips events it does not know it missed.
      if (lastEventId > 0) {
        const plan = replayBuffers.planReplay(tenantId, lastEventId);
        if (plan.gap) {
          // Fire-and-forget: enqueue() tolera chegada tardia (stream aberto).
          void fetchSnapshot(tenantId).then((resync) => {
            if (resync) {
              sseController.enqueue(`event: snapshot\ndata: ${JSON.stringify(resync)}\n\n`);
            }
          });
        } else {
          for (const event of plan.events) {
            sendEvent(sseController, event);
          }
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
      Connection: 'keep-alive',
      ...buildSseCorsHeaders(request),
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  });
}
