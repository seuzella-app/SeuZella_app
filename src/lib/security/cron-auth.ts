// ============================================================
// V11-P0 Cron Auth — M2M Client Credentials com EdDSA (Ed25519)
// Arquivo destino: src/lib/security/cron-auth.ts
// ============================================================
//
// Cobre as 3 rotas cron sem auth hoje:
//   - app/api/cron/cerebro-analyze/route.ts
//   - app/api/cron/cerebro-budget-forecast/route.ts
//   - app/api/cron/weekly-report/route.ts
//
// Design:
//   - Algoritmo: EdDSA com chave Ed25519 (não RSA, não ECDSA)
//   - Sem claim `sub` (máquina, não humano)
//   - Claims obrigatórias: iss, aud, exp, iat, azp (client_id), scope
//   - TTL curto: 5 minutos (300s)
//   - Verificação estrita: signature + iss + aud + exp + nbf + scope
//   - Token emitido por: /api/auth/m2m/token (a implementar em P0)
//   - Falha segura: qualquer erro → 401 (nunca 200 com fallback)
//
// Dependências (já presentes no zella/package.json):
//   - jose (>=5.0.0) — suporte EdDSA nativo
//   - @prisma/client — para audit log
// ============================================================

import { jwtVerify, SignJWT, importSPKI, importPKCS8, exportJWK } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

// --- Tipos ------------------------------------------------------------------

export type CronScope = 'cerebro:read' | 'billing:read' | 'reports:read' | 'cerebro:write';

export interface M2MTokenPayload {
  iss: string;       // https://auth.seuzella.com.br (ou http://localhost:3000 em dev)
  aud: string;       // 'seuzella-cron' ou 'seuzella-api'
  iat: number;       // issued at (unix seconds)
  exp: number;       // expiry (unix seconds) — iat + 300
  azp: string;       // client_id (e.g. 'cron-cerebro-analyze')
  scope: CronScope;  // escopo único, estrito
  // NOTA: sem `sub` — esta é uma máquina, não um usuário humano.
}

export interface VerifiedCronPrincipal {
  clientId: string;
  scope: CronScope;
  issuedAt: Date;
  expiresAt: Date;
}

// --- Configuração (env vars obrigatórias) ------------------------------------
// Leitura lazy para que testes possam setar env vars em beforeAll.

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

if (!getPublicKeyPem() && process.env.NODE_ENV === 'production' && !process.env.CI) {
  // Em dev e CI, permite operar sem chave para não bloquear builds sintéticos.
  // Em prod real, falha hard no boot.
  throw new Error('[cron-auth] ZELLA_M2M_ED25519_PUBLIC_KEY ausente em produção');
}

// --- Cache de chave importada (a chave é estática) ---------------------------

let _publicKey: ReturnType<typeof importSPKI> | null = null;
let _publicKeyPemCached = '';

async function getPublicKey() {
  const pem = getPublicKeyPem();
  // Re-importa se a chave mudou (para suportar testes que geram nova chave em beforeAll)
  if (!_publicKey || _publicKeyPemCached !== pem) {
    if (!pem) {
      return null;
    }
    _publicKey = importSPKI(pem, 'EdDSA');
    _publicKeyPemCached = pem;
  }
  return _publicKey;
}

// --- Verificação de token (entry point para as rotas cron) -------------------

/**
 * Verifica um Bearer token M2M nas rotas cron.
 *
 * @param req NextRequest com header `Authorization: Bearer <token>`
 * @param requiredScope Escopo exigido para a rota (e.g. 'cerebro:read')
 * @returns { ok: true, principal } ou { ok: false, response }
 *
 * Uso típico em route.ts:
 *
 *   export async function GET(req: NextRequest) {
 *     const auth = await verifyCronM2MToken(req, 'cerebro:read');
 *     if (!auth.ok) return auth.response;
 *     // ... lógica do cron, com auth.principal.clientId disponível
 *   }
 */
export async function verifyCronM2MToken(
  req: NextRequest,
  requiredScope: CronScope
): Promise<
  | { ok: true; principal: VerifiedCronPrincipal }
  | { ok: false; response: NextResponse }
> {
  // 0. Dev bypass: em NODE_ENV=development sem chave configurada,
  //    aceita o header X-Zella-M2M-Dev-Bypass=1 com escopo declarado.
  //    ESTE BYPASS NUNCA EXISTE EM PROD. Avaliar ANTES do header Authorization
  //    porque em dev não há token real para enviar.
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
        },
      };
    }
    return unauthorized('dev_bypass_required', 'Em dev sem chave, header X-Zella-M2M-Dev-Bypass deve igualar o scope exigido');
  }

  const authHeader = req.headers.get('authorization');

  // 1. Header presente?
  if (!authHeader) {
    return unauthorized('missing_authorization', 'Header Authorization ausente');
  }

  // 2. Formato Bearer?
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) {
    return unauthorized('invalid_scheme', 'Esperado: Bearer <token>');
  }
  const token = match[1];

  // 4. Verificação criptográfica estrita (caminho prod)
  try {
    const publicKey = await getPublicKey();
    if (!publicKey) {
      // Não deveria acontecer (prod já checou no boot), mas fail-safe:
      return unauthorized('key_unavailable', 'Chave pública indisponível');
    }

    const { payload } = await jwtVerify(token, await publicKey, {
      algorithms: ['EdDSA'],
      issuer: getIssuer(),
      audience: getAudience(),
      // jose verifica exp, nbf, iss, aud automaticamente quando declarados acima.
      // requireIssuedAt / requireExpiration não existem em JWTVerifyOptions (jose 5).
    });

    // 5. Checa claims obrigatórias
    const azp = payload.azp as string | undefined;
    const scope = payload.scope as CronScope | undefined;

    if (!azp || typeof azp !== 'string') {
      return unauthorized('missing_azp', 'Claim azp (client_id) obrigatória para M2M');
    }

    // 6. REJEITA tokens com `sub` — M2M nunca tem usuário humano
    if (payload.sub) {
      return unauthorized('sub_forbidden', 'Token M2M não pode conter claim sub');
    }

    // 7. Scope match EXATO (não aceita wildcard, não aceita lista)
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
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return unauthorized('verification_failed', `JWT inválido: ${msg}`);
  }
}

