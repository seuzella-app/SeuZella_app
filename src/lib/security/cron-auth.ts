import { jwtVerify, SignJWT, importSPKI, importPKCS8 } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyM2MClientCredentials, isJtiRevoked, type CronScope } from './m2m-policy';
import { isSessionTokenRevoked } from '@/lib/auth';

export type { CronScope } from './m2m-policy';

export interface M2MTokenPayload {
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  azp: string;
  scope: CronScope;
  jti?: string;
}

export interface VerifiedCronPrincipal {
  clientId: string;
  scope: CronScope;
  issuedAt: Date;
  expiresAt: Date;
  jti?: string;
}

const TOKEN_TTL_SECONDS = 300;
// LOTE A (SECURITY) [M2M]: proteção anti-replay em memória por jti dentro da
// validade do token. Um mesmo jti apresentado duas vezes enquanto o token
// ainda não expirou (com skew de relógio) é rejeitado com 401. O mapa é
// limitado pela purga lazy (TTL curto de 300s), sem dependência nova.
const REPLAY_SKEW_MS = 60_000;
const usedJtis = new Map<string, number>();
function isJtiReplayed(jti: string): boolean {
  const now = Date.now();
  for (const [k, expMs] of usedJtis) {
    if (expMs + REPLAY_SKEW_MS < now) usedJtis.delete(k);
  }
  const seenExpMs = usedJtis.get(jti);
  return seenExpMs !== undefined && seenExpMs + REPLAY_SKEW_MS >= now;
}
function markJtiUsed(jti: string, expSeconds: number): void {
  usedJtis.set(jti, expSeconds * 1000);
}
const getPublicKeyPem = () => process.env.ZELLA_M2M_ED25519_PUBLIC_KEY || '';
const getPrivateKeyPem = () => process.env.ZELLA_M2M_ED25519_PRIVATE_KEY || '';
const getIssuer = () => process.env.ZELLA_M2M_ISSUER || 'https://auth.seuzella.com.br';
const getAudience = () => process.env.ZELLA_M2M_AUDIENCE || 'seuzella-cron';

let cachedPublicKey: ReturnType<typeof importSPKI> | null = null;
let cachedPublicKeyPem = '';
async function getPublicKey() {
  const pem = getPublicKeyPem();
  if (!pem) return null;
  if (cachedPublicKey && cachedPublicKeyPem === pem) return cachedPublicKey;
  cachedPublicKey = importSPKI(pem, 'EdDSA');
  cachedPublicKeyPem = pem;
  return cachedPublicKey;
}

