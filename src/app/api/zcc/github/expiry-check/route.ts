/**
 * API: Check PAT expiry (chamado por cron diário)
 *
 * GET /api/zcc/github/expiry-check
 *   (sem params — verifica todas as credenciais ativas)
 *
 * Retorna lista de credenciais expirando em < 14 dias e auto-revogadas.
 * Em modo produção, este endpoint deve ser protegido por CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkPatExpiry } from '@/lib/github/pat-vault';

export async function GET(req: NextRequest) {
  // Em produção, exige CRON_SECRET
  if (process.env.NODE_ENV === 'production') {
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret') || req.headers.get('X-Cron-Secret');
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await checkPatExpiry();

    // Em produção, poderia disparar alertas via AlertBus aqui
    // Por ora, apenas retorna para o cron processar

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      expiringSoon: result.expiringSoon,
      expired: result.expired,
      autoRevoked: result.autoRevoked,
      summary: {
        expiringSoonCount: result.expiringSoon.length,
        expiredCount: result.expired.length,
        autoRevokedCount: result.autoRevoked.length,
      },
    });
  } catch (err: any) {
    console.error('[expiry-check] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