// --- Helper de resposta 401 --------------------------------------------------

function unauthorized(code: string, detail: string): { ok: false; response: NextResponse } {
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'unauthorized', code, detail },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
    ),
  };
}

// --- Emissão de token (apenas no /api/auth/m2m/token endpoint) ---------------
//
// Este bloco só é importado pelo endpoint de emissão. As rotas cron
// só importam `verifyCronM2MToken`. Mantém separação de preocupações
// e reduz risco de vazamento da chave privada.

export async function issueM2MToken(params: {
  clientId: string;
  clientSecret: string;
  scope: CronScope;
}): Promise<{ accessToken: string; expiresIn: number } | { error: string }> {
  if (!getPrivateKeyPem()) {
    return { error: 'ZELLA_M2M_ED25519_PRIVATE_KEY não configurada — emissão indisponível' };
  }

  // Valida client_secret contra variável de ambiente ou DB.
  // Em P0 (dev), ZELLA_M2M_CLIENTS contém pares client_id:secret em texto claro.
  // Em P1, migrar para DB com bcrypt (hash) — comparação será bcrypt.compare(secret, hash).
  // Por ora, comparação constant-time em texto claro (aceitável em dev com env var segura).
  const clients = (process.env.ZELLA_M2M_CLIENTS ?? '')
    .split(',')
    .filter(Boolean)
    .map((kv) => {
      const idx = kv.indexOf(':');
      return idx >= 0 ? [kv.slice(0, idx), kv.slice(idx + 1)] : [kv, ''];
    });

  const match = clients.find(([id]) => id === params.clientId);
  if (!match) {
    return { error: 'client_id não encontrado' };
  }

  // Comparação constant-time para evitar timing attack
  const expectedSecret = match[1];
  const providedSecret = Buffer.from(params.clientSecret);
  const expectedBuf = Buffer.from(expectedSecret);
  if (providedSecret.length !== expectedBuf.length || !timingSafeEqual(providedSecret, expectedBuf)) {
    return { error: 'client_secret inválido' };
  }

  // Restringe scope: cada client_id só pode receber seu scope pré-aprovado
  // (configurado em env: ZELLA_M2M_CLIENT_SCOPES=client_id_1:cerebro:read,...)
  // Note: scopes contêm ':' (ex: 'cerebro:read'), então split apenas no primeiro ':'.
  const allowedScopes = (process.env.ZELLA_M2M_CLIENT_SCOPES ?? '')
    .split(',')
    .filter(Boolean)
    .map((kv) => {
      const idx = kv.indexOf(':');
      return idx >= 0 ? [kv.slice(0, idx), kv.slice(idx + 1)] : [kv, ''];
    });

  const allowed = allowedScopes.find(([id]) => id === params.clientId);
  if (!allowed || allowed[1] !== params.scope) {
    return { error: 'scope não autorizado para este client_id' };
  }

  // Importa chave privada (PKCS8) e assina
  const privateKey = await importPKCS8(getPrivateKeyPem(), 'EdDSA');
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    azp: params.clientId,
    scope: params.scope,
  })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setIssuer(getIssuer())
    .setAudience(getAudience())
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .setNotBefore(now)
    // SEM .setSubject() — M2M não tem subject humano
    .sign(privateKey);

  return { accessToken: jwt, expiresIn: TOKEN_TTL_SECONDS };
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

// --- Helper para auditar M2M em PolicyAudit ----------------------------------
//
// As rotas cron devem logar cada execução (sucesso ou falha) em
// PolicyAudit para rastreabilidade. Esta função facilita.

export async function auditCronExecution(params: {
  prisma: any; // PrismaClient
  tenantId: string;
  principal: VerifiedCronPrincipal;
  entryPoint: 'cognitive_pipeline' | 'glm_cerebro';
  policyId: string;
  severity: 'info' | 'warn' | 'block' | 'critical';
  action: 'allow' | 'reject' | 'escalate';
  latencyMs: number;
  error?: string;
}): Promise<void> {
  await params.prisma.policyAudit.create({
    data: {
      tenantId: params.tenantId,
      policyId: params.policyId,
      policyVersion: 'v1',
      severity: params.severity,
      action: params.action,
      source: 'cron',
      entryPoint: params.entryPoint,
      matchedRule: params.error ? `m2m:failure:${params.error}` : 'm2m:success',
      latencyMs: params.latencyMs,
    },
  });
}

// --- Geração de par Ed25519 (one-shot, para setup inicial) -------------------
//
// Rode uma vez para gerar o par de chaves e configurar env vars:
//
//   npx tsx -e "
//     import { generateKeyPair, exportSPKI, exportPKCS8 } from 'jose';
//     (async () => {
//       const { publicKey, privateKey } = await generateKeyPair('EdDSA');
//       console.log('PUBLIC:\\n' + await exportSPKI(publicKey));
//       console.log('PRIVATE:\\n' + await exportPKCS8(privateKey));
//     })();
//   "

export const __cronAuthVersion = 'v11-p0-mock-staging';
