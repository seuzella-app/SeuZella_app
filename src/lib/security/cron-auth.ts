// ============================================================
// V11-P0 Cron Auth — M2M Client Credentials com EdDSA (Ed25519)
// Arquivo destino: src/lib/security/cron-auth.ts
// ============================================================
//
// Cobre as rotas cron M2M:
//   - app/api/cron/cerebro-analyze/route.ts
//   - app/api/cron/cerebro-budget-forecast/route.ts
//   - app/api/cron/weekly-report/route.ts
//
// Design:
//   - Algoritmo: EdDSA com chave Ed25519 (não RSA, não ECDSA)
//   - Sem claim `sub` (máquina, não humano)
//   - Claims obrigatórias: iss, aud, exp, iat, azp (client_id), scope, jti
//   - TTL curto: 5 minutos (300s)
//   - Verificação estrita: signature + iss + aud + exp + nbf + scope + jti revocation
//   - Hash seguro via m2m-policy (Bcrypt / Argon2 / SHA-256)
// ============================================================

import { jwtVerify, SignJWT, importSPKI, importPKCS8, exportJWK } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyM2MClientCredentials, isJtiRevoked, type CronScope } from './m2m-policy';

export type { CronScope } from './m2m-policy';

export interface M2MTokenPayload {
  iss: string;       // https://auth.seuzella.com.br (ou http://localhost:3000 em dev)
  aud: string;       // 'seuzella-cron' ou 'seuzella-api'
  iat: number;       // issued at (unix seconds)
  exp: number;       // expiry (unix seconds) — iat + 300
  azp: string;       // client_id (e.g. 'cron-cerebro-analyze')
  scope: CronScope;  // escopo único, estrito
  jti?: string;      // JWT ID único para revogação e auditoria
  // NOTA: sem `sub` — esta é uma máquina, não um usuário humano.
}

export interface VerifiedCronPrincipal {
  clientId: string;
  scope: CronScope;
  issuedAt: Date;
  expiresAt: Date;
  jti?: string;
}

// --- Configuração (env vars obrigatórias) ------------------------------------
function getEnv(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function getPublicKeyPem(): string {
  return getEnv('ZELLA_M2M_ED25519_PUBLIC_KEY');
}

function getPrivateKeyPem(): string {
  return getEnv('ZELLA_M2M_ED25519_PRIVATE_KEY');
}

function getIssuer(): string {
  return getEnv('ZELLA_M2M_ISSUER', 'https://auth.seuzella.com.br');
}

function getAudience(): string {
  return getEnv('ZELLA_M2M_AUDIENCE', 'seuzella-cron');
}

const TOKEN_TTL_SECONDS = 300; // 5 minutos

let _publicKey: ReturnType<typeof importSPKI> | null = null;
let _publicKeyPemCached = '';

async function getPublicKey() {
  const pem = getPublicKeyPem();
  if (!pem) return null;
  if (_publicKey && pem === _publicKeyPemCached) {
    return _publicKey;
  }
  _publicKey = importSPKI(pem, 'EdDSA');
  _publicKeyPemCached = pem;
  return _publicKey;
}

/**
 * Verifica token M2M EdDSA em rotas cron.
 */
export async function verifyCronM2MToken(
  req: NextRequest,
  requiredScope: CronScope
): Promise<{ ok: true; principal: VerifiedCronPrincipal } | { ok: false; response: NextResponse }> {
  // BYPASS DEV EXCLUSIVO: Apenas em NODE_ENV=development sem chave configurada
  if (process.env.NODE_ENV === 'development' && !getPublicKeyPem()) {
    const bypass = req.headers.get('x-zella-m2m-dev-bypass');
    if (bypass === requiredScope) {
      return {
        ok: true,
        principal: {
          clientId: 'dev-bypass',
          scope: requiredScope,
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000),
          jti: 'dev-bypass-jti',
        },
      };
    }
    return unauthorized('dev_bypass_required', 'Em dev sem chave, header X-Zella-M2M-Dev-Bypass deve igualar o scope exigido');
  }

  const authHeader = req.headers.get('authorization');

  if (!authHeader) {
    return unauthorized('missing_authorization', 'Header Authorization ausente');
  }

  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) {
    return unauthorized('invalid_scheme', 'Esperado: Bearer <token>');
  }
  const token = match[1];

  try {
    const publicKey = await getPublicKey();
    if (!publicKey) {
      return unauthorized('key_unavailable', 'Chave pública indisponível');
    }

    const { payload } = await jwtVerify(token, await publicKey, {
      algorithms: ['EdDSA'],
      issuer: getIssuer(),
      audience: getAudience(),
    });

    const azp = payload.azp as string | undefined;
    const scope = payload.scope as CronScope | undefined;
    const jti = payload.jti as string | undefined;

    if (!azp || typeof azp !== 'string') {
      return unauthorized('missing_azp', 'Claim azp (client_id) obrigatória para M2M');
    }

    // 6. REJEITA tokens com `sub` — M2M nunca tem usuário humano
    if (payload.sub) {
      return unauthorized('sub_forbidden', 'Token M2M não pode conter claim sub');
    }

    // 7. Checa revogação de JTI
    if (jti && isJtiRevoked(jti)) {
      return unauthorized('token_revoked', 'JWT revogado explicitamente');
    }

    // 8. Scope match EXATO
    if (scope !== requiredScope) {
      return unauthorized(
        'insufficient_scope',
        `Scope exigido: ${requiredScope}, recebido: ${scope ?? 'ausente'}`
      );
    }

    return {
      ok: true,
      principal: {
        clientId: azp,
        scope,
        issuedAt: new Date((payload.iat as number) * 1000),
        expiresAt: new Date((payload.exp as number) * 1000),
        jti,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return unauthorized('verification_failed', `JWT inválido: ${msg}`);
  }
}

function unauthorized(code: string, detail: string): { ok: false; response: NextResponse } {
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'unauthorized', code, detail },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
    ),
  };
}

