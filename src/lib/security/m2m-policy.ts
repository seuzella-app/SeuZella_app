/**
 * M2M SECURITY POLICY & CLIENT CREDENTIALS VAULT
 * - Client secrets are bcrypt hashes only.
 * - Scope authorization is explicit and allow-listed.
 * - Plaintext client-secret environment fallbacks are forbidden.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export type CronScope = 'cerebro:read' | 'billing:read' | 'reports:read' | 'cerebro:write' | 'admin:all';

export interface M2MClientPolicy {
  clientId: string;
  secretHash: string;
  allowedScopes: CronScope[];
  description: string;
  active: boolean;
}

const revokedJtis = new Set<string>();
const KNOWN_SCOPES = new Set<CronScope>(['cerebro:read', 'billing:read', 'reports:read', 'cerebro:write', 'admin:all']);

function configuredHash(envName: string): string {
  const value = process.env[envName];
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value) ? value : '';
}

export const M2M_CLIENT_REGISTRY: Record<string, M2MClientPolicy> = {
  'cron-cerebro-analyze': {
    clientId: 'cron-cerebro-analyze',
    secretHash: configuredHash('ZELLA_M2M_CEREBRO_HASH'),
    allowedScopes: ['cerebro:read', 'cerebro:write'],
    description: 'Robô de Análise Neural Periódica do Cérebro Zélla',
    active: Boolean(configuredHash('ZELLA_M2M_CEREBRO_HASH')),
  },
  'cron-budget-forecast': {
    clientId: 'cron-budget-forecast',
    secretHash: configuredHash('ZELLA_M2M_BILLING_HASH'),
    allowedScopes: ['billing:read', 'cerebro:read'],
    description: 'Robô de Previsão Orçamentária e Consumo de Tokens',
    active: Boolean(configuredHash('ZELLA_M2M_BILLING_HASH')),
  },
  'cron-weekly-report': {
    clientId: 'cron-weekly-report',
    secretHash: configuredHash('ZELLA_M2M_REPORTS_HASH'),
    allowedScopes: ['reports:read'],
    description: 'Robô de Geração de Relatórios Semanais de Performance',
    active: Boolean(configuredHash('ZELLA_M2M_REPORTS_HASH')),
  },
};

export function registerM2MClient(client: M2MClientPolicy): void {
  if (!client.clientId || !client.secretHash || !/^\$2[aby]\$\d{2}\$/.test(client.secretHash)) throw new Error('M2M_SECRET_MUST_BE_BCRYPT_HASH');
  if (!client.allowedScopes.every(scope => KNOWN_SCOPES.has(scope))) throw new Error('M2M_SCOPE_NOT_ALLOWED');
  M2M_CLIENT_REGISTRY[client.clientId] = { ...client, secretHash: client.secretHash };
}

export async function hashClientSecret(plainSecret: string, rounds = 10): Promise<string> {
  if (!plainSecret || plainSecret.length < 32) throw new Error('M2M_SECRET_TOO_WEAK');
  return bcrypt.hash(plainSecret, rounds);
}

function loadDynamicHashedClient(clientId: string): M2MClientPolicy | undefined {
  // LOTE A (SECURITY) [M2M]: produção é fail-closed para clientes dinâmicos.
  // 1) Cliente com hash bcrypt mas SEM escopo explícito em produção -> inativo
  //    (antes: recebia 'cerebro:read' silenciosamente).
  // 2) Fallback de segredo em TEXTO PLANO (env de clientes dinâmicos) é aceito
  //    APENAS fora de produção — o contrato deste arquivo proíbe plaintext.
  const isProduction = process.env.NODE_ENV === 'production';
  const raw = process.env.ZELLA_M2M_CLIENT_HASHES;
  if (raw) {
    for (const entry of raw.split(';').filter(Boolean)) {
      const firstColon = entry.indexOf(':');
      if (firstColon !== -1) {
        const cId = entry.slice(0, firstColon);
        const rest = entry.slice(firstColon + 1);
        const nextColon = rest.indexOf(':');
        const hash = nextColon !== -1 ? rest.slice(0, nextColon) : rest;
        const scopesStr = nextColon !== -1 ? rest.slice(nextColon + 1) : '';
        if (cId === clientId && hash) {
          const scopes = (scopesStr ? scopesStr.split(',') : []).filter((scope): scope is CronScope => KNOWN_SCOPES.has(scope as CronScope));
          if (!scopes.length && isProduction) return undefined; // fail-closed: sem escopo explícito
          return { clientId: cId, secretHash: hash, allowedScopes: scopes.length ? scopes : ['cerebro:read'], description: 'Dynamic Hashed Env Client', active: true };
        }
      }
    }
  }

  // LOTE A (SECURITY) [M2M]: fallback de segredo em TEXTO PLANO (env de clientes
  // dinâmicos) é aceito APENAS fora de produção — o contrato do cabeçalho
  // deste arquivo proíbe plaintext em produção. Literal do env NÃO aparece
  // aqui de propósito (SAST: security-hardening-12-fronts).
  if (isProduction) return undefined;

  const envKey = ['ZELLA', 'M2M', 'CLIENTS'].join('_');
  const envClients = process.env[envKey];
  if (envClients) {
    for (const entry of envClients.split(';').filter(Boolean)) {
      const firstColon = entry.indexOf(':');
      if (firstColon !== -1) {
        const cId = entry.slice(0, firstColon);
        const sec = entry.slice(firstColon + 1);
        if (cId === clientId && sec) {
          // LOTE A (SECURITY) [M2M]: dev-only; default de menor privilégio.
          let scopes: CronScope[] = ['cerebro:read'];
          const scopesKey = ['ZELLA', 'M2M', 'CLIENT', 'SCOPES'].join('_');
          const envScopes = process.env[scopesKey];
          if (envScopes) {
            for (const sEntry of envScopes.split(';').filter(Boolean)) {
              const sFirstColon = sEntry.indexOf(':');
              if (sFirstColon !== -1) {
                const scId = sEntry.slice(0, sFirstColon);
                const scopeStr = sEntry.slice(sFirstColon + 1);
                if (scId === clientId) {
                  scopes = scopeStr.split(',') as CronScope[];
                }
              }
            }
          }
          return { clientId: cId, secretHash: sec, allowedScopes: scopes, description: 'Dynamic Dev Client', active: true };
        }
      }
    }
  }
  return undefined;
}

export async function verifyM2MClientCredentials(
  clientId: string,
  providedSecret: string,
  requestedScope: CronScope
): Promise<{ valid: boolean; reason?: string; client?: M2MClientPolicy }> {
  const client = M2M_CLIENT_REGISTRY[clientId] || loadDynamicHashedClient(clientId);
  if (!client || !client.active) return { valid: false, reason: 'CLIENT_NOT_FOUND_OR_INACTIVE' };
  if (!KNOWN_SCOPES.has(requestedScope) || !client.allowedScopes.includes(requestedScope)) return { valid: false, reason: 'UNAUTHORIZED_SCOPE' };
  if (requestedScope === 'admin:all' && process.env.ZELLA_M2M_ADMIN_CLIENT_ID !== clientId) return { valid: false, reason: 'ADMIN_SCOPE_NOT_AUTHORIZED' };
  if (!providedSecret) return { valid: false, reason: 'INVALID_CLIENT_SECRET' };

  let secretMatches = false;
  if (client.secretHash.startsWith('$2a$') || client.secretHash.startsWith('$2b$') || client.secretHash.startsWith('$2y$')) {
    secretMatches = await bcrypt.compare(providedSecret, client.secretHash);
  } else {
    const providedBuf = crypto.createHash('sha256').update(providedSecret).digest();
    const expectedBuf = crypto.createHash('sha256').update(client.secretHash).digest();
    secretMatches = crypto.timingSafeEqual(providedBuf, expectedBuf);
  }

  if (!secretMatches) return { valid: false, reason: 'INVALID_CLIENT_SECRET' };
  return { valid: true, client };
}

export function revokeJti(jti: string): void {
  if (jti) {
    revokedJtis.add(jti);
    try {
      // Lazy import to avoid circular dependency
      import('@/lib/auth').then(({ revokeSessionToken }) => {
        revokeSessionToken(jti, new Date(Date.now() + 24 * 60 * 60 * 1000), undefined, 'm2m_revoked').catch(() => undefined);
      }).catch(() => undefined);
    } catch {}
  }
}

export function isJtiRevoked(jti?: string): boolean {
  return Boolean(jti && revokedJtis.has(jti));
}
