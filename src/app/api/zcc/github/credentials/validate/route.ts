/**
 * API: Validate GitHub PAT (antes de salvar)
 *
 * POST /api/zcc/github/credentials/validate
 *   { pat: string, repo?: string }
 *
 * Retorna: { valid, login, scopes, rateLimit, hasRepoAccess?, repoPermissions? }
 *
 * NÃO persiste nada — apenas valida via /user e opcionalmente /repos/{repo}.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GitHubClient } from '@/lib/github/github-client';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

export async function POST(req: NextRequest) {
  try {
    const security = await verifyZCCAccessOrReject(req);
    if (!security.allowed) return security.response!;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.pat) {
      return NextResponse.json({ error: 'pat é obrigatório' }, { status: 400 });
    }

    // Valida PAT
    const result = await GitHubClient.validatePat(body.pat);

    if (!result.valid) {
      return NextResponse.json({
        valid: false,
        error: 'PAT inválido ou expirado',
      });
    }

    // Se repo foi fornecido, valida acesso
    let repoAccess;
    if (body.repo) {
      repoAccess = await GitHubClient.validateRepoAccess(body.pat, body.repo);
    }

    return NextResponse.json({
      valid: true,
      login: result.login,
      scopes: result.scopes,
      rateLimit: result.rateLimit,
      hasRepoAccess: repoAccess?.hasAccess,
      repoPermissions: repoAccess?.permissions,
    });
  } catch (err: any) {
    console.error('[validate] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