export async function verifyCronM2MToken(
  req: NextRequest,
  requiredScope: CronScope,
): Promise<{ ok: true; principal: VerifiedCronPrincipal } | { ok: false; response: NextResponse }> {
  // RUN 6 — hardening: o flag ZELLA_ALLOW_M2M_DEV_BYPASS NUNCA é honrado em
  // produção (antes: `=== 'development' || flag` — o flag setado em prod sem
  // chave M2M abria TODAS as rotas de cron via header x-zella-m2m-dev-bypass).
  // NODE_ENV=development mantém o bypass padrão (fluxo local inalterado).
  const devBypassAllowed = process.env.NODE_ENV === 'development'
    || (process.env.NODE_ENV !== 'production' && process.env.ZELLA_ALLOW_M2M_DEV_BYPASS === 'true');
  if (devBypassAllowed && !getPublicKeyPem()) {
    const bypass = req.headers.get('x-zella-m2m-dev-bypass');
    if (bypass === requiredScope) {
      return { ok: true, principal: { clientId: 'dev-bypass', scope: requiredScope, issuedAt: new Date(), expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000), jti: 'dev-bypass-jti' } };
    }
    return unauthorized('dev_bypass_required');
  }

  const authHeader = req.headers.get('authorization');
  const match = authHeader ? /^Bearer\s+(.+)$/i.exec(authHeader) : null;
  if (!match) return unauthorized('missing_authorization');

  try {
    const publicKey = await getPublicKey();
    if (!publicKey) return unauthorized('key_unavailable');
    const { payload } = await jwtVerify(match[1], await publicKey, {
      algorithms: ['EdDSA'], issuer: getIssuer(), audience: getAudience(),
    });

    const azp = typeof payload.azp === 'string' ? payload.azp : undefined;
    const scope = payload.scope as CronScope | undefined;
    let jti = typeof payload.jti === 'string' ? payload.jti : undefined;
    if (!azp) return unauthorized('missing_azp');
    if (payload.sub) return unauthorized('sub_forbidden');
    if (scope !== requiredScope) return unauthorized('insufficient_scope');
    if (!jti) {
      if (process.env.NODE_ENV === 'production') return unauthorized('missing_jti');
      jti = `m2m_test_${azp}`;
    }
    if (isJtiRevoked(jti) || (await isSessionTokenRevoked(jti))) return unauthorized('token_revoked');
    if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') return unauthorized('invalid_temporal_claims');
    // LOTE A (SECURITY) [M2M]: replay do mesmo jti dentro da validade -> 401.
    if (isJtiReplayed(jti)) return unauthorized('token_replayed');

    // Marca como usado somente após TODAS as verificações passarem.
    markJtiUsed(jti, payload.exp);

    return { ok: true, principal: { clientId: azp, scope: scope!, issuedAt: new Date(payload.iat * 1000), expiresAt: new Date(payload.exp * 1000), jti } };
  } catch {
    return unauthorized('verification_failed');
  }
}

function unauthorized(code: string): { ok: false; response: NextResponse } {
  return { ok: false, response: NextResponse.json({ error: 'unauthorized', code }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } }) };
}

export async function issueM2MToken(params: { clientId: string; clientSecret: string; scope: CronScope }): Promise<{ accessToken: string; expiresIn: number; jti: string } | { error: string }> {
  if (!getPrivateKeyPem()) return { error: 'M2M private key unavailable' };
  const authResult = await verifyM2MClientCredentials(params.clientId, params.clientSecret, params.scope);
  if (!authResult.valid) return { error: 'M2M client credentials invalid' };

  const privateKey = await importPKCS8(getPrivateKeyPem(), 'EdDSA');
  const now = Math.floor(Date.now() / 1000);
  const jti = `m2m_${crypto.randomUUID()}`;
  const accessToken = await new SignJWT({ azp: params.clientId, scope: params.scope })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setIssuer(getIssuer()).setAudience(getAudience()).setJti(jti)
    .setIssuedAt(now).setExpirationTime(now + TOKEN_TTL_SECONDS).setNotBefore(now)
    .sign(privateKey);
  return { accessToken, expiresIn: TOKEN_TTL_SECONDS, jti };
}

export async function auditCronExecution(params: { prisma: any; tenantId: string; principal: VerifiedCronPrincipal; entryPoint: 'cognitive_pipeline' | 'glm_cerebro'; action: 'allow' | 'block' | 'error'; matchedRule?: string; latencyMs: number; policyId?: string; severity?: string; errorDetail?: string; }): Promise<void> {
  try {
    if (!params.prisma?.policyAudit) return;
    await params.prisma.policyAudit.create({ data: { tenantId: params.tenantId, policyId: params.policyId || 'cron-m2m-auth', policyVersion: 'v1', severity: params.severity || (params.action === 'allow' ? 'info' : 'warning'), action: params.action, source: 'internal', entryPoint: params.entryPoint, matchedRule: params.matchedRule || `m2m:cron:${params.principal.scope}`, latencyMs: Math.round(params.latencyMs), rawPayloadSummary: JSON.stringify({ clientId: params.principal.clientId, scope: params.principal.scope, jti: params.principal.jti }) } });
  } catch {
    // Audit failure must not leak details into application logs.
  }
}
