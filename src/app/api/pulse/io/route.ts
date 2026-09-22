// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ZCC Pulse Socket.io API Route — Initializes the Socket.io server
// This route handles the HTTP part of the Socket.io handshake
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

// This route is used by Socket.io for polling transport fallback
// The actual WebSocket upgrade is handled by the server instrumentation file

export async function GET(request: NextRequest) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'pulse.io', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:pulse.io', what: 'pulse.io.entry', resource: 'api', result: 'ALLOW' });
  // Socket.io will handle the upgrade internally
  // This route exists so Next.js doesn't return 404 for the path
  return new Response('Socket.io endpoint — use WebSocket client to connect', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

export async function POST(request: NextRequest) {
  return new Response('Socket.io endpoint — use WebSocket client to connect', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}
