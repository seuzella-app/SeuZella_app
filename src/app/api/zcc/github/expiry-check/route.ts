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
import { verifyCronSecret } from '@/lib/security/cron-secret';

export async function GET(req: NextRequest) {
  // F07: autenticação padronizada via verifyCronSecret —
  // Bearer/x-internal-token (timing-safe), dev-bypass em dev sem CRON_SECRET,
  // fail-closed 503 em produção sem secret. Query ?secret= NUNCA é aceito.
  const auth = verifyCronSecret(req);
  if (!auth.ok) return auth.response!;

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
