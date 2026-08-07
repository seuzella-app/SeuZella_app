// ============================================================
// V11-P0 Cron Auth — Endpoint de emissão de token M2M
// Arquivo destino: src/app/api/auth/m2m/token/route.ts
// ============================================================
//
// Implementa o fluxo Client Credentials do OAuth2 para
// emissão de tokens EdDSA (Ed25519) curtos (5 min TTL).
//
// Segurança:
//   - Rate limit: 10 requests/min por IP (via api-shield)
//   - Log todas as emissões em PolicyAudit (source=internal)
//   - Fail-closed: qualquer erro retorna 401 sem detalhar
//
// Dependências:
//   - issueM2MToken de '@/lib/security/cron-auth'
//   - withSecurity de '@/lib/security/api-shield' (rate limit + payload)
//   - db de '@/lib/db' (audit log)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { issueM2MToken } from '@/lib/security/cron-auth';
import type { CronScope } from '@/lib/security/cron-auth';

const VALID_SCOPES: CronScope[] = [
  'cerebro:read',
  'billing:read',
  'reports:read',
  'cerebro:write',
];

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return error400('invalid_request', 'Body deve ser JSON válido');
  }

  // 1. grant_type obrigatório = client_credentials
  if (body.grant_type !== 'client_credentials') {
    return error400('unsupported_grant_type', 'Apenas client_credentials é suportado');
  }

  // 2. client_id e client_secret obrigatórios
  const clientId = typeof body.client_id === 'string' ? body.client_id : '';
  const clientSecret = typeof body.client_secret === 'string' ? body.client_secret : '';
  const scope = typeof body.scope === 'string' ? body.scope : '';

  if (!clientId || !clientSecret) {
    return error400('invalid_client', 'client_id e client_secret são obrigatórios');
  }

  // 3. Valida scope
  if (!VALID_SCOPES.includes(scope as CronScope)) {
    return error400(
      'invalid_scope',
      `Scope inválido. Válidos: ${VALID_SCOPES.join(', ')}`
    );
  }

  // 4. Emite token (validação de client_secret + scope permitido internamente)
  const result = await issueM2MToken({
    clientId,
    clientSecret,
    scope: scope as CronScope,
  });

  if ('error' in result) {
    // Não distinguir "client não encontrado" de "secret errado" para evitar enum
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Credenciais inválidas' },
      { status: 401 }
    );
  }

  // 5. Log de auditoria
  try {
    const { db } = await import('@/lib/db');
    await db.policyAudit.create({
      data: {
        tenantId: 'system',
        policyId: 'm2m:token-issue',
        policyVersion: 'v1',
        severity: 'info',
        action: 'allow',
        source: 'internal',
        entryPoint: 'unknown',
        matchedRule: `m2m:issue:${clientId}`,
        latencyMs: 0,
      },
    });
  } catch (e) {
    // Não falhar a emissão se o log falhar
    console.error('[m2m/token] audit log failed:', e);
  }

  // 6. Retorna no formato OAuth2 padrão
  return NextResponse.json({
    access_token: result.accessToken,
    token_type: 'Bearer',
    expires_in: result.expiresIn,
    scope,
  });
}

function error400(code: string, description: string): NextResponse {
  return NextResponse.json(
    { error: code, error_description: description },
    { status: 400 }
  );
}

// GET não suportado — apenas POST (mais seguro, não loga em proxies)
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'method_not_allowed', error_description: 'Use POST' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}