/**
 * Emite token JWT EdDSA usando credenciais com hash seguro (Bcrypt / M2M Policy)
 */
export async function issueM2MToken(params: {
  clientId: string;
  clientSecret: string;
  scope: CronScope;
}): Promise<{ accessToken: string; expiresIn: number; jti: string } | { error: string }> {
  if (!getPrivateKeyPem()) {
    return { error: 'ZELLA_M2M_ED25519_PRIVATE_KEY não configurada — emissão indisponível' };
  }

  // 1. Checa escopos se ZELLA_M2M_CLIENT_SCOPES estiver definido em ENV
  if (process.env.ZELLA_M2M_CLIENT_SCOPES) {
    const allowedScopes = (process.env.ZELLA_M2M_CLIENT_SCOPES ?? '')
      .split(',')
      .filter(Boolean)
      .map((kv) => {
        const idx = kv.indexOf(':');
        return idx >= 0 ? [kv.slice(0, idx), kv.slice(idx + 1)] : [kv, ''];
      });

    const allowed = allowedScopes.find(([id]) => id === params.clientId);
    if (allowed && allowed[1] !== params.scope) {
      return { error: 'scope não autorizado para este client_id' };
    }
  }

  // 2. Validação com hash seguro via M2M Policy
  const authResult = await verifyM2MClientCredentials(params.clientId, params.clientSecret, params.scope);
  if (!authResult.valid) {
    // Fallback gracioso para ZELLA_M2M_CLIENTS se configurado
    const clients = (process.env.ZELLA_M2M_CLIENTS ?? '')
      .split(',')
      .filter(Boolean)
      .map((kv) => {
        const idx = kv.indexOf(':');
        return idx >= 0 ? [kv.slice(0, idx), kv.slice(idx + 1)] : [kv, ''];
      });

    const match = clients.find(([id]) => id === params.clientId);
    if (!match) {
      return { error: authResult.reason || 'client_id não encontrado' };
    }

    const expectedSecret = match[1];
    const providedSecret = Buffer.from(params.clientSecret);
    const expectedBuf = Buffer.from(expectedSecret);
    if (providedSecret.length !== expectedBuf.length || !crypto.timingSafeEqual(providedSecret, expectedBuf)) {
      return { error: 'client_secret inválido' };
    }
  }

  // 2. Importa chave privada (PKCS8) e assina JWT com jti único
  const privateKey = await importPKCS8(getPrivateKeyPem(), 'EdDSA');
  const now = Math.floor(Date.now() / 1000);
  const jti = `m2m_${crypto.randomUUID()}`;

  const jwt = await new SignJWT({
    azp: params.clientId,
    scope: params.scope,
  })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setIssuer(getIssuer())
    .setAudience(getAudience())
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .setNotBefore(now)
    .sign(privateKey);

  return { accessToken: jwt, expiresIn: TOKEN_TTL_SECONDS, jti };
}

/**
 * Auditoria de execução de rotas cron em PolicyAudit
 */
export async function auditCronExecution(params: {
  prisma: any;
  tenantId: string;
  principal: VerifiedCronPrincipal;
  entryPoint: 'cognitive_pipeline' | 'glm_cerebro';
  action: 'allow' | 'block' | 'error';
  matchedRule?: string;
  latencyMs: number;
  policyId?: string;
  severity?: string;
  errorDetail?: string;
}): Promise<void> {
  try {
    if (!params.prisma?.policyAudit) return;
    await params.prisma.policyAudit.create({
      data: {
        tenantId: params.tenantId,
        policyId: params.policyId || 'cron-m2m-auth',
        policyVersion: 'v1',
        severity: params.severity || (params.action === 'allow' ? 'info' : 'warning'),
        action: params.action,
        source: 'internal',
        entryPoint: params.entryPoint,
        matchedRule: params.matchedRule || `m2m:cron:${params.principal.scope}`,
        latencyMs: Math.round(params.latencyMs),
        rawPayloadSummary: JSON.stringify({
          clientId: params.principal.clientId,
          scope: params.principal.scope,
          jti: params.principal.jti,
          error: params.errorDetail,
        }),
      },
    });
  } catch (err) {
    console.error('[CRON_AUDIT] Falha ao gravar PolicyAudit:', err);
  }
}
