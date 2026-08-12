// ============================================================
// ZEHLA — Cron Secret Verification (simple shared-secret)
// ============================================================
//
// Helper SIMPLIFICADO para validar requisições cron via CRON_SECRET.
// Não substitui o cron-auth.ts (M2M Ed25519) — é um fallback prático
// para proteção básica quando chaves M2M não estão configuradas.
//
// Padrões suportados:
//   1. Header Authorization: Bearer <CRON_SECRET>
//   2. Header x-internal-token: <CRON_SECRET>
//   3. Query ?secret=<CRON_SECRET>
//
// Em desenvolvimento (NODE_ENV !== 'production' E sem CRON_SECRET configurado):
//   - Permite acesso (para teste manual via curl)
//
// Em produção SEM CRON_SECRET configurado:
//   - Rejeita com 503 Service Unavailable (fail-closed)
//
// Uso:
//   import { verifyCronSecret } from '@/lib/security/cron-secret';
//
//   export async function GET(req: NextRequest) {
//     const auth = verifyCronSecret(req);
//     if (!auth.ok) return auth.response;
//     // ... lógica do cron
//   }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export interface CronAuthResult {
  ok: boolean;
  response?: NextResponse;
  source?: 'bearer' | 'header' | 'query' | 'dev-bypass';
}

/**
 * Valida o secret do cron job.
 * Em dev sem CRON_SECRET: permite (para teste manual).
 * Em produção sem CRON_SECRET: rejeita com 503.
 * Em produção com CRON_SECRET: valida via timing-safe comparison.
 */
export function verifyCronSecret(req: NextRequest): CronAuthResult {
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  // Dev bypass: sem CRON_SECRET configurado, permite em desenvolvimento
  if (!cronSecret && !isProduction) {
    return { ok: true, source: 'dev-bypass' };
  }

  // Produção sem secret configurado → fail-closed
  if (!cronSecret && isProduction) {
    console.error('[cron-secret] CRÍTICO: CRON_SECRET não configurado em produção. Rejeitando requisição.');
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'service_unavailable',
          message: 'CRON_SECRET não configurado. Configure a env var no Vercel.',
        },
        { status: 503 }
      ),
    };
  }

  // Tenta header Authorization: Bearer <secret>
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (timingSafeEqual(token, cronSecret!)) {
      return { ok: true, source: 'bearer' };
    }
  }

  // Tenta header x-internal-token
  const internalToken = req.headers.get('x-internal-token');
  if (internalToken && timingSafeEqual(internalToken, cronSecret!)) {
    return { ok: true, source: 'header' };
  }

  // Tenta query ?secret=
  const querySecret = req.nextUrl.searchParams.get('secret');
  if (querySecret && timingSafeEqual(querySecret, cronSecret!)) {
    return { ok: true, source: 'query' };
  }

  // Rejeita silenciosamente (não revela motivo)
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'unauthorized' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
    ),
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Helper para verificar Vercel Cron (envia header Authorization: Bearer <CRON_SECRET>)
 * https://vercel.com/docs/cron-jobs#securing-cron-jobs
 */
export function verifyVercelCron(req: NextRequest): CronAuthResult {
  // Vercel Cron envia Authorization: Bearer <CRON_SECRET>
  return verifyCronSecret(req);
}
