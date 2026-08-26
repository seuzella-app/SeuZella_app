/**
 * Cron Auth Unified — tenta M2M EdDSA JWT primeiro, fallback para CRON_SECRET
 * =====================================================================
 *
 * Permite migrar rotas cron legacy gradualmente sem quebrar deploy atual:
 *   1. Tenta verifyCronM2MToken(scope) — se M2M configurado, valida JWT
 *   2. Se M2M não configurado (dev ou sem chaves), cai para verifyCronSecret
 *
 * Em produção sem NENHUMA das duas: fail-closed 503.
 *
 * Uso:
 *   import { verifyCronAuth } from '@/lib/security/cron-auth-unified';
 *
 *   export async function GET(req: NextRequest) {
 *     const auth = await verifyCronAuth(req, 'cerebro:write');
 *     if (!auth.ok) return auth.response!;
 *     // ... lógica
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronM2MToken, type CronScope } from './cron-auth';
import { verifyCronSecret } from './cron-secret';

export interface UnifiedCronAuthResult {
  ok: boolean;
  response?: NextResponse;
  source?: 'm2m' | 'cron-secret' | 'dev-bypass';
  principal?: { clientId: string; scope: CronScope };
}

/**
 * Verifica autenticação cron unificada.
 * 1. Tenta M2M EdDSA JWT primeiro (padrão moderno V11-P0)
 * 2. Fallback para CRON_SECRET (compatibilidade legada)
 * 3. Em dev sem nada configurado: bypass para teste manual
 * 4. Em produção sem nada: fail-closed 503
 */
export async function verifyCronAuth(
  req: NextRequest,
  scope: CronScope
): Promise<UnifiedCronAuthResult> {
  // Verifica se há chaves M2M configuradas (sem lançar erro)
  const hasM2MConfigured = !!(
    process.env.ZELLA_M2M_ED25519_PUBLIC_KEY ||
    process.env.ZELLA_M2M_JWKS_URL ||
    process.env.ZELLA_M2M_CLIENTS
  );

  // 1. Tenta M2M primeiro se configurado
  if (hasM2MConfigured) {
    const auth = await verifyCronM2MToken(req, scope);
    if (auth.ok) {
      return {
        ok: true,
        source: 'm2m',
        principal: auth.principal,
      };
    }
    // Se M2M falhou mas era um token JWT válido (não era secret fallback),
    // retorna o erro imediatamente (não cai para secret)
    const authHeader = req.headers.get('authorization') ?? '';
    if (authHeader.startsWith('Bearer eyJ')) {
      // Era um JWT que falhou verificação — não tenta secret
      return { ok: false, response: auth.response, source: 'm2m' };
    }
    // Sem header ou header não-JWT: tenta CRON_SECRET como fallback
  }

  // 2. Fallback para CRON_SECRET (legado)
  const secretResult = verifyCronSecret(req);
  if (secretResult.ok) {
    return {
      ok: true,
      source: 'cron-secret',
    };
  }

  // 3. Retorna erro do fallback
  return {
    ok: false,
    response: secretResult.response,
    source: secretResult.source,
  };
}
